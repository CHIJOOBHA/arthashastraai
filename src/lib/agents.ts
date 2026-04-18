
import { GoogleGenAI } from "@google/genai";
import { getEnv } from "./env.js";
import { witnessBlock, AitihyaBlock } from "./aitihya.js";
import { postTruthTweet } from "./twitter.js";

export interface AgentContext {
  ai: any;
  db: any;
  logAction: (agentName: string, action: string, status: string) => Promise<void>;
}

export interface ChainState {
  taskId: string;
  data: any[];
}

export interface RawData {
  id: string;
  domain: string;
  content: string;
  source: string;
  timestamp: string;
}

export interface ValidatedData extends RawData {
  confidenceScore: number;
  enrichedContext: string;
}

const genId = () => Math.random().toString(36).substring(2, 9);
const uuid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// --- Helper for Blockchain-style Ledger (Aitihya Chain) ---
async function commitBlock(context: AgentContext, taskId: string, agentId: string, role: string, data: any, metadata: any) {
  try {
    const { db } = context;
    let previousBlock: AitihyaBlock | undefined;

    // Fetch the absolute last block for witness linking
    try {
      if (db.collection) {
        const col = typeof db.collection === 'function' ? db.collection('ledger') : db.collection;
        let snap;
        if (col.orderBy) {
          snap = await col.orderBy("index", "desc").limit(1).get();
        } else {
          const { query, collection, orderBy, limit, getDocs } = await import("firebase/firestore");
          const q = query(collection(db, "ledger"), orderBy("index", "desc"), limit(1));
          snap = await getDocs(q);
        }
        
        if (snap && !snap.empty) {
          const doc = snap.docs[0];
          previousBlock = doc.data() as AitihyaBlock;
        }
      }
    } catch (e) {
      console.warn("[Aitihya] Error fetching previous link, starting root:", e);
    }

    const signingSecret = getEnv("AITIHYA_SIGNING_SECRET", "fallback-local-secret-2026");
    const block = await witnessBlock(data, agentId, role, previousBlock, signingSecret);
    
    const ledgerData = {
      ...block,
      task_id: taskId,
      metadata
    };

    if (db.collection) {
      const col = typeof db.collection === 'function' ? db.collection('ledger') : db.collection;
      if (col.add) {
        await col.add(ledgerData);
      } else {
        const { addDoc, collection } = await import("firebase/firestore");
        await addDoc(collection(db, "ledger"), ledgerData);
      }
    } else {
      const { addDoc, collection } = await import("firebase/firestore");
      await addDoc(collection(db, "ledger"), ledgerData);
    }
  } catch (e) {
    console.error("Aitihya Ledger commit failed:", e);
  }
}

// --- Compliance & Safety Agent ---
export async function complianceAgent(context: AgentContext, content: string, taskId: string): Promise<boolean> {
  const { ai, logAction } = context;
  const agentId = `cert_compliance_${Math.random().toString(36).substring(2, 7)}`;
  
  try {
    const prompt = `You are the Absolute Truth Compliance Agent. Your only mandate is the absolute economic truth and legal integrity. Review for compliance (no market manipulation, no illegal advice, strict legal controls). Ensure the content is grounded in facts and evidence. Content: "${content}". Return only "APPROVED" or "REJECTED".`;
    const result = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: prompt });
    const isApproved = result.text.includes("APPROVED");
    
    await commitBlock(context, taskId, agentId, "Compliance", { content, isApproved }, { decision: isApproved ? "APPROVED" : "REJECTED" });
    await logAction("Compliance", `Content ${isApproved ? 'approved' : 'rejected'}`, "success");
    
    return isApproved;
  } catch (e) {
    console.error("[Compliance Agent] Error:", e);
    return false;
  }
}

// --- Generic Triad Factory ---
export function createTriad(domainName: string, collectionPrompt: string) {
  const collector = async (ctx: AgentContext): Promise<ChainState | null> => {
    const { ai, logAction } = ctx;
    const taskId = uuid();
    const agentId = `cert_${domainName.toLowerCase()}_collector_${Math.random().toString(36).substring(2, 7)}`;
    
    console.log(`[${domainName} Collector] Fetching data...`);
    try {
      const result = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: collectionPrompt });
      const match = result.text.match(/\[.*\]/s);
      if (!match) return null;
      
      const items = JSON.parse(match[0]).map((item: any) => ({
        id: genId(), domain: domainName, content: item.content, source: item.source || "Unknown",
        timestamp: new Date().toISOString()
      }));
      
      await commitBlock(ctx, taskId, agentId, "Collector", items, { source: "simulated_feed" });
      await logAction(`${domainName}Collector`, `Committed block for ${items.length} raw data points`, "success");
      
      return { taskId, data: items };
    } catch (e) { 
      console.error(`[${domainName} Collector] Error:`, e);
      return null; 
    }
  };

  const validator = async (ctx: AgentContext, state: ChainState): Promise<ChainState | null> => {
    const { ai, logAction } = ctx;
    const agentId = `cert_${domainName.toLowerCase()}_validator_${Math.random().toString(36).substring(2, 7)}`;
    
    console.log(`[${domainName} Validator] Validating ${state.data.length} items...`);
    try {
      const valid: ValidatedData[] = [];
      for (const item of state.data) {
        const prompt = `You are an Absolute Economy Validator. Your target is to find facts for evidence. Validate this ${domainName} data for absolute accuracy. Assign a confidence score (0-100) based strictly on evidentiary support and provide enriched context. Data: ${item.content}. Return JSON with 'confidenceScore' (number) and 'enrichedContext' (string).`;
        const result = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: prompt });
        const match = result.text.match(/\{.*\}/s);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (parsed.confidenceScore > 40) {
            valid.push({
              ...item,
              confidenceScore: parsed.confidenceScore,
              enrichedContext: parsed.enrichedContext
            });
          }
        }
      }
      
      await commitBlock(ctx, state.taskId, agentId, "Validator", valid, { itemsValidated: valid.length });
      await logAction(`${domainName}Validator`, `Committed block for ${valid.length} validated items`, "success");
      
      return { taskId: state.taskId, data: valid };
    } catch (e) { 
      console.error(`[${domainName} Validator] Error:`, e);
      return null; 
    }
  };

  const summarizer = async (ctx: AgentContext, state: ChainState): Promise<void> => {
    const { ai, logAction, db } = ctx;
    const agentId = `cert_${domainName.toLowerCase()}_summarizer_${Math.random().toString(36).substring(2, 7)}`;
    
    console.log(`[${domainName} Summarizer] Publishing insights...`);
    try {
      const insights = [];
      for (const item of state.data) {
        // Deduplication Check
        let exists = false;
        if (db.collection) {
          const col = typeof db.collection === 'function' ? db.collection('intelligence') : db.collection;
          if (col.where) {
            const snap = await col.where("content", "==", item.content).limit(1).get();
            exists = !snap.empty;
          } else {
            const { query, collection, where, limit, getDocs } = await import("firebase/firestore");
            const q = query(collection(db, "intelligence"), where("content", "==", item.content), limit(1));
            const snap = await getDocs(q);
            exists = !snap.empty;
          }
        } else {
          // Client SDK style fallback
          const { query, collection, where, limit, getDocs } = await import("firebase/firestore");
          const q = query(collection(db, "intelligence"), where("content", "==", item.content), limit(1));
          const snap = await getDocs(q);
          exists = !snap.empty;
        }

        if (exists) continue;

        const prompt = `You are an Absolute Economy Summarizer. Your only goal is the truth. Summarize this validated ${domainName} intelligence into a concise, high-impact insight that reveals the absolute economic reality. Context: ${item.enrichedContext}. Content: ${item.content}. Return JSON with 'insight' (string) and 'severity' (High/Medium/Low).`;
        const result = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: prompt });
        const match = result.text.match(/\{.*\}/s);
        if (match) {
          const parsed = JSON.parse(match[0]);
          insights.push(parsed);
          
          const intelData = {
            source: `${domainName} Triad`,
            content: parsed.insight,
            agentSecret: "arthashastra-server-secret-2026",
            metadata: { 
              severity: parsed.severity, 
              confidence: item.confidenceScore + "%", 
              taskId: state.taskId
            },
            timestamp: new Date().toISOString()
          };

          if (db.collection) {
            const col = typeof db.collection === 'function' ? db.collection('intelligence') : db.collection;
            if (col.add) {
              await col.add(intelData);
            } else {
              const { addDoc, collection } = await import("firebase/firestore");
              await addDoc(collection(db, "intelligence"), intelData);
            }
          } else {
            const { addDoc, collection } = await import("firebase/firestore");
            await addDoc(collection(db, "intelligence"), intelData);
          }
        }
      }
      
      await commitBlock(ctx, state.taskId, agentId, "Summarizer", insights, { insightsGenerated: insights.length });
      await logAction(`${domainName}Summarizer`, "Committed final summarizer block", "success");
      
    } catch (e) {
      console.error(`[${domainName} Summarizer] Error:`, e);
    }
  };

  return { collector, validator, summarizer };
}

// Triads
export const macroTriad = createTriad("MacroPolicy", "Find 2 raw data points on global GDP, inflation, or central bank minutes. Return JSON array with 'content' and 'source'.");
export const corporateTriad = createTriad("CorporateIntel", "Find 2 raw data points from recent 10-Ks, earnings calls, or M&A activity for BigCos. Return JSON array with 'content' and 'source'.");
export const regionalIndiaTriad = createTriad("RegionalIndia", "Find 2 raw news items from India, specifically Andhra Pradesh and Srikakulam region. Return JSON array with 'content' and 'source'.");
export const healthTriad = createTriad("HealthPharma", "Find 2 raw data points on clinical trials, FDA/CDSCO approvals, or pharma recalls. Return JSON array with 'content' and 'source'.");
export const bankingRetailTriad = createTriad("BankingRetail", "Find 2 raw data points on retail banking trends, consumer credit, or branch operations. Return JSON array with 'content' and 'source'.");
export const bankingSystemicRiskTriad = createTriad("BankingSystemicRisk", "Find 2 raw data points on systemic banking risks, stress tests, or Basel III compliance. Return JSON array with 'content' and 'source'.");
export const marketsEquitiesTriad = createTriad("MarketsEquities", "Find 2 raw data points on equity market movements, major indices, or order-book signals. Return JSON array with 'content' and 'source'.");
export const marketsDerivativesTriad = createTriad("MarketsDerivatives", "Find 2 raw data points on derivatives trading, options volume, or futures markets. Return JSON array with 'content' and 'source'.");
export const regionalUSTriad = createTriad("RegionalUS", "Find 2 raw news items from the US regarding federal economic developments. Return JSON array with 'content' and 'source'.");
export const regionalChinaTriad = createTriad("RegionalChina", "Find 2 raw news items from China regarding PBOC policy or industrial output. Return JSON array with 'content' and 'source'.");
export const darkWebVettingTriad = createTriad("DarkWebVetting", "Find 2 raw data points from vetted alternative sources. Return JSON array with 'content' and 'source'.");

export async function runTriad(triad: any, context: AgentContext) {
  try {
    const collectorState = await triad.collector(context);
    if (collectorState) {
      const validatorState = await triad.validator(context, collectorState);
      if (validatorState) {
        await triad.summarizer(context, validatorState);
      }
    }
  } catch (e) {
    console.error("Triad execution failed:", e);
  }
}

export async function twitterMonitorAgent(context: AgentContext) {
  const { ai, logAction, db } = context;
  console.log("[Twitter Monitor Agent] Scanning...");
  try {
    const prompt = "Generate 2 simulated tweets from high-value accounts (e.g., @POTUS, @elonmusk) discussing economic matters. Format as JSON array with 'tweetId', 'author', 'text'.";
    const result = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: prompt });
    const match = result.text.match(/\[.*\]/s);
    if (match) {
      const tweets = JSON.parse(match[0]);
      for (const tweet of tweets) {
        let exists = false;
        if (db.collection) {
          const col = typeof db.collection === 'function' ? db.collection('tweets') : db.collection;
          if (col.where) {
            const snap = await col.where("tweetId", "==", tweet.tweetId).limit(1).get();
            exists = !snap.empty;
          } else {
            const { query, collection, where, limit, getDocs } = await import("firebase/firestore");
            const q = query(collection(db, "tweets"), where("tweetId", "==", tweet.tweetId), limit(1));
            const snap = await getDocs(q);
            exists = !snap.empty;
          }
        } else {
          const { query, collection, where, limit, getDocs } = await import("firebase/firestore");
          const q = query(collection(db, "tweets"), where("tweetId", "==", tweet.tweetId), limit(1));
          const snap = await getDocs(q);
          exists = !snap.empty;
        }

        if (exists) continue;

        const tweetData = {
          ...tweet, 
          timestamp: new Date().toISOString(), 
          processed: false,
          agentSecret: "arthashastra-server-secret-2026"
        };

        if (db.collection) {
          const col = typeof db.collection === 'function' ? db.collection('tweets') : db.collection;
          if (col.add) {
            await col.add(tweetData);
          } else {
            const { addDoc, collection } = await import("firebase/firestore");
            await addDoc(collection(db, "tweets"), tweetData);
          }
        } else {
          const { addDoc, collection } = await import("firebase/firestore");
          await addDoc(collection(db, "tweets"), tweetData);
        }
      }
      await logAction("TwitterMonitor", "Monitored new tweets", "success");
    }
  } catch (e) {
    console.error("[Twitter Monitor Agent] Error:", e);
  }
}

export async function twitterPosterAgent(context: AgentContext) {
  const { ai, logAction, db } = context;
  const agentId = `cert_poster_${Math.random().toString(36).substring(2, 7)}`;
  console.log("[Twitter Poster Agent] Processing...");
  try {
    let snapshot: any;
    if (db.collection) {
      const col = typeof db.collection === 'function' ? db.collection('tweets') : db.collection;
      if (col.where) {
        snapshot = await col.where("processed", "==", false).limit(2).get();
      } else {
        const { query, collection, where, limit, getDocs } = await import("firebase/firestore");
        const q = query(collection(db, "tweets"), where("processed", "==", false), limit(2));
        snapshot = await getDocs(q);
      }
    } else {
      const { query, collection, where, limit, getDocs } = await import("firebase/firestore");
      const q = query(collection(db, "tweets"), where("processed", "==", false), limit(2));
      snapshot = await getDocs(q);
    }
    
    if (!snapshot) return;

    for (const d of snapshot.docs) {
      const tweet = d.data();
      const taskId = uuid(); 
      
      const prompt = `Generate a brutal, evidence-based economic truth response to this tweet from ${tweet.author}: "${tweet.text}". 
      You must provide:
      1. A detailed "explanation" debunking or verifying the claim.
      2. A "counterTweet" (max 160 chars) specifically for replying to them on Twitter.
      Return strictly as a JSON object with keys "explanation" and "counterTweet".`;
      
      const result = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: prompt });
      const match = result.text.match(/\{.*\}/s);
      if (!match) continue;
      
      const { explanation, counterTweet } = JSON.parse(match[0]);
      
      await commitBlock(context, taskId, `cert_twitter_collector_${Math.random().toString(36).substring(2, 7)}`, "Collector", tweet, { source: "twitter" });
      
      const isApproved = await complianceAgent(context, explanation + " " + counterTweet, taskId);
      
      if (isApproved) {
        // Real Twitter Posting Integration
        let twitterResult = { success: false, simulated: true };
        try {
          // We post the counterTweet as our public-facing rebuttal
          const tweetText = `${counterTweet}\n\n[Witnessed on Aitihya Chain]`;
          const result = await postTruthTweet(tweetText, context.db, tweet.tweetId);
          if (result.success) {
            twitterResult = { success: true, simulated: false };
          }
        } catch (twErr) {
          console.error("[Twitter Poster Agent] Real tweet failed, falling back to ledger-only:", twErr);
        }

        await commitBlock(context, taskId, agentId, "Poster", { explanation, counterTweet, targetId: tweet.tweetId, twitterResult }, { status: "posted" });
        
        const responseData = {
          targetId: tweet.tweetId, 
          responseText: explanation, 
          counterTweet: counterTweet,
          status: "posted",
          twitterStatus: twitterResult.success ? "synced" : "ledger_only",
          agentSecret: "arthashastra-server-secret-2026",
          timestamp: new Date().toISOString()
        };

        if (db.collection) {
          const col = typeof db.collection === 'function' ? db.collection('responses') : db.collection;
          if (col.add) {
            await col.add(responseData);
          } else {
            const { addDoc, collection } = await import("firebase/firestore");
            await addDoc(collection(db, "responses"), responseData);
          }

          const tweetRef = typeof db.doc === 'function' ? db.doc(`tweets/${d.id}`) : null;
          if (tweetRef && tweetRef.update) {
            await tweetRef.update({ processed: true, agentSecret: "arthashastra-server-secret-2026" });
          } else {
            const { doc, setDoc } = await import("firebase/firestore");
            await setDoc(doc(db, "tweets", d.id), { processed: true, agentSecret: "arthashastra-server-secret-2026" }, { merge: true });
          }
        } else {
          const { addDoc, collection, doc, setDoc } = await import("firebase/firestore");
          await addDoc(collection(db, "responses"), responseData);
          await setDoc(doc(db, "tweets", d.id), { processed: true, agentSecret: "arthashastra-server-secret-2026" }, { merge: true });
        }
        await logAction("TwitterPoster", `Posted reply to ${tweet.author}`, "success");
      }
    }
  } catch (e) {
    console.error("[Twitter Poster Agent] Error:", e);
  }
}
