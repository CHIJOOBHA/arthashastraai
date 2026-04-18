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
      marketsDerivativesTriad, regionalUSTriad, regionalChinaTriad, darkWebVettingTriad,
      runTriad, twitterMonitorAgent, twitterPosterAgent 
    } = await import("./src/lib/agents.js");
    const { ai } = await import("./src/lib/gemini.js");

    const serverContext = {
      ai: {
        models: {
          generateContent: async (p) => {
            const resp = await ai.models.generateContent({
              model: "gemini-3-flash-preview",
              contents: p.contents
            });
            return { text: resp.text };
          }
        }
      },
      db,
      logAction: async (n, a, s) => {
        if (admin.apps.length) await db.collection("agent_logs").add({ agentName: n, action: a, status: s, timestamp: new Date().toISOString() });
      }
    };

    const triads = [macroTriad, corporateTriad, regionalIndiaTriad, healthTriad, bankingRetailTriad, bankingSystemicRiskTriad, marketsEquitiesTriad, marketsDerivativesTriad, regionalUSTriad, regionalChinaTriad, darkWebVettingTriad];
    
    const runCycle = async () => {
      // Gracefully abort if the provided key is a placeholder or unset to prevent log spamming
      const key = process.env.GEMINI_API_KEY;
      if (!key || key === "MY_GEMINI_API_KEY" || key.includes("AIza_FAKE")) {
        console.warn("[Agent Cycle] Paused: GEMINI_API_KEY is missing or set to a placeholder. Set a valid key in Secrets to resume background cycles.");
        return;
      }
      
      console.log("[Cycle] Starting...");
      for (const t of triads) { await runTriad(t, serverContext); await new Promise(r => setTimeout(r, 10000)); }
      await twitterMonitorAgent(serverContext);
      await twitterPosterAgent(serverContext);
    };

    setInterval(runCycle, 15 * 60 * 1000);
    setTimeout(runCycle, 15000);

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
        for await (const c of stream) if (c.text) res.write(c.text);
        res.end();
      } catch (e) { res.status(500).send("Err"); }
    });

    // Twitter OAuth Routes
    app.get("/api/auth/twitter/url", async (req, res) => {
      try {
        const clientId = process.env.TWITTER_CLIENT_ID;
        const clientSecret = process.env.TWITTER_CLIENT_SECRET;
        const appUrl = process.env.APP_URL;

        if (!clientId || !clientSecret || !appUrl) {
          return res.status(400).json({ error: "Twitter OAuth variables (TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET, APP_URL) are not set in the environment/secrets." });
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
        const appUrl = process.env.APP_URL;
        
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
