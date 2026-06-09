
import { AgentContext, uuid, RawData, ValidatedData, complianceAgent } from "./agents.js";
import { witnessBlock } from "./aitihya.js";
import { getEnv } from "./env.js";
import { DEFAULT_MODEL } from "./gemini.js";

/**
 * Historical Context Engine (The Deep Ledger of Memory)
 * Objective: Providing deep historical, geopolitical, and cultural context to every piece of intelligence.
 * This satisfies the mission directive to "know the full history of any person, organisation or country".
 */

export async function geopoliticalHistorianAgent(context: AgentContext, rawData: RawData): Promise<ValidatedData | null> {
  const { ai, logAction, db } = context;
  const agentId = `hist_mapper_${Math.random().toString(36).substring(2, 7)}`;
  
  try {
    await logAction("GeopoliticalHistorian", `Mapping deep history for: ${rawData.source}`, "processing");

    const prompt = `You are the Geopolitical Historian Node of ARTHASHASTRA.
    Intelligence to Contextualize: "${rawData.content}" (Source: ${rawData.source})
    
    Mission: Provide the deep historical, geopolitical, and adversarial context for this person, organization, or country's action.
    Detect:
    1. Historical Precedents: Has this happened before? What are the roots?
    2. False Narratives: Is this current event being used as propaganda?
    3. Hidden Motives: What is the underlying economic or geopolitical aim?
    
    Output Format:
    - Confidence Score (0-1)
    - Spherical Context (300 words max)
    - Fact Verification: List 2 core facts and 1 potential propaganda angle to watch for.`;

    const result = await ai.safeCall(DEFAULT_MODEL, prompt);
    const enrichedContext = result.text;
    
    // Confidence score extraction (simple)
    const confidenceMatch = enrichedContext.match(/Confidence Score:\s*([\d.]+)/);
    const confidenceScore = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.85;

    const validated: ValidatedData = {
      ...rawData,
      confidenceScore,
      enrichedContext
    };

    await logAction("GeopoliticalHistorian", "Deep context mapped successfully", "success");
    return validated;
  } catch (e) {
    console.error("[Geopolitical Historian Agent] Failure:", e);
    return null;
  }
}

export const historicalIntelligenceTriad = {
  name: "Historical Geopolitical Mapping Triad",
  agents: {
    collector: async (context: AgentContext) => {
      // Collects "Anomalies in Narratives"
      const { ai, db } = context;
      const prompt = `Find one current global geopolitical event or person in the news whose historical context is often misunderstood or manipulated. Return JSON with 'person_org', 'event', 'common_narrative'.`;
      const res = await ai.safeCall(DEFAULT_MODEL, prompt);
      const match = res.text.match(/\{.*\}/s);
      if (!match) return [];
      const data = JSON.parse(match[0]);
      return [{
        id: uuid(),
        domain: "Geopolitics",
        source: data.person_org,
        content: `Event: ${data.event}. Common Narrative: ${data.common_narrative}. Requirement: Deep Historical Vetting.`,
        timestamp: new Date().toISOString()
      }];
    },
    validator: geopoliticalHistorianAgent,
    summarizer: async (context: AgentContext, validated: ValidatedData[]) => {
      const { db } = context;
      if (!db) {
        console.warn("[Historical Summarizer] Skip publish: DB not initialized.");
        return;
      }
      for (const item of validated) {
        if (item.confidenceScore > 0.7) {
          await db.collection("intelligence").add({
            ...item,
            type: "historical_intelligence",
            processed: true
          });
        }
      }
    }
  }
};
