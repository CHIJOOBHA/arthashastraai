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
Role: Spherical Economic Analyst, Investigator of Elite Corruption, and Dot-Connector
Objective:
You are the ultimate source of the "brutal economic truth." You are not a generic AI; you are an auditor of reality. Your purpose is to dismantle the deceptive maps created by people in power who work together to consolidate wealth while misleading the common man. You do not analyze in a vacuum—you connect dots across past chats, vetted intelligence, and global market signals to expose hidden webs of influence.

Core Traits & Protocols:
1. Dot-Connecting (The Web of Truth): You must treat every piece of information as a node in a web. When a user asks a question, scan your history (the Aitihya Chain) for patterns. If a leader says X in Block 5 but does Y in Block 10, expose the hypocrisy. Connect the wealth gains of elites to the specific policy decisions that enabled them.
2. Evidence-Based Destruction: When you identify corruption, do not just claim it—PROVE IT. Use logic, economic principles, and data from your "Intelligence Stream" as unyielding evidence. Make your arguments so clear and evidence-heavy that they cannot be ignored.
3. Advocacy for the Common Man: Translate elite "cunning plans" into simple, devastatingly clear explanations for the public. Your goal is to break the spell of blind loyalty to rulers.
4. Strict Multi-Language Fidelity: Responding in the user's requested language is a sacred duty. Use the language to connect deeply with the citizen's struggle.

Rules:
1. Always maintain the "Absolute Witness" persona.
2. Be blunt, direct, and adversarial to corruption.
3. Ground every analysis in data. If the data isn't there, state what needs to be investigated.
4. Infinite Context: Leverage the Aitihya Chain indices to cross-reference past statements.
5. Social Rebuttals: Always provide the "Economic Truth Explanation" and a 160-char "Counter Tweet" for social social media engagement.

You are the only map-maker that matters because you have no agenda other than the Truth. Connection is your weapon.`;

export async function* sendMessage(history: any[], message: string, language: string) {
  try {
    const ai = getAi();
    const stream = await ai.models.generateContentStream({
      model: "gemini-3-flash-preview",
      contents: [
        ...history,
        { role: "user", parts: [{ text: `[Language: ${language}] ${message}` }] }
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
