import { db, auth, resilientGetDocs } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp 
} from 'firebase/firestore';
import { getMessages } from './chatStore';

export interface MessageBlock {
  id: string;
  index: number;
  role: 'user' | 'model' | 'system';
  text: string;
  hash: string;
  previousHash: string;
  createdAt: string;
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

/**
 * Custom reproducible checksum generator to link message blocks
 * together, acting as an immutable reference chain so agents never forget.
 */
export function computeMessageHash(index: number, role: string, text: string, prevHash: string): string {
  const input = `${index}|${role}|${text}|${prevHash}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return 'AKSHA_HEX_' + Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
}

/**
 * Fetch a specific day storage block for the current authenticated user
 */
export async function getTemporalDayBlock(dateStr: string): Promise<TemporalDayBlock | null> {
  const user = auth.currentUser;
  if (!user) return null;

  try {
    const blockId = `${user.uid}_${dateStr}`;
    const blockRef = doc(db, 'temporal_blocks', blockId);
    const snap = await getDoc(blockRef);

    if (snap.exists()) {
      const data = snap.data();
      // Ensure messages are sorted by index
      const messageBlocks = (data.messageBlocks || []) as MessageBlock[];
      messageBlocks.sort((a, b) => a.index - b.index);
      return {
        id: dateStr,
        userId: user.uid,
        year: data.year,
        month: data.month,
        day: data.day,
        dateStr: data.dateStr,
        messageBlocks,
        summary: data.summary,
      } as TemporalDayBlock;
    }
    return null;
  } catch (error) {
    console.error('[TemporalStore] Error fetching day block:', error);
    return null;
  }
}

/**
 * Create or update a specific day block
 */
export async function saveTemporalDayBlock(block: TemporalDayBlock): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;

  try {
    const blockId = `${user.uid}_${block.dateStr}`;
    const blockRef = doc(db, 'temporal_blocks', blockId);

    // Verify chain integrity before saving
    let prevHash = 'GENESIS_BLOCK';
    const verifiedMessageBlocks = block.messageBlocks.map((msg, idx) => {
      const calculatedHash = computeMessageHash(idx, msg.role, msg.text, prevHash);
      const updatedMsg = {
        ...msg,
        index: idx,
        previousHash: prevHash,
        hash: calculatedHash,
        createdAt: msg.createdAt || new Date().toISOString()
      };
      prevHash = calculatedHash;
      return updatedMsg;
    });

    await setDoc(blockRef, {
      userId: user.uid,
      year: block.year,
      month: block.month,
      day: block.day,
      dateStr: block.dateStr,
      messageBlocks: verifiedMessageBlocks,
      summary: block.summary || '',
      updatedAt: serverTimestamp()
    });

    console.log(`[TemporalStore] Solidified memory block chain for ${block.dateStr} with ${verifiedMessageBlocks.length} links.`);
    return true;
  } catch (error) {
    console.error('[TemporalStore] Error saving temporal block:', error);
    return false;
  }
}

/**
 * Direct insertion of a single connected message block to a day
 */
export async function addMessageBlockToDay(
  dateStr: string,
  role: 'user' | 'model' | 'system',
  text: string
): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;

  try {
    let block = await getTemporalDayBlock(dateStr);
    
    const dParts = dateStr.split('-');
    const year = parseInt(dParts[0], 10);
    const month = parseInt(dParts[1], 10);
    const day = parseInt(dParts[2], 10);

    if (!block) {
      block = {
        id: dateStr,
        userId: user.uid,
        year,
        month,
        day,
        dateStr,
        messageBlocks: []
      };
    }

    const nextIndex = block.messageBlocks.length;
    const prevHash = nextIndex > 0 ? block.messageBlocks[nextIndex - 1].hash : 'GENESIS_BLOCK';
    const hash = computeMessageHash(nextIndex, role, text, prevHash);

    const newBlock: MessageBlock = {
      id: crypto.randomUUID(),
      index: nextIndex,
      role,
      text,
      hash,
      previousHash: prevHash,
      createdAt: new Date().toISOString()
    };

    block.messageBlocks.push(newBlock);
    return await saveTemporalDayBlock(block);
  } catch (error) {
    console.error('[TemporalStore] Error adding message link:', error);
    return false;
  }
}

/**
 * Import a full chat/conversation and chain all its messages chronologically to a day block
 */
export async function importChatToDayBlock(
  dateStr: string,
  chatId: string,
  title: string
): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;

  try {
    const rawMessages = await getMessages(chatId);
    if (!rawMessages || rawMessages.length === 0) {
      console.warn('[TemporalStore] No messages found in chat to import.');
      return false;
    }

    const dParts = dateStr.split('-');
    const year = parseInt(dParts[0], 10);
    const month = parseInt(dParts[1], 10);
    const day = parseInt(dParts[2], 10);

    let prevHash = 'GENESIS_BLOCK';
    const messageBlocks: MessageBlock[] = rawMessages.map((msg, idx) => {
      const simpleRole = msg.role === 'user' ? 'user' : 'model';
      const calculatedHash = computeMessageHash(idx, simpleRole, msg.text, prevHash);
      const block: MessageBlock = {
        id: msg.id || crypto.randomUUID(),
        index: idx,
        role: simpleRole,
        text: msg.text,
        previousHash: prevHash,
        hash: calculatedHash,
        createdAt: new Date().toISOString()
      };
      prevHash = calculatedHash;
      return block;
    });

    const block: TemporalDayBlock = {
      id: dateStr,
      userId: user.uid,
      year,
      month,
      day,
      dateStr,
      messageBlocks,
      summary: `Consolidated memory thread compiled from: "${title}"`
    };

    return await saveTemporalDayBlock(block);
  } catch (error) {
    console.error('[TemporalStore] Chat import failed:', error);
    return false;
  }
}

/**
 * Load all populated temporal block date strings for UI calendar indication
 */
export async function getPopulatedBlockDates(): Promise<string[]> {
  const user = auth.currentUser;
  if (!user) return [];

  try {
    const q = query(
      collection(db, 'temporal_blocks'),
      where('userId', '==', user.uid)
    );
    const snap = await resilientGetDocs(q);
    return snap.docs.map(doc => {
      const parts = doc.id.split('_');
      // doc.id format is {userId}_{YYYY-MM-DD}
      // Let's obtain the suffix by joining all parts after the first one and ignoring the prefix.
      return parts.slice(1).join('_');
    });
  } catch (error) {
    console.error('[TemporalStore] Error listing populated dates:', error);
    return [];
  }
}
