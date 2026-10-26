import { useEffect, useState } from 'react';
import { initializeApp, setLogLevel } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInAnonymously, onAuthStateChanged, type User } from 'firebase/auth';
import {
  getFirestore,
  getDoc,
  getDocs,
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
  Query,
  QuerySnapshot,
} from 'firebase/firestore';

// Configuration comes from VITE_FIREBASE_* environment variables.
// AI Studio's firebase-applet-config.json is used only if it exists (it is optional,
// so a missing file does not break the build).
const appletFiles = import.meta.glob('../../firebase-applet-config.json', { eager: true, import: 'default' }) as Record<string, Record<string, string>>;
const firebaseConfig: Record<string, string | undefined> = Object.values(appletFiles)[0] || {};

const isPlaceholder = (val: string | undefined) => !val || val.includes('MY_FIREBASE') || val.trim() === '';
const pick = (fileVal: string | undefined, envVal: string | undefined) => (!isPlaceholder(envVal) ? envVal : !isPlaceholder(fileVal) ? fileVal : undefined);

const finalConfig = {
  apiKey: pick(firebaseConfig.apiKey, import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: pick(firebaseConfig.authDomain, import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: pick(firebaseConfig.projectId, import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: pick(firebaseConfig.storageBucket, import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: pick(firebaseConfig.messagingSenderId, import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: pick(firebaseConfig.appId, import.meta.env.VITE_FIREBASE_APP_ID),
  firestoreDatabaseId: pick(firebaseConfig.firestoreDatabaseId, import.meta.env.VITE_FIREBASE_DATABASE_ID),
};

// AI Studio preview hosts look like "ais-dev-<project>-<n>.<domain>". When no project
// ID is configured there, the project ID can be read from the hostname.
if (isPlaceholder(finalConfig.projectId) && typeof window !== 'undefined') {
  const aisMatch = window.location.hostname.match(/^(ais-(?:dev|pre)-[a-z0-9-]+)-\d+\./);
  if (aisMatch) {
    const detectedId = aisMatch[1];
    finalConfig.projectId = detectedId;
    finalConfig.authDomain = `${detectedId}.firebaseapp.com`;
    finalConfig.storageBucket = `${detectedId}.firebasestorage.app`;
  }
}

export const firebaseConfigured = !isPlaceholder(finalConfig.projectId) && !isPlaceholder(finalConfig.apiKey);
if (!firebaseConfigured) {
  console.warn('[Firebase] Not configured: set the VITE_FIREBASE_* environment variables.');
}

let app;
try {
  app = initializeApp(isPlaceholder(finalConfig.projectId) ? { apiKey: 'none', projectId: 'none' } : finalConfig);
  setLogLevel('silent');
} catch (e) {
  console.error('[Firebase] Initialisation failed:', e);
  app = initializeApp({ apiKey: 'none', projectId: 'none' });
}

export const auth = getAuth(app);
const databaseId = !isPlaceholder(finalConfig.firestoreDatabaseId) ? finalConfig.firestoreDatabaseId : undefined;
export const db = getFirestore(app, databaseId === '(default)' || databaseId === 'default' ? undefined : databaseId);

/**
 * Kept for backwards compatibility. The client no longer switches databases at
 * runtime based on a server response; the database is fixed by configuration.
 */
export async function syncNeuralLink(): Promise<void> {
  return;
}

// ---------- resilient reads ----------
// Only transient errors are retried. Permission, missing-index and other
// permanent errors are rethrown so callers can show them instead of an empty list.
const TRANSIENT_CODES = new Set(['unavailable', 'deadline-exceeded']);
const isTransient = (e: unknown) => {
  const code = (e as { code?: string } | null)?.code;
  return typeof code === 'string' && TRANSIENT_CODES.has(code);
};
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function resilientGetDoc<T = DocumentData>(docRef: DocumentReference<T>, maxRetries = 3): Promise<DocumentSnapshot<T>> {
  let delay = 500;
  for (let attempt = 1; ; attempt++) {
    try {
      return await getDoc(docRef);
    } catch (e) {
      if (!isTransient(e) || attempt >= maxRetries) throw e;
      await sleep(delay);
      delay *= 2;
    }
  }
}

export async function resilientGetDocs<T = DocumentData>(q: Query<T>, maxRetries = 3): Promise<QuerySnapshot<T>> {
  let delay = 500;
  for (let attempt = 1; ; attempt++) {
    try {
      return await getDocs(q);
    } catch (e) {
      if (!isTransient(e) || attempt >= maxRetries) throw e;
      await sleep(delay);
      delay *= 2;
    }
  }
}

// ---------- auth helpers ----------
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const signInAnonymous = () => signInAnonymously(auth);
export const signOut = () => auth.signOut();

/** Authorization header for calls to our own server. Every AI endpoint requires it. */
export async function authHeaders(): Promise<Record<string, string>> {
  const u = auth.currentUser;
  if (!u) throw new Error('AUTH_REQUIRED');
  return { Authorization: `Bearer ${await u.getIdToken()}` };
}

/** Converts Firestore Timestamps, {seconds,nanoseconds} maps, ISO strings, millis or Dates into a Date (or null). */
export function toDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6));
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// ---------- error handling ----------
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  code: string | undefined;
  operationType: OperationType;
  path: string | null;
  userId: string | undefined;
  isAnonymous: boolean | undefined;
}

/**
 * Logs a Firestore error without crashing the app. Transient network noise is
 * ignored; everything else (including permission-denied) is logged with console.error
 * so it is never hidden. Callers that need to inform the user should also show a message.
 */
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): FirestoreErrorInfo | null {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string } | null)?.code;
  const low = errorMessage.toLowerCase();

  if (
    code === 'cancelled' ||
    low.includes('disconnecting idle stream') ||
    low.includes('network-request-failed')
  ) {
    return null;
  }

  const info: FirestoreErrorInfo = {
    error: errorMessage,
    code,
    operationType,
    path,
    userId: auth.currentUser?.uid,
    isAnonymous: auth.currentUser?.isAnonymous,
  };
  if (code === 'unavailable' || code === 'deadline-exceeded') {
    console.warn('[Firestore] Temporarily unavailable:', info);
  } else if (code === 'permission-denied') {
    console.error('[Firestore] Permission denied:', info);
  } else {
    console.error('[Firestore] Error:', info);
  }
  return info;
}

// ---------- types ----------
export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp?: any;
  index?: number;
  hash?: string;
  previousHash?: string;
}

export interface IntelligenceItem {
  id?: string;
  source: string;
  content: string;
  timestamp: string;
  isBroadcasted?: boolean;
  explanationId?: string;
  metadata?: any;
}

export interface Tweet {
  id?: string;
  tweetId: string;
  author: string;
  text: string;
  timestamp: string;
  processed: boolean;
  userApproved?: boolean;
  draftRebuttal?: string;
  draftLogic?: string;
}

export interface AgentResponse {
  id?: string;
  targetId: string;
  responseText: string;
  counterTweet?: string;
  status: 'pending' | 'posted' | 'failed';
  timestamp: string;
}

export interface AgentLog {
  id?: string;
  agentName: string;
  action: string;
  status: string;
  timestamp: string;
}

// ---------- React helper ----------

/**
 * Returns the signed-in user. If the parent passes `user` (even null), that value is
 * used; if it passes nothing (undefined), this subscribes to Firebase Auth itself.
 */
export function useAuthUser(propUser?: User | null): User | null {
  const [authUser, setAuthUser] = useState<User | null>(() => auth.currentUser);
  const controlled = propUser !== undefined;
  useEffect(() => {
    if (controlled) return;
    return onAuthStateChanged(auth, setAuthUser);
  }, [controlled]);
  return controlled ? propUser ?? null : authUser;
}
