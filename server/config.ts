/**
 * Central server configuration. Every secret is read here and nowhere else,
 * so it is easy to audit what the server depends on.
 */
import fs from "fs";
import path from "path";

const PLACEHOLDERS = [
  "MY_GEMINI_API_KEY",
  "MY_APP_URL",
  "MY_FIREBASE",
  "YOUR_API_KEY",
  "YOUR_PROJECT_ID",
  "YOUR_DATABASE_ID",
  "REPLACE_WITH",
  "AIza_FAKE",
  "TODO",
];

/** True when a value is missing or still an example placeholder. */
export function isPlaceholder(val: unknown): boolean {
  if (typeof val !== "string") return true;
  const v = val.trim();
  if (v.length < 4) return true;
  return PLACEHOLDERS.some((p) => v.includes(p));
}

/** Returns the env value, or "" when missing / placeholder. */
export function env(name: string): string {
  const v = process.env[name];
  return isPlaceholder(v) ? "" : (v as string).trim();
}

/** AI Studio drops a firebase-applet-config.json next to the app. It is optional. */
function readAppletConfig(): Record<string, string> {
  try {
    const p = path.resolve(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    console.warn("[config] Could not read firebase-applet-config.json:", (e as Error).message);
  }
  return {};
}

const applet = readAppletConfig();

export const config = {
  isProduction: process.env.NODE_ENV === "production",
  isVercel: !!process.env.VERCEL,
  port: parseInt(process.env.PORT || "3000", 10),

  geminiKey:
    env("GEMINI_API_KEY") || env("USER_GEMINI_KEY") || env("GOOGLE_API_KEY"),
  anthropicKey: env("ANTHROPIC_API_KEY"),
  /** Which AI to use first when both keys are set: "claude" (default) or "gemini". */
  aiProvider: (process.env.AI_PROVIDER || "claude").trim().toLowerCase() === "gemini" ? "gemini" : "claude",

  firebase: {
    projectId:
      env("FIREBASE_PROJECT_ID") ||
      env("VITE_FIREBASE_PROJECT_ID") ||
      (isPlaceholder(applet.projectId) ? "" : applet.projectId) ||
      env("GOOGLE_CLOUD_PROJECT"),
    databaseId:
      env("FIREBASE_DATABASE_ID") ||
      env("VITE_FIREBASE_DATABASE_ID") ||
      (isPlaceholder(applet.firestoreDatabaseId) ? "" : applet.firestoreDatabaseId) ||
      "(default)",
    serviceAccount: env("FIREBASE_SERVICE_ACCOUNT"),
  },

  razorpay: {
    keyId: env("RAZORPAY_KEY_ID") || env("VITE_RAZORPAY_KEY_ID"),
    keySecret: env("RAZORPAY_KEY_SECRET"),
    webhookSecret: env("RAZORPAY_WEBHOOK_SECRET"),
    /** Price in paise. Default ₹34 for 30 days. */
    pricePaise: parseInt(process.env.SUBSCRIPTION_PRICE_PAISE || "3400", 10),
    periodDays: parseInt(process.env.SUBSCRIPTION_DAYS || "30", 10),
  },

  ledgerSecret: env("AITIHYA_SIGNING_SECRET"),
  cronSecret: env("CRON_SECRET"),

  /** Comma separated emails that get admin rights on the server. */
  adminEmails: (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),

  /** Daily AI request limits per user. */
  limits: {
    anonymous: parseInt(process.env.DAILY_LIMIT_ANONYMOUS || "5", 10),
    free: parseInt(process.env.DAILY_LIMIT_FREE || "20", 10),
    subscriber: parseInt(process.env.DAILY_LIMIT_SUBSCRIBER || "200", 10),
    freeExplanations: parseInt(process.env.FREE_EXPLANATIONS || "3", 10),
  },
};
