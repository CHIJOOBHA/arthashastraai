import { db, auth, resilientGetDoc, resilientGetDocs, toDate } from './firebase';
import {
  collection,
  doc,
  deleteDoc,
  query,
  where,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { getMessages } from './chatStore';

/**
 * Personal day-by-day notes ("temporal blocks"). One Firestore document per day:
 * temporal_blocks/{uid}_{YYYY-MM-DD}. Inside it, entries form a SHA-256 hash chain
 * (each entry's hash covers its index, role, time, text and the previous hash), so
 * accidental or manual edits of stored entries are detectable. It is a private,
 * editable store: you can delete a day at any time. It is not a blockchain.
 */

export const GENESIS_HASH = 'GENESIS_BLOCK';
/** Firestore documents are capped at 1 MiB; stay well below. */
const MAX_DAY_BYTES = 900_000;

export interface MessageBlock {
  id: string;
  index: number;
  role: 'user' | 'model' | 'system';
  text: string;
  hash: string;
  previousHash: string;
  createdAt: string; // ISO time
}

export interface TemporalDayBlock {
  id: string; // YYYY-MM-DD
  userId: string;
  year: number;
  month: number;
  day: number;
  dateStr: string; // "YYYY-MM-DD"
  messageBlocks: MessageBlock[];
  summary?: string;
  updatedAt?: any;
}

export interface NewEntry {
  id?: string;
  role: 'user' | 'model' | 'system';
  text: string;
  createdAt?: string;
}

function requireUser() {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in to use your memory calendar.');
  return user;
}

function parseDateStr(dateStr: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) throw new Error(`Invalid date: ${dateStr}`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  return { year, month, day };
}

const dayRef = (uid: string, dateStr: string) => doc(db, 'temporal_blocks', `${uid}_${dateStr}`);

/** SHA-256 (hex) of one entry and the hash before it. */
export async function computeMessageHash(index: number, role: string, createdAt: string, text: string, prevHash: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('SHA-256 is unavailable in this browser (a secure https page is required).');
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(`${index}|${role}|${createdAt}|${text}|${prevHash}`));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface ChainCheck {
  valid: boolean;
  /** First entry whose link or hash does not match, or -1. */
  errorIndex: number;
  /** True when entries were written by the old app version (short checksum, not verifiable). */
  legacy: boolean;
}

/** Recomputes every link of a day's chain. Never modifies stored data. */
export async function verifyDayChain(entries: MessageBlock[]): Promise<ChainCheck> {
  let prev = GENESIS_HASH;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (typeof e.hash === 'string' && e.hash.startsWith('AKSHA_HEX_')) {
      return { valid: false, errorIndex: i, legacy: true };
    }
    if (e.index !== i || e.previousHash !== prev) return { valid: false, errorIndex: i, legacy: false };
    const h = await computeMessageHash(i, e.role, e.createdAt, e.text, prev);
    if (h !== e.hash) return { valid: false, errorIndex: i, legacy: false };
    prev = e.hash;
  }
  return { valid: true, errorIndex: -1, legacy: false };
}

function toBlock(uid: string, dateStr: string, data: Record<string, any>): TemporalDayBlock {
  const messageBlocks = (Array.isArray(data.messageBlocks) ? data.messageBlocks : []) as MessageBlock[];
  messageBlocks.sort((a, b) => a.index - b.index);
  const parts = parseDateStr(dateStr);
  return {
    id: dateStr,
    userId: uid,
    ...parts,
    dateStr,
    messageBlocks,
    summary: typeof data.summary === 'string' ? data.summary : '',
    updatedAt: data.updatedAt,
  };
}

/**
 * Reads one day. Returns null only when the day does not exist yet.
 * Any other problem (offline, permission) THROWS, so callers never mistake an
 * error for an empty day and overwrite it.
 */
export async function getTemporalDayBlock(dateStr: string): Promise<TemporalDayBlock | null> {
  const user = requireUser();
  const snap = await resilientGetDoc(dayRef(user.uid, dateStr));
  if (!snap.exists()) return null;
  return toBlock(user.uid, dateStr, snap.data());
}

/** Creates an empty day if (and only if) it does not exist. Never overwrites. */
export async function initializeDayBlock(dateStr: string): Promise<void> {
  const user = requireUser();
  const parts = parseDateStr(dateStr);
  const ref = dayRef(user.uid, dateStr);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) return;
    tx.set(ref, { userId: user.uid, ...parts, dateStr, messageBlocks: [], summary: '', updatedAt: serverTimestamp() });
  });
}

/**
 * Appends entries to the end of a day's chain inside a transaction, so two tabs
 * cannot overwrite each other. Existing entries are never rewritten or re-hashed.
 * Entries whose id is already in the day are skipped. Returns how many were added.
 */
export async function appendEntriesToDay(dateStr: string, entries: NewEntry[], summary?: string): Promise<number> {
  const user = requireUser();
  const parts = parseDateStr(dateStr);
  const ref = dayRef(user.uid, dateStr);

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const existing: MessageBlock[] = snap.exists() ? toBlock(user.uid, dateStr, snap.data()).messageBlocks : [];
    const knownIds = new Set(existing.map((e) => e.id));
    const fresh = entries.filter((e) => e.text.trim() && !(e.id && knownIds.has(e.id)));
    if (!fresh.length) return 0;

    const added: MessageBlock[] = [];
    let prev = existing.length ? existing[existing.length - 1].hash : GENESIS_HASH;
    let index = existing.length;
    for (const e of fresh) {
      const createdAt = e.createdAt || new Date().toISOString();
      const hash = await computeMessageHash(index, e.role, createdAt, e.text, prev);
      added.push({ id: e.id || crypto.randomUUID(), index, role: e.role, text: e.text, hash, previousHash: prev, createdAt });
      prev = hash;
      index++;
    }

    const all = [...existing, ...added];
    const bytes = new TextEncoder().encode(JSON.stringify(all)).length;
    if (bytes > MAX_DAY_BYTES) {
      throw new Error(`This day would hold about ${Math.round(bytes / 1024)} KB, above the ~${Math.round(MAX_DAY_BYTES / 1000)} KB limit of one day. Use another date for the rest.`);
    }

    const prevSummary = snap.exists() && typeof snap.data().summary === 'string' ? snap.data().summary : '';
    tx.set(ref, {
      userId: user.uid,
      ...parts,
      dateStr,
      messageBlocks: all,
      summary: summary ? (prevSummary ? `${prevSummary}\n${summary}` : summary) : prevSummary,
      updatedAt: serverTimestamp(),
    });
    return added.length;
  });
}

/** Appends one entry written by the user. */
export async function addMessageBlockToDay(dateStr: string, role: 'user' | 'model' | 'system', text: string): Promise<number> {
  return appendEntriesToDay(dateStr, [{ role, text }]);
}

/**
 * Copies a conversation's messages to the end of a day, keeping their original
 * times. Messages already copied to that day are skipped. Returns how many were added.
 */
export async function importChatToDayBlock(dateStr: string, chatId: string, title: string): Promise<number> {
  requireUser();
  const messages = await getMessages(chatId);
  if (!messages.length) throw new Error('That conversation has no messages to copy.');
  const entries: NewEntry[] = messages.map((m) => ({
    id: `${chatId}:${m.id}`,
    role: m.role === 'user' ? 'user' : 'model',
    text: m.text || '',
    createdAt: (toDate(m.timestamp) || new Date()).toISOString(),
  }));
  return appendEntriesToDay(dateStr, entries, `Copied from conversation: "${(title || 'Untitled').slice(0, 120)}"`);
}

/** Permanently deletes one day. */
export async function deleteDayBlock(dateStr: string): Promise<void> {
  const user = requireUser();
  await deleteDoc(dayRef(user.uid, dateStr));
}

/** All of the user's days (for the calendar dots and for export). Throws on error. */
export async function getAllTemporalBlocks(): Promise<TemporalDayBlock[]> {
  const user = requireUser();
  const snap = await resilientGetDocs(query(collection(db, 'temporal_blocks'), where('userId', '==', user.uid)));
  return snap.docs
    .map((d) => {
      const data = d.data();
      const dateStr = typeof data.dateStr === 'string' ? data.dateStr : d.id.slice(user.uid.length + 1);
      try {
        return toBlock(user.uid, dateStr, data);
      } catch {
        return null;
      }
    })
    .filter((b): b is TemporalDayBlock => b !== null)
    .sort((a, b) => a.dateStr.localeCompare(b.dateStr));
}

/** Dates (YYYY-MM-DD) that have a stored day. Throws on error. */
export async function getPopulatedBlockDates(): Promise<string[]> {
  return (await getAllTemporalBlocks()).map((b) => b.dateStr);
}

/** Deletes every day of the user. Returns how many were deleted. */
export async function deleteAllTemporalBlocks(): Promise<number> {
  const user = requireUser();
  const snap = await resilientGetDocs(query(collection(db, 'temporal_blocks'), where('userId', '==', user.uid)));
  for (let i = 0; i < snap.docs.length; i += 450) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return snap.size;
}
