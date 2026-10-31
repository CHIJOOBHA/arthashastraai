# Security specification — Arthashastra AI

## Invariants
1. Users can read and delete only their own private data (conversations, messages, memory blocks, archives, share links). Nobody can read another user's profile, chats or payments.
2. Everything public or money-related (intelligence feed, explanations, ledger, agent logs, Gazette, Risk Radar results, AI replies in debates, users' subscription fields, payments) is written **only by the server** (Admin SDK). Browsers cannot write these collections at all.
3. Paid explanations are served only through `/api/explanations/:id`, which enforces the free-view limit and subscription expiry on the server.
4. Every AI-spending endpoint requires a valid Firebase ID token and consumes from a per-user daily quota stored in Firestore (`usage/{uid}_{date}`), plus a per-IP burst limit.
5. Payments: orders carry the buyer's uid; activation requires a valid Razorpay signature (checkout `order|payment` HMAC or webhook HMAC over the raw body), a captured payment of the right amount for the right user, and is idempotent per payment id. Subscriptions expire after 30 days.
6. Admin rights come from the `admin` custom claim (scripts/set-admin.ts), the server `ADMIN_EMAILS` list (verified emails only), or the owner's verified email in the rules.
7. No secret ever reaches the browser bundle; no prompt text is sent to the browser; `/api/health` returns no internal details; errors return generic messages.

## The "Dirty Dozen" attacks — all covered by `tests/rules/rules.test.ts`
1. Identity spoofing (write data as another user) — blocked.
2. Role escalation (`role: admin`) — users cannot write their profile at all.
3. State shortcutting (resolve a debate / forge an AI verdict) — blocked; only the server writes `aiResponse` and `role: model` messages.
4. Shadow fields (`verified: true`, `isSubscribed: true`) — `hasOnly` key lists everywhere.
5. PII leak (read another user's email) — blocked.
6. Resource poisoning (huge ids / strings) — id regex ≤128 chars, size caps on all strings.
7. Orphaned / foreign writes (messages into someone else's conversation) — blocked via `getAfter` ownership check.
8. Immutable violation (edit messages / createdAt) — messages cannot be updated; debate fields cannot be changed except likes.
9. Blanket reads (list all users) — blocked.
10. Delete vandalism on public content — blocked.
11. Ledger tampering — ledger is server-write-only, hash-chained and HMAC-signed.
12. Self-subscription — subscription fields are server-only; activation needs a verified payment.

Extra: like-count inflation (exactly +1 per user, tied to `likes/{uid}`), forged share transcripts (built server-side), forged threat reports (server-only).
