import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Activity, Database, Loader2, ShieldAlert } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ai, SYSTEM_INTELLIGENCE_CORE, HIGH_INTEL_MODEL } from '../lib/gemini';
import { db } from '../lib/firebase';
import { collection, query, getDocs, orderBy, limit, addDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { ErrorBoundary } from './ErrorBoundary';

export function EconomicDisasterPredictor() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'threat_matrices'), orderBy('timestamp', 'desc'), limit(10));
    const unsubscribe = onSnapshot(q, (snap) => {
      setHistory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("[EconomicDisasterPredictor] History fetch error:", error);
    });
    return () => unsubscribe();
  }, []);

  const generateReport = async () => {
    setLoading(true);
    setReport(null);
    try {
      let agentReports = "";
      
      try {
        const qIntell = query(collection(db, 'intelligence'), orderBy('timestamp', 'desc'), limit(50));
        const intellSnap = await getDocs(qIntell);
        let reportsData = intellSnap.docs.map(doc => {
          const data = doc.data();
          return `[AGENT REPORT - ${data.type || 'GENERAL'} - ${data.region || 'GLOBAL'}] ${data.summary || data.content}`;
        }).join('\n\n');
        
        const qLedger = query(collection(db, 'ledger'), orderBy('timestamp', 'desc'), limit(50));
        const ledgerSnap = await getDocs(qLedger);
        const ledgerData = ledgerSnap.docs.map(doc => {
          const data = doc.data();
          return `[LEDGER INTEL: ${data.action || 'Unknown'}] ${data.details || ''}`;
        }).join('\n\n');

        agentReports = `--- SYSTEM AGENT INTELLIGENCE REPORTS ---\n\n${reportsData}\n\n--- FINANCIAL LEDGER INSIGHTS ---\n\n${ledgerData}\n\n`;
      } catch(e) {
        console.error("Failed to fetch agent intel", e);
        agentReports = "--- NO RECENT AGENT INTELLIGENCE AVAILABLE ---\n";
      }

      const prompt = `You are an elite, highly confidential global economic threat intelligence system.
Your supreme directive is to predict upcoming financial or economic disasters with ZERO HALLUCINATIONS, ZERO MISINFORMATION, and ZERO MISLEADING claims. People's lives depend on this intelligence, so you must proceed with extreme caution and factual rigidity.

You MUST base your prediction STRICTLY on the real-time agent reports provided below. Synthesize this data to assess the current macroeconomic landscape.
You have complete autonomy to predict sectoral disasters, specific national economic threats, or a global economic collapse, but it MUST be supported by the provided intelligence and your deep economic knowledge of precedents.

Categorize your identified threats strictly under one of the following levels, grouping situations accordingly:
- **CRITICAL THREAT**: Imminent collapse or systemic contagion risk.
- **HIGH THREAT**: High probability of significant long-term economic damage.
- **MEDIUM THREAT**: Serious friction in economic gears; localized damage possible.
- **LOW THREAT**: Monitor closely; early warning signs detected.

Format your output in clean Markdown. Include logical reasoning based on historical macroeconomic precedents (e.g., 2008, Dot-Com Bubble, Asian Financial Crisis) and current systemic risk factors (liquidity, credit cycles, inflation traps, geopolitical friction) that align with the agent reports.

At the very end of your report, generate a short, punchy 280-character 'Counter-Tweet' summarizing the critical threat to alert the public. Format this exactly as:

**Counter-Tweet:** <your tweet here>

Do not be overly optimistic, but do not invent threats that are unsupported. Keep it highly analytical and objective.

${agentReports}`;
      
      const fullPrompt = `${SYSTEM_INTELLIGENCE_CORE}\n\nTask-Specific Instructions: ${prompt}`;
      
      const res = await ai.safeCall(HIGH_INTEL_MODEL, fullPrompt);

      const generatedText = res.text || "No threat data synthesized. Null response.";
      setReport(generatedText);

      // Save the report to Firebase forever
      try {
        await addDoc(collection(db, 'threat_matrices'), {
          content: generatedText,
          timestamp: serverTimestamp(),
          agentReportsUsed: agentReports !== "--- NO RECENT AGENT INTELLIGENCE AVAILABLE ---\n"
        });
      } catch (saveError) {
        console.error("Failed to save threat matrix:", saveError);
      }
    } catch (error: any) {
      console.error("[EconomicThreatPredictor] error:", error);
      setReport(`**ERROR**: Failed to synthesize threat vectors. Ensure Neural Link (API Key) is active.\n\n\`\`\`\n${error?.message || String(error)}\n\`\`\``);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col p-13 md:p-21 lg:p-34 relative min-h-[60vh] max-w-5xl mx-auto">
      <div className="flex items-center gap-13 mb-21 z-10">
        <div className="w-44 h-44 rounded-full bg-cyber-red/21 border border-cyber-red flex items-center justify-center text-cyber-red shadow-[0_0_13px_rgba(255,42,42,0.5)] shrink-0">
          <ShieldAlert className="w-21 h-21" />
        </div>
        <div>
          <h2 className="text-21 font-bold text-cyber-red caps-modern drop-shadow-[0_0_8px_rgba(255,42,42,0.8)]">Economic Threat Matrix</h2>
          <p className="text-13 text-parchment/55">Predictive Intelligence & Systemic Risk Monitor</p>
        </div>
      </div>

      <div className="z-10 bg-void/89 p-21 border-2 border-dashed border-cyber-red/34 rounded-13 mb-21 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyber-red to-transparent opacity-55" />
        <p className="text-13 text-parchment/89 font-mono leading-relaxed mb-13">
          Initialize the neural network to analyze macro-economic structures, geopolitical friction, and systemic vulnerabilities. The system will categorize upcoming economic anomalies by threat level. Proceed with high caution.
        </p>
        <button
          onClick={generateReport}
          disabled={loading}
          className="flex items-center justify-center gap-8 px-21 py-13 bg-cyber-red text-void w-full md:w-auto font-bold caps-modern border border-cyber-red hover:bg-void hover:text-cyber-red transition-all duration-377 shadow-[0_0_13px_rgba(255,42,42,0.5)] hover:shadow-[0_0_21px_rgba(255,42,42,0.8)] disabled:opacity-55 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="w-13 h-13 animate-spin" />
          ) : (
            <Activity className="w-13 h-13" />
          )}
          <span>{loading ? 'Synthesizing Threat Vectors...' : 'Run Global Threat Analysis'}</span>
        </button>
      </div>

      {report && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="z-10 bg-void/89 p-21 border-2 border-neon-cyan/55 rounded-13 mb-21 relative overflow-hidden shadow-[0_0_21px_rgba(0,240,255,0.2)]"
        >
          <div className="flex items-center gap-8 mb-13 border-b border-neon-cyan/21 pb-8">
            <Activity className="w-13 h-13 text-neon-cyan" />
            <span className="text-13 caps-modern font-bold text-neon-cyan">LATEST INTELLIGENCE</span>
          </div>
          <div className="markdown-body prose prose-invert max-w-none prose-headings:text-cyber-red prose-strong:text-cyber-red prose-a:text-cyber-red text-parchment/89 prose-code:text-cyber-red/89 font-mono max-h-[55vh] overflow-y-auto silk-scroll pr-8">
            <ReactMarkdown>{report}</ReactMarkdown>
          </div>
        </motion.div>
      )}

      <div className="z-10 mt-34 flex-1">
        <h3 className="text-13 font-bold text-cyber-red caps-modern drop-shadow-[0_0_8px_rgba(255,42,42,0.8)] mb-13 flex items-center gap-8 uppercase">
          <Database className="w-13 h-13" />
          Threat Matrix Archive
        </h3>
        
        {history.length > 0 ? (
          <div className="flex flex-col gap-21">
            {history.map((item, idx) => (
              <motion.div 
                key={item.id}
                initial={{ opacity: 0, y: 13 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="glass-panel p-21 border border-cyber-red/21 rounded-13 relative bg-cyber-red/5"
              >
                <div className="text-[10px] text-cyber-red/89 font-mono mb-8 opacity-55">
                  {typeof item.timestamp?.toDate === 'function' ? item.timestamp.toDate().toLocaleString() : 'Saving...'}
                  {item.agentReportsUsed ? ' • Integrated Agent Reports' : ''}
                </div>
                <div className="markdown-body prose prose-invert max-w-none prose-p:text-13 prose-headings:text-13 prose-headings:font-bold prose-headings:text-cyber-red prose-strong:text-cyber-red prose-a:text-cyber-red text-parchment/55 prose-code:text-cyber-red/89 font-mono">
                  <ReactMarkdown>{item.content || ''}</ReactMarkdown>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="glass-panel p-21 border border-cyber-red/13 rounded-13 text-center opacity-55">
            <Database className="w-21 h-21 mx-auto mb-8 text-cyber-red" />
            <p className="text-13 font-mono text-parchment/89">No historical matrices archived.</p>
            <p className="text-[10px] text-parchment/55">All generated global threat reports will be permanently stored here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
