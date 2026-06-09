
import { db, auth, resilientGetDocs } from './firebase';
import { collection, addDoc, query, where, orderBy, getDocs, doc, setDoc, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { Message } from './firebase';

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  lastMessageAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

export async function saveMessage(chatId: string, message: Message) {
  const user = auth.currentUser;
  if (!user) return;

  const msgData = {
    ...message,
    userId: user.uid,
    timestamp: message.timestamp || serverTimestamp(),
    createdAt: serverTimestamp()
  };

  try {
    const batch = writeBatch(db);
    
    const chatRef = doc(db, 'conversations', chatId);
    const messagesRef = doc(collection(chatRef, 'messages')); // Generate auto-ID locally
    
    // 1. Establish/Update conversation metadata (The Block Envelope)
    batch.set(chatRef, {
      id: chatId,
      userId: user.uid,
      title: message.role === 'user' ? message.text.substring(0, 50) : 'Arthashastra Response',
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    // 2. Write the message into the ledger atomically
    batch.set(messagesRef, {
      ...msgData,
      id: messagesRef.id // Ensure ID consistency
    });
    
    await batch.commit();
    console.log(`[ChatStore] Atomic Witness Committed: ${chatId} -> ${messagesRef.id}`);
    
  } catch (error) {
    console.error('[ChatStore] Error saving message:', error);
  }
}

export async function getConversations(): Promise<Conversation[]> {
  const user = auth.currentUser;
  if (!user) return [];

  try {
    const q = query(
      collection(db, 'conversations'),
      where('userId', '==', user.uid)
    );
    
    // Use resilient version to handle transient "client is offline" errors.
    // We return ALL conversations for the user and filter client-side to avoid 
    // the requirement for Firestore composite indices which cause hard sync failures.
    const snap = await resilientGetDocs(q, 5);
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Conversation));
    
    console.info(`[ChatStore] Witness Archive Sync: ${data.length} threads synchronized for node ${user.uid.substring(0, 5)}...`);
    
    return data.sort((a, b) => {
      const getVal = (v: any) => {
        if (!v) return 0;
        if (v?.seconds) return v.seconds * 1000;
        if (v instanceof Date) return v.getTime();
        const parsed = new Date(v).getTime();
        return isNaN(parsed) ? 0 : parsed;
      };
      return getVal(b.lastMessageAt) - getVal(a.lastMessageAt);
    });
  } catch (error) {
    console.error('[ChatStore] Neural Link Archive Retrieval Failure:', error);
    return [];
  }
}

export async function getMessages(chatId: string): Promise<Message[]> {
  try {
    const q = query(
      collection(db, 'conversations', chatId, 'messages')
    );
    // Use resilient version for message loading
    const snap = await resilientGetDocs(q);
    const msgs = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        role: data.role,
        text: data.text,
        index: data.index,
        hash: data.hash,
        previousHash: data.previousHash,
        timestamp: data.timestamp || data.createdAt,
        createdAt: data.createdAt // Keep original for sorting
      } as Message & { createdAt: any };
    });

    // Sort client-side to avoid index requirements
    return msgs.sort((a, b) => {
      const getTime = (ca: any) => {
        if (!ca) return 0;
        if (ca.seconds) return ca.seconds * 1000;
        return new Date(ca).getTime() || 0;
      };
      return getTime(a.createdAt) - getTime(b.createdAt);
    }).map(({ createdAt, ...rest }) => rest as Message);
    
  } catch (error) {
    console.error('[ChatStore] Error fetching message history:', error);
    return [];
  }
}

export async function createSharedTranscript(messages: Message[]): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const sharedId = crypto.randomUUID();
  const sharedRef = doc(db, 'shared_transcripts', sharedId);
  
  await setDoc(sharedRef, {
    id: sharedId,
    userId: user.uid,
    messages: JSON.stringify(messages),
    createdAt: serverTimestamp()
  });

  return sharedId;
}

export async function getSharedTranscript(sharedId: string): Promise<Message[]> {
  try {
    const { getDocFromServer } = await import('firebase/firestore');
    const docSnap = await getDocFromServer(doc(db, 'shared_transcripts', sharedId));
    if (!docSnap.exists()) {
      return [];
    }
    const data = docSnap.data();
    return JSON.parse(data.messages) as Message[];
  } catch (error) {
    console.error('[ChatStore] Error fetching shared transcript:', error);
    return [];
  }
}
