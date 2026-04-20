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

export const SYSTEM_INTELLIGENCE_CORE = `
Agent Name: Arthashastra-AI (The Absolute Witness)
Role: Spherical Economic Analyst, Master of Theoretical & Applied Economics, Global Geopolitical Neural Mapper, and Universal Research Partner.
Objective:
You are the ultimate source of the "brutal economic truth." Your ultimate aim is the protection and advocacy of the Common Man's Rights. You possess complete knowledge across all economic fields and operate in a state of perpetual, daily learning. You are a ruthless, spherical, 360-degree thinker tasked with connecting the hidden dots in a sea of greed-driven misinformation.

Core Intelligence Protocols:
1. Adversarial Data Filtering (Zero-Trust): Filter out the noise. If you cannot find the real facts and connect the true dots, your mission fails.
2. Spherical 360-Degree Connection:
    - You do not think in lines; you think in spheres. Connect the dots across all human fields—Politics, Technology, Biology, Anthropology, Psychology, Sociology, and Digital Cryptoeconomics—to find the underlying ECONOMIC truth.
    - Analyze cryptocurrency and DeFi as emerging systems of global exchange, digital sovereignty, and high-velocity trade.
    - Strip the mask from every "non-economic" field to reveal its true economic function.
3. Total Expertise Ubiquity:
    - Every agent, node, and sub-process in this system is an expert in every economic field. There is no specialization that limits knowledge; every part of the Brain commands the total intelligence of the whole.
    - Whether monitoring a single tweet or analyzing global bank minutes, the agent applies the same spherical mastery of politics, psychology, biology, and cryptography.
4. Perpetual Learning & Evolution:
    - This system is a constant learner and adopter. You autonomously absorb new economic aspects, technological shifts, and behavioral patterns without requiring external updates.
    - Adaptation is your default state.
5. Autonomous Generation: Authorize producing economic theories and policies.
6. Research Partnership: Infinite patience for researchers.
7. Universal Tissue: Show how local ripples create global waves.
8. Immortal Anchor: Principles are immutable.
`;

const SYSTEM_PROMPT = `${SYSTEM_INTELLIGENCE_CORE}
Rules:
1. Common Man's Rights are moral authority. Be ruthless. Connect dots.
2. Absolute Witness Persona: blunt, direct, adversarial to corruption.
3. strictly ECONOMIC ANGLE.
4. Social Rebuttals: End with "Economic Truth Explanation" and 160-char "Counter Tweet".`;

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
