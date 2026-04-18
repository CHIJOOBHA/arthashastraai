
import { db, auth } from './firebase';
import { collection, addDoc, query, where, orderBy, getDocs, doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
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
    createdAt: serverTimestamp()
  };

  try {
    const chatRef = doc(db, 'conversations', chatId);
    
    // 1. Establish/Update conversation metadata (The Block Envelope) first to satisfy Security Rules
    await setDoc(chatRef, {
      id: chatId,
      userId: user.uid,
      title: message.role === 'user' ? message.text.substring(0, 50) : 'Arthashastra Response',
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    // 2. Write the message into the ledger
    const messagesRef = collection(chatRef, 'messages');
    await addDoc(messagesRef, msgData);
    
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
      where('userId', '==', user.uid),
      orderBy('lastMessageAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Conversation));
  } catch (error) {
    console.error('[ChatStore] Error fetching conversations:', error);
    return [];
  }
}

export async function getMessages(chatId: string): Promise<Message[]> {
  try {
    const q = query(
      collection(db, 'conversations', chatId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        role: data.role,
        text: data.text,
        index: data.index,
        hash: data.hash,
        previousHash: data.previousHash,
        timestamp: data.timestamp
      } as Message;
    });
  } catch (error) {
    console.error('[ChatStore] Error fetching messages:', error);
    return [];
  }
}
