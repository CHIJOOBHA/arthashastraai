/**
 * Firebase Admin initialisation. The server ONLY talks to Firestore through the
 * Admin SDK. (The old code fell back to the browser SDK, which forced the
 * database rules to be left open to the whole internet.)
 */
import admin from "firebase-admin";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { config } from "./config.js";

let db: Firestore | null = null;
let initError = "";

function parseServiceAccount(raw: string): admin.ServiceAccount | null {
  try {
    // Accept plain JSON or base64-encoded JSON (easier to paste into Vercel).
    const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const parsed = JSON.parse(text);
    if (typeof parsed.private_key === "string") {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return parsed;
  } catch {
    return null;
  }
}

function init() {
  if (admin.apps.length) return;
  const { projectId, serviceAccount } = config.firebase;
  try {
    if (serviceAccount) {
      const sa = parseServiceAccount(serviceAccount);
      if (!sa) throw new Error("FIREBASE_SERVICE_ACCOUNT is not valid JSON (or base64 JSON).");
      admin.initializeApp({
        credential: admin.credential.cert(sa),
        projectId: projectId || (sa as any).project_id,
      });
    } else {
      // Application Default Credentials: works on Cloud Run / AI Studio.
      admin.initializeApp(projectId ? { projectId } : undefined);
    }
  } catch (e) {
    initError = (e as Error).message;
    console.error("[firebase-admin] init failed:", initError);
  }
}

/** Returns Firestore, or null if Firebase is not configured. */
export function getDb(): Firestore | null {
  if (db) return db;
  init();
  if (!admin.apps.length) return null;
  try {
    const dbId = config.firebase.databaseId;
    db = dbId && dbId !== "(default)" ? getFirestore(admin.app(), dbId) : getFirestore(admin.app());
    return db;
  } catch (e) {
    initError = (e as Error).message;
    console.error("[firebase-admin] Firestore init failed:", initError);
    return null;
  }
}

/** Throws a clear error when Firestore is required but missing. */
export function requireDb(): Firestore {
  const d = getDb();
  if (!d) throw Object.assign(new Error("DATABASE_UNAVAILABLE"), { status: 503 });
  return d;
}

export function getAdminAuth(): admin.auth.Auth | null {
  init();
  return admin.apps.length ? admin.auth() : null;
}

export function firebaseStatus() {
  return {
    ready: !!getDb(),
    databaseId: config.firebase.databaseId,
    error: initError || undefined,
  };
}
