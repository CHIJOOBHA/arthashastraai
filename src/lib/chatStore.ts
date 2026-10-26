import { db, auth, resilientGetDocs, toDate, Message } from './firebase';
import { collection, query, where, doc, getDoc, serverTimestamp, writeBatch, Timestamp } from 'firebase/firestore';
import { shareConversation } from './api';

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  lastMessageAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  createdAt?: Date | Timestamp;
}

const MAX_TITLE = 200;
const MAX_TEXT = 100_000;

/** Conversations this browser already knows exist (so we only create each one once). */
const knownConversations = new Set<string>();
/** Saves to the same conversation run one after another, so the "create" never races itself. */
const saveQueues = new Map<string, Promise<unknown>>();

function titleFrom(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return 'New conversation';
  return clean.length > 60 ? `${clean.slice(0, 57)}...` : clean;
}

async function writeMessage(chatId: string, message: Message): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;

  const chatRef = doc(db, 'conversations', chatId);
  const msgRef = message.id && /^[A-Za-z0-9_-]{1,128}$/.test(message.id)
    ? doc(collection(chatRef, 'messages'), message.id)
    : doc(collection(chatRef, 'messages'));

  // Only the keys the security rules allow; Firestore rejects `undefined` values.
  const msgData: Record<string, unknown> = {
    id: msgRef.id,
    role: message.role === 'model' ? 'model' : 'user',
    text: String(message.text || '').slice(0, MAX_TEXT),
    userId: user.uid,
    timestamp: serverTimestamp(),
    createdAt: serverTimestamp(),
  };
  if (typeof message.index === 'number') msgData.index = message.index;
  if (typeof message.hash === 'string') msgData.hash = message.hash;
  if (typeof message.previousHash === 'string') msgData.previousHash = message.previousHash;

  let exists = knownConversations.has(chatId);
  if (!exists) {
    try {
      exists = (await getDoc(chatRef)).exists();
    } catch {
      // The rules deny reading a conversation that does not exist yet ("resource" is null), so treat it as new.
      exists = false;
    }
  }

  const batch = writeBatch(db);
  if (!exists) {
    // First message: create the conversation. The title comes from the first user message and is never overwritten.
    batch.set(chatRef, {
      id: chatId,
      userId: user.uid,
      title: (message.role === 'user' ? titleFrom(message.text) : 'New conversation').slice(0, MAX_TITLE),
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
  } else {
    batch.update(chatRef, { lastMessageAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }
  batch.set(msgRef, msgData);
  await batch.commit();
  knownConversations.add(chatId);
  return true;
}

/**
 * Saves one chat message (and creates the conversation on first use).
 * Resolves to true when stored, false when the user is signed out or the write failed.
 */
export function saveMessage(chatId: string, message: Message): Promise<boolean> {
  const previous = saveQueues.get(chatId) || Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(() => writeMessage(chatId, message))
    .catch((error) => {
      console.error('[ChatStore] Could not save message:', error);
      return false;
    });
  saveQueues.set(chatId, next);
  next.finally(() => {
    if (saveQueues.get(chatId) === next) saveQueues.delete(chatId);
  });
  return next;
}

const millis = (v: unknown) => toDate(v)?.getTime() ?? 0;

export async function getConversations(): Promise<Conversation[]> {
  const user = auth.currentUser;
  if (!user) return [];

  try {
    // No orderBy: avoids needing a composite index. Sorted on the client instead.
    const q = query(collection(db, 'conversations'), where('userId', '==', user.uid));
    const snap = await resilientGetDocs(q, 5);
    const data: Conversation[] = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Conversation));
    data.forEach((c) => knownConversations.add(c.id));
    return data.sort((a, b) => millis(b.lastMessageAt) - millis(a.lastMessageAt));
  } catch (error) {
    console.error('[ChatStore] Could not load conversations:', error);
    return [];
  }
}

export async function getMessages(chatId: string): Promise<Message[]> {
  try {
    const snap = await resilientGetDocs(query(collection(db, 'conversations', chatId, 'messages')));
    const msgs = snap.docs.map((d: any) => {
      const data = d.data({ serverTimestamps: 'estimate' });
      return {
        message: {
          id: d.id,
          role: data.role,
          text: data.text,
          index: data.index,
          hash: data.hash,
          previousHash: data.previousHash,
          timestamp: data.timestamp || data.createdAt,
        } as Message,
        sortKey: millis(data.createdAt || data.timestamp),
      };
    });
    if (msgs.length) knownConversations.add(chatId);
    return msgs.sort((a: any, b: any) => a.sortKey - b.sortKey).map((m: any) => m.message);
  } catch (error) {
    console.error('[ChatStore] Could not load messages:', error);
    return [];
  }
}

/**
 * Publishes a read-only share link for a stored conversation.
 * The server builds the transcript from the saved messages, so nothing can be forged.
 * Returns the share id (the page lives at /share/<id>).
 */
export async function createSharedTranscript(conversationId: string): Promise<string> {
  const { id } = await shareConversation(conversationId);
  return id;
}

export interface SharedTranscriptData {
  id: string;
  title: string;
  createdAt: Date | null;
  messages: { role: 'user' | 'model'; text: string }[];
}

/** Reads a public share link. Works for logged-out visitors. Returns null if missing or unreadable. */
export async function getSharedTranscript(sharedId: string): Promise<SharedTranscriptData | null> {
  if (!sharedId) return null;
  try {
    const snap = await getDoc(doc(db, 'shared_transcripts', sharedId));
    if (!snap.exists()) return null;
    const data = snap.data();
    let parsed: unknown = [];
    try {
      parsed = typeof data.messages === 'string' ? JSON.parse(data.messages) : data.messages;
    } catch {
      parsed = [];
    }
    const messages = (Array.isArray(parsed) ? parsed : [])
      .filter((m: any) => m && typeof m.text === 'string')
      .map((m: any) => ({ role: m.role === 'model' ? 'model' : 'user', text: m.text } as const));
    return {
      id: snap.id,
      title: typeof data.title === 'string' && data.title ? data.title : 'Arthashastra AI conversation',
      createdAt: toDate(data.createdAt),
      messages,
    };
  } catch (error) {
    console.error('[ChatStore] Could not load shared transcript:', error);
    return null;
  }
}
