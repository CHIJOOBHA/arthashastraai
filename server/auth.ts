/**
 * Authentication, admin checks, subscription status and per-user daily quotas.
 * Every endpoint that spends AI tokens goes through `requireUser` + `consumeQuota`.
 */
import type { Request, Response, NextFunction } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getDb } from "./firebaseAdmin.js";
import { config } from "./config.js";

export interface AuthedUser {
  uid: string;
  email?: string;
  isAnonymous: boolean;
  isAdmin: boolean;
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
  try {
    await db
      .collection("usage")
      .doc(`${user.uid}_${today()}`)
      .update({ count: FieldValue.increment(-cost) });
  } catch {
    /* best effort */
  }
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

  const ref = db.collection("usage").doc(`${user.uid}_${today()}`);
  const used = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
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
  return { used, limit };
}

/**
 * Small in-memory burst limiter (per server instance) as a first line of
 * defence against floods, before any database or AI work happens.
 */
const hits = new Map<string, number[]>();
export function burstLimit(maxPerMinute: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
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
