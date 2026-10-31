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
  assert.deepEqual(extractJson('{"headline":"h","stories":[{"t":1}]}'), { headline: "h", stories: [{ t: 1 }] });
});

test("sourcesMarkdown lists sources and warns when there are none", () => {
  const md = sourcesMarkdown([{ title: "RBI [notice]", url: "https://rbi.org.in/x" }], ["inflation india"]);
  assert.match(md, /\*\*Sources\*\*/);
  assert.match(md, /\[RBI notice\]\(https:\/\/rbi\.org\.in\/x\)/);
  assert.match(md, /google\.com\/search\?q=inflation%20india/);
  assert.match(sourcesMarkdown([], [], [], "Fees rose 12% last year."), /unverified/);
  assert.equal(sourcesMarkdown([], [], [], "Which country are you in?"), "");
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

// ---------------------------------------------------------------------------
// The brain: citations, unsupported-figure warnings, Claude provider.
// (These inject a fake Claude client, so they run last.)
// ---------------------------------------------------------------------------
const ai = await import("../server/ai.ts");

test("citations: supported spans get inline [n] links; unsupported figures are flagged", () => {
  const sources = [
    { title: "RBI notice", url: "https://rbi.org.in/a" },
    { title: "Reuters", url: "https://www.reuters.com/b" },
  ];
  const spans = [
    { text: "The RBI capped ATM fees at ₹23 per withdrawal from May 2025.", cites: [0, 1] },
    { text: " Banks earned ₹5,000 crore from these fees last year.", cites: [] },
    { text: "\n\n**Counter-Tweet:** Check your bank statement every month.", cites: [] },
  ];
  const md = ai.finalAnswer({ spans, sources, searchQueries: ["atm fee cap rbi"] });
  assert.match(md, /2025\. \[\[1\]\]\(https:\/\/rbi\.org\.in\/a\)\[\[2\]\]\(https:\/\/www\.reuters\.com\/b\)/);
  assert.match(md, /Not matched to a source/);
  assert.match(md, /Banks earned ₹5,000 crore/);
  // The Counter-Tweet line is never flagged and stays intact.
  assert.match(md, /\*\*Counter-Tweet:\*\* Check your bank statement every month\./);
  assert.doesNotMatch(md.split("Not matched")[1], /Counter-Tweet/);
});

test("unsupportedClaims: restated cited figures and calculations are not flagged; new figures are", () => {
  const out = ai.unsupportedClaims([
    { text: "The cap is ₹23 per withdrawal from 2025.", cites: [0] },
    { text: "\n## What is claimed\nWhich country are you in? So ₹23 is the legal maximum.\nSo ₹23 + ₹4.14 = ₹27.14 in total.\nIn 2024 wages grew 9% in nominal terms.\n- 5% of loans went bad.\nParty X got 6,000 crore.", cites: [] },
  ]);
  assert.deepEqual(out, ["In 2024 wages grew 9% in nominal terms.", "5% of loans went bad.", "Party X got 6,000 crore."]);
});

test("sourceLabel replaces junk page titles with the site name", () => {
  assert.equal(ai.sourceLabel({ title: "March 28, 2025 6:10 PM", url: "https://www.newsonair.gov.in/x" }), "newsonair.gov.in");
  assert.equal(ai.sourceLabel({ title: "ATM withdrawals to cost more", url: "https://www.business-standard.com/a" }), "ATM withdrawals to cost more (business-standard.com)");
});

/** A fake Anthropic client returning web-search citations, with one pause_turn continuation. */
function fakeClaude(calls: any[]) {
  const reply = (n: number): any =>
    n === 0
      ? { stop_reason: "pause_turn", content: [{ type: "server_tool_use", name: "web_search", input: { query: "india cpi september 2026" } }] }
      : {
          stop_reason: "end_turn",
          content: [
            { type: "text", text: "India's CPI inflation was 3.1% in September 2026.", citations: [{ type: "web_search_result_location", url: "https://mospi.gov.in/cpi", title: "MoSPI CPI", cited_text: "3.1%" }] },
            { type: "text", text: "\n\nVerdict: Supported (High confidence).\n\n**Counter-Tweet:** Official CPI: 3.1% in Sept 2026.", citations: [] },
          ],
        };
  return {
    messages: {
      async create(params: any) {
        calls.push(params);
        return reply(calls.length - 1);
      },
      stream(params: any) {
        calls.push(params);
        const msg = reply(calls.length - 1);
        let onText: ((t: string) => void) | null = null;
        return {
          on(evt: string, cb: (t: string) => void) {
            if (evt === "text") onText = cb;
            return this;
          },
          async finalMessage() {
            for (const b of msg.content as any[]) if (b.type === "text") onText?.(b.text);
            return msg;
          },
        };
      },
    },
  };
}

test("Claude provider: Opus first, adaptive thinking, web search, continues after pause_turn, keeps citations", async () => {
  const calls: any[] = [];
  ai.__setClaudeClientForTests(fakeClaude(calls));
  const r = await ai.generate("What was India's CPI in Sept 2026?", { system: "sys", grounded: true });
  assert.equal(r.provider, "claude");
  assert.equal(calls[0].model, "claude-opus-5-5");
  assert.deepEqual(calls[0].thinking, { type: "adaptive" });
  assert.equal(calls[0].output_config.effort, "high");
  assert.equal(calls[0].tools[0].type, "web_search_20250305");
  assert.equal(calls.length, 2, "should continue after pause_turn");
  assert.equal(calls[1].messages.at(-1).role, "assistant");
  assert.deepEqual(r.searchQueries, ["india cpi september 2026"]);
  assert.deepEqual(r.sources, [{ title: "MoSPI CPI", url: "https://mospi.gov.in/cpi" }]);
  const md = ai.finalAnswer(r);
  assert.match(md, /3\.1% in September 2026\. \[\[1\]\]\(https:\/\/mospi\.gov\.in\/cpi\)/);
  assert.doesNotMatch(md, /Not matched to a source/);
});

test("Claude provider: light tier uses Haiku; streaming yields text then the cited result", async () => {
  const calls: any[] = [];
  ai.__setClaudeClientForTests(fakeClaude(calls));
  await ai.generate("x", { system: "s", tier: "light" });
  assert.equal(calls[0].model, "claude-haiku-5-5");

  const calls2: any[] = [];
  ai.__setClaudeClientForTests(fakeClaude(calls2));
  let done: any = null;
  let streamed = "";
  for await (const t of ai.generateStream("q", { system: "s", grounded: true }, (r) => (done = r))) streamed += t;
  assert.match(streamed, /3\.1% in September 2026/);
  assert.ok(done);
  assert.equal(done.sources.length, 1);
});

test("agents: dates must be recent and real", async () => {
  const { isRecent } = await import("../server/agents.ts");
  const now = Date.parse("2026-11-01T00:00:00Z");
  assert.equal(isRecent("2026-10-20", 35, now), true);
  assert.equal(isRecent("2026-08-01", 35, now), false);
  assert.equal(isRecent("2027-01-01", 35, now), false);
  assert.equal(isRecent("not a date", 35, now), false);
});

test("citations never split a number or word across a span boundary", () => {
  const sources = [{ title: "A", url: "https://a.org/x" }];
  const md = ai.citedText(
    [
      { text: "Prices multiplied by 1.", cites: [0] },
      { text: "62 times since 2014.", cites: [] },
      { text: " Wages grew", cites: [0] },
      { text: " too.", cites: [] },
    ],
    sources,
  );
  assert.equal(md, "Prices multiplied by 1.62 [[1]](https://a.org/x) times since 2014. Wages grew [[1]](https://a.org/x) too.");
});
