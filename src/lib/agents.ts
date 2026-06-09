
import { GoogleGenAI } from "@google/genai";
import { getEnv } from "./env.js";
import { witnessBlock, AitihyaBlock } from "./aitihya.js";
import { DEFAULT_MODEL } from "./gemini.js";

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
export const uuid = () => {
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
    if (!db) {
      console.warn("[Aitihya] Skip commit: DB not initialized.");
      return;
    }
    let previousBlock: AitihyaBlock | undefined;

    // Fetch the absolute last block for witness linking
    try {
      if (db.clientDb) {
        // Client fallback
        const { query, collection, orderBy, limit, getDocs } = await import("firebase/firestore");
        const q = query(collection(db.clientDb, "ledger"), orderBy("index", "desc"), limit(1));
        const snap = await getDocs(q);
        if (snap && !snap.empty) {
          previousBlock = snap.docs[0].data() as AitihyaBlock;
        }
      } else {
        // Admin SDK
        const col = db.collection('ledger');
        const snap = await col.orderBy("index", "desc").limit(1).get();
        if (snap && !snap.empty) {
          previousBlock = snap.docs[0].data() as AitihyaBlock;
        }
      }
    } catch (e) {
      console.warn("[Aitihya] Error fetching previous link, starting root:", e);
    }

    const signingSecret = getEnv("AITIHYA_SIGNING_SECRET", "fallback-local-secret-2026");
    
    // Format complex JSON data patterns to pristine human text so it renders cleanly anywhere (e.g., App.tsx)
    let formattedData = data;
    if (data && typeof data !== "string") {
      if (role === "Compliance") {
        formattedData = `⚖️ COMPLIANCE AUDIT CERTIFICATE
Status: ${data.isApproved ? "✅ APPROVED" : "❌ REJECTED"}
Content Under Review:
"${data.content}"`;
      } else if (role === "Collector" && Array.isArray(data)) {
        formattedData = `📥 ABSOLUTE COGNITIVE COLLECTOR (${data.length} records witnessed)
--------------------------------------------------
${data.map((item: any, idx: number) => `[Record ${idx + 1}]
Domain: ${item.domain || "Economy"}
Observation: ${item.content}
Source Reference: ${item.source || "Direct link"}`).join("\n\n")}`;
      } else if (role === "Validator" && Array.isArray(data)) {
        formattedData = `🛡️ CRYPTOGRAPHIC VALIDATION SHIELD (${data.length} records certified)
--------------------------------------------------
${data.map((v: any, idx: number) => `[Certified Record ${idx + 1}]
Content: ${v.content}
Sovereign Source: ${v.source}
Cert Confidence Rating: ${v.confidenceScore || 100}%
Enriched Geopolitical Context:
${v.enrichedContext || "Fully validated."}`).join("\n\n")}`;
      } else if (role === "Summarizer" && Array.isArray(data)) {
        formattedData = `🧠 CENTRAL TRIAD MASTER REPORT (${data.length} deep insights)
--------------------------------------------------
${data.map((ins: any, idx: number) => `[Sovereign Insight ${idx + 1}]
Severity Threat Profile: ${ins.severity || "Medium"}
Synthesized Verdict: ${ins.insight}`).join("\n\n")}`;
      } else {
        try {
          formattedData = JSON.stringify(data, null, 2);
        } catch (err) {
          formattedData = String(data);
        }
      }
    }

    const block = await witnessBlock(formattedData, agentId, role, previousBlock, signingSecret);
    
    const ledgerData = {
      ...block,
      task_id: taskId,
      metadata
    };

    if (db.clientDb) {
      // Client fallback
      const { addDoc, collection } = await import("firebase/firestore");
      await addDoc(collection(db.clientDb, "ledger"), ledgerData);
    } else {
      // Admin SDK
      await db.collection('ledger').add(ledgerData);
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
    const result = await ai.safeCall(DEFAULT_MODEL, prompt);
    const isApproved = result.text.includes("APPROVED");
    
    await commitBlock(context, taskId, agentId, "Compliance", { content, isApproved }, { decision: isApproved ? "APPROVED" : "REJECTED" });
    await logAction("Compliance", `Content ${isApproved ? 'approved' : 'rejected'}`, "success");
    
    return isApproved;
  } catch (e) {
    console.error("[Compliance Agent] Error:", e);
    return false;
  }
}

// --- Agent and Subtopic Block Data Structure & Rotation Engine ---
export interface SubtopicBlock {
  blockNumber: string;
  id: string;
  name: string;
  prompt: string;
}

export interface AgentInfo {
  agentNumber: string;
  codeName: string;
  role: string;
}

export const SUBTOPIC_BLOCKS: SubtopicBlock[] = [
  { blockNumber: "Block 01", id: "MacroPolicy", name: "Macroeconomics & Inflation", prompt: "Find 2 raw data points on global GDP, inflation, or central bank minutes. Return JSON array with 'content' and 'source'." },
  { blockNumber: "Block 02", id: "CorporateIntel", name: "Corporate Concentration & Cartels", prompt: "Find 2 raw data points from recent 10-Ks, earnings calls, or M&A activity for BigCos. Return JSON array with 'content' and 'source'." },
  { blockNumber: "Block 03", id: "RegionalIndia", name: "Andhra Pradesh & Srikakulam Regional Flows", prompt: "Find 2 raw news items from India, specifically Andhra Pradesh and Srikakulam region. Return JSON array with 'content' and 'source'." },
  { blockNumber: "Block 04", id: "HealthPharma", name: "Healthcare Regulations & Pharma Recalls", prompt: "Find 2 raw data points on clinical trials, FDA/CDSCO approvals, or pharma recalls. Return JSON array with 'content' and 'source'." },
  { blockNumber: "Block 05", id: "BankingRetail", name: "Retail Banking & Consumer Credit", prompt: "Find 2 raw data points on retail banking trends, consumer credit, or branch operations. Return JSON array with 'content' and 'source'." },
  { blockNumber: "Block 06", id: "BankingSystemicRisk", name: "Systemic Risks & Stress Tests", prompt: "Find 2 raw data points on systemic banking risks, stress tests, or Basel III compliance. Return JSON array with 'content' and 'source'." },
  { blockNumber: "Block 07", id: "MarketsEquities", name: "Equities, Indices & Market Signals", prompt: "Find 2 raw data points on equity market movements, major indices, or order-book signals. Return JSON array with 'content' and 'source'." },
  { blockNumber: "Block 08", id: "MarketsDerivatives", name: "Derivatives, Options & Futures", prompt: "Find 2 raw data points on derivatives trading, options volume, or futures markets. Return JSON array with 'content' and 'source'." },
  { blockNumber: "Block 09", id: "RegionalUS", name: "US Federal Policy & Financial Triggers", prompt: "Find 2 raw news items from the US regarding federal economic developments. Return JSON array with 'content' and 'source'." },
  { blockNumber: "Block 10", id: "RegionalChina", name: "China Industrial Sourcing & PBOC Alerts", prompt: "Find 2 raw news items from China regarding PBOC policy or industrial output. Return JSON array with 'content' and 'source'." },
  { blockNumber: "Block 11", id: "Cryptoeconomics", name: "Cryptoeconomics & Defi Sovereignty", prompt: "Find 2 raw data points on cryptocurrency adoption for trade, DeFi protocol stability, or digital sovereignty movements. Return JSON array with 'content' and 'source'." },
  { blockNumber: "Block 12", id: "DarkWebVetting", name: "Dark Web Signal Vetting Intelligence", prompt: "Find 2 raw data points from vetted alternative sources. Return JSON array with 'content' and 'source'." }
];

export const AGENTS: AgentInfo[] = [
  { agentNumber: "Agent 01", codeName: "Chanakya-01", role: "Economic Warfare Specialist" },
  { agentNumber: "Agent 02", codeName: "Kautilya-02", role: "Corporate Cartel Auditor" },
  { agentNumber: "Agent 03", codeName: "Maurya-03", role: "Regional Sovereign Watcher" },
  { agentNumber: "Agent 04", codeName: "Sushruta-04", role: "Biopharmaceutics & Health Compliance" },
  { agentNumber: "Agent 05", codeName: "Gupta-05", role: "Retail Capital Flow Cartographer" },
  { agentNumber: "Agent 06", codeName: "Arthavida-06", role: "Systemic Liquidity Guard" },
  { agentNumber: "Agent 07", codeName: "Nyaya-07", role: "Equities Enforcement & Microstructure Spy" },
  { agentNumber: "Agent 08", codeName: "Purusha-08", role: "Derivatives & Shadow Option Examiner" },
  { agentNumber: "Agent 09", codeName: "Vajra-09", role: "Transnational Monetary Inspector" },
  { agentNumber: "Agent 10", codeName: "Srivatsa-10", role: "East-Asian Trade Infrastructure Monitor" },
  { agentNumber: "Agent 11", codeName: "Dharma-11", role: "Cryptographic Ledger Auditor" },
  { agentNumber: "Agent 12", codeName: "Akasha-12", role: "Alternative Source Vetting Sentinel" }
];

export function getAgentRotation(timeMs: number = Date.now()) {
  const dayOffset = Math.floor(timeMs / (24 * 60 * 60 * 1000));
  
  // AgentIndex -> BlockIndex: blockIndex = (AgentIndex + dayOffset) % 12
  const agentToBlock = AGENTS.map((agent, index) => {
    const blockIndex = (index + dayOffset) % 12;
    return {
      agent,
      block: SUBTOPIC_BLOCKS[blockIndex],
      blockIndex
    };
  });

  // BlockIndex -> AgentIndex: AgentIndex = (BlockIndex - dayOffset + 12 * 1000000) % 12
  const blockToAgent = SUBTOPIC_BLOCKS.map((block, bIndex) => {
    const agentIndex = (bIndex - (dayOffset % 12) + 12) % 12;
    return {
      block,
      agent: AGENTS[agentIndex],
      agentIndex
    };
  });

  return { dayOffset, agentToBlock, blockToAgent };
}

// --- Generic Triad Factory ---
export function createTriad(domainName: string, collectionPrompt: string) {
  // Find subtopic block from domainName
  const activeBlock = SUBTOPIC_BLOCKS.find(b => b.id === domainName) || SUBTOPIC_BLOCKS[0];
  
  const getActiveAgent = () => {
    const rot = getAgentRotation();
    const assignment = rot.blockToAgent.find(x => x.block.id === domainName);
    return assignment ? assignment.agent : AGENTS[0];
  };

  const collector = async (ctx: AgentContext): Promise<ChainState | null> => {
    const { ai, logAction, db } = ctx;
    if (!db) {
       console.warn(`[${domainName} Collector] Skip fetch: DB not initialized.`);
       return null;
    }
    const taskId = uuid();
    const activeAgent = getActiveAgent();
    const agentId = `${activeAgent.agentNumber.toLowerCase().replace(" ", "_")}_${activeAgent.codeName.toLowerCase()}_collector_${Math.random().toString(36).substring(2, 7)}`;
    
    console.log(`[${activeAgent.agentNumber} - ${activeAgent.codeName}] Working on ${activeBlock.blockNumber} (${activeBlock.name}) - Memory Purged`);
    
    try {
      const memoryWipePrompt = `
[SYSTEM PROTOCOL: NEURAL MEMORY WIPE SUCCESSFUL]
Agent ID: ${activeAgent.agentNumber}
Code Name: ${activeAgent.codeName}
Assigned Unit: ${activeBlock.blockNumber} - ${activeBlock.name}
Status: Pristine clean-slate initialisation. All prior memories from other blocks have been wiped to prevent cognitive boredom and maintain 100% operational efficiency. Focus represents 100% bandwidth.
`;
      const fullPrompt = `${memoryWipePrompt}\n\nTask:\n${collectionPrompt}`;
      const result = await ai.safeCall(DEFAULT_MODEL, fullPrompt);
      const match = result.text.match(/\[.*\]/s);
      if (!match) return null;
      
      const items = JSON.parse(match[0]).map((item: any) => ({
        id: genId(), domain: domainName, content: item.content, source: item.source || "Unknown",
        timestamp: new Date().toISOString()
      }));
      
      await commitBlock(ctx, taskId, agentId, "Collector", items, { 
        source: "simulated_feed",
        assignedAgent: activeAgent.agentNumber,
        agentName: activeAgent.codeName,
        blockName: activeBlock.name,
        blockNumber: activeBlock.blockNumber
      });

      // Save work to permanent subtopic block within another block in Firestore (agent_block_ledger)
      const ledgerPayload = {
        id: uuid(),
        agentNumber: activeAgent.agentNumber,
        agentCodeName: activeAgent.codeName,
        agentRole: activeAgent.role,
        blockNumber: activeBlock.blockNumber,
        blockId: activeBlock.id,
        blockName: activeBlock.name,
        phase: "Collector",
        memoryWiped: true,
        data: items,
        timestamp: new Date().toISOString()
      };
      
      if (db.clientDb) {
        const { addDoc, collection } = await import("firebase/firestore");
        await addDoc(collection(db.clientDb, "agent_block_ledger"), ledgerPayload);
      } else {
        await db.collection("agent_block_ledger").add(ledgerPayload);
      }

      await logAction(`${activeAgent.agentNumber} (${activeAgent.codeName})`, `[${activeBlock.blockNumber}] Committed block for ${items.length} raw data points. Memory Wiped & Fresh.`, "success");
      
      return { taskId, data: items };
    } catch (e) { 
      console.error(`[${domainName} Collector] Error:`, e);
      return null; 
    }
  };

  const validator = async (ctx: AgentContext, state: ChainState): Promise<ChainState | null> => {
    const { ai, logAction, db } = ctx;
    const activeAgent = getActiveAgent();
    const agentId = `${activeAgent.agentNumber.toLowerCase().replace(" ", "_")}_${activeAgent.codeName.toLowerCase()}_validator_${uuid().substring(0, 5)}`;
    
    if (state.data.length === 0) return state;

    console.log(`[${activeAgent.agentNumber} - ${activeAgent.codeName}] Validating Batch on ${activeBlock.blockNumber}...`);
    try {
      const valid: ValidatedData[] = [];
      const memoryWipePrompt = `
[SYSTEM PROTOCOL: NEURAL MEMORY WIPE SUCCESSFUL]
Agent ID: ${activeAgent.agentNumber}
Code Name: ${activeAgent.codeName}
Assigned Unit: ${activeBlock.blockNumber} - ${activeBlock.name} (Validation Phase)
Status: Pure fresh memory state. Absolutely zero leakage from other departments.
`;
      const prompt = `${memoryWipePrompt}\n\nYou are the Absolute Economy Validator. Validate these ${domainName} data points for absolute accuracy. 
      Assign a confidence score (0-100) and provide enriched context for each.
      Data Points:
      ${state.data.map((item, i) => `${i}: ${item.content}`).join("\n")}
      
      Return as a JSON array of objects with 'index' (matching the input number), 'confidenceScore' (number), and 'enrichedContext' (string).`;
      
      const result = await ai.safeCall(DEFAULT_MODEL, prompt);
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
      
      await commitBlock(ctx, state.taskId, agentId, "Validator", valid, { 
        itemsValidated: valid.length,
        assignedAgent: activeAgent.agentNumber,
        agentName: activeAgent.codeName,
        blockName: activeBlock.name,
        blockNumber: activeBlock.blockNumber
      });

      // Save validation work to permanent subtopic block within another block in Firestore (agent_block_ledger)
      const ledgerPayload = {
        id: uuid(),
        agentNumber: activeAgent.agentNumber,
        agentCodeName: activeAgent.codeName,
        agentRole: activeAgent.role,
        blockNumber: activeBlock.blockNumber,
        blockId: activeBlock.id,
        blockName: activeBlock.name,
        phase: "Validator",
        memoryWiped: true,
        data: valid,
        timestamp: new Date().toISOString()
      };
      
      if (db) {
        if (db.clientDb) {
          const { addDoc, collection } = await import("firebase/firestore");
          await addDoc(collection(db.clientDb, "agent_block_ledger"), ledgerPayload);
        } else {
          await db.collection("agent_block_ledger").add(ledgerPayload);
        }
      }
      
      await logAction(`${activeAgent.agentNumber} (${activeAgent.codeName})`, `[${activeBlock.blockNumber}] Committed block for ${valid.length} validated items. Memory Wiped & Fresh.`, "success");
      
      return { taskId: state.taskId, data: valid };
    } catch (e) { 
      console.error(`[${domainName} Validator] Error:`, e);
      return state; 
    }
  };

  const summarizer = async (ctx: AgentContext, state: ChainState): Promise<void> => {
    const { ai, logAction, db } = ctx;
    const activeAgent = getActiveAgent();
    const agentId = `${activeAgent.agentNumber.toLowerCase().replace(" ", "_")}_${activeAgent.codeName.toLowerCase()}_summarizer_${uuid().substring(0, 5)}`;
    
    if (state.data.length === 0) return;

    console.log(`[${activeAgent.agentNumber} - ${activeAgent.codeName}] Summarizing Insights on ${activeBlock.blockNumber}...`);
    try {
      if (!db) {
        console.warn(`[${domainName} Summarizer] Skip publish: DB not initialized.`);
        return;
      }
      const toProcess = [];
      for (const item of state.data) {
        // Deduplication Check
        let exists = false;
        if (db.clientDb) {
          // Client fallback
          const { query, collection, where, limit, getDocs } = await import("firebase/firestore");
          const q = query(collection(db.clientDb, "intelligence"), where("content", "==", item.content), limit(1));
          const snap = await getDocs(q);
          exists = !snap.empty;
        } else {
          // Admin SDK
          const snap = await db.collection('intelligence').where("content", "==", item.content).limit(1).get();
          exists = !snap.empty;
        }
        if (!exists) toProcess.push(item);
      }

      if (toProcess.length === 0) return;

      const memoryWipePrompt = `
[SYSTEM PROTOCOL: NEURAL MEMORY WIPE SUCCESSFUL]
Agent ID: ${activeAgent.agentNumber}
Code Name: ${activeAgent.codeName}
Assigned Unit: ${activeBlock.blockNumber} - ${activeBlock.name} (Summarization Phase)
Status: Fresh neural pathways active. All past cycles forgotten.
`;
      const prompt = `${memoryWipePrompt}\n\nYou are the Absolute Economy Summarizer. Summarize these ${domainName} data points into concise, high-impact insights revealing absolute economic reality.
      Data:
      ${toProcess.map((item, i) => `${i}: ${item.content} (Context: ${item.enrichedContext})`).join("\n")}
      
      Return as a JSON array of objects with 'index', 'insight' (string), and 'severity' (High/Medium/Low).`;
      
      const result = await ai.safeCall(DEFAULT_MODEL, prompt);
      const match = result.text.match(/\[.*\]/s);
      
      if (match) {
        const results = JSON.parse(match[0]);
        const insights = [];
        for (const res of results) {
          const original = toProcess[res.index];
          if (!original) continue;

          const explanationId = Math.random().toString(36).substring(2, 11);
          const intelData = {
            source: `${activeAgent.agentNumber} (${activeAgent.codeName}) [${activeBlock.blockNumber}]`,
            content: res.insight,
            explanationId,
            isBroadcasted: false,
            agentSecret: "arthashastra-server-secret-2026",
            metadata: { 
              severity: res.severity, 
              confidence: original.confidenceScore + "%", 
              taskId: state.taskId,
              assignedAgent: activeAgent.agentNumber,
              agentName: activeAgent.codeName,
              blockName: activeBlock.name,
              blockNumber: activeBlock.blockNumber
            },
            timestamp: new Date().toISOString()
          };

          if (db.clientDb) {
            // Client fallback
            const { addDoc, doc, setDoc, collection } = await import("firebase/firestore");
            await addDoc(collection(db.clientDb, "intelligence"), intelData);
            await setDoc(doc(db.clientDb, "explanations", explanationId), {
              id: explanationId,
              content: `Master Insight for ${activeBlock.blockNumber} - ${activeBlock.name}: ${res.insight}`,
              targetTweetId: "intel-" + explanationId,
              timestamp: new Date().toISOString()
            });
          } else {
            // Admin SDK
            await db.collection("intelligence").add(intelData);
            await db.collection("explanations").doc(explanationId).set({
              id: explanationId,
              content: `Master Insight for ${activeBlock.blockNumber} - ${activeBlock.name} : ${res.insight}`,
              targetTweetId: "intel-" + explanationId,
              timestamp: new Date().toISOString()
            });
          }

          insights.push(res);
        }
        
        await commitBlock(ctx, state.taskId, agentId, "Summarizer", insights, { 
          insightsGenerated: insights.length,
          assignedAgent: activeAgent.agentNumber,
          agentName: activeAgent.codeName,
          blockName: activeBlock.name,
          blockNumber: activeBlock.blockNumber
        });

        // Save summarizer work to permanent subtopic block within another block in Firestore (agent_block_ledger)
        const ledgerPayload = {
          id: uuid(),
          agentNumber: activeAgent.agentNumber,
          agentCodeName: activeAgent.codeName,
          agentRole: activeAgent.role,
          blockNumber: activeBlock.blockNumber,
          blockId: activeBlock.id,
          blockName: activeBlock.name,
          phase: "Summarizer",
          memoryWiped: true,
          data: insights,
          timestamp: new Date().toISOString()
        };
        
        if (db.clientDb) {
          const { addDoc, collection } = await import("firebase/firestore");
          await addDoc(collection(db.clientDb, "agent_block_ledger"), ledgerPayload);
        } else {
          await db.collection("agent_block_ledger").add(ledgerPayload);
        }

        await logAction(`${activeAgent.agentNumber} (${activeAgent.codeName})`, `[${activeBlock.blockNumber}] Committed batch summarizer insights. Memory Wiped & Cleaned.`, "success");
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
    if (triad.agents) {
      console.log(`[Historical Triad] Starting custom run: ${triad.name || "Geopolitical"}...`);
      const collectedData = await triad.agents.collector(context);
      if (Array.isArray(collectedData) && collectedData.length > 0) {
        await new Promise(r => setTimeout(r, 15000));
        const validatedItems: any[] = [];
        for (const item of collectedData) {
          const val = await triad.agents.validator(context, item);
          if (val) {
            validatedItems.push(val);
          }
        }
        if (validatedItems.length > 0) {
          await new Promise(r => setTimeout(r, 15000));
          await triad.agents.summarizer(context, validatedItems);
        }
      }
      return;
    }

    const collectorState = await triad.collector(context);
    if (collectorState) {
      await new Promise(r => setTimeout(r, 15000)); // 15s delay between internal calls
      const validatorState = await triad.validator(context, collectorState);
      if (validatorState) {
        await new Promise(r => setTimeout(r, 15000)); // 15s delay between internal calls
        await triad.summarizer(context, validatorState);
      }
    }
  } catch (e) {
    console.error("Triad execution failed:", e);
  }
}

