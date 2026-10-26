/**
 * Aitihya ledger: an append-only, hash-chained audit log of what the agents
 * published and what payments were recorded.
 *
 * Honest description: this is a tamper-EVIDENT log (editing any block breaks
 * the hash chain, and blocks are HMAC-signed with a server secret). It is not
 * a public blockchain. Only the server can write to it (Firestore rules).
 */
import crypto from "crypto";
import { getDb } from "./firebaseAdmin.js";
import { config } from "./config.js";

export interface LedgerBlock {
  index: number;
  timestamp: string;
  data: string;
  previousHash: string;
  hash: string;
  agentId: string;
  role: string;
  signature: string;
  task_id?: string;
  metadata?: Record<string, unknown>;
}

/** Same hashing scheme as src/lib/aitihya.ts so the browser can verify the chain. */
export function blockHash(index: number, timestamp: string, data: unknown, previousHash: string): string {
  return crypto
    .createHash("sha256")
    .update(`${index}${timestamp}${JSON.stringify(data)}${previousHash}`)
    .digest("hex");
}

export function signHash(hash: string): string {
  if (!config.ledgerSecret) return "UNSIGNED";
  return crypto.createHmac("sha256", config.ledgerSecret).update(hash).digest("hex");
}

/**
 * Appends one block. Uses a transaction on a "head" document so two writers
 * can never create two blocks with the same index (the old code could fork).
 */
export async function appendBlock(
  data: string,
  agentId: string,
  role: string,
  extra: { taskId?: string; metadata?: Record<string, unknown> } = {},
): Promise<LedgerBlock | null> {
  const db = getDb();
  if (!db) return null;
  const headRef = db.collection("ledger_meta").doc("head");
  try {
    return await db.runTransaction(async (tx) => {
      const head = await tx.get(headRef);
      const prevIndex = head.exists ? (head.get("index") as number) : -1;
      const previousHash = head.exists ? (head.get("hash") as string) : "ROOT_ETERNITY";
      const index = prevIndex + 1;
      const timestamp = new Date().toISOString();
      const hash = blockHash(index, timestamp, data, previousHash);
      const block: LedgerBlock = {
        index,
        timestamp,
        data,
        previousHash,
        hash,
        agentId,
        role,
        signature: signHash(hash),
        ...(extra.taskId ? { task_id: extra.taskId } : {}),
        ...(extra.metadata ? { metadata: extra.metadata } : {}),
      };
      tx.set(db.collection("ledger").doc(String(index).padStart(10, "0")), block);
      tx.set(headRef, { index, hash, updatedAt: timestamp });
      return block;
    });
  } catch (e) {
    console.error("[ledger] append failed:", (e as Error).message);
    return null;
  }
}
