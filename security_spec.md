# Security Specification - Arthashastra AI

## Data Invariants
1. A user can only access their own private data (conversations, subscription details).
2. Public data (intelligence, chronicles, debates) is read-only for users.
3. Users can posing "Debates" but cannot resolve them (only the AI/Admin can).
4. System logs and audit logs are write-protected from client SDKs.
5. PII (emails) must be restricted to the owner.

## The Dirty Dozen Payloads (Targeting Vulnerabilities)

1. **Identity Spoofing**: Attempt to create a conversation with a `userId` belonging to another user.
2. **Role Escalation**: Attempt to update a user profile's `role` to 'admin'.
3. **State Shortcutting**: Attempt to update a debate's `status` to 'resolved' as a regular user.
4. **Shadow Update**: Attempt to inject a `verified: true` field into a user profile that doesn't exist in the schema.
5. **PII Leak**: Attempt to read the email of another user via `/users/{otherUid}`.
6. **Resource Poisoning**: Use a 1MB string as a document ID for a new debate.
7. **Orphaned Write**: Create a message in a conversation that doesn't exist.
8. **Immutable Violation**: Change the `createdAt` timestamp on an existing debate.
9. **Blanket Read Attack**: Attempt to `list` all user profiles without a `where` clause restricting to self.
10. **Delete Vandalism**: Attempt to delete a public `Chronicle` document.
11. **System Field Poisoning**: Attempt to modify the `hash` or `previousHash` of a ledger entry.
12. **Unauthorized Subscription**: Propose a subscription update with status 'active' without a valid server-side validation (simulated by client write).

## Security Verification (Tests)
The following rules enforce strict schema validation and relationship integrity to block all the above payloads.
