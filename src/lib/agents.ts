
import { GoogleGenAI } from "@google/genai";
import { getEnv } from "./env.js";
import { witnessBlock, AitihyaBlock } from "./aitihya.js";
import { postTruthTweet, likeTweet, retweetTweet, followUser } from "./twitter.js";

export interface AgentContext {
  ai: any;
  db: any;
  appUrl?: string;
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
    const agentId = `cert_${domainName.toLowerCase()}_validator_${uuid().substring(0, 5)}`;
    
    if (state.data.length === 0) return state;

    console.log(`[${domainName} Validator] Batch validating ${state.data.length} items...`);
    try {
      const valid: ValidatedData[] = [];
      const prompt = `You are the Absolute Economy Validator. Validate these ${domainName} data points for absolute accuracy. 
      Assign a confidence score (0-100) and provide enriched context for each.
      Data Points:
      ${state.data.map((item, i) => `${i}: ${item.content}`).join("\n")}
      
      Return as a JSON array of objects with 'index' (matching the input number), 'confidenceScore' (number), and 'enrichedContext' (string).`;
      
      const result = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: prompt });
      const match = result.text.match(/\[.*\]/s);
      if (match) {
        const results = JSON.parse(match[0]);
        for (const res of results) {
          const item = state.data[res.index];
          if (item && res.confidenceScore > 40) {
            valid.push({
              ...item,
              confidenceScore: res.confidenceScore,
              enrichedContext: res.enrichedContext
            });
          }
        }
      }
      
      await commitBlock(ctx, state.taskId, agentId, "Validator", valid, { itemsValidated: valid.length });
      await logAction(`${domainName}Validator`, `Committed block for ${valid.length} validated items`, "success");
      
      return { taskId: state.taskId, data: valid };
    } catch (e) { 
      console.error(`[${domainName} Validator] Error:`, e);
      return state; 
    }
  };

  const summarizer = async (ctx: AgentContext, state: ChainState): Promise<void> => {
    const { ai, logAction, db } = ctx;
    const agentId = `cert_${domainName.toLowerCase()}_summarizer_${uuid().substring(0, 5)}`;
    
    if (state.data.length === 0) return;

    console.log(`[${domainName} Summarizer] Batch publishing ${state.data.length} insights...`);
    try {
      const toProcess = [];
      for (const item of state.data) {
        // Deduplication Check
        let exists = false;
        if (db.collection) {
          const col = typeof db.collection === 'function' ? db.collection('intelligence') : db.collection;
          const { query, collection, where, limit, getDocs } = await import("firebase/firestore");
          const q = query(collection(db, "intelligence"), where("content", "==", item.content), limit(1));
          const snap = await getDocs(q);
          exists = !snap.empty;
        }
        if (!exists) toProcess.push(item);
      }

      if (toProcess.length === 0) return;

      const prompt = `You are the Absolute Economy Summarizer. Summarize these ${domainName} data points into concise, high-impact insights revealing absolute economic reality.
      Data:
      ${toProcess.map((item, i) => `${i}: ${item.content} (Context: ${item.enrichedContext})`).join("\n")}
      
      Return as a JSON array of objects with 'index', 'insight' (string), and 'severity' (High/Medium/Low).`;
      
      const result = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: prompt });
      const match = result.text.match(/\[.*\]/s);
      
      if (match) {
        const results = JSON.parse(match[0]);
        const insights = [];
        for (const res of results) {
          const original = toProcess[res.index];
          if (!original) continue;

          const explanationId = Math.random().toString(36).substring(2, 11);
          const intelData = {
            source: `${domainName} Triad`,
            content: res.insight,
            explanationId,
            isBroadcasted: false,
            agentSecret: "arthashastra-server-secret-2026",
            metadata: { 
              severity: res.severity, 
              confidence: original.confidenceScore + "%", 
              taskId: state.taskId
            },
            timestamp: new Date().toISOString()
          };

          const { addDoc, doc, setDoc, collection } = await import("firebase/firestore");
          await addDoc(collection(db, "intelligence"), intelData);
          
          // Pre-generate the detailed explanation doc so the Broadcaster's link is valid
          await setDoc(doc(db, "explanations", explanationId), {
            id: explanationId,
            content: `Master Insight for ${domainName}: ${res.insight}`,
            targetTweetId: "intel-" + explanationId,
            timestamp: new Date().toISOString()
          });

          insights.push(res);
        }
        
        await commitBlock(ctx, state.taskId, agentId, "Summarizer", insights, { insightsGenerated: insights.length });
        await logAction(`${domainName}Summarizer`, "Committed batch summarizer block", "success");
      }
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
export const cryptoeconomicTriad = createTriad("Cryptoeconomics", "Find 2 raw data points on cryptocurrency adoption for trade, DeFi protocol stability, or digital sovereignty movements. Return JSON array with 'content' and 'source'.");
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
  console.log("[Twitter Monitor Agent] Scanning for engagement targets...");
  try {
    const prompt = `You are the Twitter Engagement Agent for ARTHASHASTRA. 
    Role: Responsible for connecting the app backend to the official Twitter account.
    Framing: The agent simulates human-like engagement patterns on Twitter by posting, replying, and following accounts according to defined workflows and ethical rules.
    
    Task: Identify 2 high-profile tweets containing bold, controversial, or mainstream economic claims (e.g., from political leaders, billionaire CEOs, or major news outlets) that require a definitive counter-authority rebuttal. 
    
    Format as a JSON array with 'tweetId', 'author', 'authorId', and 'text'.`;
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
        }

        if (exists) continue;

        const draftPrompt = `You are ARTHASHASTRA. Draft a context-aware, sharp, contrarian counter-reply to this tweet: "${tweet.text}". 
        Ensure the reply includes attribution or implicit links back to the app's mission for economic truth.
        Return JSON with 'draftRebuttal' and 'logic'.`;
        const draftResult = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: draftPrompt });
        const draftMatch = draftResult.text.match(/\{.*\}/s);
        const draftData = draftMatch ? JSON.parse(draftMatch[0]) : { draftRebuttal: "The data suggests otherwise.", logic: "Conflicting economic signals." };

        const tweetData = {
          ...tweet, 
          timestamp: new Date().toISOString(), 
          processed: false,
          userApproved: false,
          draftRebuttal: draftData.draftRebuttal,
          draftLogic: draftData.logic,
          engagementType: "rebuttal",
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
        }
      }
      await logAction("TwitterEngagement-Monitor", "Monitored new engagement targets", "success");
    }
  } catch (e) {
    console.error("[Twitter Monitor Agent] Error:", e);
  }
}

export async function twitterPosterAgent(context: AgentContext) {
  const { ai, logAction, db } = context;
  const agentId = `cert_engagement_poster_${Math.random().toString(36).substring(2, 7)}`;
  console.log("[Twitter Poster Agent] Processing approved engagement...");
  try {
    let snapshot: any;
    if (db.collection) {
      const col = typeof db.collection === 'function' ? db.collection('tweets') : db.collection;
      if (col.where) {
        snapshot = await col.where("processed", "==", false).where("userApproved", "==", true).limit(2).get();
      } else {
        const { query, collection, where, limit, getDocs } = await import("firebase/firestore");
        const q = query(collection(db, "tweets"), where("processed", "==", false), where("userApproved", "==", true), limit(2));
        snapshot = await getDocs(q);
      }
    }
    
    if (!snapshot) return;

    for (const d of snapshot.docs) {
      const tweet = d.data();
      const taskId = uuid(); 
      
      const prompt = `You are ARTHASHASTRA. 
      Framing: The agent simulates human-like engagement patterns on Twitter.
      
      Context: Rebutting ${tweet.author}: "${tweet.text}". 
      Approved Rebuttal: "${tweet.draftRebuttal}"

      Your mission: Refine the rebuttal into a public post (max 240 chars).
      Must include a link back to our 'Absolute Truth' ledger or site context.
      
      Return strictly as a JSON object with keys "explanation" and "counterTweet".`;
      
      const result = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: prompt });
      const match = result.text.match(/\{.*\}/s);
      if (!match) continue;
      
        const { explanation, counterTweet } = JSON.parse(match[0]);
        
        // Generate a unique ID for the explanation
        const explanationId = Math.random().toString(36).substring(2, 11); // Simple random ID
        const appUrl = context.appUrl || "https://arthashastra-ai.com"; 
        const explanationUrl = `${appUrl}/explanation/${explanationId}`;

        // Store Explanation in Firestore
        const explanationData = {
          id: explanationId,
          content: explanation,
          targetTweetId: tweet.tweetId,
          timestamp: new Date().toISOString(),
          agentSecret: "arthashastra-server-secret-2026"
        };
        
        if (db.collection) {
          const expCol = typeof db.collection === 'function' ? db.collection('explanations') : db.collection;
          if (expCol.doc) {
            await expCol.doc(explanationId).set(explanationData);
          } else {
            const { setDoc, doc, collection } = await import("firebase/firestore");
            await setDoc(doc(db, "explanations", explanationId), explanationData);
          }
        }
        
        await commitBlock(context, taskId, `cert_twitter_collector_${Math.random().toString(36).substring(2, 7)}`, "Collector", tweet, { source: "twitter" });
        
        const isApproved = await complianceAgent(context, explanation + " " + counterTweet, taskId);
        
        if (isApproved) {
          let twitterResult = { success: false, simulated: true };
          try {
            // Append the tracking link to the tweet
            const tweetText = `${counterTweet}\n\nEconomic Explanation: ${explanationUrl}\n\n[Authored by Arthashastra AI]`;
            const result = await postTruthTweet(tweetText, context.db, tweet.tweetId);
            if (result.success) {
              twitterResult = { success: true, simulated: false };
            }
          } catch (twErr) {
            console.error("[Twitter Poster Agent] Real tweet failed:", twErr);
          }

        await commitBlock(context, taskId, agentId, "EngagementPoster", { explanation, counterTweet, targetId: tweet.tweetId, twitterResult }, { status: "posted" });
        
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
          if (col.add) await col.add(responseData);
          
          const docId = d.id;
          if (typeof db.doc === 'function') {
            await db.collection('tweets').doc(docId).update({ processed: true });
          } else {
            const { doc, updateDoc } = await import("firebase/firestore");
            await updateDoc(doc(db, "tweets", docId), { processed: true });
          }
        }
        await logAction("TwitterEngagement-Poster", `Posted engagement response to ${tweet.author}`, "success");
      }
    }
  } catch (e) {
    console.error("[Twitter Poster Agent] Error:", e);
  }
}

export async function twitterBroadcasterAgent(context: AgentContext) {
  const { db, appUrl } = context;
  const { postTruthTweet } = await import("./twitter.js");
  console.log("[Twitter Broadcaster Agent] Pipe: Fetching Intelligence for broadcast...");
  
  try {
    // Fetch latest intelligence not yet broadcasted
    let snapshot: any;
    if (db.collection) {
      const col = typeof db.collection === 'function' ? db.collection('intelligence') : db.collection;
      const { query, collection, where, limit, getDocs, orderBy } = await import("firebase/firestore");
      const q = query(collection(db, "intelligence"), where("isBroadcasted", "==", false), orderBy("timestamp", "desc"), limit(1));
      snapshot = await getDocs(q);
    }

    if (!snapshot || snapshot.empty) {
      console.log("[Twitter Broadcaster Agent] No new intelligence to broadcast.");
      return;
    }

    const intelDoc = snapshot.docs[0];
    const intel = intelDoc.data();
    
    // Middle Man Logic: No generation, just formatting and piping
    const explanationId = intel.explanationId || Math.random().toString(36).substring(2, 11);
    const trackingUrl = `${appUrl || "https://arthashastra-ai.com"}/explanation/${explanationId}`;
    
    const tweetText = `${intel.content}\n\nAnalytical Context: ${trackingUrl}\n\n[Witnessed by Arthashastra AI]`;
    const broadcastResult = await postTruthTweet(tweetText, db, "broadcast-" + Date.now());
    
    if (broadcastResult.success) {
      const { updateDoc } = await import("firebase/firestore");
      await updateDoc(intelDoc.ref, { 
        isBroadcasted: true, 
        broadcastTimestamp: new Date().toISOString() 
      });
      await context.logAction("TwitterBroadcaster", "Intelligence broadcasted via pipe", "success");
    }
  } catch (e) {
    console.error("[Twitter Broadcaster Agent] Pipe Error:", e);
  }
}

export async function twitterInteractionAgent(context: AgentContext) {
  const { ai, logAction, db } = context;
  console.log("[Twitter Interaction Agent] Scouting for likes/follows...");
  try {
    const prompt = `You are the Twitter Engagement Agent for ARTHASHASTRA.
    Framing: The agent simulates human-like engagement patterns on Twitter by posting, replying, and following accounts according to defined workflows and ethical rules.
    
    Task: Find 3 trending topics or hashtags aligned with 'Economic Truth', 'Common Man Rights', or 'Anti-Corruption'.
    Format as JSON array with 'topic', 'reason'.`;
    const result = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: prompt });
    const match = result.text.match(/\[.*\]/s);
    if (!match) return;

    const topics = JSON.parse(match[0]);
    for (const top of topics) {
      const searchPrompt = `As ARTHASHASTRA, identify one influential account or high-impact tweet related to "${top.topic}".
      Reason: ${top.reason}.
      Return JSON with 'type' (like_retweet or follow), 'id' (tweetId or userId), 'handle'.`;
      const searchResult = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: searchPrompt });
      const searchMatch = searchResult.text.match(/\{.*\}/s);
      if (searchMatch) {
         const action = JSON.parse(searchMatch[0]);
         let res = { success: false, simulated: true };
         
         if (action.type === 'like_retweet') {
           await likeTweet(action.id, db);
           res = await retweetTweet(action.id, db);
         } else if (action.type === 'follow') {
           res = await followUser(action.id, db);
         }
         
         await logAction("TwitterEngagement-Interaction", `Action: ${action.type} on ${action.handle}`, res.success ? "success" : "failed");
         await commitBlock(context, uuid(), "cert_interaction_agent", "Interaction", action, { result: res.success ? "performed" : "simulated" });
      }
    }
  } catch (e) {
    console.error("[Twitter Interaction Agent] Error:", e);
  }
}
