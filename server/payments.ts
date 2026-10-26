/**
 * Razorpay payments.
 *  - Orders always carry the buyer's verified user id.
 *  - Activation happens from TWO independent paths (browser verify + webhook);
 *    both verify signatures and are idempotent, so a payment is never lost or doubled.
 *  - Subscriptions expire; access is checked against the expiry date.
 */
import crypto from "crypto";
import Razorpay from "razorpay";
import { FieldValue } from "firebase-admin/firestore";
import { config } from "./config.js";
import { requireDb } from "./firebaseAdmin.js";
import { HttpError } from "./auth.js";
import { appendBlock } from "./ledger.js";

let rzp: Razorpay | null = null;
export const paymentsConfigured = () => !!(config.razorpay.keyId && config.razorpay.keySecret);

function client(): Razorpay {
  if (!paymentsConfigured()) {
    throw new HttpError(503, "PAYMENTS_UNCONFIGURED", "Payments are not set up yet.");
  }
  if (!rzp) rzp = new Razorpay({ key_id: config.razorpay.keyId, key_secret: config.razorpay.keySecret });
  return rzp;
}

function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

export async function createOrder(uid: string) {
  const order = await client().orders.create({
    amount: config.razorpay.pricePaise,
    currency: "INR",
    receipt: `aw_${uid.slice(0, 12)}_${Date.now()}`.slice(0, 40),
    notes: { userId: uid, planId: "absolute_witness" },
  });
  return {
    id: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: config.razorpay.keyId,
  };
}

/** Records the payment and extends the subscription. Safe to call more than once. */
export async function activate(uid: string, paymentId: string, orderId: string, amount: number, via: string) {
  const db = requireDb();
  const paymentRef = db.collection("payments").doc(paymentId);
  const userRef = db.collection("users").doc(uid);
  const subRef = db.collection("subscriptions").doc(uid);

  const result = await db.runTransaction(async (tx) => {
    const [p, u] = await Promise.all([tx.get(paymentRef), tx.get(userRef)]);
    if (p.exists) return { alreadyProcessed: true, expiresAt: u.get("subscriptionExpiresAt") as string };
    const currentExp = u.exists ? Date.parse(u.get("subscriptionExpiresAt") || "") : NaN;
    const base = Number.isFinite(currentExp) && currentExp > Date.now() ? currentExp : Date.now();
    const expiresAt = new Date(base + config.razorpay.periodDays * 86_400_000).toISOString();
    tx.set(paymentRef, {
      userId: uid,
      paymentId,
      orderId,
      amount,
      currency: "INR",
      status: "captured",
      via,
      createdAt: new Date().toISOString(),
    });
    tx.set(userRef, { uid, isSubscribed: true, subscriptionExpiresAt: expiresAt, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(subRef, { userId: uid, status: "active", plan: "absolute_witness", expiresAt, lastPaymentId: paymentId });
    return { alreadyProcessed: false, expiresAt };
  });

  if (!result.alreadyProcessed) {
    // Audit trail: no personal data, only ids and amount.
    await appendBlock(`Payment ${paymentId} for order ${orderId}: ₹${(amount / 100).toFixed(2)} — subscription active until ${result.expiresAt}`, "payments_gatekeeper", "Payments");
  }
  return result;
}

/** Called by the browser after Razorpay Checkout succeeds. */
export async function verifyCheckout(
  uid: string,
  body: { razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string },
) {
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = body;
  if (!orderId || !paymentId || !signature) throw new HttpError(400, "BAD_REQUEST", "Missing payment details.");
  const expected = crypto.createHmac("sha256", config.razorpay.keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  if (!safeEqualHex(expected, signature)) throw new HttpError(400, "BAD_SIGNATURE", "Payment signature did not match.");

  const r = client();
  const order: any = await r.orders.fetch(orderId);
  if (order?.notes?.userId !== uid) throw new HttpError(403, "WRONG_USER", "This payment belongs to a different account.");
  let payment: any = await r.payments.fetch(paymentId);
  if (payment.order_id !== orderId) throw new HttpError(400, "ORDER_MISMATCH", "Payment does not match the order.");
  if (payment.status === "authorized") {
    payment = await r.payments.capture(paymentId, payment.amount, payment.currency);
  }
  if (payment.status !== "captured") throw new HttpError(402, "NOT_CAPTURED", `Payment status is ${payment.status}.`);
  if (Number(payment.amount) < config.razorpay.pricePaise) throw new HttpError(400, "AMOUNT_MISMATCH", "Payment amount is too low.");
  return activate(uid, paymentId, orderId, Number(payment.amount), "checkout");
}

/** Razorpay server-to-server webhook. `raw` must be the exact request bytes. */
export async function handleWebhook(raw: Buffer, signature: string | undefined): Promise<string> {
  if (!config.razorpay.webhookSecret) throw new HttpError(503, "WEBHOOK_UNCONFIGURED", "Webhook secret is not set.");
  if (!signature) throw new HttpError(400, "BAD_SIGNATURE", "Missing signature.");
  const expected = crypto.createHmac("sha256", config.razorpay.webhookSecret).update(raw).digest("hex");
  if (!safeEqualHex(expected, signature)) throw new HttpError(400, "BAD_SIGNATURE", "Invalid signature.");

  const evt = JSON.parse(raw.toString("utf8"));
  if (evt.event !== "payment.captured" && evt.event !== "order.paid") return "ignored";

  const payment = evt.payload?.payment?.entity;
  const orderEntity = evt.payload?.order?.entity;
  if (!payment?.id || payment.status !== "captured") return "ignored";
  const orderId = payment.order_id || orderEntity?.id;
  let uid: string | undefined = orderEntity?.notes?.userId || payment.notes?.userId;
  if (!uid && orderId && paymentsConfigured()) {
    const order: any = await client().orders.fetch(orderId);
    uid = order?.notes?.userId;
  }
  if (!uid) {
    console.error(`[webhook] payment ${payment.id} has no userId; needs manual review.`);
    return "no_user";
  }
  if (Number(payment.amount) < config.razorpay.pricePaise) return "amount_too_low";
  await activate(uid, payment.id, orderId || "", Number(payment.amount), "webhook");
  return "activated";
}
