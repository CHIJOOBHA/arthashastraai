
import { db, auth, resilientGetDocs, handleFirestoreError, OperationType } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  getDocs,
  deleteDoc, 
  addDoc,
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp, 
  writeBatch,
  Timestamp
} from 'firebase/firestore';

export interface ColdArchive {
  id: string;
  userId: string;
  date: string;
  participant: string;
  msgCount: number;
  compression: string;
  migratedAt: any;
  manifest: string;
  messages?: string;
  chatData?: string;
  title?: string;
}

export interface AuditEntry {
  id?: string;
  time: any;
  action: string;
  detail: string;
  participant: string;
}

export async function migrateToCold(chatId: string) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const chatRef = doc(db, 'conversations', chatId);
    const chatSnap = await getDoc(chatRef);
    if (!chatSnap.exists()) return;

    const chatData = chatSnap.data();
    const messagesRef = collection(chatRef, 'messages');
    const msgSnap = await getDocs(messagesRef);
    
    // Extract actual messages content to store in cold archive
    const messagesList = msgSnap.docs.map(m => ({
      id: m.id,
      ...m.data()
    }));

    const batch = writeBatch(db);

    // 1. Create cold archive entry with full messages payload
    const coldRef = doc(db, 'cold_archives', chatId);
    
    // Extract true calendar date from conversation timestamp, not migration date
    let rawDate = chatData.updatedAt || chatData.lastMessageAt || new Date();
    let chatDateStr = new Date().toISOString().split('T')[0];
    try {
      let d: Date;
      if (rawDate?.seconds) d = new Date(rawDate.seconds * 1000);
      else if (typeof rawDate?.toDate === 'function') d = rawDate.toDate();
      else d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        chatDateStr = d.toISOString().split('T')[0];
      }
    } catch (e) {
      console.warn("Could not extract true conversation timestamp:", e);
    }

    batch.set(coldRef, {
      id: chatId,
      userId: user.uid,
      title: chatData.title || 'Archived Witness',
      date: chatDateStr,
      participant: chatData.participant || 'unknown',
      msgCount: msgSnap.size,
      compression: 'balanced',
      migratedAt: serverTimestamp(),
      manifest: `manifest_${Math.random().toString(36).substring(2, 9)}.json`,
      messages: JSON.stringify(messagesList),
      chatData: JSON.stringify(chatData)
    });

    // 2. Delete from hot storage
    msgSnap.docs.forEach(m => batch.delete(m.ref));
    batch.delete(chatRef);

    await batch.commit();
    await logAudit('MIGRATE', `Hot -> Cold: ${chatId} (${msgSnap.size} msgs)`);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `migrate/${chatId}`);
    return false;
  }
}

export async function logAudit(action: string, detail: string, participant: string = 'system') {
  const user = auth.currentUser;
  try {
    await addDoc(collection(db, 'audit_log'), {
      time: serverTimestamp(),
      action,
      detail,
      participant: user?.email || participant,
      userId: user?.uid || 'system'
    });
  } catch (error) {
    console.error('[Audit] Failed to log action:', error);
  }
}

export async function getAuditLogs(): Promise<AuditEntry[]> {
  try {
    const q = query(
      collection(db, 'audit_log'),
      orderBy('time', 'desc'),
      limit(100)
    );
    const snap = await resilientGetDocs(q);
    return snap.docs.map(d => ({ 
      id: d.id, 
      ...d.data(),
      time: d.data().time?.toDate?.()?.toISOString() || d.data().time 
    } as AuditEntry));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'audit_log');
    return [];
  }
}

export async function getColdArchives(): Promise<ColdArchive[]> {
  const user = auth.currentUser;
  if (!user) return [];

  try {
    const q = query(
      collection(db, 'cold_archives'),
      where('userId', '==', user.uid)
    );
    const snap = await resilientGetDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ColdArchive));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'cold_archives');
    return [];
  }
}

export async function rehydrateFromCold(archiveId: string) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const coldRef = doc(db, 'cold_archives', archiveId);
    const coldSnap = await getDoc(coldRef);
    if (!coldSnap.exists()) return;

    const archiveData = coldSnap.data();
    
    // Parse preserved structures
    let chatMeta = {};
    if (archiveData.chatData) {
      try {
        chatMeta = JSON.parse(archiveData.chatData);
      } catch (e) {
        console.warn('Failed to parse chatData meta:', e);
      }
    }

    let messagesList: any[] = [];
    if (archiveData.messages) {
      try {
        messagesList = JSON.parse(archiveData.messages);
      } catch (e) {
        console.warn('Failed to parse cold messages list:', e);
      }
    }

    const batch = writeBatch(db);

    // 1. Restore conversation metadata
    const chatRef = doc(db, 'conversations', archiveId);
    batch.set(chatRef, {
      ...chatMeta,
      id: archiveId,
      userId: user.uid,
      title: archiveData.title || 'Rehydrated Witness',
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    // 2. Hydrate each message back under the messages subcollection
    const messagesCol = collection(chatRef, 'messages');
    messagesList.forEach((msg: any) => {
      const msgId = msg.id || Math.random().toString(36).substring(2, 9);
      const msgRef = doc(messagesCol, msgId);
      
      // Destructure or filter system timestamps to avoid merge/overwrite conflicts if applicable
      const { id, createdAt, ...msgData } = msg;
      batch.set(msgRef, {
        ...msgData,
        createdAt: createdAt || serverTimestamp()
      }, { merge: true });
    });

    // 3. Delete from cold storage
    batch.delete(coldRef);

    await batch.commit();

    await logAudit('REHYDRATE', `Cold -> Hot: ${archiveId}`);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `rehydrate/${archiveId}`);
    return false;
  }
}

