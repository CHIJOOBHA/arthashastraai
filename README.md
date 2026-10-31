# Arthashastra AI

**The economic witness for ordinary people, anywhere in the world.**
Arthashastra AI shows people, in plain language and in their own language, how they lose money and rights: hidden fees, inflation, scams, debt traps, mis-selling, cartels, misuse of public money, unfair taxes and more. **Every answer is backed by live web sources, linked at the bottom.**

## What it does

| Feature | What happens |
|---|---|
| **Chat** | Ask anything in 15 languages. The AI searches the web (Google Search grounding), answers, lists its sources, and ends with a share-ready "Counter-Tweet" line for users to post themselves (the app never posts to Twitter/X automatically). |
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
Browser (React PWA)  ──ID token──▶  /api/*  (Express on Vercel)  ──▶  Claude Opus 5.5 + web search (or Gemini + Google Search)
        │                                   │
        └── reads public + own data ──▶ Firestore ◀── writes everything public / paid (Admin SDK)
```

- `src/` — the React app. Contains **no** prompts, keys or AI calls; it talks to the server through `src/lib/api.ts`.
- `server/` — the API: `app.ts` (routes), `ai.ts` (Claude/Gemini brain + inline citations), `agents.ts` (intelligence pipeline), `payments.ts` (Razorpay), `auth.ts` (sign-in, admin, daily limits), `ledger.ts`, `prompts.ts`.
- `firestore.rules` — database security. Browsers can only write their own private data and validated debate posts.
- `api/index.ts` — Vercel entry. `server.ts` — local / Cloud Run entry.
- `tests/` — unit tests, end-to-end tests (Firebase emulators) and security-rules tests. GitHub Actions runs all of them on every push.

## Setup (one time)

1. **Firebase** (console.firebase.google.com): use your project, enable **Authentication → Google** and **Anonymous**, and create a **Firestore** database.
   - Copy the web app config into the `VITE_FIREBASE_*` variables.
   - Project settings → Service accounts → *Generate new private key* → paste the JSON into `FIREBASE_SERVICE_ACCOUNT`.
   - **Publish the rules:** Firestore → Rules → paste the contents of `firestore.rules` → Publish.
   - Authentication → Settings → Authorized domains → add your Vercel domain.
2. **AI key** — at least one:
   - **Claude (recommended):** on claude.ai, Settings → Billing → API credits → Link organization (Max plans include monthly API credits), then platform.claude.com → API keys → `ANTHROPIC_API_KEY`.
   - **Gemini (backup):** aistudio.google.com/apikey with billing on (Google Search grounding is not in the free tier) → `GEMINI_API_KEY`.
   - With both set, Claude answers first and Gemini takes over automatically if Claude fails or credits run out (`AI_PROVIDER` picks the order).
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
- Daily AI limits per user (anonymous 5, signed-in 20, subscribers 200) protect your AI bill; change them with the `DAILY_LIMIT_*` variables.
- Vercel Hobby runs cron once a day, so ~3–4 desks refresh per day (all 12 every few days). Vercel Pro or an always-on server can run more often.

## The brain exam

`npm run eval` (with `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` set) asks the real AI 15 probing questions — a checkable fact, a false premise, a loaded question, an ambiguous question, an unverifiable accusation, a BJP/Congress symmetry pair, inflation maths, a causal claim, a denominator trap, a "no cheating" case, a Telugu scam victim, official-data distrust, a Nigerian bank case and a crypto "guaranteed returns" pitch — and grades each answer on 8 reasoning skills plus automatic checks (sources, inline citations, unsupported figures, Counter-Tweet, language). The report is written to `eval-results/`. On GitHub: Actions → **Brain exam** → Run workflow (needs the key as a repository secret).
