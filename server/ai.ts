/**
 * Gemini wrapper.
 *  - Optional Google Search grounding, with the real source links returned.
 *  - Model fallback on quota / overload errors.
 *  - NO invented fallback content: if the AI is unavailable we say so.
 */
import { GoogleGenAI } from "@google/genai";
import { config } from "./config.js";
import { HttpError } from "./auth.js";

export interface Source {
  title: string;
  url: string;
}

export interface AiResult {
  text: string;
  sources: Source[];
  searchQueries: string[];
}

export interface AiOptions {
  system: string;
  /** Use Google Search so answers are based on live, citable sources. */
  grounded?: boolean;
  /** Ask for JSON output (not combined with grounding; parse with extractJson). */
  json?: boolean;
  temperature?: number;
}

const MODELS = (process.env.GEMINI_MODELS || "gemini-3.5-flash,gemini-flash-latest,gemini-flash-lite-latest")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (client) return client;
  if (!config.geminiKey) {
    throw new HttpError(503, "CONFIGURATION_REQUIRED", "The AI key is not configured on the server.");
  }
  if (!client) client = new GoogleGenAI({ apiKey: config.geminiKey });
  return client;
}

export const aiConfigured = () => !!config.geminiKey || !!client;

/** Test hook: inject a fake Gemini client. */
export function __setAiClientForTests(fake: unknown) {
  client = fake as GoogleGenAI;
}

/** Errors where trying the next model makes sense. */
function isRetryable(err: unknown): boolean {
  const s = String((err as any)?.message || err);
  return /429|RESOURCE_EXHAUSTED|quota|503|UNAVAILABLE|overloaded|demand|500|INTERNAL|not found|NOT_FOUND|404/i.test(s);
}

function isQuota(err: unknown): boolean {
  return /429|RESOURCE_EXHAUSTED|quota/i.test(String((err as any)?.message || err));
}

function buildConfig(opts: AiOptions) {
  const cfg: Record<string, unknown> = {
    systemInstruction: opts.system,
    temperature: opts.temperature ?? (opts.grounded ? 0.3 : 0.5),
  };
  if (opts.grounded) cfg.tools = [{ googleSearch: {} }];
  if (opts.json && !opts.grounded) cfg.responseMimeType = "application/json";
  return cfg;
}

type Contents = string | Array<{ role: string; parts: Array<{ text: string }> }>;

function normaliseContents(contents: Contents) {
  return typeof contents === "string" ? [{ role: "user", parts: [{ text: contents }] }] : contents;
}

/** Pulls the real web sources and search queries out of a Gemini response. */
function collectGrounding(candidate: any, into: { sources: Map<string, Source>; queries: Set<string> }) {
  const gm = candidate?.groundingMetadata;
  if (!gm) return;
  for (const chunk of gm.groundingChunks || []) {
    const uri = chunk?.web?.uri;
    if (uri && !into.sources.has(uri)) {
      into.sources.set(uri, { title: chunk.web.title || new URL(uri).hostname, url: uri });
    }
  }
  for (const q of gm.webSearchQueries || []) into.queries.add(q);
}

/**
 * Grounding links are Google redirect URLs. Resolve them to the real article
 * URL (best effort, short timeout) so stored citations stay readable.
 */
export async function resolveSources(sources: Source[], timeoutMs = 2500): Promise<Source[]> {
  const out = await Promise.all(
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
  // De-duplicate after resolution.
  const seen = new Set<string>();
  return out.filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true)));
}

/** One-shot generation with model fallback. */
export async function generate(contents: Contents, opts: AiOptions): Promise<AiResult> {
  const ai = getClient();
  let lastErr: unknown;
  for (const model of MODELS) {
    try {
      const res: any = await ai.models.generateContent({
        model,
        contents: normaliseContents(contents),
        config: buildConfig(opts),
      });
      const acc = { sources: new Map<string, Source>(), queries: new Set<string>() };
      collectGrounding(res.candidates?.[0], acc);
      const text = res.text ?? "";
      if (!text.trim()) throw new Error("EMPTY_RESPONSE");
      return { text, sources: [...acc.sources.values()], searchQueries: [...acc.queries] };
    } catch (e) {
      lastErr = e;
      console.warn(`[ai] ${model} failed: ${String((e as any)?.message || e).slice(0, 200)}`);
      if (!isRetryable(e) && String((e as any)?.message) !== "EMPTY_RESPONSE") break;
    }
  }
  throw aiUnavailable(lastErr);
}

/**
 * Streaming generation with model fallback. Fallback is only possible before
 * the first chunk has been sent to the user.
 */
export async function* generateStream(
  contents: Contents,
  opts: AiOptions,
  onDone?: (r: { sources: Source[]; searchQueries: string[] }) => void,
): AsyncGenerator<string> {
  const ai = getClient();
  let lastErr: unknown;
  for (const model of MODELS) {
    let started = false;
    try {
      const stream: any = await ai.models.generateContentStream({
        model,
        contents: normaliseContents(contents),
        config: buildConfig(opts),
      });
      const acc = { sources: new Map<string, Source>(), queries: new Set<string>() };
      for await (const chunk of stream) {
        collectGrounding(chunk.candidates?.[0], acc);
        const t = chunk.text;
        if (t) {
          started = true;
          yield t;
        }
      }
      if (!started) throw new Error("EMPTY_RESPONSE");
      onDone?.({ sources: [...acc.sources.values()], searchQueries: [...acc.queries] });
      return;
    } catch (e) {
      lastErr = e;
      console.warn(`[ai] stream ${model} failed: ${String((e as any)?.message || e).slice(0, 200)}`);
      if (started) throw aiUnavailable(e); // cannot switch model mid-answer
      if (!isRetryable(e) && String((e as any)?.message) !== "EMPTY_RESPONSE") break;
    }
  }
  throw aiUnavailable(lastErr);
}

function aiUnavailable(err: unknown): HttpError {
  if (err instanceof HttpError) return err;
  return isQuota(err)
    ? new HttpError(429, "RESOURCE_EXHAUSTED", "The AI is busy right now (quota reached). Please try again later.")
    : new HttpError(503, "AI_UNAVAILABLE", "The AI could not answer right now. Please try again in a minute.");
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

/** Markdown block listing the sources, appended to answers shown to users. */
export function sourcesMarkdown(sources: Source[], queries: string[] = []): string {
  if (!sources.length) {
    return "\n\n---\n_No live web sources were used for this answer. Treat any figures as unverified._";
  }
  const list = sources
    .slice(0, 10)
    .map((s, i) => `${i + 1}. [${s.title.replace(/[\[\]]/g, "")}](${s.url})`)
    .join("\n");
  const q = queries.length
    ? `\n\n_Searched on Google: ${queries
        .slice(0, 4)
        .map((x) => `[${x.replace(/[\[\]]/g, "")}](https://www.google.com/search?q=${encodeURIComponent(x)})`)
        .join(" · ")}_`
    : "";
  return `\n\n---\n**Sources**\n${list}${q}`;
}
