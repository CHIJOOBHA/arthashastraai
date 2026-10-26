# Arthashastra AI

**The economic witness for ordinary people, anywhere in the world.**
Arthashastra AI shows people, in plain language and in their own language, how they lose money and rights: hidden fees, inflation, scams, debt traps, mis-selling, cartels, misuse of public money, unfair taxes and more. **Every answer is backed by live web sources, linked at the bottom.**

## What it does

| Feature | What happens |
|---|---|
| **Chat** | Ask anything in 15 languages. The AI searches the web (Google Search grounding), answers, lists its sources, and adds a share-ready "Counter-Tweet". |
| **Intelligence feed** | 12 agents (Chanakya-01 … Akasha-12) rotate daily across 12 watch-desks. Each desk: *search real reports → independent second search to fact-check → plain-language "who pays / what you can do"*. Only confirmed items are published, with their sources. |
| **Explanations** | Deep dive on each feed item. 3 free, then subscription. |
| **The Arena** | Public debates. Users post arguments; the AI gives a sourced verdict and replies. |
| **Gazette** | One sourced daily newspaper edition, shareable at `/gazette/<date>`. |
| **Economic Risk Radar** | Current risks for households, rated Low / Elevated / High with evidence (no fake probabilities). |
| **Personal archive** | Chat history, day-by-day memory, cold storage, full JSON export and "delete all my data". |
| **Subscription** | ₹34 for 30 days via Razorpay (one-time, no auto-renew). |
| **Audit log ("Aitihya chain")** | A hash-chained, HMAC-signed, server-only log of what the agents published and of payments. Tamper-evident — not a public blockchain. |

## How it is built

```
Browser (React PWA)  ──ID token──▶  /api/*  (Express on Vercel)  ──▶  Gemini (with Google Search)
        │                                   │
        └── reads public + own data ──▶ Firestore ◀── writes everything public / paid (Admin SDK)
```

- `src/` — the React app. Contains **no** prompts, keys or AI calls; it talks to the server through `src/lib/api.ts`.
- `server/` — the API: `app.ts` (routes), `ai.ts` (Gemini + sources), `agents.ts` (intelligence pipeline), `payments.ts` (Razorpay), `auth.ts` (sign-in, admin, daily limits), `ledger.ts`, `prompts.ts`.
- `firestore.rules` — database security. Browsers can only write their own private data and validated debate posts.
- `api/index.ts` — Vercel entry. `server.ts` — local / Cloud Run entry.
- `tests/` — unit tests, end-to-end tests (Firebase emulators) and security-rules tests. GitHub Actions runs all of them on every push.

## Setup (one time)

1. **Firebase** (console.firebase.google.com): use your project, enable **Authentication → Google** and **Anonymous**, and create a **Firestore** database.
   - Copy the web app config into the `VITE_FIREBASE_*` variables.
   - Project settings → Service accounts → *Generate new private key* → paste the JSON into `FIREBASE_SERVICE_ACCOUNT`.
   - **Publish the rules:** Firestore → Rules → paste the contents of `firestore.rules` → Publish.
   - Authentication → Settings → Authorized domains → add your Vercel domain.
2. **Gemini key** from aistudio.google.com/apikey → `GEMINI_API_KEY`.
3. **Razorpay** keys → `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`. Add a webhook to `https://<your-domain>/api/payments/webhook` for `payment.captured` and `order.paid`, and put its secret in `RAZORPAY_WEBHOOK_SECRET`.
4. Long random strings for `AITIHYA_SIGNING_SECRET` and `CRON_SECRET`. Your Google email in `ADMIN_EMAILS`.
5. Fill the `VITE_LEGAL_*`, `VITE_CONTACT_EMAIL` and `VITE_GRIEVANCE_*` values (shown on the Terms / Privacy pages; required for Razorpay and Indian IT Rules).
6. Put all of these in **Vercel → Project → Settings → Environment Variables** (see `.env.example`), then redeploy.

The agents run daily via Vercel Cron (`vercel.json`). Admins can also press **Run agents now** in the dashboard. On an always-on server set `AGENT_SCHEDULER_MINUTES`.

## Run locally

```bash
npm install
cp .env.example .env   # fill in values
npm run dev            # http://localhost:3000
npm test               # unit tests
npm run lint           # type check
```

## Limits and honesty notes

- The AI can still make mistakes. Answers always show their sources so readers can check.
- Daily AI limits per user (anonymous 5, signed-in 20, subscribers 200) protect your Gemini bill; change them with the `DAILY_LIMIT_*` variables.
- Vercel Hobby runs cron once a day, so ~3–4 desks refresh per day (all 12 every few days). Vercel Pro or an always-on server can run more often.
