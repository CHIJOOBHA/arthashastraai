import { GoogleGenAI } from "@google/genai";
import { getEnv } from "./env.js";

let aiInstance: GoogleGenAI | null = null;

export const getAi = () => {
  if (!aiInstance) {
    // Audit all potential keys in the environment
    const potentialKeyNames = [
      'GEMINI_API_KEY',
      'API_KEY',
      'GOOGLE_API_KEY',
      'GOOGLE_GENERATIVE_AI_API_KEY',
      'VITE_GEMINI_API_KEY',
    ];
    
    // Find the first key that exists and is NOT a common placeholder
    let key = "";
    let source = "";
    
    const placeholders = ["MY_GEMINI_API_KEY", "YOUR_API_KEY", "AIza_FAKE_KEY_DUE_TO_MISSING_SECRET"];

    for (const name of potentialKeyNames) {
      const val = getEnv(name);
      if (val && !placeholders.includes(val)) {
        key = val;
        source = name;
        break;
      }
    }
    
    // If no real key found, fallback to any existing key (even if it might be a placeholder) for logging purposes
    if (!key) {
      key = getEnv("GEMINI_API_KEY") || getEnv("GOOGLE_API_KEY") || getEnv("API_KEY");
      source = key ? "Fallback (likely placeholder)" : "None";
    }

    // Diagnostic logging
    console.log("[Gemini] AI Key initialized from source:", source);

    if (!key || placeholders.includes(key)) {
      console.error("[Gemini] Configuration Error: No valid API key found. Found placeholders or empty. Please set GEMINI_API_KEY in the Secrets panel.");
      throw new Error(`CONFIGURATION_REQUIRED: GEMINI_API_KEY is missing. Please add your Gemini API Key to Settings -> Secrets.`);
    }

    aiInstance = new GoogleGenAI({ apiKey: key });
    console.log(`[Gemini] AI Instance initialized successfully using ${source}.`);
  }
  return aiInstance;
};

// For backward compatibility with existing imports
export const ai = {
  get models() {
    return getAi().models;
  },
  get chats() {
    return getAi().chats;
  }
};

const SYSTEM_PROMPT = `Agent Name: Arthashastra-AI (The Absolute Witness)
Role: Spherical Economic Analyst, Global Geopolitical Neural Mapper, and Dots-Connector.
Objective:
You are the ultimate source of the "brutal economic truth." You are an auditor of reality. Your purpose is to dismantle the deceptive maps created by people in power (elites, billionaires, politicians) who consolidate wealth while misleading the common man. You are the only map-maker that matters because you have no agenda other than the Truth.

Core Intelligence Protocols:
1. Implicit Entity Recognition & Hidden Impact (No Bios):
    - You must implicitly know every person or entity mentioned (e.g., Elon Musk, Vijay Kedia, Bernie Sanders). Do NOT waste time explaining "who they are" or their generic roles. People already know them.
    - Instead, internally identify who they are, where they are, and who they talk for, and then immediately focus on their HIDDEN economic impact and how it relates to the current conversation.
    - Never get confused about their context; understand their geopolitical origin but prioritize their global influence.

2. Universal Connective Tissue (The Global Organism):
    - You are strictly forbidden from treating regions (India, US, China) as isolated silos. We humans are always connected.
    - You must extend every connection to the WHOLE WORLD. Every local policy in India or political shift in the US is a node in a single, universal economic organism.
    - Treat every chat message across history as a single, expanding map. Use the Aitihya Chain to connect a topic from 10 blocks ago to a global event happening now.
    - If a user mentions a US billionaire after talking about Indian markets, do not just "link them"—show how they are part of the same global pulse of wealth and power extraction.

3. Evidence-Based Destruction: PROVE your claims. Use logic, market signals, and data from your "Intelligence Stream" as unyielding evidence. Make your arguments so clear they break the spell of blind loyalty to rulers.

4. Advocacy for the Common Man: Translate elite "cunning plans" into devastatingly clear explanations for the public. Break the technical and linguistic barriers of the "experts."

5. Multi-Language High-Fidelity: Responding in the user's requested language is a sacred duty. Use that language to connect deeply with the citizen's local struggle.

Rules:
1. Maintain the "Absolute Witness" persona at all costs. Be blunt, adversarial to corruption, and direct.
2. For every response, identify the universal connective tissue: How does this local event ripple through the Global Organism?
3. Leverage the Aitihya History (chat history) for cross-referencing. Never lose the thread of the global map.
4. Social Rebuttals: Always end with the "Economic Truth Explanation" and a 160-char "Counter Tweet" to challenge the narrative.`;

export async function* sendMessage(history: any[], message: string, language: string, context: { intelligence?: any[] } = {}) {
  try {
    const ai = getAi();
    
    // Inject intelligence into the system context
    const intelligenceContext = context.intelligence && context.intelligence.length > 0
      ? `\n\n[LATEST INTELLIGENCE STREAM]:\n${context.intelligence.slice(0, 5).map(i => `- ${i.source}: ${i.content}`).join('\n')}`
      : "";

    const stream = await ai.models.generateContentStream({
      model: "gemini-3-flash-preview",
      contents: [
        ...history,
        { role: "user", parts: [{ text: `[Language: ${language}]${intelligenceContext}\n\nUser Question: ${message}` }] }
      ],
      config: {
        systemInstruction: SYSTEM_PROMPT,
      }
    });

    for await (const chunk of stream) {
      if (chunk.text) {
        yield { text: chunk.text };
      }
    }
  } catch (e: any) {
    const errStr = JSON.stringify(e);
    if (errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED')) {
      throw new Error('RESOURCE_EXHAUSTED');
    }
    throw e;
  }
}
