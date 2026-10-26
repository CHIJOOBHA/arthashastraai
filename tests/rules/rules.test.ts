/**
 * Firestore security rules tests (the "Dirty Dozen" attacks and more).
 * Runs against the Firestore emulator:  npm run test:rules
 */
import { test, before, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, getDocs, query, where, writeBatch, serverTimestamp, increment } from "firebase/firestore";

const skip = process.env.FIRESTORE_EMULATOR_HOST ? false : "Firestore emulator not running";
let env: RulesTestEnvironment;

const alice = () => env.authenticatedContext("alice", { email: "alice@example.com", firebase: { sign_in_provider: "google.com" } }).firestore();
const bob = () => env.authenticatedContext("bob", { email: "bob@example.com", firebase: { sign_in_provider: "google.com" } }).firestore();
const anon = () => env.authenticatedContext("anon1", { firebase: { sign_in_provider: "anonymous" } }).firestore();
const nobody = () => env.unauthenticatedContext().firestore();
const admin = () => env.authenticatedContext("boss", { admin: true, firebase: { sign_in_provider: "google.com" } }).firestore();

before(async () => {
  if (skip) return;
  env = await initializeTestEnvironment({
    projectId: "demo-arthashastra-rules", // separate from the integration tests
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});
after(async () => {
  if (!skip) await env.cleanup();
});
beforeEach(async () => {
  if (skip) return;
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "users/alice"), { uid: "alice", email: "alice@example.com", role: "user" });
    await setDoc(doc(db, "intelligence/i1"), { content: "x" });
    await setDoc(doc(db, "explanations/e1"), { content: "paid content" });
    await setDoc(doc(db, "ledger/0000000000"), { index: 0, hash: "h" });
    await setDoc(doc(db, "conversations/c1"), { id: "c1", userId: "alice", title: "t" });
    await setDoc(doc(db, "debates/d1"), { id: "d1", userId: "alice", userName: "A", userArgument: "arg", status: "pending", likesCount: 0 });
    await setDoc(doc(db, "agent_logs/l1"), { agentName: "x" });
    await setDoc(doc(db, "shared_transcripts/s1"), { id: "s1", userId: "alice", messages: "[]" });
    await setDoc(doc(db, "chronicles/2026-10-26"), { status: "ready" });
  });
});

// ---- 1. identity spoofing ----
test("cannot create a conversation for another user", { skip }, async () => {
  await assertFails(setDoc(doc(bob(), "conversations/c2"), { id: "c2", userId: "alice", title: "x" }));
  await assertSucceeds(setDoc(doc(bob(), "conversations/c2"), { id: "c2", userId: "bob", title: "x" }));
});

// ---- 2/4/12. role escalation, shadow fields, self-subscription ----
test("users cannot write their own profile (no role, isSubscribed or counter tampering)", { skip }, async () => {
  await assertFails(updateDoc(doc(alice(), "users/alice"), { role: "admin" }));
  await assertFails(updateDoc(doc(alice(), "users/alice"), { isSubscribed: true }));
  await assertFails(updateDoc(doc(alice(), "users/alice"), { explanationViewCount: 0 }));
  await assertFails(setDoc(doc(bob(), "users/bob"), { uid: "bob", email: "b", role: "user", isSubscribed: true }));
  await assertFails(setDoc(doc(alice(), "subscriptions/alice"), { status: "active" }));
});

// ---- 3. state shortcutting / forged AI verdicts ----
test("cannot resolve a debate or forge an AI verdict", { skip }, async () => {
  await assertFails(updateDoc(doc(alice(), "debates/d1"), { status: "resolved", aiResponse: "I win" }));
  await assertFails(
    setDoc(doc(bob(), "debates/d2"), { id: "d2", userId: "bob", userName: "B", userArgument: "x", createdAt: serverTimestamp(), status: "resolved", likesCount: 0 }),
  );
  await assertFails(
    setDoc(doc(bob(), "debates/d2"), { id: "d2", userId: "bob", userName: "B", userArgument: "x", createdAt: serverTimestamp(), status: "pending", likesCount: 0, aiResponse: "fake" }),
  );
  await assertSucceeds(
    setDoc(doc(bob(), "debates/d2"), { id: "d2", userId: "bob", userName: "B", userArgument: "x", createdAt: serverTimestamp(), status: "pending", likesCount: 0 }),
  );
});

test("cannot post AI ('model') messages in a debate", { skip }, async () => {
  await assertFails(setDoc(doc(bob(), "debates/d1/chat/m1"), { id: "m1", userId: "bob", userName: "B", role: "model", text: "fake AI", createdAt: serverTimestamp() }));
  await assertSucceeds(setDoc(doc(bob(), "debates/d1/chat/m1"), { id: "m1", userId: "bob", userName: "B", role: "user", text: "hello", createdAt: serverTimestamp() }));
  await assertFails(setDoc(doc(anon(), "debates/d1/chat/m2"), { id: "m2", userId: "anon1", userName: "A", role: "user", text: "hi", createdAt: serverTimestamp() }));
});

test("likes: exactly +1, once per user, with the like document", { skip }, async () => {
  await assertFails(updateDoc(doc(bob(), "debates/d1"), { likesCount: 999 }));
  await assertFails(updateDoc(doc(bob(), "debates/d1"), { likesCount: increment(1) }));
  const b = writeBatch(bob());
  b.set(doc(bob(), "debates/d1/likes/bob"), { createdAt: serverTimestamp() });
  b.update(doc(bob(), "debates/d1"), { likesCount: increment(1) });
  await assertSucceeds(b.commit());
  const again = writeBatch(bob());
  again.set(doc(bob(), "debates/d1/likes/bob"), { createdAt: serverTimestamp() });
  again.update(doc(bob(), "debates/d1"), { likesCount: increment(1) });
  await assertFails(again.commit());
});

// ---- 5/9. PII leak / blanket reads ----
test("cannot read or list other users' profiles", { skip }, async () => {
  await assertFails(getDoc(doc(bob(), "users/alice")));
  await assertFails(getDocs(collection(bob(), "users")));
  await assertSucceeds(getDoc(doc(alice(), "users/alice")));
  await assertSucceeds(getDoc(doc(admin(), "users/alice")));
});

test("cannot read other users' conversations or messages", { skip }, async () => {
  await assertFails(getDoc(doc(bob(), "conversations/c1")));
  await assertFails(getDocs(collection(bob(), "conversations/c1/messages")));
  await assertSucceeds(getDocs(query(collection(alice(), "conversations"), where("userId", "==", "alice"))));
});

// ---- 6. resource poisoning ----
test("rejects huge document ids", { skip }, async () => {
  const id = "x".repeat(200);
  await assertFails(setDoc(doc(bob(), `debates/${id}`), { id, userId: "bob", userName: "B", userArgument: "x", createdAt: serverTimestamp(), status: "pending", likesCount: 0 }));
});

// ---- 7. orphaned / foreign writes ----
test("cannot add messages to someone else's conversation", { skip }, async () => {
  await assertFails(addDoc(collection(bob(), "conversations/c1/messages"), { role: "user", text: "x", userId: "bob" }));
  await assertSucceeds(addDoc(collection(alice(), "conversations/c1/messages"), { role: "user", text: "x", userId: "alice" }));
  await assertFails(addDoc(collection(alice(), "conversations/c1/messages"), { role: "user", text: "x", userId: "alice", verified: true }));
});

// ---- 10/11. public data vandalism ----
test("nobody can write server-owned collections", { skip }, async () => {
  for (const db of [nobody(), bob(), anon()]) {
    await assertFails(setDoc(doc(db, "intelligence/i1"), { content: "hacked" }));
    await assertFails(deleteDoc(doc(db, "intelligence/i1")));
    await assertFails(setDoc(doc(db, "ledger/0000000000"), { index: 0, hash: "forged" }));
    await assertFails(setDoc(doc(db, "agent_block_ledger/x"), { data: 1 }));
    await assertFails(setDoc(doc(db, "agent_logs/x"), { a: 1 }));
    await assertFails(setDoc(doc(db, "explanations/x"), { a: 1 }));
    await assertFails(setDoc(doc(db, "chronicles/2026-10-27"), { a: 1 }));
    await assertFails(addDoc(collection(db, "threat_matrices"), { content: "fake alarm" }));
    await assertFails(setDoc(doc(db, "payments/p1"), { userId: "bob" }));
    await assertFails(setDoc(doc(db, "shared_transcripts/s2"), { id: "s2", userId: "bob", messages: "[]" }));
  }
});

test("paid explanations are not readable directly", { skip }, async () => {
  await assertFails(getDoc(doc(alice(), "explanations/e1")));
});

test("public reads work logged out where intended", { skip }, async () => {
  await assertSucceeds(getDoc(doc(nobody(), "intelligence/i1")));
  await assertSucceeds(getDoc(doc(nobody(), "chronicles/2026-10-26")));
  await assertSucceeds(getDoc(doc(nobody(), "shared_transcripts/s1")));
  await assertFails(getDoc(doc(nobody(), "ledger/0000000000")));
  await assertSucceeds(getDoc(doc(bob(), "ledger/0000000000")));
  await assertFails(getDoc(doc(bob(), "agent_logs/l1")));
  await assertSucceeds(getDoc(doc(admin(), "agent_logs/l1")));
});

test("temporal blocks and cold archives are private", { skip }, async () => {
  await assertSucceeds(setDoc(doc(alice(), "temporal_blocks/alice_2026-10-26"), { userId: "alice", messages: [] }));
  await assertFails(setDoc(doc(bob(), "temporal_blocks/alice_2026-10-27"), { userId: "bob" }));
  await assertFails(getDoc(doc(bob(), "temporal_blocks/alice_2026-10-26")));
  await assertSucceeds(getDocs(query(collection(alice(), "temporal_blocks"), where("userId", "==", "alice"))));
  await assertSucceeds(addDoc(collection(alice(), "cold_archives"), { userId: "alice", data: "x" }));
  await assertFails(addDoc(collection(bob(), "cold_archives"), { userId: "alice", data: "x" }));
});

test("owners can delete their own data (right to erasure)", { skip }, async () => {
  await assertFails(deleteDoc(doc(bob(), "conversations/c1")));
  await assertSucceeds(deleteDoc(doc(alice(), "conversations/c1")));
  await assertSucceeds(deleteDoc(doc(alice(), "shared_transcripts/s1")));
});
