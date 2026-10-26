/**
 * Aitihya chain: a tamper-evident hash chain (not a blockchain).
 *
 * Each block stores the SHA-256 hash of `${index}${timestamp}${JSON.stringify(data)}${previousHash}`
 * and the hash of the block before it, starting from "ROOT_ETERNITY". Changing any
 * block breaks every link after it, so edits are detectable. It is NOT immutable:
 * whoever can write the store can rebuild the whole chain. Server ledger blocks
 * (server/ledger.ts) use the same formula with `data` stored as a string, and are
 * additionally HMAC-signed by the server; blocks made in the browser are unsigned.
 */

export interface AitihyaBlock {
  index: number;
  timestamp: string;
  data: any;
  previousHash: string;
  hash: string;
  agentId: string;
  role: string;
  /** HMAC from the server for server ledger blocks; "" for browser-made blocks. */
  signature: string;
}

export const ROOT_HASH = 'ROOT_ETERNITY';

function getSubtle(): SubtleCrypto {
  const subtle = typeof globalThis !== 'undefined' ? globalThis.crypto?.subtle : undefined;
  if (!subtle) {
    throw new Error('SHA-256 is unavailable: this browser does not provide crypto.subtle (a secure https context is required).');
  }
  return subtle;
}

/** SHA-256 (hex) of the block's index, timestamp, data and previous hash. Throws if hashing is unavailable. */
export async function calculateHash(index: number, timestamp: string, data: any, previousHash: string): Promise<string> {
  const content = `${index}${timestamp}${JSON.stringify(data)}${previousHash}`;
  const digest = await getSubtle().digest('SHA-256', new TextEncoder().encode(content));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Creates the next block after `previousBlock` (or the first block).
 * Browser blocks are unsigned (signature ""). `_serverSecret` is ignored and kept
 * only so existing callers stay compatible; signing happens on the server.
 */
export async function witnessBlock(
  data: any,
  agentId: string,
  role: string,
  previousBlock?: Pick<AitihyaBlock, 'index' | 'hash'>,
  _serverSecret?: string,
): Promise<AitihyaBlock> {
  const index = previousBlock ? previousBlock.index + 1 : 0;
  const timestamp = new Date().toISOString();
  const previousHash = previousBlock ? previousBlock.hash : ROOT_HASH;
  const hash = await calculateHash(index, timestamp, data, previousHash);
  return { index, timestamp, data, previousHash, hash, agentId, role, signature: '' };
}

/**
 * Checks the hash chain: block 0 starts at ROOT_ETERNITY with index 0, indexes run
 * without gaps, every previousHash matches the block before, and every hash is
 * recomputed. Signatures are not checked here (the HMAC secret stays on the server).
 * Pass the chain sorted by index.
 */
export async function verifyIntegrity(chain: AitihyaBlock[]): Promise<boolean> {
  if (chain.length === 0) return true;
  const first = chain[0];
  const startsAtRoot = first.index === 0;
  if (startsAtRoot && first.previousHash !== ROOT_HASH) return false;

  for (let i = 0; i < chain.length; i++) {
    const current = chain[i];
    if (i > 0) {
      const previous = chain[i - 1];
      if (current.index !== previous.index + 1) return false;
      if (current.previousHash !== previous.hash) return false;
    }
    const recalculated = await calculateHash(current.index, current.timestamp, current.data, current.previousHash);
    if (recalculated !== current.hash) return false;
  }
  return true;
}
