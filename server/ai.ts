/**
 * The AI "brain" layer. Two interchangeable providers:
 *   - Claude (Anthropic): web search with sentence-level citations, adaptive thinking.
 *   - Gemini (Google):    Google Search grounding with groundingSupports, thinking level.
 * Both return the same shape: the answer, the sources, and the answer split into
 * spans that say which source supports which sentence. From that we add inline
 * [n] citations and flag numbers that no source supports.
 *
 * No invented fallback content: if every provider fails, we say so honestly.
 */
import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import { HttpError } from "./auth.js";

export interface Source {
  title: string;
  url: string;
}

/** A piece of the answer and the sources (indexes into `sources`) that support it. */
export interface Span {
  text: string;
  cites: number[];
}

export interface AiResult {
  /** Plain answer text (no citation markers). */
  text: string;
  sources: Source[];
  searchQueries: string[];
  spans: Span[];
  provider: "claude" | "gemini";
  model: string;
}

export type Effort = "low" | "medium" | "high";

export interface AiOptions {
  system: string;
  /** Search the live web so answers are based on current, citable sources. */
  grounded?: boolean;
  /** Ask for JSON output (parse with extractJson). */
  json?: boolean;
  /** How hard the model should think. Default: high when grounded, medium otherwise. */
  effort?: Effort;
  /** "light" uses the cheaper model (background agents). */
  tier?: "main" | "light";
  /** Max web searches per request (Claude). */
  maxSearches?: number;
}

type Turn = { role: string; parts: Array<{ text: string }> };
type Contents = string | Turn[];

const list = (v: string | undefined, fallback: string) =>
  (v || fallback)
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

const GEMINI_MAIN = list(process.env.GEMINI_MODELS, "gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flash-lite");
const GEMINI_LIGHT = list(process.env.GEMINI_LIGHT_MODELS, "gemini-3.5-flash-lite,gemini-3.6-flash");
const CLAUDE_MAIN = list(process.env.CLAUDE_MODELS, "claude-opus-5-5,claude-sonnet-5-5");
const CLAUDE_LIGHT = list(process.env.CLAUDE_LIGHT_MODELS, "claude-haiku-5-5,claude-sonnet-5-5");

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
let gemini: GoogleGenAI | null = null;
let claude: Anthropic | null = null;

function geminiClient(): GoogleGenAI | null {
  if (gemini) return gemini;
  if (!config.geminiKey) return null;
  gemini = new GoogleGenAI({ apiKey: config.geminiKey });
  return gemini;
}

function claudeClient(): Anthropic | null {
  if (claude) return claude;
  if (!config.anthropicKey) return null;
  claude = new Anthropic({ apiKey: config.anthropicKey, maxRetries: 1, timeout: 120_000 });
  return claude;
}

/** Provider order: the preferred one first, the other as a fallback when it is configured. */
function providers(): Array<"claude" | "gemini"> {
  const out: Array<"claude" | "gemini"> = [];
  const pref = config.aiProvider;
  const order: Array<"claude" | "gemini"> = pref === "gemini" ? ["gemini", "claude"] : ["claude", "gemini"];
  for (const p of order) if (p === "claude" ? claudeClient() : geminiClient()) out.push(p);
  return out;
}

export const aiConfigured = () => providers().length > 0;
export const aiProviderStatus = () => ({ providers: providers() });

/** Test hooks: inject fake clients. */
export function __setAiClientForTests(fake: unknown) {
  gemini = fake as GoogleGenAI;
}
export function __setClaudeClientForTests(fake: unknown) {
  claude = fake as Anthropic;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------
const msgOf = (e: unknown) => String((e as any)?.message || e);
function isRetryable(err: unknown): boolean {
  return /429|RESOURCE_EXHAUSTED|quota|rate|503|UNAVAILABLE|overloaded|529|demand|500|INTERNAL|not found|NOT_FOUND|404|EMPTY_RESPONSE|timeout/i.test(
    msgOf(err),
  );
}
function isQuota(err: unknown): boolean {
  return /429|RESOURCE_EXHAUSTED|quota|rate limit|credit balance/i.test(msgOf(err));
}
function aiUnavailable(err: unknown): HttpError {
  if (err instanceof HttpError) return err;
  return isQuota(err)
    ? new HttpError(429, "RESOURCE_EXHAUSTED", "The AI is busy right now (quota reached). Please try again later.")
    : new HttpError(503, "AI_UNAVAILABLE", "The AI could not answer right now. Please try again in a minute.");
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------
function geminiConfig(opts: AiOptions) {
  // Gemini 3.x: keep default temperature/top_p (Google's guidance); control depth with thinkingLevel.
  const effort = opts.effort || (opts.grounded ? "high" : "medium");
  const cfg: Record<string, unknown> = {
    systemInstruction: opts.system,
    thinkingConfig: { thinkingLevel: effort.toUpperCase() },
  };
  if (opts.grounded) cfg.tools = [{ googleSearch: {} }];
  if (opts.json && !opts.grounded) cfg.responseMimeType = "application/json";
  return cfg;
}

const geminiContents = (c: Contents) => (typeof c === "string" ? [{ role: "user", parts: [{ text: c }] }] : c);

/** Builds sources + spans from Gemini grounding metadata. */
function geminiGrounding(text: string, candidate: any): { sources: Source[]; queries: string[]; spans: Span[] } {
  const gm = candidate?.groundingMetadata || {};
  const sources: Source[] = [];
  const chunkToSource = new Map<number, number>();
  (gm.groundingChunks || []).forEach((ch: any, i: number) => {
    const uri = ch?.web?.uri;
    if (!uri) return;
    let idx = sources.findIndex((s) => s.url === uri);
    if (idx === -1) {
      let title = ch.web.title;
      if (!title) {
        try {
          title = new URL(uri).hostname;
        } catch {
          title = uri;
        }
      }
      sources.push({ title, url: uri });
      idx = sources.length - 1;
    }
    chunkToSource.set(i, idx);
  });

  // Locate each supported segment in the text (by its text, which is robust to byte/char offsets).
  const marks: Array<{ start: number; end: number; cites: number[] }> = [];
  let cursor = 0;
  for (const sup of gm.groundingSupports || []) {
    const segText: string = sup?.segment?.text || "";
    if (!segText) continue;
    let at = text.indexOf(segText, cursor);
    if (at === -1) at = text.indexOf(segText);
    if (at === -1) continue;
    const cites = [...new Set((sup.groundingChunkIndices || []).map((c: number) => chunkToSource.get(c)).filter((x: unknown) => x !== undefined))] as number[];
    if (!cites.length) continue;
    marks.push({ start: at, end: at + segText.length, cites });
    cursor = at + segText.length;
  }
  marks.sort((a, b) => a.start - b.start);
  const spans: Span[] = [];
  let pos = 0;
  for (const m of marks) {
    if (m.start < pos) continue; // overlapping support: skip
    if (m.start > pos) spans.push({ text: text.slice(pos, m.start), cites: [] });
    spans.push({ text: text.slice(m.start, m.end), cites: m.cites });
    pos = m.end;
  }
  if (pos < text.length) spans.push({ text: text.slice(pos), cites: [] });
  return { sources, queries: gm.webSearchQueries || [], spans };
}

async function geminiGenerate(contents: Contents, opts: AiOptions, models: string[]): Promise<AiResult> {
  const ai = geminiClient()!;
  let lastErr: unknown;
  for (const model of models) {
    try {
      const res: any = await ai.models.generateContent({ model, contents: geminiContents(contents), config: geminiConfig(opts) });
      const text = res.text ?? "";
      if (!text.trim()) throw new Error("EMPTY_RESPONSE");
      const g = geminiGrounding(text, res.candidates?.[0]);
      return { text, sources: g.sources, searchQueries: g.queries, spans: g.spans, provider: "gemini", model };
    } catch (e) {
      lastErr = e;
      console.warn(`[ai] gemini ${model} failed: ${msgOf(e).slice(0, 200)}`);
      if (!isRetryable(e)) break;
    }
  }
  throw lastErr;
}

async function* geminiStream(
  contents: Contents,
  opts: AiOptions,
  models: string[],
  done: (r: AiResult) => void,
): AsyncGenerator<string> {
  const ai = geminiClient()!;
  let lastErr: unknown;
  for (const model of models) {
    let started = false;
    try {
      const stream: any = await ai.models.generateContentStream({ model, contents: geminiContents(contents), config: geminiConfig(opts) });
      let text = "";
      let lastCandidate: any = null;
      const merged: any = { groundingMetadata: { groundingChunks: [], groundingSupports: [], webSearchQueries: [] } };
      for await (const chunk of stream) {
        const cand = chunk.candidates?.[0];
        if (cand?.groundingMetadata) {
          lastCandidate = cand;
          const gm = cand.groundingMetadata;
          // Streams usually send full grounding metadata on the last chunk; keep the richest one.
          if ((gm.groundingChunks || []).length >= merged.groundingMetadata.groundingChunks.length) merged.groundingMetadata = gm;
        }
        const t = chunk.text;
        if (t) {
          started = true;
          text += t;
          yield t;
        }
      }
      if (!started) throw new Error("EMPTY_RESPONSE");
      const g = geminiGrounding(text, lastCandidate ? merged : null);
      done({ text, sources: g.sources, searchQueries: g.queries, spans: g.spans, provider: "gemini", model });
      return;
    } catch (e) {
      lastErr = e;
      console.warn(`[ai] gemini stream ${model} failed: ${msgOf(e).slice(0, 200)}`);
      if (started) throw aiUnavailable(e);
      if (!isRetryable(e)) break;
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------
// Claude
// ---------------------------------------------------------------------------
const claudeMessages = (c: Contents) =>
  (typeof c === "string" ? [{ role: "user", parts: [{ text: c }] }] : c).map((t) => ({
    role: t.role === "model" ? ("assistant" as const) : ("user" as const),
    content: t.parts.map((p) => p.text).join("\n"),
  }));

function claudeParams(opts: AiOptions, model: string, messages: any[]) {
  const effort = opts.effort || (opts.grounded ? "high" : "medium");
  const params: Record<string, unknown> = {
    model,
    max_tokens: 16000,
    system: opts.json ? `${opts.system}\n\nReturn ONLY valid JSON, with no text before or after it.` : opts.system,
    messages,
    thinking: { type: "adaptive" },
    output_config: { effort },
  };
  if (opts.grounded) {
    params.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: opts.maxSearches ?? 8 }];
  }
  return params;
}

/** Builds text, sources and spans from Claude content blocks (text blocks carry their citations). */
function claudeCollect(blocks: any[]): { text: string; sources: Source[]; queries: string[]; spans: Span[] } {
  const sources: Source[] = [];
  const spans: Span[] = [];
  const queries: string[] = [];
  for (const b of blocks) {
    if (b.type === "server_tool_use" && b.name === "web_search" && b.input?.query) queries.push(String(b.input.query));
    if (b.type !== "text") continue;
    const cites: number[] = [];
    for (const c of b.citations || []) {
      if (c.type !== "web_search_result_location" || !c.url) continue;
      let idx = sources.findIndex((s) => s.url === c.url);
      if (idx === -1) {
        sources.push({ title: c.title || c.url, url: c.url });
        idx = sources.length - 1;
      }
      if (!cites.includes(idx)) cites.push(idx);
    }
    spans.push({ text: b.text, cites });
  }
  return { text: spans.map((s) => s.text).join(""), sources, queries, spans };
}

/** Runs one Claude request, continuing automatically when a long web search pauses the turn. */
async function claudeRun(opts: AiOptions, model: string, contents: Contents, onText?: (t: string) => void): Promise<any[]> {
  const client = claudeClient()!;
  const messages: any[] = claudeMessages(contents);
  const blocks: any[] = [];
  for (let turn = 0; turn < 4; turn++) {
    const params = claudeParams(opts, model, messages) as any;
    let final: any;
    if (onText) {
      const stream = (client.messages as any).stream(params);
      stream.on("text", (t: string) => onText(t));
      final = await stream.finalMessage();
    } else {
      final = await client.messages.create(params);
    }
    blocks.push(...(final.content || []));
    if (final.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: final.content });
  }
  return blocks;
}

async function claudeGenerate(contents: Contents, opts: AiOptions, models: string[]): Promise<AiResult> {
  let lastErr: unknown;
  for (const model of models) {
    try {
      const blocks = await claudeRun(opts, model, contents);
      const c = claudeCollect(blocks);
      if (!c.text.trim()) throw new Error("EMPTY_RESPONSE");
      return { text: c.text, sources: c.sources, searchQueries: c.queries, spans: c.spans, provider: "claude", model };
    } catch (e) {
      lastErr = e;
      console.warn(`[ai] claude ${model} failed: ${msgOf(e).slice(0, 200)}`);
      if (!isRetryable(e)) break;
    }
  }
  throw lastErr;
}

async function* claudeStream(
  contents: Contents,
  opts: AiOptions,
  models: string[],
  done: (r: AiResult) => void,
): AsyncGenerator<string> {
  let lastErr: unknown;
  for (const model of models) {
    let started = false;
    // Bridge the SDK's callback stream into an async generator.
    const queue: string[] = [];
    let wake: (() => void) | null = null;
    let finished = false;
    let failure: unknown = null;
    let blocks: any[] = [];
    claudeRun(opts, model, contents, (t) => {
      queue.push(t);
      wake?.();
    })
      .then((b) => (blocks = b))
      .catch((e) => (failure = e))
      .finally(() => {
        finished = true;
        wake?.();
      });
    try {
      while (true) {
        if (queue.length) {
          started = true;
          yield queue.shift()!;
          continue;
        }
        if (finished) break;
        await new Promise<void>((r) => (wake = r));
        wake = null;
      }
      if (failure) throw failure;
      const c = claudeCollect(blocks);
      if (!c.text.trim()) throw new Error("EMPTY_RESPONSE");
      done({ text: c.text, sources: c.sources, searchQueries: c.queries, spans: c.spans, provider: "claude", model });
      return;
    } catch (e) {
      lastErr = e;
      console.warn(`[ai] claude stream ${model} failed: ${msgOf(e).slice(0, 200)}`);
      if (started) throw aiUnavailable(e);
      if (!isRetryable(e)) break;
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
const modelsFor = (p: "claude" | "gemini", tier: AiOptions["tier"]) =>
  p === "claude" ? (tier === "light" ? CLAUDE_LIGHT : CLAUDE_MAIN) : tier === "light" ? GEMINI_LIGHT : GEMINI_MAIN;

/** One-shot generation, with model and provider fallback. */
export async function generate(contents: Contents, opts: AiOptions): Promise<AiResult> {
  const ps = providers();
  if (!ps.length) throw new HttpError(503, "CONFIGURATION_REQUIRED", "The AI key is not configured on the server.");
  let lastErr: unknown;
  for (const p of ps) {
    try {
      return p === "claude"
        ? await claudeGenerate(contents, opts, modelsFor(p, opts.tier))
        : await geminiGenerate(contents, opts, modelsFor(p, opts.tier));
    } catch (e) {
      lastErr = e;
    }
  }
  throw aiUnavailable(lastErr);
}

/**
 * Streaming generation. Yields text as it is written; `onDone` receives the full
 * result (with sources and citation spans) at the end. Provider fallback is only
 * possible before the first chunk reaches the user.
 */
export async function* generateStream(
  contents: Contents,
  opts: AiOptions,
  onDone?: (r: AiResult) => void,
): AsyncGenerator<string> {
  const ps = providers();
  if (!ps.length) throw new HttpError(503, "CONFIGURATION_REQUIRED", "The AI key is not configured on the server.");
  let lastErr: unknown;
  for (const p of ps) {
    let started = false;
    try {
      const it =
        p === "claude"
          ? claudeStream(contents, opts, modelsFor(p, opts.tier), (r) => onDone?.(r))
          : geminiStream(contents, opts, modelsFor(p, opts.tier), (r) => onDone?.(r));
      for await (const chunk of it) {
        started = true;
        yield chunk;
      }
      return;
    } catch (e) {
      lastErr = e;
      if (started) throw aiUnavailable(e);
    }
  }
  throw aiUnavailable(lastErr);
}

/**
 * Grounding links from Gemini are Google redirect URLs. Resolve them to the real
 * article URL (best effort, short timeout) so citations stay readable.
 */
export async function resolveSources(sources: Source[], timeoutMs = 2500): Promise<Source[]> {
  return Promise.all(
    sources.map(async (s) => {
      if (!/grounding-api-redirect|vertexaisearch/.test(s.url)) return s;
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), timeoutMs);
        const r = await fetch(s.url, { method: "HEAD", redirect: "manual", signal: ctrl.signal });
        clearTimeout(t);
        const loc = r.headers.get("location");
        return loc && /^https?:\/\//.test(loc) ? { ...s, url: loc } : s;
      } catch {
        return s;
      }
    }),
  );
}

/** Extracts the first JSON array/object from model text. Returns null if none. */
export function extractJson<T = unknown>(text: string): T | null {
  const cleaned = text.replace(/```(?:json)?/gi, "");
  // Use whichever JSON shape starts first, so an object containing an array is returned whole.
  const firstArr = cleaned.indexOf("[");
  const firstObj = cleaned.indexOf("{");
  const order: Array<[string, string]> =
    firstObj !== -1 && (firstArr === -1 || firstObj < firstArr) ? [["{", "}"], ["[", "]"]] : [["[", "]"], ["{", "}"]];
  for (const [open, close] of order) {
    const start = cleaned.indexOf(open);
    const end = cleaned.lastIndexOf(close);
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        /* try next shape */
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Citations and "unsupported claim" checks
// ---------------------------------------------------------------------------
const COUNTER_TWEET = /\*\*Counter-Tweet:\*\*/i;

/** Numbers in a text, normalised ("₹5,000" -> "5000", "3.1%" -> "3.1"). */
const numbersIn = (t: string) => (t.match(/\d[\d,]*(?:\.\d+)?/g) || []).map((n) => n.replace(/,/g, ""));

/**
 * Sentences that state a figure which appears in NO cited passage. These are the
 * riskiest claims, so we show them to the reader. Work at sentence level over the
 * whole answer: a sentence counts as sourced if any part of it is cited, or if all
 * its numbers appear in cited passages (e.g. restating a cited figure).
 * Calculations ("a + b = c") and questions are not flagged.
 */
export function unsupportedClaims(spans: Span[]): string[] {
  const citedNumbers = new Set(spans.filter((s) => s.cites.length).flatMap((s) => numbersIn(s.text)));
  // Rebuild the text with a marker for which characters are cited.
  let text = "";
  const cited: boolean[] = [];
  for (const s of spans) {
    text += s.text;
    for (let i = 0; i < s.text.length; i++) cited.push(s.cites.length > 0);
  }
  const out: string[] = [];
  // A sentence ends at . ! ? । followed by a space/newline/end (so "3.1%" is not split).
  const re = /(?:[^\n.!?।]|[.!?।](?=[^\s.!?।]))+(?:[.!?।]+|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = m[0];
    const start = m.index;
    if (cited.slice(start, start + raw.length).some(Boolean)) continue;
    const lineStart = text.lastIndexOf("\n", start) + 1;
    const lineEnd = text.indexOf("\n", start);
    if (COUNTER_TWEET.test(text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd))) continue;
    // Strip Markdown list/heading/quote markers and bold (keep numbers that start a sentence).
    const sentence = raw.replace(/^\s*(?:[#>*\-]+|\d+[.)])\s+/, "").replace(/\*\*/g, "").trim();
    if (sentence.length < 15 || /\?\s*$/.test(sentence) || /=/.test(sentence)) continue;
    const nums = numbersIn(sentence).filter((n) => !/^(19|20)\d\d$/.test(n) || !citedNumbers.has(n));
    if (!nums.length) continue;
    if (nums.every((n) => citedNumbers.has(n))) continue;
    out.push(sentence.length > 220 ? `${sentence.slice(0, 217)}...` : sentence);
  }
  return [...new Set(out)].slice(0, 6);
}

/** The answer with inline [n] citation links after each supported span. */
export function citedText(spans: Span[], sources: Source[]): string {
  return spans
    .map((s) => {
      if (!s.cites.length) return s.text;
      const marks = s.cites
        .slice(0, 3)
        .map((i) => `[[${i + 1}]](${sources[i]?.url ?? "#"})`)
        .join("");
      // Put markers before trailing whitespace/newlines so they stay on the same line.
      const m = s.text.match(/^([\s\S]*?)(\s*)$/)!;
      return `${m[1]} ${marks}${m[2]}`;
    })
    .join("");
}

/** "Title (site)", or just the site when the page title is missing or junk (e.g. a timestamp). */
export function sourceLabel(s: Source): string {
  let host = "";
  try {
    host = new URL(s.url).hostname.replace(/^www\./, "");
  } catch {
    /* keep empty */
  }
  const title = (s.title || "").replace(/\s+/g, " ").trim();
  const letters = (title.match(/\p{L}/gu) || []).length;
  const junk = !title || letters < 8 || /^\w+ \d{1,2}, \d{4}/.test(title) || /^(sunday|monday|tuesday|wednesday|thursday|friday|saturday),/i.test(title) || title === s.url;
  if (junk) return host || s.url;
  const short = title.length > 90 ? `${title.slice(0, 87)}...` : title;
  return host && !short.toLowerCase().includes(host.split(".")[0]) ? `${short} (${host})` : short;
}

/** Markdown footer: numbered sources, search queries, and any unsupported figures. */
export function sourcesMarkdown(sources: Source[], queries: string[] = [], unsupported: string[] = [], text = ""): string {
  if (!sources.length) {
    // Only warn when the answer actually states figures (a clarifying question needs no sources).
    return /\d/.test(text.replace(/\*\*Counter-Tweet:\*\*[\s\S]*$/, ""))
      ? "\n\n---\n_No live web sources were found for this answer. Treat every figure in it as unverified._"
      : "";
  }
  // List every cited source so each [n] in the text has a matching entry.
  const listMd = sources
    .slice(0, 40)
    .map((s, i) => `${i + 1}. [${sourceLabel(s).replace(/[\[\]]/g, "")}](${s.url})`)
    .join("\n");
  const q = queries.length
    ? `\n\n_Searched: ${queries
        .slice(0, 4)
        .map((x) => `[${x.replace(/[\[\]]/g, "")}](https://www.google.com/search?q=${encodeURIComponent(x)})`)
        .join(" · ")}_`
    : "";
  const warn = unsupported.length
    ? `\n\n**Not matched to a source — check before relying on these:**\n${unsupported.map((u) => `- ${u}`).join("\n")}`
    : "";
  return `\n\n---\n**Sources**\n${listMd}${q}${warn}`;
}

/** The full, final answer as shown to users: inline citations + sources footer. */
export function finalAnswer(r: Pick<AiResult, "spans" | "sources" | "searchQueries"> & { text?: string }): string {
  return citedText(r.spans, r.sources).trim() + sourcesMarkdown(r.sources, r.searchQueries, unsupportedClaims(r.spans), r.text ?? r.spans.map((s) => s.text).join(""));
}
