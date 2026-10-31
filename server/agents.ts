/**
 * The intelligence pipeline. For each watch-desk (block):
 *   1. Collector    – searches the live web for recent, real reports (harmful OR protective OR reassuring).
 *   2. Fact-checker – a separate sceptic, with its own prompt and its own searches, tries to disprove
 *                     each report. "Confirmed" needs two independent sources; wrong details are corrected.
 *   3. Explainer    – explains the verified facts fairly in plain words (no added facts or numbers).
 * Nothing is invented: if search or the AI fails, the desk publishes nothing that run.
 */
import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { generate, extractJson, resolveSources, Source } from "./ai.js";
import { CORE, FACT_CHECKER, EXPLAINER, today } from "./prompts.js";
import { getDb } from "./firebaseAdmin.js";
import { appendBlock } from "./ledger.js";
import { SUBTOPIC_BLOCKS, SubtopicBlock, agentForBlock } from "../src/lib/agentRoster.js";

export interface Finding {
  headline: string;
  whatHappened: string;
  country: string;
  date: string;
  sourceUrl?: string;
  sources: Source[];
}

export interface Verified extends Finding {
  verdict: "confirmed" | "corrected";
  verificationNote: string;
}

interface Insight extends Verified {
  direction: "harm" | "protection" | "mixed" | "reassurance";
  effectOnPeople: string;
  otherSide: string;
  whatYouCanDo: string;
  severity: "High" | "Medium" | "Low";
}

const uuid = () => crypto.randomUUID();
export const domainOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
};
/** Registrable-ish domain, so news.example.com and example.com count as the same organisation. */
const orgOf = (u: string) => domainOf(u).split(".").slice(-2).join(".");

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

/** Keeps only sources that were really retrieved, matched to the URL the model says it used. */
function retrievedFor(url: string | undefined, retrieved: Source[]): Source[] {
  const org = url ? orgOf(url) : "";
  return org ? retrieved.filter((s) => orgOf(s.url) === org) : [];
}

/** True when the date is a real date within the last `days` days (and not in the future). */
export function isRecent(date: string, days: number, now = Date.now()): boolean {
  const t = Date.parse(date);
  return Number.isFinite(t) && t <= now + 2 * 86_400_000 && now - t <= days * 86_400_000;
}

// ---------- 1. Collector ----------
async function collect(block: SubtopicBlock): Promise<Finding[]> {
  const prompt = `Search the web for up to 3 recent reports (published in the last 30 days; today is ${today()}) from anywhere in the world about: ${block.focus}.
Include whatever the evidence shows: people being cheated or harmed, official action that protects people, or evidence that a feared problem is smaller than claimed.
Prefer regulators, courts, statistics offices, auditors and established news outlets. Skip opinion pieces, rumours and press releases without independent coverage.
Return ONLY a JSON array:
[{"headline": "...", "whatHappened": "2 factual sentences with the key numbers", "country": "...", "date": "YYYY-MM-DD", "sourceUrl": "the exact URL you used"}]
If you cannot find solid reports, return [].`;
  const res = await generate(prompt, { system: CORE(), grounded: true, tier: "light", effort: "medium" });
  const items = extractJson<any[]>(res.text);
  if (!Array.isArray(items) || !res.sources.length) return [];
  const retrieved = await resolveSources(res.sources);
  const out: Finding[] = [];
  for (const i of items.slice(0, 3)) {
    if (!i || typeof i.headline !== "string" || typeof i.whatHappened !== "string") continue;
    const date = String(i.date || "").slice(0, 10);
    if (!isRecent(date, 35)) continue; // stale, future or made-up date
    const sources = retrievedFor(i.sourceUrl, retrieved);
    if (!sources.length) continue; // the cited page was not actually retrieved
    out.push({
      headline: i.headline.slice(0, 200),
      whatHappened: i.whatHappened.slice(0, 800),
      country: String(i.country || "Global").slice(0, 60),
      date,
      sourceUrl: i.sourceUrl,
      sources: sources.slice(0, 3),
    });
  }
  return out;
}

// ---------- 2. Fact-checker (separate sceptic, own searches) ----------
/**
 * Independently checks claims. A claim survives only if at least two
 * independent organisations support it. Wrong details are replaced with the
 * corrected, verified text. Used by the agents AND the daily Gazette.
 */
export async function factCheck(findings: Finding[]): Promise<Verified[]> {
  if (!findings.length) return [];
  const prompt = `Fact-check each claim below. Today is ${today()}.
${findings.map((f, i) => `${i}: [${f.country}, ${f.date}] ${f.headline} — ${f.whatHappened} (reported by: ${f.sourceUrl || "unknown"})`).join("\n")}

Return ONLY a JSON array, one object per claim:
[{"index": 0, "verdict": "confirmed" | "corrected" | "unverified" | "false",
  "correctedText": "only for 'corrected': the claim rewritten using only verified facts",
  "sourceUrls": ["URLs of the independent sources that support the (corrected) claim"],
  "note": "one sentence: what the sources confirm, correct or contradict"}]`;
  const res = await generate(prompt, { system: FACT_CHECKER(), grounded: true, effort: "high" });
  const verdicts = extractJson<any[]>(res.text);
  if (!Array.isArray(verdicts)) return [];
  const retrieved = await resolveSources(res.sources);
  const out: Verified[] = [];
  for (const v of verdicts) {
    const f = findings[v?.index];
    if (!f || (v.verdict !== "confirmed" && v.verdict !== "corrected")) continue;
    if (v.verdict === "corrected" && !(typeof v.correctedText === "string" && v.correctedText.trim())) continue;
    // Only sources the checker really retrieved count, plus the collector's own retrieved source.
    const checkerSources = (Array.isArray(v.sourceUrls) ? v.sourceUrls : []).flatMap((u: string) => retrievedFor(u, retrieved));
    const all = new Map<string, Source>();
    for (const s of [...f.sources, ...checkerSources]) all.set(s.url, s);
    const orgs = new Set([...all.values()].map((s) => orgOf(s.url)));
    if (orgs.size < 2) continue; // needs two independent organisations
    out.push({
      ...f,
      whatHappened: v.verdict === "corrected" ? String(v.correctedText).slice(0, 800) : f.whatHappened,
      verdict: v.verdict,
      verificationNote: String(v.note || "").slice(0, 400),
      sources: [...all.values()].slice(0, 5),
    });
  }
  return out;
}

// ---------- 3. Explainer (fair, plain language, no new facts) ----------
async function explain(items: Verified[]): Promise<Insight[]> {
  if (!items.length) return [];
  const prompt = `Explain each verified report below for ordinary people. Use ONLY the facts given; do not add numbers or events.
${items.map((f, i) => `${i}: ${f.headline} — ${f.whatHappened} (${f.country}, ${f.date})`).join("\n")}

Return ONLY a JSON array:
[{"index": 0,
  "direction": "harm" | "protection" | "mixed" | "reassurance",
  "effectOnPeople": "2-3 simple sentences on how this affects ordinary people's money or rights (positive, negative or mixed)",
  "otherSide": "one sentence: the strongest legitimate explanation or defence from the government/company/body involved",
  "whatYouCanDo": "one or two practical steps (what to check, who to complain to)",
  "severity": "High" | "Medium" | "Low"}]
Severity = how much it matters for households' money or rights, not how outrageous it sounds.`;
  const res = await generate(prompt, { system: EXPLAINER(), json: true, tier: "light", effort: "medium" });
  const rows = extractJson<any[]>(res.text);
  if (!Array.isArray(rows)) return [];
  const out: Insight[] = [];
  for (const r of rows) {
    const it = items[r?.index];
    if (!it || typeof r.effectOnPeople !== "string") continue;
    out.push({
      ...it,
      direction: ["harm", "protection", "mixed", "reassurance"].includes(r.direction) ? r.direction : "mixed",
      effectOnPeople: r.effectOnPeople.slice(0, 800),
      otherSide: String(r.otherSide || "").slice(0, 400),
      whatYouCanDo: String(r.whatYouCanDo || "").slice(0, 500),
      severity: ["High", "Medium", "Low"].includes(r.severity) ? r.severity : "Medium",
    });
  }
  return out;
}

const DIRECTION_LABEL: Record<Insight["direction"], string> = {
  harm: "Harm to ordinary people",
  protection: "Protection for ordinary people",
  mixed: "Mixed effects",
  reassurance: "Reassuring evidence",
};

function explanationMarkdown(i: Insight): string {
  return `## ${i.headline}

**What happened** (${i.country}${i.date ? `, ${i.date}` : ""})
${i.whatHappened}

**${DIRECTION_LABEL[i.direction]}**
${i.effectOnPeople}

**The other side**
${i.otherSide || "No official explanation was found."}

**What you can do**
${i.whatYouCanDo}

**Fact-check:** ${i.verdict === "confirmed" ? "Confirmed" : "Corrected and confirmed"} by ${new Set(i.sources.map((s) => orgOf(s.url))).size} independent sources — ${i.verificationNote}

**Sources**
${i.sources.map((s, n) => `${n + 1}. [${s.title.replace(/[\[\]]/g, "")}](${s.url})`).join("\n")}

_AI-generated summary of the sources above. Not financial or legal advice._`;
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
        content: `${i.headline} — ${i.effectOnPeople}`,
        headline: i.headline,
        country: i.country,
        explanationId: id,
        sources: i.sources,
        metadata: {
          severity: i.severity,
          confidence: `${i.verdict === "confirmed" ? "Confirmed" : "Corrected & confirmed"} · ${new Set(i.sources.map((s) => orgOf(s.url))).size} independent sources`,
          direction: i.direction,
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
    const verified = await factCheck(found);
    await recordWork(block, "Validator", verified);
    if (!verified.length) {
      await log(name, `[${block.blockNumber}] ${found.length} report(s) failed independent verification; nothing published.`, "rejected");
      return 0;
    }
    const insights = await explain(verified);
    await recordWork(block, "Summarizer", insights);
    const n = await publish(block, taskId, insights);
    if (n) {
      await appendBlock(
        insights.map((i) => `[${i.severity}/${i.direction}] ${i.headline}\nSources: ${i.sources.map((s) => s.url).join(", ")}`).join("\n\n"),
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
  const perBlockEstimate = 120_000; // collector + independent fact-checker + explainer
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
