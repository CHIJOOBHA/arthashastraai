
import { db, auth, resilientGetDocs, resilientGetDoc } from './firebase';
import { collection, query, where, orderBy, limit, doc, setDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { generateJSON } from './gemini';

export interface ChronicleTweet {
  text: string;
  region: 'India' | 'World';
  source?: string; // What news/policy this responds to
}

export interface ChronicleArticle {
  title: string;
  lead: string; // opening paragraph stating the issue and position
  content: string; // 2-4 supporting points with facts/data
  counterArgument: string; // brief presentation and rebuttal of opposing view
  callToAction: string; // restate thesis and recommend specific action
  summary: string;
  perspective: string; // Resolution strategy as requested by user
  sources: string[]; // List of news sources or policies analyzed
  editorialLabel: string; // e.g., "Editorial Opinion", "Systemic Analysis"
  auditTrail?: string; // Log of agent decision/fact-check reasoning
}

export interface Chronicle {
  id: string; // YYYY-MM-DD
  date: string;
  tweets: ChronicleTweet[];
  articleIndia: ChronicleArticle;
  articleWorld: ChronicleArticle;
  timestamp: any;
  editorialStandards: string; // Reference to standards followed (PCI, etc.)
}

export async function getChronicle(dateId: string): Promise<Chronicle | null> {
  try {
    const docRef = doc(db, 'chronicles', dateId);
    const snap = await resilientGetDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as Chronicle;
    }
    return null;
  } catch (error) {
    console.error('[ChronicleStore] Error fetching chronicle:', error);
    return null;
  }
}

export async function getRecentChronicles(count = 10): Promise<Chronicle[]> {
  try {
    const q = query(
      collection(db, 'chronicles'),
      orderBy('id', 'desc'),
      limit(count)
    );
    const snap = await resilientGetDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Chronicle));
  } catch (error) {
    console.error('[ChronicleStore] Error fetching recent chronicles:', error);
    return [];
  }
}

/**
 * Generates today's chronicle using Gemini.
 * This simulates the "daily search and write" task.
 */
export async function generateDailyChronicle(dateId: string): Promise<Chronicle> {
  const prompt = `
    You are Arthashastra-AI, the Absolute Witness. 
    Task: Generate the "Arthashastra Gazette" for the temporal node ${dateId}.
    
    EDITORIAL MANDATE (PCI & EDITORS GUILD COMPLIANCE):
    1. Clarity of Purpose: Every piece must have a single, explicit thesis defending the Common Man's Rights.
    2. Accuracy & Attribution: Check every claim against real events around ${dateId}. Provide specific citations/sources.
    3. Structural Rigor: 
       - Headline: Concise & Argumentative.
       - Lead: State the issue and position clearly.
       - Body: 2-4 supporting points with data, expert logic, or facts (Target: 400-600 words).
       - Counterargument: Present the strongest opposing view (e.g., government or corporate justification) and rebut it logically.
       - Call to Action: Recommend a specific policy or public action.
    4. Fairness & Balance: Avoid ad-hominem attacks; critique actions/systems, not individuals.
    5. Constructive Tone: Propose solutions (Resolution Strategy).

    REQUIREMENTS:
    1. 5 Daily Tweets: Respond to specific news items/propaganda. Provide "source" (Event/Short Link).
    2. 1 India Article & 1 World Article: Each MUST follow the 5-point structure above.
    
    Format: JSON
    {
      "tweets": [{"text": "...", "region": "India" | "World", "source": "..."}],
      "articleIndia": {
        "title": "...", 
        "lead": "...",
        "content": "...", 
        "counterArgument": "...",
        "callToAction": "...",
        "summary": "...", 
        "perspective": "...", 
        "sources": ["..."], 
        "editorialLabel": "...", 
        "auditTrail": "..."
      },
      "articleWorld": {
        "title": "...", 
        "lead": "...",
        "content": "...", 
        "counterArgument": "...",
        "callToAction": "...",
        "summary": "...", 
        "perspective": "...", 
        "sources": ["..."], 
        "editorialLabel": "...", 
        "auditTrail": "..."
      },
      "editorialStandards": "Compliance: PCI/Editors Guild Structural Standards"
    }
  `;

  // We use generateJSON with responseMimeType
  let data;
  try {
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("NEURAL_LINK_TIMEOUT: The neural model for the Absolute Gazette took too long to synchronize. This is often due to high network latency or complex data aggregation. Please try again.")), 150000)
    );
    console.log(`[ChronicleStore] Initiating search and write for date: ${dateId}`);
    
    // Use a more capable model for this complex multi-article generation
    // and try at least once more if it fails initial JSON parsing
    let attempts = 0;
    while (attempts < 2) {
      try {
        data = await Promise.race([
          generateJSON(prompt, "You are the primary intelligence node of Arthashastra. Return only valid, deep-researched JSON data."), 
          timeoutPromise
        ]) as any;
        if (data && data.articleIndia && data.articleWorld) {
          break;
        }
        
        // If data is returned but invalid, we still need to increment attempts and retry or throw
        attempts++;
        if (attempts >= 2) throw new Error("NEURAL_DATA_INVALID: The model returned incomplete intelligence nodes after multiple attempts.");
        console.warn(`[ChronicleStore] Generation attempt ${attempts} returned incomplete records, retrying...`);
        await new Promise(r => setTimeout(r, 2000));
      } catch (e) {
        attempts++;
        if (attempts >= 2) throw e;
        console.warn(`[ChronicleStore] Generation attempt ${attempts} failed, retrying...`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    
    console.log(`[ChronicleStore] Neural generation successful for: ${dateId}`);
  } catch (e: any) {
    console.error("[ChronicleStore] Generation failed:", e);
    
    // Return a structured error that the UI can handle specifically
    if (e.message?.includes('TIMEOUT')) {
      throw new Error("NEURAL_SYNC_FAILED: Timeout. The economic complexity surpassed the current neural bandwidth.");
    }
    throw new Error(e.message || "The Neural Assembly failed to solidify this record. Quota or Connectivity issues detected.");
  }
  
  const chronicle: Chronicle = {
    id: dateId,
    date: dateId,
    tweets: data.tweets || [],
    articleIndia: data.articleIndia || {},
    articleWorld: data.articleWorld || {},
    timestamp: serverTimestamp(),
    editorialStandards: data.editorialStandards || "Compliance: Standard Neural Vetting"
  };

  try {
    await setDoc(doc(db, 'chronicles', dateId), chronicle);
  } catch (err: any) {
    console.error("Firestore Error in setDoc", err);
    throw new Error("Neural Assembly Core Error: Database rejected the record.");
  }

  return chronicle;
}
