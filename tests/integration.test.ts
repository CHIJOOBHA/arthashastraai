/**
 * End-to-end server tests against the Firebase Auth + Firestore emulators,
 * with a fake Gemini and a fake Razorpay. Runs in CI (see .github/workflows/ci.yml):
 *   npx firebase-tools emulators:exec --only auth,firestore --project demo-arthashastra "npx tsx --test tests/integration.test.ts"
 * Skipped automatically when the emulators are not running.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

const EMU = process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST;
const skip = !EMU ? "Firebase emulators not running" : false;

process.env.NODE_ENV = "test";
process.env.GCLOUD_PROJECT = "demo-arthashastra";
process.env.FIREBASE_PROJECT_ID = "demo-arthashastra";
process.env.FIREBASE_DATABASE_ID = "(default)";
process.env.GEMINI_API_KEY = "";
process.env.RAZORPAY_KEY_ID = "rzp_test_key";
process.env.RAZORPAY_KEY_SECRET = "test_key_secret";
process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret";
process.env.AITIHYA_SIGNING_SECRET = "test_ledger_secret";
process.env.CRON_SECRET = "test_cron_secret";
process.env.DAILY_LIMIT_ANONYMOUS = "2";
process.env.DAILY_LIMIT_FREE = "4";
process.env.ADMIN_EMAILS = "";

let request: any, app: any, db: any;

// ---------- fakes ----------
const fakeSources = [
  { web: { uri: "https://www.reuters.com/a", title: "reuters.com" } },
  { web: { uri: "https://www.rbi.org.in/b", title: "rbi.org.in" } },
];
function fakeResponse(text: string, grounded: boolean) {
  return {
    text,
    candidates: [
      {
        groundingMetadata: grounded
          ? {
              groundingChunks: fakeSources,
              webSearchQueries: ["bank fees 2026"],
              groundingSupports: [{ segment: { text: "Evidence shows the fee is real." }, groundingChunkIndices: [0, 1] }],
            }
          : undefined,
      },
    ],
  };
}
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
function answerFor(prompt: string): string {
  if (prompt.includes("Search the web for up to 3 recent reports")) {
    return JSON.stringify([
      { headline: "Bank fined for hidden card fees", whatHappened: "Regulator fined Bank X 5 million for undisclosed fees.", country: "UK", date: daysAgo(5), sourceUrl: "https://www.reuters.com/a" },
      { headline: "Made-up story", whatHappened: "Something unverifiable.", country: "Nowhere", date: daysAgo(3), sourceUrl: "https://www.reuters.com/z" },
      { headline: "Invented source", whatHappened: "Cites a page that was never retrieved.", country: "X", date: daysAgo(2), sourceUrl: "https://not-retrieved.example/x" },
      { headline: "Stale story", whatHappened: "Too old.", country: "X", date: daysAgo(400), sourceUrl: "https://www.reuters.com/old" },
    ]);
  }
  if (prompt.includes("Fact-check each claim below")) {
    return JSON.stringify([
      { index: 0, verdict: "corrected", correctedText: "Regulator fined Bank X 4.8 million for undisclosed card fees.", sourceUrls: ["https://www.rbi.org.in/b"], note: "Fine was 4.8 million, not 5 million." },
      { index: 1, verdict: "unverified", sourceUrls: [], note: "No source found." },
    ]);
  }
  if (prompt.includes("Explain each verified report below")) {
    return JSON.stringify([{ index: 0, direction: "protection", effectOnPeople: "Customers may get refunds of fees they were never told about.", otherSide: "The bank says the fees were in its terms.", whatYouCanDo: "Check statements and complain to the ombudsman.", severity: "High" }]);
  }
  if (prompt.includes("Write the Gazette")) {
    return JSON.stringify({
      headline: "Fees, fines and food prices",
      summary: "Three stories.",
      stories: [{ title: "Bank fined", whatHappened: "A bank was fined.", effectOnPeople: "Customers may get refunds.", region: "UK", date: daysAgo(1), sourceUrl: "https://www.reuters.com/a" }],
    });
  }
  return "Evidence shows the fee is real.\n\n**Counter-Tweet:** Check your statement.";
}
const promptOf = (args: any) => JSON.stringify(args.contents);
const fakeGemini = {
  models: {
    async generateContent(args: any) {
      return fakeResponse(answerFor(promptOf(args)), !!args.config?.tools);
    },
    async generateContentStream(args: any) {
      const text = answerFor(promptOf(args));
      const grounded = !!args.config?.tools;
      return (async function* () {
        yield fakeResponse(text.slice(0, 10), false);
        yield fakeResponse(text.slice(10), grounded);
      })();
    },
  },
};
const orders = new Map<string, any>();
const payments = new Map<string, any>();
const fakeRazorpay = {
  orders: {
    async create(o: any) {
      const id = `order_${orders.size + 1}`;
      orders.set(id, { id, ...o });
      return { id, ...o };
    },
    async fetch(id: string) {
      return orders.get(id);
    },
  },
  payments: {
    async fetch(id: string) {
      return payments.get(id);
    },
    async capture(id: string) {
      const p = { ...payments.get(id), status: "captured" };
      payments.set(id, p);
      return p;
    },
  },
};

// ---------- auth emulator helpers ----------
async function signUp(email?: string): Promise<{ token: string; uid: string }> {
  const base = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`;
  const body = email ? { email, password: "password123", returnSecureToken: true } : { returnSecureToken: true };
  const r = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j: any = await r.json();
  return { token: j.idToken, uid: j.localId };
}

before(async () => {
  if (skip) return;
  ({ default: request } = await import("supertest"));
  const { createApp } = await import("../server/app.ts");
  const { __setAiClientForTests } = await import("../server/ai.ts");
  const { __setRazorpayForTests } = await import("../server/payments.ts");
  const { getDb } = await import("../server/firebaseAdmin.ts");
  __setAiClientForTests(fakeGemini);
  __setRazorpayForTests(fakeRazorpay);
  app = createApp();
  db = getDb();
});

test("chat streams an answer with real source links appended", { skip }, async () => {
  const u = await signUp("chat@example.com");
  const res = await request(app).post("/api/chat").set("Authorization", `Bearer ${u.token}`).send({ message: "Are my bank fees fair?", language: "English" });
  assert.equal(res.status, 200);
  assert.match(res.text, /Evidence shows the fee is real/);
  assert.match(res.text, /\*\*Sources\*\*/);
  assert.match(res.text, /reuters\.com/);
  // Draft first, then the final answer with inline citations after the marker.
  const final = res.text.split("\u001e")[1];
  assert.ok(final, "final cited answer is sent after the marker");
  assert.match(final, /Evidence shows the fee is real\. \[\[1\]\]\(https:\/\/www\.reuters\.com\/a\)\[\[2\]\]/);
  assert.match(final, /\*\*Counter-Tweet:\*\*/);
});

test("daily quota is enforced per user (anonymous limit 2)", { skip }, async () => {
  const u = await signUp();
  const call = () => request(app).post("/api/chat").set("Authorization", `Bearer ${u.token}`).send({ message: "hi" });
  assert.equal((await call()).status, 200);
  assert.equal((await call()).status, 200);
  const third = await call();
  assert.equal(third.status, 429);
  assert.equal(third.body.code, "DAILY_LIMIT");
});

test("message validation", { skip }, async () => {
  const u = await signUp("validate@example.com");
  const empty = await request(app).post("/api/chat").set("Authorization", `Bearer ${u.token}`).send({ message: "  " });
  assert.equal(empty.status, 400);
  const long = await request(app).post("/api/chat").set("Authorization", `Bearer ${u.token}`).send({ message: "x".repeat(4001) });
  assert.equal(long.body.code, "TOO_LONG");
});

test("agent cycle publishes ONLY independently verified items, with sources, and chains the ledger", { skip }, async () => {
  const res = await request(app).get("/api/cron/run-cycle?budgetMs=200000").set("Authorization", "Bearer test_cron_secret");
  assert.equal(res.status, 200);
  assert.ok(res.body.published >= 1, JSON.stringify(res.body));
  const intel = await db.collection("intelligence").get();
  const headlines = intel.docs.map((d: any) => d.get("headline"));
  assert.ok(headlines.includes("Bank fined for hidden card fees"));
  assert.ok(!headlines.includes("Made-up story"), "unverified item must not be published");
  assert.ok(!headlines.includes("Invented source"), "items citing pages that were never retrieved are dropped");
  assert.ok(!headlines.includes("Stale story"), "old items are dropped");
  const item = intel.docs.find((d: any) => d.get("headline") === "Bank fined for hidden card fees");
  assert.ok(item.get("sources").length >= 1);
  assert.match(item.get("metadata").confidence, /Corrected & confirmed · 2 independent sources/);
  assert.equal(item.get("metadata").direction, "protection");
  // The corrected text (4.8 million) is what gets explained and published, not the collector's 5 million.
  const exp = await db.collection("explanations").doc(item.get("explanationId")).get();
  assert.match(exp.get("content"), /4\.8 million/);
  // The fact-check note may mention the wrong figure; the story text itself must not.
  assert.doesNotMatch(exp.get("content").split("**Fact-check:**")[0], /\b5 million/);

  // Re-running does not duplicate stories.
  await request(app).get("/api/cron/run-cycle?budgetMs=100000").set("Authorization", "Bearer test_cron_secret");
  const again = await db.collection("intelligence").get();
  assert.equal(again.docs.filter((d: any) => d.get("headline") === "Bank fined for hidden card fees").length, 1);

  // Ledger: continuous indexes, each block links to the previous hash, signed.
  const { blockHash, signHash } = await import("../server/ledger.ts");
  const blocks = (await db.collection("ledger").orderBy("index").get()).docs.map((d: any) => d.data());
  assert.ok(blocks.length >= 1);
  blocks.forEach((b: any, i: number) => {
    assert.equal(b.index, i);
    assert.equal(b.previousHash, i === 0 ? "ROOT_ETERNITY" : blocks[i - 1].hash);
    assert.equal(b.hash, blockHash(b.index, b.timestamp, b.data, b.previousHash));
    assert.equal(b.signature, signHash(b.hash));
  });
});

test("explanations: 3 free, then paywall; re-opening is free; subscribers unlimited", { skip }, async () => {
  const ids = ["e1", "e2", "e3", "e4"];
  for (const id of ids) await db.collection("explanations").doc(id).set({ id, content: `## ${id}` });
  const u = await signUp("reader@example.com");
  const get = (id: string) => request(app).get(`/api/explanations/${id}`).set("Authorization", `Bearer ${u.token}`);
  assert.equal((await get("e1")).body.remainingFree, 2);
  assert.equal((await get("e1")).body.remainingFree, 2, "re-opening must not cost a view");
  await get("e2");
  assert.equal((await get("e3")).body.remainingFree, 0);
  const blocked = await get("e4");
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.code, "PAYWALL");
  assert.equal((await get("missing")).status, 404);

  await db.collection("users").doc(u.uid).set({ subscriptionExpiresAt: new Date(Date.now() + 86_400_000).toISOString() }, { merge: true });
  assert.equal((await get("e4")).status, 200);

  // An EXPIRED subscription does not count.
  await db.collection("users").doc(u.uid).set({ subscriptionExpiresAt: new Date(Date.now() - 1000).toISOString() }, { merge: true });
  await db.collection("explanations").doc("e5").set({ id: "e5", content: "x" });
  assert.equal((await get("e5")).status, 403);
});

test("payments: order carries the user, checkout verify activates once, webhook is idempotent", { skip }, async () => {
  const u = await signUp("payer@example.com");
  const auth = { Authorization: `Bearer ${u.token}` };

  const anon = await signUp();
  const anonOrder = await request(app).post("/api/payments/create-order").set("Authorization", `Bearer ${anon.token}`).send({});
  assert.equal(anonOrder.status, 403);

  const order = await request(app).post("/api/payments/create-order").set(auth).send({});
  assert.equal(order.status, 200);
  assert.equal(order.body.amount, 3400);
  assert.equal(orders.get(order.body.id).notes.userId, u.uid);

  payments.set("pay_1", { id: "pay_1", order_id: order.body.id, amount: 3400, currency: "INR", status: "captured" });
  const badSig = await request(app).post("/api/payments/verify").set(auth).send({ razorpay_order_id: order.body.id, razorpay_payment_id: "pay_1", razorpay_signature: "x" });
  assert.equal(badSig.status, 400);

  const sig = crypto.createHmac("sha256", "test_key_secret").update(`${order.body.id}|pay_1`).digest("hex");
  const ok = await request(app).post("/api/payments/verify").set(auth).send({ razorpay_order_id: order.body.id, razorpay_payment_id: "pay_1", razorpay_signature: sig });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  const exp1 = Date.parse(ok.body.expiresAt);
  assert.ok(exp1 > Date.now() + 29 * 86_400_000);

  // Another user cannot claim this payment.
  const thief = await signUp("thief@example.com");
  const stolen = await request(app).post("/api/payments/verify").set("Authorization", `Bearer ${thief.token}`).send({ razorpay_order_id: order.body.id, razorpay_payment_id: "pay_1", razorpay_signature: sig });
  assert.equal(stolen.status, 403);

  // The webhook for the same payment does not extend the subscription twice.
  const evt = Buffer.from(JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1", order_id: order.body.id, amount: 3400, status: "captured", notes: {} } } } }));
  const whSig = crypto.createHmac("sha256", "test_webhook_secret").update(evt).digest("hex");
  const wh = await request(app).post("/api/payments/webhook").set("Content-Type", "application/json").set("x-razorpay-signature", whSig).send(evt.toString());
  assert.equal(wh.status, 200);
  const user = await db.collection("users").doc(u.uid).get();
  assert.equal(Date.parse(user.get("subscriptionExpiresAt")), exp1);

  const me = await request(app).get("/api/me").set(auth);
  assert.equal(me.body.isSubscribed, true);
});

test("arena: only the author can request the verdict; the server writes AI replies", { skip }, async () => {
  const author = await signUp("author@example.com");
  const other = await signUp("other@example.com");
  await db.collection("debates").doc("d1").set({ id: "d1", userId: author.uid, userName: "Citizen-abc", userArgument: "Bank fees are fair.", status: "pending", likesCount: 0, createdAt: new Date() });

  const notAuthor = await request(app).post("/api/arena/reply").set("Authorization", `Bearer ${other.token}`).send({ debateId: "d1" });
  assert.equal(notAuthor.status, 403);

  const verdict = await request(app).post("/api/arena/reply").set("Authorization", `Bearer ${author.token}`).send({ debateId: "d1" });
  assert.equal(verdict.status, 200);
  assert.equal(verdict.body.kind, "verdict");
  const d = await db.collection("debates").doc("d1").get();
  assert.equal(d.get("status"), "resolved");
  assert.match(d.get("aiResponse"), /Sources/);

  // No new user message → nothing to reply to.
  const nothing = await request(app).post("/api/arena/reply").set("Authorization", `Bearer ${author.token}`).send({ debateId: "d1" });
  assert.equal(nothing.status, 409);

  await db.collection("debates").doc("d1").collection("chat").doc("m1").set({ id: "m1", userId: other.uid, userName: "Citizen-xyz", role: "user", text: "But what about card fees?", createdAt: new Date() });
  const reply = await request(app).post("/api/arena/reply").set("Authorization", `Bearer ${other.token}`).send({ debateId: "d1" });
  assert.equal(reply.status, 200);
  assert.equal(reply.body.kind, "reply");
});

test("share builds the transcript from stored messages; only the owner can share", { skip }, async () => {
  const owner = await signUp("sharer@example.com");
  const stranger = await signUp("stranger@example.com");
  const conv = db.collection("conversations").doc("c1");
  await conv.set({ id: "c1", userId: owner.uid, title: "Fees" });
  await conv.collection("messages").add({ role: "user", text: "Q", createdAt: new Date(1) });
  await conv.collection("messages").add({ role: "model", text: "A", createdAt: new Date(2) });

  const denied = await request(app).post("/api/share").set("Authorization", `Bearer ${stranger.token}`).send({ conversationId: "c1" });
  assert.equal(denied.status, 404);

  const ok = await request(app).post("/api/share").set("Authorization", `Bearer ${owner.token}`).send({ conversationId: "c1" });
  assert.equal(ok.status, 200);
  const shared = await db.collection("shared_transcripts").doc(ok.body.id).get();
  assert.deepEqual(JSON.parse(shared.get("messages")), [
    { role: "user", text: "Q" },
    { role: "model", text: "A" },
  ]);
});

test("gazette is generated once per day and cached", { skip }, async () => {
  const u = await signUp("gazette@example.com");
  const first = await request(app).post("/api/chronicle/today").set("Authorization", `Bearer ${u.token}`).send({});
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.status, "ready");
  assert.ok(first.body.sources.length >= 2);
  assert.equal(first.body.stories.length, 1);
  assert.equal(first.body.stories[0].verdict, "corrected");
  assert.ok(first.body.stories[0].sources.length >= 2);
  const second = await request(app).post("/api/chronicle/today").set("Authorization", `Bearer ${u.token}`).send({});
  assert.equal(second.body.headline, first.body.headline);
});

test("risk radar is saved with its sources", { skip }, async () => {
  const u = await signUp("radar@example.com");
  const res = await request(app).post("/api/risk-radar").set("Authorization", `Bearer ${u.token}`).send({ language: "Telugu" });
  assert.equal(res.status, 200);
  const doc = await db.collection("threat_matrices").doc(res.body.id).get();
  assert.equal(doc.get("userId"), u.uid);
  assert.ok(doc.get("sources").length >= 1);
});
