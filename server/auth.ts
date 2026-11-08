/**
 * Authentication, admin checks, subscription status and per-user daily quotas.
 * Every endpoint that spends AI tokens goes through `requireUser` + `consumeQuota`.
 */
import type { Request, Response, NextFunction } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getDb } from "./firebaseAdmin.js";
import { config } from "./config.js";

export interface AuthedUser {
  uid: string;
  email?: string;
  isAnonymous: boolean;
  isAdmin: boolean;
  /** Salted hash of the caller's IP address (never the raw IP), for per-device limits. */
  ipKey?: string;
}

/**
 * The caller's real IP. On Vercel `x-real-ip` / `x-vercel-forwarded-for` are set by the
 * platform and cannot be forged by the browser; other headers are only a fallback.
 */
export function clientIp(req: Request): string {
  const h = (name: string) => String(req.headers[name] || "").split(",")[0].trim();
  return h("x-real-ip") || h("x-vercel-forwarded-for") || h("x-forwarded-for") || req.ip || "unknown";
}

/** A salted, one-way hash of the IP so we can count per device without storing IP addresses. */
export function ipKeyOf(req: Request): string {
  return createHash("sha256")
    .update(`${config.ledgerSecret || "arthashastra"}|${clientIp(req)}`)
    .digest("hex")
    .slice(0, 32);
}

/** Compares secrets in constant time (no timing leaks). */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export interface AuthedRequest extends Request {
  user?: AuthedUser;
}

export class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message || code);
  }
}

/** Returns the signed-in user for this request, or null. */
export async function decode(req: Request): Promise<AuthedUser | null> {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  const auth = getAdminAuth();
  if (!auth || !token) return null;
  try {
    const decoded = await auth.verifyIdToken(token);
    const email = (decoded.email || "").toLowerCase() || undefined;
    return {
      uid: decoded.uid,
      email,
      isAnonymous: decoded.firebase?.sign_in_provider === "anonymous",
      ipKey: ipKeyOf(req),
      isAdmin:
        decoded.admin === true ||
        (!!email && decoded.email_verified === true && config.adminEmails.includes(email)),
    };
  } catch {
    return null;
  }
}

/** Express middleware: rejects requests without a valid Firebase ID token. */
export function requireUser(req: AuthedRequest, res: Response, next: NextFunction) {
  decode(req)
    .then((user) => {
      if (!user) return res.status(401).json({ error: "Please sign in first.", code: "AUTH_REQUIRED" });
      req.user = user;
      next();
    })
    .catch(next);
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  requireUser(req, res, () => {
    if (!req.user?.isAdmin) return res.status(403).json({ error: "Admins only.", code: "FORBIDDEN" });
    next();
  });
}

/** Subscription is active only while subscriptionExpiresAt is in the future. */
export async function isSubscribed(uid: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const snap = await db.collection("users").doc(uid).get();
  const exp = snap.exists ? snap.get("subscriptionExpiresAt") : null;
  return typeof exp === "string" && Date.parse(exp) > Date.now();
}

const today = () => new Date().toISOString().slice(0, 10);

/** Gives back quota when the AI failed before answering, so users are not charged for errors. */
export async function refundQuota(user: AuthedUser, cost = 1): Promise<void> {
  if (user.isAdmin) return;
  const db = getDb();
  if (!db) return;
  const dec = { count: FieldValue.increment(-cost) };
  await Promise.all([
    db.collection("usage").doc(`${user.uid}_${today()}`).update(dec).catch(() => {}),
    user.ipKey ? db.collection("usage_ip").doc(`${user.ipKey}_${today()}`).update(dec).catch(() => {}) : null,
    db.collection("system").doc(`ai_budget_${today()}`).update(dec).catch(() => {}),
  ]);
}

/**
 * Atomically counts one AI request against the user's daily limit.
 * Throws HttpError(429, "DAILY_LIMIT") when the limit is reached.
 */
export async function consumeQuota(user: AuthedUser, cost = 1): Promise<{ used: number; limit: number }> {
  if (user.isAdmin) return { used: 0, limit: Infinity };
  const db = getDb();
  // Without a database we cannot count, so we refuse rather than allow unlimited use.
  if (!db) throw new HttpError(503, "DATABASE_UNAVAILABLE", "Service is not fully configured yet.");

  const subscribed = !user.isAnonymous && (await isSubscribed(user.uid));
  const limit = user.isAnonymous
    ? config.limits.anonymous
    : subscribed
      ? config.limits.subscriber
      : config.limits.free;

  // 1) Whole-site safety cap: protects the AI bill from floods and runaway bugs.
  const budgetRef = db.collection("system").doc(`ai_budget_${today()}`);
  const budget = await budgetRef.get();
  if (((budget.exists ? (budget.get("count") as number) : 0) || 0) + cost > config.limits.globalDaily) {
    console.error("[quota] global daily AI cap reached:", config.limits.globalDaily);
    throw new HttpError(503, "DAILY_CAPACITY", "Arthashastra has reached today's capacity. Please come back tomorrow.");
  }

  const ref = db.collection("usage").doc(`${user.uid}_${today()}`);
  // 2) Per-device cap for guests: new anonymous accounts are free to create, so the
  //    limit must follow the device (hashed IP), not just the account.
  const ipRef = user.isAnonymous && user.ipKey ? db.collection("usage_ip").doc(`${user.ipKey}_${today()}`) : null;
  const used = await db.runTransaction(async (tx) => {
    const [snap, ipSnap] = await Promise.all([tx.get(ref), ipRef ? tx.get(ipRef) : Promise.resolve(null)]);
    if (ipRef && ipSnap) {
      const ipUsed = ipSnap.exists ? (ipSnap.get("count") as number) || 0 : 0;
      if (ipUsed + cost > config.limits.anonymousPerDevice) {
        throw new HttpError(429, "DAILY_LIMIT", "Daily guest limit reached on this device. Sign in with Google for more questions.");
      }
      tx.set(ipRef, { date: today(), count: ipUsed + cost, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    const current = snap.exists ? (snap.get("count") as number) || 0 : 0;
    if (current + cost > limit) {
      throw new HttpError(
        429,
        "DAILY_LIMIT",
        user.isAnonymous
          ? "Daily limit reached. Sign in with Google for more questions."
          : subscribed
            ? "Daily limit reached. Please come back tomorrow."
            : "Daily free limit reached. Subscribe for more, or come back tomorrow.",
      );
    }
    tx.set(
      ref,
      { uid: user.uid, date: today(), count: current + cost, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return current + cost;
  });
  await budgetRef.set({ date: today(), count: FieldValue.increment(cost) }, { merge: true });
  return { used, limit };
}

/**
 * Small in-memory burst limiter (per server instance) as a first line of
 * defence against floods, before any database or AI work happens.
 */
const hits = new Map<string, number[]>();
export function burstLimit(maxPerMinute: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = clientIp(req);
    // Separate bucket per route, so heavy chat use does not block other features.
    const key = `${req.baseUrl}${req.path}|${ip}`;
    const now = Date.now();
    const recent = (hits.get(key) || []).filter((t) => now - t < 60_000);
    if (recent.length >= maxPerMinute) {
      return res.status(429).json({ error: "Too many requests. Slow down a little.", code: "RATE_LIMITED" });
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 10_000) hits.clear();
    next();
  };
}
