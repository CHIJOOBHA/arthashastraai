import { db, auth, resilientGetDoc, resilientGetDocs, toDate } from './firebase';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  DocumentReference,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { deleteAllTemporalBlocks, getAllTemporalBlocks } from './temporalStore';

/**
 * Cold storage: the user can move an old conversation out of the chat list into a
 * single private document (cold_archives), and restore it later. Plain Firestore
 * documents, protected by the Firestore security rules (only the owner can read
 * them). No extra encryption or compression is applied.
 */

const BATCH_LIMIT = 450;
/** Firestore documents are capped at 1 MiB; keep archives below ~900 KB. */
export const MAX_ARCHIVE_BYTES = 900_000;

const MESSAGE_KEYS = ['id', 'role', 'text', 'userId', 'index', 'hash', 'previousHash', 'timestamp', 'createdAt'] as const;

export interface ColdArchive {
  id: string;
  userId: string;
  conversationId: string;
  title: string;
  /** Local date (YYYY-MM-DD) of the conversation's last activity. */
  date: string;
  msgCount: number;
  sizeBytes?: number;
  migratedAt: any;
  /** JSON string of the archived messages. */
  messages?: string;
  /** JSON string of the archived conversation document. */
  chatData?: string;
}

export interface AuditEntry {
  id: string;
  userId: string;
  action: string;
  details: string;
  timestamp: Date | null;
}

export interface ArchivedMessage {
  id: string;
  role: string;
  text: string;
  hash?: string;
  createdAt: Date | null;
}

function requireUser() {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in first.');
  return user;
}

const localDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Turns Firestore Timestamps into {"__ts": millis} so they survive JSON. */
function serialize(value: unknown): unknown {
  if (value instanceof Timestamp) return { __ts: value.toMillis() };
  if (value instanceof Date) return { __ts: value.getTime() };
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, serialize(v)]));
  }
  return value;
}

/** Turns {"__ts": millis} or an old {seconds, nanoseconds} map back into a Firestore Timestamp. */
function reviveTimestamp(value: any): Timestamp | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value;
  if (typeof value === 'object' && typeof value.__ts === 'number') return Timestamp.fromMillis(value.__ts);
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return Timestamp.fromMillis(value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6));
  }
  const d = toDate(value);
  return d ? Timestamp.fromDate(d) : null;
}

const toJsDate = (value: any): Date | null => {
  if (value && typeof value === 'object' && typeof value.__ts === 'number') return new Date(value.__ts);
  return toDate(value);
};

/** Deletes refs in batches of at most 450 operations. */
async function deleteInChunks(refs: DocumentReference[]) {
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    refs.slice(i, i + BATCH_LIMIT).forEach((r) => batch.delete(r));
    await batch.commit();
  }
}

// ---------- audit log ----------

/** Records an action in the user's own audit log. Failures are logged, never thrown. */
export async function logAudit(action: string, details: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await addDoc(collection(db, 'audit_log'), {
      userId: user.uid,
      action: action.slice(0, 100),
      details: details.slice(0, 2000),
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error('[Audit] Could not record action:', error);
  }
}

/** The user's own audit entries, newest first (max 200). Throws on error. */
export async function getAuditLogs(): Promise<AuditEntry[]> {
  const user = requireUser();
  const snap = await resilientGetDocs(query(collection(db, 'audit_log'), where('userId', '==', user.uid)));
  return snap.docs
    .map((d) => {
      const data = d.data({ serverTimestamps: 'estimate' });
      return {
        id: d.id,
        userId: String(data.userId || ''),
        action: String(data.action || ''),
        details: String(data.details ?? data.detail ?? ''),
        timestamp: toDate(data.timestamp ?? data.time),
      };
    })
    .sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0))
    .slice(0, 200);
}

// ---------- cold storage ----------

async function readConversationMessages(chatId: string) {
  const snap = await resilientGetDocs(collection(db, 'conversations', chatId, 'messages'));
  return snap.docs;
}

/**
 * Moves one conversation into cold storage: writes the archive document first, then
 * deletes the messages and the conversation. Throws a readable error on failure.
 * Refuses conversations whose archive would exceed ~900 KB.
 */
export async function migrateToCold(chatId: string): Promise<ColdArchive> {
  const user = requireUser();
  const chatRef = doc(db, 'conversations', chatId);
  const chatSnap = await resilientGetDoc(chatRef);
  if (!chatSnap.exists()) throw new Error('This conversation no longer exists.');
  const chatData = chatSnap.data();
  if (chatData.userId !== user.uid) throw new Error('You can only archive your own conversations.');

  const msgDocs = await readConversationMessages(chatId);
  const messages = msgDocs
    .map((m) => ({ ...m.data(), id: m.id }))
    .sort((a: any, b: any) => (toDate(a.createdAt)?.getTime() || 0) - (toDate(b.createdAt)?.getTime() || 0));

  const messagesJson = JSON.stringify(serialize(messages));
  const chatJson = JSON.stringify(serialize(chatData));
  const sizeBytes = new TextEncoder().encode(messagesJson + chatJson).length;
  if (sizeBytes > MAX_ARCHIVE_BYTES) {
    throw new Error(
      `This conversation is about ${Math.round(sizeBytes / 1024)} KB, above the ~${Math.round(MAX_ARCHIVE_BYTES / 1000)} KB limit for one archive. It stays in your chat list.`,
    );
  }

  const last = toDate(chatData.lastMessageAt) || toDate(chatData.updatedAt) || new Date();
  const archive = {
    userId: user.uid,
    conversationId: chatId,
    title: String(chatData.title || 'Untitled conversation').slice(0, 200),
    date: localDateStr(last),
    msgCount: messages.length,
    sizeBytes,
    migratedAt: serverTimestamp(),
    messages: messagesJson,
    chatData: chatJson,
  };
  const coldRef = await addDoc(collection(db, 'cold_archives'), archive);

  // The archive is safely written; now remove the hot copy (messages, then the conversation).
  await deleteInChunks([...msgDocs.map((m) => m.ref), chatRef]);
  await logAudit('ARCHIVE', `Moved "${archive.title}" (${messages.length} messages) to cold storage.`);
  return { ...archive, id: coldRef.id, migratedAt: new Date() };
}

/** The user's cold archives, newest first. Throws on error. */
export async function getColdArchives(): Promise<ColdArchive[]> {
  const user = requireUser();
  const snap = await resilientGetDocs(query(collection(db, 'cold_archives'), where('userId', '==', user.uid)));
  return snap.docs
    .map((d) => {
      const data = d.data({ serverTimestamps: 'estimate' });
      return {
        id: d.id,
        userId: data.userId,
        conversationId: String(data.conversationId || data.id || d.id),
        title: String(data.title || 'Untitled conversation'),
        date: typeof data.date === 'string' ? data.date : '',
        msgCount: Number(data.msgCount) || 0,
        sizeBytes: typeof data.sizeBytes === 'number' ? data.sizeBytes : undefined,
        migratedAt: data.migratedAt,
        messages: typeof data.messages === 'string' ? data.messages : undefined,
        chatData: typeof data.chatData === 'string' ? data.chatData : undefined,
      } as ColdArchive;
    })
    .sort((a, b) => (toDate(b.migratedAt)?.getTime() || 0) - (toDate(a.migratedAt)?.getTime() || 0));
}

/** Parses an archive's messages for reading (no restore). */
export function parseArchivedMessages(archive: ColdArchive): ArchivedMessage[] {
  if (!archive.messages) return [];
  try {
    const raw = JSON.parse(archive.messages);
    if (!Array.isArray(raw)) return [];
    return raw
      .map((m: any) => ({
        id: String(m.id || ''),
        role: String(m.role || ''),
        text: typeof m.text === 'string' ? m.text : '',
        hash: typeof m.hash === 'string' ? m.hash : undefined,
        createdAt: toJsDate(m.createdAt) || toJsDate(m.timestamp),
      }))
      .sort((a, b) => (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0));
  } catch {
    return [];
  }
}

/**
 * Restores an archive back to the chat list with its original times, then deletes
 * the archive. Returns the restored conversation id. Throws a readable error on failure.
 */
export async function rehydrateFromCold(archiveId: string): Promise<string> {
  const user = requireUser();
  const coldRef = doc(db, 'cold_archives', archiveId);
  const coldSnap = await resilientGetDoc(coldRef);
  if (!coldSnap.exists()) throw new Error('This archive no longer exists.');
  const data = coldSnap.data();

  let chatMeta: Record<string, any> = {};
  let messages: any[] = [];
  try {
    chatMeta = data.chatData ? JSON.parse(data.chatData) : {};
    messages = data.messages ? JSON.parse(data.messages) : [];
  } catch {
    throw new Error('This archive could not be read (damaged data). Nothing was changed.');
  }
  if (!Array.isArray(messages)) throw new Error('This archive could not be read (damaged data). Nothing was changed.');

  const chatId = String(data.conversationId || chatMeta.id || archiveId);
  const chatRef = doc(db, 'conversations', chatId);
  if ((await resilientGetDoc(chatRef)).exists()) {
    throw new Error('A conversation with the same id is already in your chat list. Nothing was changed.');
  }

  const now = Timestamp.now();
  const conversation = {
    id: chatId,
    userId: user.uid,
    title: String(data.title || chatMeta.title || 'Restored conversation').slice(0, 200),
    lastMessageAt: reviveTimestamp(chatMeta.lastMessageAt) || now,
    updatedAt: reviveTimestamp(chatMeta.updatedAt) || now,
    createdAt: reviveTimestamp(chatMeta.createdAt) || reviveTimestamp(chatMeta.updatedAt) || now,
  };

  const messageWrites = messages
    .filter((m) => m && (m.role === 'user' || m.role === 'model') && typeof m.text === 'string')
    .map((m) => {
      const id = typeof m.id === 'string' && m.id ? m.id : doc(collection(chatRef, 'messages')).id;
      const out: Record<string, unknown> = {};
      for (const key of MESSAGE_KEYS) {
        if (m[key] === undefined || m[key] === null) continue;
        out[key] = key === 'timestamp' || key === 'createdAt' ? reviveTimestamp(m[key]) : m[key];
      }
      out.id = id;
      out.userId = user.uid;
      out.text = String(m.text).slice(0, 100_000);
      if (!out.createdAt) out.createdAt = (out.timestamp as Timestamp | undefined) || now;
      return { ref: doc(chatRef, 'messages', id), data: out };
    });

  // First batch creates the conversation together with the first messages.
  const firstBatch = writeBatch(db);
  firstBatch.set(chatRef, conversation);
  const firstChunk = messageWrites.slice(0, BATCH_LIMIT - 1);
  firstChunk.forEach((w) => firstBatch.set(w.ref, w.data));
  await firstBatch.commit();
  for (let i = firstChunk.length; i < messageWrites.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    messageWrites.slice(i, i + BATCH_LIMIT).forEach((w) => batch.set(w.ref, w.data));
    await batch.commit();
  }

  await deleteDoc(coldRef);
  await logAudit('RESTORE', `Restored "${conversation.title}" (${messageWrites.length} messages) from cold storage.`);
  return chatId;
}

/** Permanently deletes one cold archive. */
export async function deleteColdArchive(archiveId: string, title?: string): Promise<void> {
  requireUser();
  await deleteDoc(doc(db, 'cold_archives', archiveId));
  await logAudit('DELETE_ARCHIVE', `Deleted cold archive "${(title || archiveId).slice(0, 200)}".`);
}

// ---------- the user's own data: export and erasure ----------

async function listOwn(collectionName: string) {
  const user = requireUser();
  return (await resilientGetDocs(query(collection(db, collectionName), where('userId', '==', user.uid)))).docs;
}

const iso = (v: unknown) => toJsDate(v)?.toISOString() ?? null;

/** Collects everything this app stores privately for the user, as plain JSON-ready data. */
export async function collectMyData() {
  const user = requireUser();
  const [convDocs, temporal, cold, audit, shares] = await Promise.all([
    listOwn('conversations'),
    getAllTemporalBlocks(),
    getColdArchives(),
    getAuditLogs(),
    listOwn('shared_transcripts'),
  ]);

  const conversations = await Promise.all(
    convDocs.map(async (c) => {
      const cd = c.data({ serverTimestamps: 'estimate' });
      const msgs = await readConversationMessages(c.id);
      return {
        id: c.id,
        title: cd.title ?? null,
        createdAt: iso(cd.createdAt),
        updatedAt: iso(cd.updatedAt),
        lastMessageAt: iso(cd.lastMessageAt),
        messages: msgs
          .map((m) => {
            const md = m.data({ serverTimestamps: 'estimate' });
            return {
              id: m.id,
              role: md.role,
              text: md.text,
              index: md.index ?? null,
              hash: md.hash ?? null,
              previousHash: md.previousHash ?? null,
              timestamp: iso(md.timestamp),
              createdAt: iso(md.createdAt),
            };
          })
          .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')),
      };
    }),
  );

  return {
    meta: {
      app: 'Arthashastra AI',
      format: 'plain JSON (not encrypted)',
      exportedAt: new Date().toISOString(),
      userId: user.uid,
    },
    conversations,
    temporalBlocks: temporal.map((b) => ({
      date: b.dateStr,
      summary: b.summary || '',
      updatedAt: iso(b.updatedAt),
      entries: b.messageBlocks,
    })),
    coldArchives: cold.map((a) => ({
      id: a.id,
      conversationId: a.conversationId,
      title: a.title,
      date: a.date,
      migratedAt: iso(a.migratedAt),
      messageCount: a.msgCount,
      messages: parseArchivedMessages(a).map((m) => ({ ...m, createdAt: m.createdAt?.toISOString() ?? null })),
    })),
    sharedLinks: shares.map((s) => ({ id: s.id, url: `/share/${s.id}`, title: s.data().title ?? null, createdAt: iso(s.data().createdAt) })),
    auditLog: audit.map((e) => ({ action: e.action, details: e.details, timestamp: e.timestamp?.toISOString() ?? null })),
  };
}

export interface ErasureResult {
  conversations: number;
  messages: number;
  temporalDays: number;
  coldArchives: number;
  sharedLinks: number;
}

/** Deletes all of the user's conversations (with their messages). */
export async function deleteAllMyConversations(): Promise<{ conversations: number; messages: number }> {
  const convDocs = await listOwn('conversations');
  let messages = 0;
  for (const c of convDocs) {
    const msgs = await readConversationMessages(c.id);
    messages += msgs.length;
    await deleteInChunks([...msgs.map((m) => m.ref), c.ref]);
  }
  return { conversations: convDocs.length, messages };
}

/**
 * Right to erasure: deletes the user's conversations and messages, memory-calendar
 * days, cold archives and public share links. Payment and subscription records are
 * kept by the server (legal/tax duty) and the audit log cannot be deleted from the browser.
 */
export async function deleteAllMyData(): Promise<ErasureResult> {
  requireUser();
  const { conversations, messages } = await deleteAllMyConversations();
  const temporalDays = await deleteAllTemporalBlocks();
  const cold = await listOwn('cold_archives');
  await deleteInChunks(cold.map((d) => d.ref));
  const shares = await listOwn('shared_transcripts');
  await deleteInChunks(shares.map((d) => d.ref));
  const result = { conversations, messages, temporalDays, coldArchives: cold.length, sharedLinks: shares.length };
  await logAudit(
    'ERASE_ALL',
    `Deleted ${conversations} conversations (${messages} messages), ${temporalDays} calendar days, ${cold.length} archives, ${shares.length} share links.`,
  );
  return result;
}
