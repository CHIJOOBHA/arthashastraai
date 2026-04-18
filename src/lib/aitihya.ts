
/**
 * Aitihya Chain (The Chain of Witness)
 * 
 * A blockchain-inspired architecture for immutable data linking and absolute focus.
 */

export interface AitihyaBlock {
  index: number;
  timestamp: string;
  data: any;
  previousHash: string;
  hash: string;
  agentId: string;
  role: string;
  signature: string; // Cryptographic witness signature
}

/**
 * Generates a SHA-256 hash for the block data and linkage.
 */
export async function calculateHash(index: number, timestamp: string, data: any, previousHash: string): Promise<string> {
  const content = `${index}${timestamp}${JSON.stringify(data)}${previousHash}`;
  
  try {
    const crypto = typeof window !== 'undefined' ? window.crypto : (await import('crypto')).webcrypto;
    
    if (crypto && crypto.subtle) {
      const msgUint8 = new TextEncoder().encode(content);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {}

  return `fallback-${Date.now().toString(16)}`;
}

/**
 * Signs the hash using a secret key (HMAC-SHA256).
 * This ensures only the authorized "Oracle" (Server) can witness truth.
 */
export async function signBlock(hash: string, secret: string): Promise<string> {
  try {
    const crypto = typeof window !== 'undefined' ? window.crypto : (await import('crypto')).webcrypto;
    if (crypto && crypto.subtle) {
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        enc.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const sigBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(hash));
      const sigArray = Array.from(new Uint8Array(sigBuffer));
      return sigArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {}
  return "SERVER_AUTH_REQUIRED";
}

/**
 * Witnesses a new piece of data into the Aitihya Chain.
 */
export async function witnessBlock(
  data: any, 
  agentId: string, 
  role: string, 
  previousBlock?: AitihyaBlock,
  serverSecret?: string
): Promise<AitihyaBlock> {
  const index = previousBlock ? previousBlock.index + 1 : 0;
  const timestamp = new Date().toISOString();
  const previousHash = previousBlock ? previousBlock.hash : "ROOT_ETERNITY";
  const hash = await calculateHash(index, timestamp, data, previousHash);
  
  // Apply signature if secret is provided (Server-side)
  const signature = serverSecret ? await signBlock(hash, serverSecret) : "";

  return {
    index,
    timestamp,
    data,
    previousHash,
    hash,
    agentId,
    role,
    signature: signature // Added signature field to the block
  };
}

/**
 * Verifies the integrity of the chain.
 */
export async function verifyIntegrity(chain: AitihyaBlock[]): Promise<boolean> {
  for (let i = 1; i < chain.length; i++) {
    const current = chain[i];
    const previous = chain[i - 1];

    if (current.previousHash !== previous.hash) return false;
    
    const recalculated = await calculateHash(
      current.index, 
      current.timestamp, 
      current.data, 
      current.previousHash
    );
    
    if (recalculated !== current.hash) return false;
  }
  return true;
}
