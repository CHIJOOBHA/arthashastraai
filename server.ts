// --- MISSION LOCK: ARTHASHASTRA ARCHITECTURE SECURED ---
// THIS FILE IS PART OF THE IMMORTAL CORE. NO MODIFICATION WITHOUT OVERRIDE.

import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
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

// We use process.cwd() instead of __dirname to support both TSX (ESM) and CJS builds
const rootDir = process.cwd();

console.log("[Server] INITIALIZING ARTHASHASTRA...");

// 1. Manual Config Load
let firebaseConfig: any = {};
try {
  const cfgPath = path.resolve(rootDir, "firebase-applet-config.json");
  if (fs.existsSync(cfgPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  }
} catch (e) {
  console.error("[Server] Config Read Error:", e);
}

// --- DATABASE: THE ROOT LEDGER ---
const isPlaceholder = (val: any) => {
  if (!val || typeof val !== 'string') return true;
  const p = val.trim();
  return [
    "MY_FIREBASE_PROJECT_ID", 
    "YOUR_API_KEY", 
    "TODO", 
    "YOUR_PROJECT_ID",
    "AIza_FAKE",
    "YOUR_DATABASE_ID",
    "REPLACE_WITH"
  ].some(placeholder => p.includes(placeholder)) || p.length < 4;
};

let db: any = null;
let isCycling = false;
let finalProjectId = "";
let finalDatabaseId = "";
let lastFirestoreError = "";
let configProjectId = "";
let configDatabaseId = "";
let projectCandidates: (string | undefined)[] = [];
let databaseCandidates: string[] = [];
let trialErrors: string[] = [];

// --- FIREBASE CLIENT SDK COMPATIBILITY ADAPTER ---
// Emulates the Node.js Admin SDK firestore API on top of the Firebase Client SDK.
const fRefs: any = {};

class ClientDocumentSnapshot {
  constructor(private snap: any) {}
  get exists() { return this.snap.exists(); }
  get id() { return this.snap.id; }
  data() { return this.snap.data(); }
}

class ClientDocumentReference {
  constructor(private clientDb: any, private col: string, private docId?: string) {}
  get id() { return this.docId || ""; }
  get nativeRef() {
    return fRefs.doc(this.clientDb, this.col, this.docId!);
  }
  async get() {
    const snap = await fRefs.getDoc(this.nativeRef);
    return new ClientDocumentSnapshot(snap);
  }
  async set(data: any, options?: any) {
    await fRefs.setDoc(this.nativeRef, data, options);
  }
  async update(data: any) {
    await fRefs.updateDoc(this.nativeRef, data);
  }
}

class ClientQuery {
  constructor(private clientDb: any, private col: string, private constraints: any[]) {}
  limit(n: number) {
    return new ClientQuery(this.clientDb, this.col, [...this.constraints, { type: 'limit', val: n }]);
  }
  async get() {
    let q = fRefs.collection(this.clientDb, this.col);
    for (const c of this.constraints) {
      if (c.type === 'limit') {
        q = fRefs.query(q, fRefs.limit(c.val));
      }
    }
    const snap = await fRefs.getDocs(q);
    return {
      empty: snap.empty,
      docs: snap.docs.map((d: any) => new ClientDocumentSnapshot(d))
    };
  }
}

class ClientCollectionReference {
  constructor(private clientDb: any, private colName: string) {}
  doc(docId?: string) {
    return new ClientDocumentReference(this.clientDb, this.colName, docId);
  }
  async add(data: any) {
    const ref = await fRefs.addDoc(fRefs.collection(this.clientDb, this.colName), data);
    return new ClientDocumentReference(this.clientDb, this.colName, ref.id);
  }
  limit(n: number) {
    return new ClientQuery(this.clientDb, this.colName, [{ type: 'limit', val: n }]);
  }
}

class ClientWriteBatch {
  private batchInstance: any;
  constructor(clientDb: any) {
    this.batchInstance = fRefs.writeBatch(clientDb);
  }
  set(docRef: ClientDocumentReference, data: any, options?: any) {
    this.batchInstance.set(docRef.nativeRef, data, options);
  }
  async commit() {
    await this.batchInstance.commit();
  }
}

class ClientTransaction {
  constructor(private nativeTx: any, private clientDb: any) {}
  get(docRef: ClientDocumentReference) {
    return this.nativeTx.get(docRef.nativeRef).then((snap: any) => new ClientDocumentSnapshot(snap));
  }
  set(docRef: ClientDocumentReference, data: any, options?: any) {
    this.nativeTx.set(docRef.nativeRef, data, options);
    return this;
  }
  update(docRef: ClientDocumentReference, data: any) {
    this.nativeTx.update(docRef.nativeRef, data);
    return this;
  }
}

class ClientFirestoreAdapter {
  constructor(public clientDb: any) {}
  collection(colName: string) {
    return new ClientCollectionReference(this.clientDb, colName);
  }
  batch() {
    return new ClientWriteBatch(this.clientDb);
  }
  async runTransaction(updateFn: (transaction: any) => Promise<any>) {
    return await fRefs.runTransaction(this.clientDb, async (nativeTx: any) => {
      const wrapped = new ClientTransaction(nativeTx, this.clientDb);
      return await updateFn(wrapped);
    });
  }
}

async function initializeFirestore() {
  // 1. Resolve potential IDs
  configProjectId = (firebaseConfig.projectId && !isPlaceholder(firebaseConfig.projectId)) ? firebaseConfig.projectId : "";
  configDatabaseId = (firebaseConfig.firestoreDatabaseId && !isPlaceholder(firebaseConfig.firestoreDatabaseId)) ? firebaseConfig.firestoreDatabaseId : "";
  
  const envProjectId = (process.env.VITE_FIREBASE_PROJECT_ID && !isPlaceholder(process.env.VITE_FIREBASE_PROJECT_ID))
    ? process.env.VITE_FIREBASE_PROJECT_ID
    : (process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID || "");
    
  const envDatabaseId = (process.env.VITE_FIREBASE_DATABASE_ID && !isPlaceholder(process.env.VITE_FIREBASE_DATABASE_ID))
    ? process.env.VITE_FIREBASE_DATABASE_ID
    : "";

  projectCandidates = [
    configProjectId,
    envProjectId,
    undefined // ADC fallback
  ].filter((v, i, a) => {
     if (v === undefined) return a.indexOf(undefined) === i;
     if (v === "") return false;
     return a.indexOf(v) === i;
  }); 

  databaseCandidates = [
    configDatabaseId,
    envDatabaseId,
    "(default)" 
  ].filter(v => v && v !== "" && !isPlaceholder(v)).filter((v, i, a) => a.indexOf(v) === i);

  console.log(`[Server] Connection Strategy: Projects=[${projectCandidates.map(p => p || 'ADC').join(', ')}], DBs=[${databaseCandidates.join(', ')}]`);

  // Try to use Client SDK as a last-resort fallback if Service Account is missing
  let clientDb: any = null;
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  const hasSA = sa && !isPlaceholder(sa);
  
  if (!hasSA && configProjectId && firebaseConfig.apiKey && !isPlaceholder(firebaseConfig.apiKey)) {
    console.log("[Server] No Service Account provided. Falling back to Firebase Client SDK for Server.");
    try {
      const { initializeApp } = await import("firebase/app");
      const { getFirestore } = await import("firebase/firestore");
      // Prevent multiple initialization warnings
      let clientApp;
      try {
        clientApp = initializeApp(firebaseConfig, "server-client-app");
      } catch (e: any) {
        if (e.code === 'app/duplicate-app') {
           const { getApp } = await import("firebase/app");
           clientApp = getApp("server-client-app");
        } else throw e;
      }
      
      const targetDbId = databaseCandidates[0] === '(default)' ? undefined : databaseCandidates[0];
      clientDb = getFirestore(clientApp, targetDbId);
      
      // Test read to see if security rules allow us to use the client SDK globally
      console.log(`[Server] Testing Client SDK read for ${configProjectId}:${targetDbId || '(default)'}`);
      const firestoreModule = await import("firebase/firestore");
      Object.assign(fRefs, firestoreModule);

      const testSnap = await fRefs.getDocs(fRefs.query(fRefs.collection(clientDb, '_health_'), fRefs.limit(1)));
      
      // If we got here, client DB works! We won't have full admin rights, but we can operate.
      db = new ClientFirestoreAdapter(clientDb);
      finalProjectId = configProjectId;
      finalDatabaseId = targetDbId || "(default)";
      console.log(`[Server] VERIFIED CONNECTION via Client SDK Wrapper: Project=${finalProjectId}, DB=${finalDatabaseId}`);
      lastFirestoreError = "";
      return; 
    } catch (e: any) {
      console.warn(`[Server] Client SDK Fallback Failed: ${e.message}`);
      trialErrors.push(`Client SDK -> ${e.message}`);
    }
  }

  const initAdmin = (projectId: string | undefined) => {
    const apps = [...admin.apps];
    for (const app of apps) {
      try {
        if (app) app.delete();
      } catch (e) {
        console.warn("[Server] App Delete Error:", e);
      }
    }

    try {
      if (hasSA) {
        admin.initializeApp({
          credential: admin.credential.cert(JSON.parse(sa)),
          projectId: projectId || undefined
        });
      } else if (projectId) {
        admin.initializeApp({ projectId });
      } else {
        admin.initializeApp();
      }
      console.log(`[Server] Admin Initialized for Project: ${admin.app().options.projectId || 'ADC'}`);
    } catch (err) {
      console.error("[Server] Admin Init Failed:", err);
    }
  };

  const attemptBind = async (p: string | undefined, d: string): Promise<{score: number, db: any}> => {
    try {
      initAdmin(p);
      const dbTarget = (d === "(default)" || d === "default" || !d) ? undefined : d;
      const testDb = dbTarget ? getFirestore(admin.app(), dbTarget) : getFirestore(admin.app());
      
      const snap = await testDb.collection('_health_').doc('heartbeat').get();
      
      let score = 1; 
      try {
        const intelSnap = await testDb.collection('intelligence').limit(5).get();
        if (!intelSnap.empty) score += 10;
        
        const chatSnap = await testDb.collection('conversations').limit(5).get();
        if (!chatSnap.empty) score += 8;
      } catch (e) {}
      
      return { score, db: testDb };
    } catch (err: any) {
      lastFirestoreError = `${err.code || 'ERROR'}: ${err.message}`;
      console.warn(`[Server] Trial Failed: Project=${p || 'ADC'}, DB=${d} -> ${lastFirestoreError}`);
      return { score: 0, db: null };
    }
  };

  let bestCandidate: {score: number, db: any, p: string | undefined, d: string, error?: string} = { score: 0, db: null, p: undefined, d: "" };

  for (const p of projectCandidates) {
    for (const d of databaseCandidates) {
      const result = await attemptBind(p, d);
      if (result.score > bestCandidate.score) {
        bestCandidate = { ...result, p, d };
      }
      if (result.score === 0) {
        trialErrors.push(`${p || 'ADC'}:${d} -> ${lastFirestoreError}`);
      }
      if (result.score > 5) break;
    }
    if (bestCandidate.score > 5) break;
  }

  if (bestCandidate.db) {
    db = bestCandidate.db;
    finalProjectId = admin.app().options.projectId || bestCandidate.p || process.env.GOOGLE_CLOUD_PROJECT || "ADC";
    finalDatabaseId = bestCandidate.d || "(default)";
    console.log(`[Server] VERIFIED CONNECTION: Project=${finalProjectId}, DB=${finalDatabaseId} (Score: ${bestCandidate.score})`);
    lastFirestoreError = "";
  } else {
    lastFirestoreError = trialErrors.length > 0 ? trialErrors[0] : "All connection trials failed";
    console.error(`[Server] FATAL: All Firestore trials failed. Errors: ${trialErrors.join(' | ')}`);
  }
}

// Make app accessible globally for Vercel
let configuredApp: any;

async function startServer() {
  const app = express();
  configuredApp = app;
  const PORT = parseInt(process.env.PORT || '3000', 10);
  app.use(express.json());
  app.use(cookieParser());

  // Immediate Port Binding
  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[Server] Port ${PORT} secured.`);
    });
  }

  // Asynchronously initialize Firestore to prevent boot blockage
  initializeFirestore().catch((err) => {
    console.error("[Server] Firestore background initialization error:", err);
  });

    // Enhanced Routes
    app.get("/api/health", async (req, res) => {
      const { getEnv } = await import("./src/lib/env.js");
      
      const geminiKey = process.env.USER_GEMINI_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY;
      const isGeminiConfigured = geminiKey && 
                                !geminiKey.includes("AIza_FAKE") && 
                                geminiKey !== "MY_GEMINI_API_KEY" && 
                                geminiKey.length > 3;

      // Detect all missing or placeholder keys
      const missingKeys = [];
      const criticalKeys = [];

      if (!isGeminiConfigured) {
        // Only mark as missing if NO key is found at all
        if (!geminiKey) {
          missingKeys.push("GEMINI_API_KEY");
          criticalKeys.push("GEMINI_API_KEY");
        }
      }
      
      const hasFirebase = !!db;
      if (!hasFirebase) {
        let firebaseLabel = "FIREBASE_DATABASE";
        if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
           firebaseLabel = "FIREBASE_SERVICE_ACCOUNT_MISSING";
        } else if (lastFirestoreError) {
          if (lastFirestoreError.includes("PERMISSION_DENIED")) {
            firebaseLabel += " (Permission Denied)";
          } else if (lastFirestoreError.includes("NOT_FOUND")) {
            firebaseLabel += " (Not Found)";
          } else {
            firebaseLabel += ` (${lastFirestoreError})`;
          }
        }
        missingKeys.push(firebaseLabel);
        
        // Database is warning only, so frontend can continue functioning
        // criticalKeys.push("FIREBASE_LEDGER");
      }

      console.log(`[Health Check] Gemini:${isGeminiConfigured}, Firebase:${hasFirebase}, Criticals:${criticalKeys.length}`);

      const hasAitihya = process.env.AITIHYA_SIGNING_SECRET && !isPlaceholder(process.env.AITIHYA_SIGNING_SECRET);
      if (!hasAitihya) {
        // We allow it to be missing, but it's a warning
        // missingKeys.push("AITIHYA_SIGNING_SECRET");
      }
      
      // System is only "Unconfigured" if CRITICAL keys are missing
      let finalStatus: 'active' | 'warn' | 'unconfigured' = "active";
      if (criticalKeys.length > 0) {
        finalStatus = "unconfigured";
      } else if (missingKeys.length > 0) {
        finalStatus = "warn";
      }

      res.json({ 
        status: finalStatus, 
        projectId: finalProjectId,
        databaseId: finalDatabaseId,
        geminiConfigured: isGeminiConfigured,
        firestoreReady: !!db,
        missingKeys,
        error: finalStatus !== 'active' ? `System ${finalStatus}. Missing: ${missingKeys.join(", ")}` : null,
        debug: {
          lastError: lastFirestoreError,
          envProject: process.env.GOOGLE_CLOUD_PROJECT || "unset",
          configProject: configProjectId || "unset",
          hasSA: !!(process.env.FIREBASE_SERVICE_ACCOUNT && process.env.FIREBASE_SERVICE_ACCOUNT !== ""),
          candidates: {
            projects: projectCandidates.map(p => p || 'ADC'),
            databases: databaseCandidates
          },
          trialErrors: trialErrors
        }
      });
    });

  // Dynamic Logic Load
  try {
    const { 
      macroTriad, corporateTriad, regionalIndiaTriad, healthTriad,
      bankingRetailTriad, bankingSystemicRiskTriad, marketsEquitiesTriad,
      marketsDerivativesTriad, regionalUSTriad, regionalChinaTriad, cryptoeconomicTriad, darkWebVettingTriad,
      runTriad
    } = await import("./src/lib/agents.js");
    const { historicalIntelligenceTriad } = await import("./src/lib/historicalIntelligence.js");
    const { ai, SYSTEM_INTELLIGENCE_CORE, SYSTEM_INTELLIGENCE_CORE_WITH_TWEET, DEFAULT_MODEL, HIGH_INTEL_MODEL } = await import("./src/lib/gemini.server.js");

    const serverContext = {
      ai: {
        safeCall: async (model: string, contents: any, config?: any) => {
          // Prepend the System Intelligence Core to every agent prompt to ensure unified brain identity
          const systemContext = config?.systemInstruction || SYSTEM_INTELLIGENCE_CORE;
          return await ai.safeCall(model, contents, {
            ...config,
            systemInstruction: systemContext
          });
        },
        models: {
          generateContent: async (p: any) => {
            // Mapping for legacy calls, use safeCall internally
            const fullPrompt = `${SYSTEM_INTELLIGENCE_CORE}\n\nTask-Specific Instructions: ${p.contents}`;
            return await ai.safeCall(DEFAULT_MODEL, fullPrompt);
          }
        }
      },
      db,
      appUrl: process.env.APP_URL || (finalProjectId ? `https://${finalProjectId}.firebaseapp.com` : ""),
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      logAction: async (n: string, a: string, s: string) => {
        if (admin.apps.length && db) {
          try {
            await db.collection("agent_logs").add({ 
              agentName: n, 
              action: a, 
              status: s, 
              timestamp: new Date().toISOString() 
            });
          } catch (e) {
            console.error("[LogAction] Failed to write to agent_logs:", e);
          }
        }
      }
    };

    const triads = [macroTriad, corporateTriad, regionalIndiaTriad, healthTriad, bankingRetailTriad, bankingSystemicRiskTriad, marketsEquitiesTriad, marketsDerivativesTriad, regionalUSTriad, regionalChinaTriad, cryptoeconomicTriad, darkWebVettingTriad, historicalIntelligenceTriad];
    
    const seedIntelligence = async () => {
      if (!db) {
        console.warn("[Server] Seeding skipped: Firestore not initialized.");
        return;
      }
      try {
        console.log(`[Server] Seeding check on intelligence collection... (Project: ${finalProjectId})`);
        const snap = await db.collection('intelligence').limit(1).get();
        if (snap.empty) {
          console.log("[Server] Seeding initial intelligence node...");
          await db.collection('intelligence').add({
            source: 'Arthashastra Root',
            content: 'Neural Assembly Synchronized. Awaiting global telemetry. Absolute Witness is active and monitoring all economic translocation vectors.',
            timestamp: new Date().toISOString(),
            metadata: { severity: 'Low', confidence: '100%', category: 'System' }
          });
          console.log("[Server] Seeding successful.");
        } else {
          console.log("[Server] Database already seeded.");
        }
      } catch (err) {
        console.error("[Server] Seeding failed:", err);
        if (err instanceof Error && err.message.includes("PERMISSION_DENIED")) {
          console.error("[Server] Critical: Firestore Permissions Denied. Check project/database configuration.");
        }
      }
    };

    const runCycle = async () => {
      if (isCycling) {
        console.warn("[Server] runCycle is already in progress, skipping...");
        return;
      }
      isCycling = true;
      try {
        // Seed first
        await seedIntelligence();
        // Gracefully resolve key and abort if it is a placeholder or unset to prevent log spamming
        const rawKey = process.env.USER_GEMINI_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY;
        const key = (rawKey && rawKey !== "MY_GEMINI_API_KEY" && rawKey !== "YOUR_API_KEY" && !rawKey.includes("FAKE")) ? rawKey : "";
        if (!key || key === "") {
          console.warn("[Agent Cycle] Paused: GEMINI_API_KEY is missing or set to a placeholder. Set a valid key in Secrets (or USER_GEMINI_KEY if reserved) to resume background cycles.");
          return;
        }

        if (!db) {
          console.warn("[Agent Cycle] Paused: Firestore database not connected.");
          return;
        }
        
        console.log("[Cycle] Starting Optimized Intelligence Run...");
        const isPremium = process.env.GEMINI_KEY_TIER === "professional" || (key && key.length > 40);
        
        if (isPremium) {
          console.log("[Cycle] Premium account. Running all 13 intelligence triads...");
          for (const t of triads) { 
            await runTriad(t, serverContext); 
            const stagger = 60000 + Math.random() * 30000; // 60-90s stagger
            await new Promise(r => setTimeout(r, stagger)); 
          }
        } else {
          console.log("[Cycle] Free tier account. Selecting 1 random intelligence triad to conserve daily API key limits for user chats...");
          const randomTriad = triads[Math.floor(Math.random() * triads.length)];
          await runTriad(randomTriad, serverContext);
        }
        console.log("[Cycle] Completed Intelligence Run.");
      } catch (e: any) {
        console.error("[Cycle] Execution error:", e);
      } finally {
        isCycling = false;
      }
    };

    setInterval(runCycle, 120 * 60 * 1000);
    // Delay initial cycle to 5 minutes to prevent competition with user during dev/remix boot
    setTimeout(runCycle, 300000); 

    // Vercel Cron Endpoint
    app.get("/api/cron/run-cycle", async (req, res) => {
      const authHeader = req.headers['authorization'];
      const cronSecret = process.env.CRON_SECRET;
      
      // Security Check
      if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      console.log("[Cron] Triggering Intelligence Cycle via External Request...");
      
      // On Serverless (Vercel), we must acknowledge that background tasks 
      // may be throttled after response. We run it and hope for the best, 
      // or the user should use a persistent Cloud Run instance.
      runCycle().catch(err => console.error("[Cron] Path Error:", err));
      
      res.json({ 
        status: "intelligence_cycle_triggered", 
        timestamp: new Date().toISOString(),
        message: "Cycle initiated in background. Monitor Agent logs for progress."
      });
    });

    // Chat API
    app.post("/api/chat", async (req, res) => {
      try {
        const { history, message, language, context } = req.body;
        
        // Inject intelligence into the system context
        const intelligenceContext = context?.intelligence && context.intelligence.length > 0
          ? `\n\n[LATEST INTELLIGENCE STREAM]:\n${context.intelligence.slice(0, 5).map((i: any) => `- ${i.source}: ${i.content}`).join('\n')}`
          : "";

        const fullContents = [
          ...history,
          { role: "user", parts: [{ text: `[Language: ${language}]${intelligenceContext}\n\nUser Question: ${message}` }] }
        ];

        const stream = await ai.safeCall(HIGH_INTEL_MODEL, fullContents, {
          stream: true,
          systemInstruction: SYSTEM_INTELLIGENCE_CORE_WITH_TWEET
        });

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        for await (const chunk of stream) {
          if (chunk.text) res.write(chunk.text);
        }
        res.end();
      } catch (e: any) { 
        console.error("[Chat API Error]:", e);
        const errStr = String(e);
        if (errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED')) {
          res.status(429).send("RESOURCE_EXHAUSTED");
        } else if (errStr.includes('CONFIGURATION_REQUIRED')) {
          res.status(401).send("CONFIGURATION_REQUIRED");
        } else {
          res.status(500).send(e.message || "Internal Server Error");
        }
      }
    });

    app.post("/api/chat/json", async (req, res) => {
      try {
        const { generateJSON } = await import("./src/lib/gemini.server.js");
        const { prompt, systemInstruction } = req.body;
        const result = await generateJSON(prompt, systemInstruction);
        res.json(result);
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    app.post("/api/chat/arena", async (req, res) => {
      try {
        const { generateArenaResponse } = await import("./src/lib/gemini.server.js");
        const { argument, language } = req.body;
        const result = await generateArenaResponse(argument, language);
        res.send(result);
      } catch (e: any) {
        res.status(500).send(e.message);
      }
    });

    app.post("/api/chat/call", async (req, res) => {
      try {
        const { modelName, contents, config } = req.body;
        const result = await ai.safeCall(modelName || DEFAULT_MODEL, contents, config);
        res.json(result);
      } catch (e: any) {
        res.status(500).json({ error: e.message });
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
      } catch (e: any) {
        console.error("[Razorpay Order Error]:", e);
        const errorMsg = e.message?.includes('missing from environment') 
          ? "Payment gateway unconfigured. Set VITE_RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Settings -> Secrets." 
          : "Failed to create payment order";
        res.status(500).json({ error: errorMsg });
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
    const signingSecret = process.env.AITIHYA_SIGNING_SECRET || "ARTHASHASTRA_ROOT_FAILSAFE_SIGNED";
    const eventData = { event, paymentId, userId, amount: payload.amount, timestamp: new Date().toISOString() };
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

    // --- DIAGNOSTICS & OAUTH ---
    app.get("/api/diagnostics", (req, res) => {
      const mask = (v: string | undefined) => {
        if (!v || v.length < 8) return v === undefined ? "missing" : "placeholder/invalid";
        return `${v.substring(0, 4)}...${v.substring(v.length - 4)}`;
      };

      const geminiKey = process.env.USER_GEMINI_KEY || process.env.GEMINI_API_KEY;
      const isGeminiConfigured = geminiKey && !geminiKey.includes("AIza_FAKE") && geminiKey !== "MY_GEMINI_API_KEY" && geminiKey.length > 10;
      const hasFirebase = !isPlaceholder(process.env.VITE_FIREBASE_PROJECT_ID) || !isPlaceholder(firebaseConfig["projectId"]);
      
      res.json({
        gemini: {
          primary: mask(process.env.GEMINI_API_KEY),
          fallback: mask(process.env.USER_GEMINI_KEY),
          configured: !!isGeminiConfigured
        },
        firebase: {
          projectId: finalProjectId,
          managedProject: firebaseConfig.projectId,
          databaseId: finalDatabaseId,
          configured: !!db,
          identity: {
            finalProject: finalProjectId,
            finalDatabase: finalDatabaseId,
            envProject: !!process.env.VITE_FIREBASE_PROJECT_ID,
            hasSA: !!process.env.FIREBASE_SERVICE_ACCOUNT
          }
        },
        env: process.env.NODE_ENV,
        neuralDump: {
          hasGemini: isGeminiConfigured,
          hasFirebase: !!db
        }
      });
    });

    // Vite
    if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const dist = path.resolve(rootDir, "dist");
    app.use(express.static(dist));
    app.get("*", (req, res) => res.sendFile(path.join(dist, "index.html")));
  }

  // Export the app for Vercel
  return app;
  } catch (e: any) {
    console.error("[Server Critical Error]:", e);
    const fallbackApp = express();
    fallbackApp.get("*", (req, res) => res.status(500).send("Neural Critical Failure: Server Initialization Failed."));
    return fallbackApp;
  }
}

const appPromise = startServer();

export default async function handler(req: any, res: any) {
  const app = await appPromise;
  app(req, res);
}
