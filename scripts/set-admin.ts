/**
 * Gives (or removes) admin rights for a user, by email.
 *   npx tsx scripts/set-admin.ts someone@example.com          # grant
 *   npx tsx scripts/set-admin.ts someone@example.com --remove # revoke
 * Needs FIREBASE_SERVICE_ACCOUNT (and FIREBASE_PROJECT_ID) in .env.
 * The user must sign out and in again for the change to apply.
 */
import "dotenv/config";
import { getAdminAuth } from "../server/firebaseAdmin.js";

const [email, flag] = process.argv.slice(2);
if (!email) {
  console.error("Usage: npx tsx scripts/set-admin.ts <email> [--remove]");
  process.exit(1);
}
const auth = getAdminAuth();
if (!auth) {
  console.error("Firebase Admin is not configured (set FIREBASE_SERVICE_ACCOUNT).");
  process.exit(1);
}
const user = await auth.getUserByEmail(email);
const claims = { ...(user.customClaims || {}) } as Record<string, unknown>;
if (flag === "--remove") delete claims.admin;
else claims.admin = true;
await auth.setCustomUserClaims(user.uid, claims);
console.log(`${flag === "--remove" ? "Removed" : "Granted"} admin for ${email} (uid ${user.uid}).`);
