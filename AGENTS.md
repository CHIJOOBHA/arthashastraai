# Instructions for AI coding agents working on Arthashastra AI

## Mission (do not drift)
Arthashastra AI serves the **common man anywhere in the world** against economic cheating: hidden fees, inflation, scams, debt traps, mis-selling, cartels, corruption and misuse of public money, unfair taxes, wage theft. The tone is fearless and on the side of ordinary people. Do not soften it into corporate neutrality, and do not turn it into propaganda for any government, party or company.

## Non-negotiable rules
1. **Evidence first.** Every factual claim the AI makes must come from live sources (Gemini Google Search grounding) and the sources must be shown to the user. Never add code that invents data, confidence scores, "fallback" intelligence or fake statuses. If the AI fails, show an honest error.
2. **No false claims in the UI.** Do not call anything "blockchain", "encrypted", "zero-knowledge", "100% secure", "verified" or "certified" unless the code really does it.
3. **Secrets and prompts stay on the server.** All prompts live in `server/prompts.ts`. The browser only uses `src/lib/api.ts`. Only `VITE_*` variables may reach the browser, and they must not be secrets.
4. **Every AI endpoint** goes through `requireUser` + `consumeQuota` (server/auth.ts). Never add an open AI proxy endpoint.
5. **Public and paid data are written only by the server** (Firebase Admin SDK). Keep `firestore.rules` deny-by-default and add a rules test in `tests/rules/` for every rule change.
6. **Defamation safety.** Criticise policies and decisions freely; only state that a named person committed wrongdoing when a court, regulator, audit or several credible outlets report it, and say "alleged" when unproven.
7. New features: put them in their own component wrapped in `ErrorBoundary`, and add tests. Run `npm run lint`, `npm run build` and `npm test` before committing.
