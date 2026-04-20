import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import admin from "firebase-admin";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { TwitterApi } from "twitter-api-v2";
import { getFirestore } from "firebase-admin/firestore";
import crypto from "crypto";
import { getRazorpay } from "./src/lib/razorpay.js";
import { witnessBlock } from "./src/lib/aitihya.js";

// --- GLOBAL SAFETY NET ---
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process] Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught Exception:', err);
});

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("[Server] INITIALIZING ARTHASHASTRA...");

// 1. Manual Config Load
let firebaseConfig = {};
try {
  const cfgPath = path.resolve(__dirname, "firebase-applet-config.json");
  if (fs.existsSync(cfgPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  }
} catch (e) {
  console.error("[Server] Config Read Error:", e);
}

const isPlaceholder = (val) => !val || ["MY_FIREBASE_PROJECT_ID", "YOUR_API_KEY", "TODO"].some(p => String(val).includes(p));

const getVal = (envK, cfgK) => {
  const ev = process.env[envK];
  if (!isPlaceholder(ev)) return ev;
  const cv = firebaseConfig[cfgK];
  if (!isPlaceholder(cv)) return cv;
  return null;
};

const projectId = getVal("VITE_FIREBASE_PROJECT_ID", "projectId");
const dbId = getVal("FIREBASE_DATABASE_ID", "firestoreDatabaseId") || getVal("VITE_FIREBASE_DATABASE_ID", "firestoreDatabaseId");

let db = null;
if (projectId && !admin.apps.length) {
  admin.initializeApp({ projectId });
  db = getFirestore(dbId && dbId !== "(default)" ? dbId : undefined);
} else if (admin.apps.length) {
  db = getFirestore(dbId && dbId !== "(default)" ? dbId : undefined);
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  app.use(express.json());
  app.use(cookieParser());

  // Immediate Port Binding
  const httpServer = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Port ${PORT} secured.`);
  });

  // Basic Routes
  app.get("/api/health", (req, res) => res.json({ status: "ok", projectId }));

  // Dynamic Logic Load
  try {
    const { 
      macroTriad, corporateTriad, regionalIndiaTriad, healthTriad,
      bankingRetailTriad, bankingSystemicRiskTriad, marketsEquitiesTriad,
      marketsDerivativesTriad, regionalUSTriad, regionalChinaTriad, cryptoeconomicTriad, darkWebVettingTriad,
      runTriad, twitterMonitorAgent, twitterPosterAgent, twitterBroadcasterAgent, twitterInteractionAgent 
    } = await import("./src/lib/agents.js");
    const { ai, SYSTEM_INTELLIGENCE_CORE } = await import("./src/lib/gemini.js");

    const serverContext = {
      ai: {
        models: {
          generateContent: async (p) => {
            // Prepend the System Intelligence Core to every agent prompt to ensure unified brain identity
            const fullPrompt = `${SYSTEM_INTELLIGENCE_CORE}\n\nTask-Specific Instructions: ${p.contents}`;
            const resp = await ai.models.generateContent({
              model: "gemini-3-flash-preview",
              contents: [{ role: "user", parts: [{ text: fullPrompt }] }]
            });
            return { text: resp.text };
          }
        }
      },
      db,
      appUrl: process.env.APP_URL || (projectId ? `https://${projectId}.firebaseapp.com` : ""),
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      logAction: async (n, a, s) => {
        if (admin.apps.length && db) await db.collection("agent_logs").add({ agentName: n, action: a, status: s, timestamp: new Date().toISOString() });
      }
    };

    const triads = [macroTriad, corporateTriad, regionalIndiaTriad, healthTriad, bankingRetailTriad, bankingSystemicRiskTriad, marketsEquitiesTriad, marketsDerivativesTriad, regionalUSTriad, regionalChinaTriad, cryptoeconomicTriad, darkWebVettingTriad];
    
    const runCycle = async () => {
      // Gracefully abort if the provided key is a placeholder or unset to prevent log spamming
      const key = process.env.GEMINI_API_KEY;
      if (!key || key === "MY_GEMINI_API_KEY" || key.includes("AIza_FAKE")) {
        console.warn("[Agent Cycle] Paused: GEMINI_API_KEY is missing or set to a placeholder. Set a valid key in Secrets to resume background cycles.");
        return;
      }
      
      console.log("[Cycle] Starting Optimized Intelligence Run...");
      // Stagger triad execution to spread token load
      for (const t of triads) { 
        await runTriad(t, serverContext); 
        await new Promise(r => setTimeout(r, 15000 + Math.random() * 10000)); 
      }
      
      await twitterMonitorAgent(serverContext);
      await new Promise(r => setTimeout(r, 5000));
      await twitterPosterAgent(serverContext);
      await new Promise(r => setTimeout(r, 5000));
      await twitterBroadcasterAgent(serverContext);
      await new Promise(r => setTimeout(r, 5000));
      await twitterInteractionAgent(serverContext);
    };

    // Run every 30 minutes to maximize free token quota while maintaining 'always-on' presence
    setInterval(runCycle, 30 * 60 * 1000);
    setTimeout(runCycle, 20000);

    // Chat API
    app.post("/api/chat", async (req, res) => {
      try {
        const { history, message, language } = req.body;
        const stream = await ai.models.generateContentStream({
          model: "gemini-3-flash-preview",
          contents: [...history, { role: "user", parts: [{ text: message }] }],
          config: { systemInstruction: `Respond in ${language}.` }
        });
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        for await (const c of stream) {
           if (c.text) res.write(c.text);
        }
        res.end();
      } catch (e: any) { 
        console.error("[Chat API Error]:", e);
        const code = e.message?.includes('CONFIGURATION_REQUIRED') ? 401 : 500;
        res.status(code).send(e.message || "Internal Server Error"); 
      }
    });

    // --- ENFORCEMENT GATEKEEPER ---
    // Specifically for Explanation access tracking (Free: 3, then Paid)
    // Enforces the 3-free-explanations rule ATOMICALLY on the backend.
    app.get("/api/gatekeeper/explanation/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({ error: "Auth Required", code: "AUTH_REQUIRED" });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(token);
        const uid = decodedToken.uid;

        if (!admin.apps.length || !db) return res.status(500).json({ error: "Database not initialized" });

        const userRef = db.collection("users").doc(uid);
        const expRef = db.collection("explanations").doc(id);

        let activeExplanation: any = null;
        let finalViewCount = 0;
        let isSubscribed = false;

        // Atomic Transaction for the 3-free-explanations rule
        await db.runTransaction(async (transaction) => {
          const userDoc = await transaction.get(userRef);
          const expDoc = await transaction.get(expRef);

          if (!expDoc.exists) {
            throw new Error("EXPLANATION_NOT_FOUND");
          }
          activeExplanation = expDoc.data();

          let userData = userDoc.exists ? userDoc.data() : { 
            uid, 
            email: decodedToken.email, 
            role: 'user', 
            explanationViewCount: 0, 
            isSubscribed: false 
          };

          // Initialize missing fields
          if (userData.explanationViewCount === undefined) userData.explanationViewCount = 0;
          if (userData.isSubscribed === undefined) userData.isSubscribed = false;

          isSubscribed = userData.isSubscribed;

          // Check Access Permissions
          const canAccess = userData.isSubscribed || userData.explanationViewCount < 3;

          if (!canAccess) {
            throw new Error("PAYWALL_REACHED");
          }

          // Increment count if not subscribed
          if (!userData.isSubscribed) {
             userData.explanationViewCount += 1;
             transaction.set(userRef, { explanationViewCount: userData.explanationViewCount }, { merge: true });
          }
          finalViewCount = userData.explanationViewCount;
        });

        res.json({
          explanation: activeExplanation,
          remainingFree: isSubscribed ? Infinity : 3 - finalViewCount
        });

      } catch (e: any) {
        if (e.message === "PAYWALL_REACHED") {
          return res.status(403).json({ error: "Subscription required", code: "PAYWALL" });
        }
        if (e.message === "EXPLANATION_NOT_FOUND") {
          return res.status(404).json({ error: "Explanation Not Found" });
        }
        console.error("[Gatekeeper Error]:", e);
        res.status(500).json({ error: "Access validation failed" });
      }
    });

    // --- PAYMENTS API (Razorpay) ---
    
    // Create Razorpay Order
    app.post("/api/payments/create-order", async (req, res) => {
      try {
        const { planId } = req.body; // e.g., 'absolute_witness'
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).send("Unauthorized");

        const razorpay = getRazorpay();
        const amount = 3400; // Rs 34.00 (in paise) per requirement

        const order = await razorpay.orders.create({
          amount,
          currency: "INR",
          receipt: `receipt_${Date.now()}`,
          notes: {
            planId,
            identity: "Absolute Witness Access"
          }
        });

        res.json(order);
      } catch (e) {
        console.error("[Razorpay Order Error]:", e);
        res.status(500).json({ error: "Failed to create payment order" });
      }
    });

    // Razorpay Webhook Management
    // HMAC Signature Verification + Idempotent Processing
    app.post("/api/payments/webhook", async (req, res) => {
      const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
      const signature = req.headers["x-razorpay-signature"];

      if (typeof signature !== 'string') return res.status(400).send("No signature field");

      const shasum = crypto.createHmac("sha256", secret || "LEGACY_SECRET");
      shasum.update(JSON.stringify(req.body));
      const digest = shasum.digest("hex");

      if (digest !== signature) {
        return res.status(400).send("Invalid signature");
      }

      const event = req.body.event;
      console.log(`[Razorpay Webhook] Event received: ${event}`);

      if (event === "payment.captured" || event === "order.paid") {
        const payload = req.body.payload.payment?.entity || req.body.payload.order?.entity;
        const orderNotes = payload.notes || {};
        const paymentId = payload.id || "manual_capture";
        const userId = orderNotes.userId; // Important: Ensure frontend sends userId in notes
        
        // Record immutable audit trail to Aitihya Chain
        const eventData = { event, paymentId, userId, amount: payload.amount, timestamp: new Date().toISOString() };
        const signingSecret = process.env.AITIHYA_SIGNING_SECRET || "ARTHASHASTRA_ROOT";
        const block = await witnessBlock(eventData, "PaymentsGatekeeper", "Oracle", undefined, signingSecret);
        
        // Record to Firestore and update user status atomically
        if (db && userId) {
          const batch = db.batch();
          const paymentRef = db.collection("payments").doc(paymentId);
          const userRef = db.collection("users").doc(userId);
          const subRef = db.collection("subscriptions").doc(userId);

          batch.set(paymentRef, {
            ...eventData,
            blockchainTxId: block.hash,
            status: "confirmed"
          });

          batch.update(userRef, { 
            isSubscribed: true, 
            updatedAt: new Date().toISOString() 
          });

          batch.set(subRef, {
            userId,
            status: "active",
            plan: orderNotes.planId || "absolute_witness",
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
            paymentId
          });

          await batch.commit();
          console.log(`[Subscription] Witnessed and activated for user ${userId}`);
        }

        console.log(`[Blockchain] Witnessed payment ${paymentId} with hash ${block.hash}`);
      }

      res.json({ status: "ok" });
    });

    // Twitter OAuth Routes
    app.get("/api/auth/twitter/url", async (req, res) => {
      try {
        const clientId = process.env.TWITTER_CLIENT_ID;
        const clientSecret = process.env.TWITTER_CLIENT_SECRET;
        // Fallback to host header if APP_URL is not set
        const appUrl = process.env.APP_URL || (req.headers.host ? `https://${req.headers.host}` : "");

        if (!clientId || !clientSecret || !appUrl) {
          const suggestedUrl = appUrl || "YOUR_APP_URL";
          return res.status(400).json({ 
            error: "Twitter OAuth variables (TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET) are not set in the environment/secrets.",
            details: {
              info: "You must set these in the Secrets panel in AI Studio.",
              requiredCallbackUrl: `${suggestedUrl}/api/auth/twitter/callback`,
              instructions: "1. Go to Twitter Developer Portal. 2. Create an OAuth 2.0 app. 3. Set the Type to 'Web App'. 4. Add the callback URL above. 5. Copy Client ID and Secret to AI Studio Secrets."
            }
          });
        }

        const client = new TwitterApi({ clientId, clientSecret });
        // Generate auth link, requiring offline access to get a refresh token
        const { url, codeVerifier, state } = client.generateOAuth2AuthLink(
          `${appUrl}/api/auth/twitter/callback`,
          { scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'] }
        );

        // Store verifier and state in cookies for the callback to use
        res.cookie('twitter_verifier', codeVerifier, { httpOnly: true, secure: true, maxAge: 1000 * 60 * 15 });
        res.cookie('twitter_state', state, { httpOnly: true, secure: true, maxAge: 1000 * 60 * 15 });

        res.json({ url });
      } catch (e) {
        console.error("Twitter Auth URL Error:", e);
        res.status(500).json({ error: "Failed to generate Twitter auth URL" });
      }
    });

    app.get("/api/auth/twitter/callback", async (req, res) => {
      try {
        const { state, code } = req.query;
        const storedState = req.cookies.twitter_state;
        const codeVerifier = req.cookies.twitter_verifier;

        if (state !== storedState || !codeVerifier || typeof code !== 'string') {
          return res.status(400).send("Invalid OAuth state or verifier. Please close this window and try again.");
        }

        const clientId = process.env.TWITTER_CLIENT_ID;
        const clientSecret = process.env.TWITTER_CLIENT_SECRET;
        const appUrl = process.env.APP_URL || (req.headers.host ? `https://${req.headers.host}` : "");
        
        const client = new TwitterApi({ clientId, clientSecret });

        const { accessToken, refreshToken, expiresIn } = await client.loginWithOAuth2({
          code,
          codeVerifier,
          redirectUri: `${appUrl}/api/auth/twitter/callback`
        });

        // Store the tokens in Firestore so the agents can use them
        if (admin.apps.length && db) {
          await db.collection("config").doc("twitter").set({
            accessToken,
            refreshToken,
            expiresAt: Date.now() + (expiresIn * 1000),
            updatedAt: Date.now()
          }, { merge: true });
        } else {
          console.warn("Firestore not available to save Twitter token. Will only persist in memory/env temporarily.");
        }

        // Return an HTML page that sends a message to the opener, then closes itself
        res.send(`
          <html>
            <head><title>Twitter Auth Successful</title></head>
            <body>
              <p>Twitter connected successfully! You may close this window.</p>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'TWITTER_AUTH_SUCCESS' }, '*');
                  window.close();
                } else {
                  console.log("No opener window found.");
                }
              </script>
            </body>
          </html>
        `);
      } catch (e) {
        console.error("Twitter OAuth Callback Error:", e);
        res.status(500).send("Authentication failed. Check the server logs.");
      }
    });

  } catch (err) {
    console.error("[Server] Logic Load Fail:", err);
  }

  // Vite
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const dist = path.resolve(__dirname, "dist");
    app.use(express.static(dist));
    app.get("*", (req, res) => res.sendFile(path.join(dist, "index.html")));
  }
}

startServer();
