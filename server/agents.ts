/**
 * The intelligence pipeline. For each watch-desk (block):
 *   1. Collector  – searches the live web (Google Search grounding) for real reports.
 *   2. Validator  – a second, independent search checks every claim.
 *   3. Summarizer – explains in plain words who pays and what people can do.
 * Only items that are confirmed by real sources are published. Nothing is invented:
 * if search or the AI fails, the cycle publishes nothing for that desk.
 */
import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { generate, extractJson, resolveSources, Source } from "./ai.js";
import { CORE, today } from "./prompts.js";
import { getDb } from "./firebaseAdmin.js";
import { appendBlock } from "./ledger.js";
import { SUBTOPIC_BLOCKS, SubtopicBlock, agentForBlock } from "../src/lib/agentRoster.js";

interface Finding {
  headline: string;
  whatHappened: string;
  country: string;
  date: string;
  sourceUrl?: string;
  sources: Source[];
}

interface Verified extends Finding {
  verdict: "confirmed" | "partly";
  verificationNote: string;
}

interface Insight extends Verified {
  impact: string;
  whoBenefits: string;
  whatYouCanDo: string;
  severity: "High" | "Medium" | "Low";
}

const uuid = () => crypto.randomUUID();
const domainOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

async function log(agentName: string, action: string, status: string) {
  const db = getDb();
  if (!db) return;
  try {
    await db.collection("agent_logs").add({ agentName, action, status, timestamp: new Date().toISOString() });
  } catch (e) {
    console.error("[agents] log failed:", (e as Error).message);
  }
}

async function recordWork(block: SubtopicBlock, phase: string, data: unknown) {
  const db = getDb();
  if (!db) return;
  const agent = agentForBlock(block.id);
  await db.collection("agent_block_ledger").add({
    id: uuid(),
    agentNumber: agent.agentNumber,
    agentCodeName: agent.codeName,
    agentRole: agent.role,
    blockNumber: block.blockNumber,
    blockId: block.id,
    blockName: block.name,
    phase,
    data: JSON.parse(JSON.stringify(data)),
    timestamp: new Date().toISOString(),
  });
}

/** Picks the grounding sources that support one finding. */
function sourcesFor(f: { sourceUrl?: string; headline: string }, all: Source[]): Source[] {
  const wanted = f.sourceUrl ? domainOf(f.sourceUrl) : "";
  const matched = wanted ? all.filter((s) => domainOf(s.url) === wanted || s.title.includes(wanted)) : [];
  return (matched.length ? matched : all).slice(0, 4);
}

// ---------- 1. Collector ----------
async function collect(block: SubtopicBlock): Promise<Finding[]> {
  const prompt = `Search the web for 2 recent reports (published in the last 30 days; today is ${today()}) from anywhere in the world about: ${block.focus}.
Each must show ordinary people being cheated, overcharged, misled or harmed, or an official action to stop it.
Prefer regulators, courts, official statistics, auditors and established news outlets. Skip opinion pieces and rumours.
Return ONLY a JSON array:
[{"headline": "...", "whatHappened": "2 factual sentences with the key numbers", "country": "...", "date": "YYYY-MM-DD", "sourceUrl": "..."}]
If you cannot find solid reports, return [].`;
  const res = await generate(prompt, { system: CORE(), grounded: true });
  const items = extractJson<any[]>(res.text);
  if (!Array.isArray(items) || !res.sources.length) return [];
  const resolved = await resolveSources(res.sources);
  return items
    .filter((i) => i && typeof i.headline === "string" && typeof i.whatHappened === "string")
    .slice(0, 3)
    .map((i) => ({
      headline: i.headline.slice(0, 200),
      whatHappened: i.whatHappened.slice(0, 800),
      country: String(i.country || "Global").slice(0, 60),
      date: String(i.date || "").slice(0, 10),
      sourceUrl: typeof i.sourceUrl === "string" ? i.sourceUrl : undefined,
      sources: sourcesFor(i, resolved),
    }));
}

// ---------- 2. Validator (independent second search) ----------
async function validate(findings: Finding[]): Promise<Verified[]> {
  if (!findings.length) return [];
  const prompt = `Independently fact-check each claim below by searching the web. Today is ${today()}.
${findings.map((f, i) => `${i}: ${f.headline} — ${f.whatHappened} (${f.country}, ${f.date})`).join("\n")}

Return ONLY a JSON array, one object per claim:
[{"index": 0, "verdict": "confirmed" | "partly" | "unverified" | "false", "note": "one sentence: what the sources confirm or contradict"}]
"confirmed" = key facts and numbers match at least one credible source. "partly" = the event is real but some details differ.`;
  const res = await generate(prompt, { system: CORE(), grounded: true });
  const verdicts = extractJson<any[]>(res.text);
  if (!Array.isArray(verdicts)) return [];
  const extra = await resolveSources(res.sources);
  const out: Verified[] = [];
  for (const v of verdicts) {
    const f = findings[v?.index];
    if (!f || (v.verdict !== "confirmed" && v.verdict !== "partly")) continue;
    const merged = new Map<string, Source>();
    for (const s of [...f.sources, ...extra.slice(0, 2)]) merged.set(s.url, s);
    out.push({ ...f, verdict: v.verdict, verificationNote: String(v.note || "").slice(0, 400), sources: [...merged.values()].slice(0, 5) });
  }
  return out;
}

// ---------- 3. Summarizer (plain-language impact) ----------
async function summarize(items: Verified[]): Promise<Insight[]> {
  if (!items.length) return [];
  const prompt = `For each verified report below, explain it for an ordinary person. Use ONLY the facts given; do not add numbers.
${items.map((f, i) => `${i}: ${f.headline} — ${f.whatHappened} (${f.country}). Check note: ${f.verificationNote}`).join("\n")}

Return ONLY a JSON array:
[{"index": 0, "impact": "2-3 simple sentences: how this takes money or rights from ordinary people", "whoBenefits": "one sentence", "whatYouCanDo": "one or two practical steps (who to complain to, what to check)", "severity": "High" | "Medium" | "Low"}]`;
  const res = await generate(prompt, { system: CORE(), json: true });
  const rows = extractJson<any[]>(res.text);
  if (!Array.isArray(rows)) return [];
  const out: Insight[] = [];
  for (const r of rows) {
    const it = items[r?.index];
    if (!it || typeof r.impact !== "string") continue;
    out.push({
      ...it,
      impact: r.impact.slice(0, 800),
      whoBenefits: String(r.whoBenefits || "").slice(0, 300),
      whatYouCanDo: String(r.whatYouCanDo || "").slice(0, 500),
      severity: ["High", "Medium", "Low"].includes(r.severity) ? r.severity : "Medium",
    });
  }
  return out;
}

function explanationMarkdown(i: Insight): string {
  return `## ${i.headline}

**What happened** (${i.country}${i.date ? `, ${i.date}` : ""})
${i.whatHappened}

**How it hits ordinary people**
${i.impact}

**Who benefits**
${i.whoBenefits}

**What you can do**
${i.whatYouCanDo}

**Verification:** ${i.verdict === "confirmed" ? "Confirmed" : "Partly confirmed"} — ${i.verificationNote}

**Sources**
${i.sources.map((s, n) => `${n + 1}. [${s.title.replace(/[\[\]]/g, "")}](${s.url})`).join("\n")}`;
}

/** Publishes insights. Document IDs are derived from the headline, so re-runs never duplicate. */
async function publish(block: SubtopicBlock, taskId: string, insights: Insight[]): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  const agent = agentForBlock(block.id);
  let published = 0;
  for (const i of insights) {
    const id = crypto.createHash("sha256").update(i.headline.toLowerCase().replace(/\W+/g, " ").trim()).digest("hex").slice(0, 24);
    const ref = db.collection("intelligence").doc(id);
    try {
      await ref.create({
        source: `${agent.agentNumber} (${agent.codeName}) [${block.blockNumber}]`,
        content: `${i.headline} — ${i.impact}`,
        headline: i.headline,
        country: i.country,
        explanationId: id,
        sources: i.sources,
        isBroadcasted: false,
        metadata: {
          severity: i.severity,
          confidence: `${i.verdict === "confirmed" ? "Confirmed" : "Partly confirmed"} · ${new Set(i.sources.map((s) => domainOf(s.url))).size} source(s)`,
          verdict: i.verdict,
          taskId,
          category: block.name,
          assignedAgent: agent.agentNumber,
          agentName: agent.codeName,
          blockName: block.name,
          blockNumber: block.blockNumber,
        },
        timestamp: new Date().toISOString(),
        createdAt: FieldValue.serverTimestamp(),
      });
      await db.collection("explanations").doc(id).set({
        id,
        content: explanationMarkdown(i),
        sources: i.sources,
        timestamp: new Date().toISOString(),
      });
      published++;
    } catch (e: any) {
      if (e?.code === 6 || /ALREADY_EXISTS/.test(String(e?.message))) continue; // duplicate story
      console.error("[agents] publish failed:", e?.message);
    }
  }
  return published;
}

/** Runs one desk end-to-end. Returns how many insights were published. */
export async function runBlock(block: SubtopicBlock): Promise<number> {
  const agent = agentForBlock(block.id);
  const name = `${agent.agentNumber} (${agent.codeName})`;
  const taskId = uuid();
  try {
    const found = await collect(block);
    await recordWork(block, "Collector", found);
    if (!found.length) {
      await log(name, `[${block.blockNumber}] No solid reports found today.`, "empty");
      return 0;
    }
    const verified = await validate(found);
    await recordWork(block, "Validator", verified);
    if (!verified.length) {
      await log(name, `[${block.blockNumber}] ${found.length} report(s) failed independent verification; nothing published.`, "rejected");
      return 0;
    }
    const insights = await summarize(verified);
    await recordWork(block, "Summarizer", insights);
    const n = await publish(block, taskId, insights);
    if (n) {
      await appendBlock(
        insights.map((i) => `[${i.severity}] ${i.headline}\nSources: ${i.sources.map((s) => s.url).join(", ")}`).join("\n\n"),
        `${agent.codeName.toLowerCase()}_${block.id}`,
        "Summarizer",
        { taskId, metadata: { blockNumber: block.blockNumber, blockName: block.name, published: n } },
      );
    }
    await log(name, `[${block.blockNumber}] Published ${n} verified insight(s) from ${found.length} report(s).`, "success");
    return n;
  } catch (e) {
    await log(name, `[${block.blockNumber}] Cycle failed: ${String((e as Error).message).slice(0, 160)}`, "error");
    return 0;
  }
}

/**
 * Runs as many desks as fit in the time budget, starting where the last run
 * stopped, so all 12 desks are covered over successive runs.
 * A lease document prevents two overlapping cycles.
 */
export async function runCycle(budgetMs: number): Promise<{ ran: string[]; published: number; skipped?: string }> {
  const db = getDb();
  if (!db) return { ran: [], published: 0, skipped: "database not configured" };
  const started = Date.now();
  const stateRef = db.collection("system").doc("agent_cycle");

  const lease = await db.runTransaction(async (tx) => {
    const s = await tx.get(stateRef);
    const until = s.exists ? (s.get("leaseUntil") as number) || 0 : 0;
    if (until > Date.now()) return null;
    const next = s.exists ? (s.get("nextBlock") as number) || 0 : 0;
    tx.set(stateRef, { leaseUntil: Date.now() + budgetMs + 60_000, nextBlock: next }, { merge: true });
    return next;
  });
  if (lease === null) return { ran: [], published: 0, skipped: "another cycle is running" };

  let idx = lease;
  const ran: string[] = [];
  let published = 0;
  const perBlockEstimate = 75_000;
  try {
    for (let k = 0; k < SUBTOPIC_BLOCKS.length; k++) {
      if (Date.now() - started + perBlockEstimate > budgetMs) break;
      const block = SUBTOPIC_BLOCKS[idx % SUBTOPIC_BLOCKS.length];
      published += await runBlock(block);
      ran.push(block.id);
      idx = (idx + 1) % SUBTOPIC_BLOCKS.length;
      await stateRef.set({ nextBlock: idx }, { merge: true });
    }
  } finally {
    await stateRef.set({ leaseUntil: 0, lastRunAt: new Date().toISOString(), lastRan: ran, lastPublished: published }, { merge: true });
  }
  return { ran, published };
}
