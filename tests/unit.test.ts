/**
 * Server tests that need no database: input validation, auth gate, error
 * handling, webhook signature checks and helper functions.
 * Run: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

// Configure BEFORE importing server modules (config is read at import time).
process.env.NODE_ENV = "test";
process.env.GEMINI_API_KEY = "";
process.env.RAZORPAY_KEY_ID = "rzp_test_key";
process.env.RAZORPAY_KEY_SECRET = "test_key_secret";
process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret";
delete process.env.FIREBASE_SERVICE_ACCOUNT;
delete process.env.FIRESTORE_EMULATOR_HOST;

const { default: request } = await import("supertest");
const { createApp } = await import("../server/app.ts");
const { extractJson, sourcesMarkdown } = await import("../server/ai.ts");
const { handleWebhook } = await import("../server/payments.ts");
const { blockHash } = await import("../server/ledger.ts");
const { getAgentRotation, SUBTOPIC_BLOCKS, AGENTS } = await import("../src/lib/agentRoster.ts");

const app = createApp();

test("health endpoint exposes no internals", async () => {
  const res = await request(app).get("/api/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.geminiConfigured, false);
  assert.ok(Array.isArray(res.body.missingKeys));
  assert.equal(res.body.debug, undefined);
  assert.equal(res.body.trialErrors, undefined);
});

test("AI and account endpoints require sign-in", async () => {
  for (const [method, path] of [
    ["post", "/api/chat"],
    ["post", "/api/arena/reply"],
    ["post", "/api/risk-radar"],
    ["post", "/api/chronicle/today"],
    ["post", "/api/share"],
    ["get", "/api/me"],
    ["get", "/api/explanations/abc"],
    ["post", "/api/payments/create-order"],
    ["post", "/api/payments/verify"],
    ["post", "/api/admin/run-cycle"],
  ] as const) {
    const res = await (request(app) as any)[method](path).send({ message: "hi" });
    assert.equal(res.status, 401, `${method.toUpperCase()} ${path} should be 401`);
    assert.equal(res.body.code, "AUTH_REQUIRED");
  }
});

test("a forged token is rejected", async () => {
  const res = await request(app).post("/api/chat").set("Authorization", "Bearer not-a-real-token").send({ message: "hi" });
  assert.equal(res.status, 401);
});

test("the old open AI proxy endpoints are gone", async () => {
  for (const path of ["/api/chat/call", "/api/chat/json", "/api/chat/arena", "/api/diagnostics"]) {
    const res = await request(app).post(path).send({});
    assert.equal(res.status, 404, path);
  }
});

test("cron endpoint refuses callers without the secret", async () => {
  const res = await request(app).get("/api/cron/run-cycle");
  assert.equal(res.status, 401);
});

test("unknown API routes return JSON 404", async () => {
  const res = await request(app).get("/api/nope");
  assert.equal(res.status, 404);
  assert.equal(res.body.code, "NOT_FOUND");
});

test("oversized bodies are rejected", async () => {
  const res = await request(app)
    .post("/api/chat")
    .set("Content-Type", "application/json")
    .send(JSON.stringify({ message: "x".repeat(300_000) }));
  assert.equal(res.status, 413);
});

test("webhook rejects missing and wrong signatures", async () => {
  const body = Buffer.from(JSON.stringify({ event: "payment.captured" }));
  await assert.rejects(handleWebhook(body, undefined), /signature/i);
  await assert.rejects(handleWebhook(body, "deadbeef"), /signature/i);
  const res = await request(app).post("/api/payments/webhook").set("x-razorpay-signature", "bad").send({ event: "payment.captured" });
  assert.equal(res.status, 400);
  assert.equal(res.body.code, "BAD_SIGNATURE");
});

test("webhook accepts a valid signature over the RAW body and ignores irrelevant events", async () => {
  const raw = Buffer.from('{"event":"refund.created","payload":{}}');
  const sig = crypto.createHmac("sha256", "test_webhook_secret").update(raw).digest("hex");
  assert.equal(await handleWebhook(raw, sig), "ignored");
  const res = await request(app)
    .post("/api/payments/webhook")
    .set("Content-Type", "application/json")
    .set("x-razorpay-signature", sig)
    .send(raw.toString());
  assert.equal(res.status, 200);
  assert.equal(res.body.result, "ignored");
});

test("extractJson finds arrays and objects inside model text", () => {
  assert.deepEqual(extractJson('Here:\n```json\n[{"a":1}]\n```'), [{ a: 1 }]);
  assert.deepEqual(extractJson('noise {"b":2} tail'), { b: 2 });
  assert.equal(extractJson("no json here"), null);
});

test("sourcesMarkdown lists sources and warns when there are none", () => {
  const md = sourcesMarkdown([{ title: "RBI [notice]", url: "https://rbi.org.in/x" }], ["inflation india"]);
  assert.match(md, /\*\*Sources\*\*/);
  assert.match(md, /\[RBI notice\]\(https:\/\/rbi\.org\.in\/x\)/);
  assert.match(md, /google\.com\/search\?q=inflation%20india/);
  assert.match(sourcesMarkdown([]), /unverified/);
});

test("ledger hash matches the browser formula", async () => {
  const { calculateHash } = await import("../src/lib/aitihya.ts");
  const browser = await calculateHash(3, "2026-10-26T00:00:00.000Z", "hello", "abc");
  assert.equal(blockHash(3, "2026-10-26T00:00:00.000Z", "hello", "abc"), browser);
});

test("agent rotation covers every desk exactly once per day", () => {
  for (const t of [0, Date.parse("2026-10-26"), Date.parse("2027-01-01")]) {
    const { blockToAgent, agentToBlock } = getAgentRotation(t);
    assert.equal(new Set(blockToAgent.map((x) => x.agent.codeName)).size, AGENTS.length);
    for (const a of agentToBlock) {
      assert.equal(blockToAgent[a.blockIndex].agent.codeName, a.agent.codeName);
    }
  }
  assert.ok(SUBTOPIC_BLOCKS.every((b) => !/srikakulam|andhra/i.test(b.name + b.focus)));
});
