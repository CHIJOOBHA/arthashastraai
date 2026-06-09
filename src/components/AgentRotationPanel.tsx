import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Shield, 
  RefreshCw, 
  Database, 
  Cpu, 
  CheckCircle2, 
  Clock, 
  Search, 
  Sliders, 
  FileText, 
  Sparkles,
  Zap
} from "lucide-react";
import { db } from "../lib/firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { SUBTOPIC_BLOCKS, AGENTS, getAgentRotation, SubtopicBlock, AgentInfo } from "../lib/agents";

export default function AgentRotationPanel() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBlockFilter, setSelectedBlockFilter] = useState("all");
  const [selectedAgentFilter, setSelectedAgentFilter] = useState("all");
  const [countdown, setCountdown] = useState("");
  const [rotation, setRotation] = useState(() => getAgentRotation());

  // Real-time calculation of countdown timer to the next 24-hour day rollover
  useEffect(() => {
    const updateRotationAndTimer = () => {
      setRotation(getAgentRotation());

      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setUTCHours(24, 0, 0, 0); // Next UTC midnight for deterministic 24h shifting
      const diffMs = tomorrow.getTime() - now.getTime();

      const hrs = Math.floor(diffMs / (3600 * 1000));
      const mins = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));
      const secs = Math.floor((diffMs % (60 * 1000)) / 1000);

      setCountdown(
        `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
      );
    };

    updateRotationAndTimer();
    const interval = setInterval(updateRotationAndTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync real-time permanent outputs written in agent_block_ledger
  useEffect(() => {
    const q = query(
      collection(db, "agent_block_ledger"),
      orderBy("timestamp", "desc"),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLogs(data);
      setLoading(false);
    }, (err) => {
      console.warn("Error loading agent_block_ledger: ", err);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const filteredLogs = logs.filter(log => {
    const blockMatch = selectedBlockFilter === "all" || log.blockNumber === selectedBlockFilter || log.blockId === selectedBlockFilter;
    const agentMatch = selectedAgentFilter === "all" || log.agentNumber === selectedAgentFilter;
    return blockMatch && agentMatch;
  });

  return (
    <div id="neural-rotation-panel" className="space-y-34">
      {/* Dynamic Header Metrics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-21">
        <div className="glass-panel p-21 border border-neon-cyan/21 rounded-13 relative group overflow-hidden">
          <div className="absolute top-0 right-0 p-13 text-neon-cyan/13 group-hover:text-neon-cyan/21 transition-all">
            <Cpu className="w-34 h-34" />
          </div>
          <p className="text-[9px] caps-modern text-parchment/55 tracking-wider">ACTIVE INTEL SQUAD</p>
          <h3 className="text-34 font-display font-medium text-neon-cyan mt-5 drop-shadow-[0_0_5px_rgba(0,230,118,0.3)]">12 Agents</h3>
          <p className="text-[10px] text-parchment/34 mt-5">Numbered dynamically Agent 01-12</p>
        </div>

        <div className="glass-panel p-21 border border-neon-blue/21 rounded-13 relative group overflow-hidden">
          <div className="absolute top-0 right-0 p-13 text-neon-blue/13 group-hover:text-neon-blue/21 transition-all">
            <Database className="w-34 h-34" />
          </div>
          <p className="text-[9px] caps-modern text-parchment/55 tracking-wider">DECOUPLED SUBJECTS</p>
          <h3 className="text-34 font-display font-medium text-neon-blue mt-5 drop-shadow-[0_0_5px_rgba(0,184,212,0.3)]">12 Blocks</h3>
          <p className="text-[10px] text-parchment/34 mt-5">Categorised modular subtopics</p>
        </div>

        <div className="glass-panel p-21 border border-neon-magenta/21 rounded-13 relative group overflow-hidden">
          <div className="absolute top-0 right-0 p-13 text-neon-magenta/13 group-hover:text-neon-magenta/21 transition-all">
            <Clock className="w-34 h-34" />
          </div>
          <p className="text-[9px] caps-modern text-parchment/55 tracking-wider">NEXT SHIFT ROTATION</p>
          <h3 className="text-34 font-mono font-medium text-neon-magenta mt-5 drop-shadow-[0_0_5px_rgba(255,0,255,0.3)]">{countdown || "Calculating..."}</h3>
          <p className="text-[10px] text-parchment/34 mt-5">Synchronized 24-hour UTC epoch shift</p>
        </div>

        <div className="glass-panel p-21 border border-parchment/21 rounded-13 relative group overflow-hidden">
          <div className="absolute top-0 right-0 p-13 text-parchment/13 group-hover:text-parchment/21 transition-all">
            <CheckCircle2 className="w-34 h-34" />
          </div>
          <p className="text-[9px] caps-modern text-parchment/55 tracking-wider">MEMORY COGNITION</p>
          <h3 className="text-34 font-display font-medium text-parchment mt-5">Clean Slate</h3>
          <p className="text-[10px] text-green-400 mt-5 flex items-center gap-5">
            <span className="w-5 h-5 rounded-full bg-green-400 animate-ping inline-block" />
            Sterile Isolation Verified
          </p>
        </div>
      </div>

      {/* Conceptual System Lock Information Callout */}
      <div className="glass-panel p-21 border border-neon-cyan/13 rounded-13 bg-neon-cyan/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-13">
        <div className="space-y-5">
          <h4 className="text-13 caps-modern font-bold text-neon-cyan uppercase">Neural Efficiency Protocol Active</h4>
          <p className="text-[10px] text-parchment/73 leading-relaxed max-w-3xl">
            To combat agent mental fatigue and performance decay from repetitive scope isolation, agents have been assigned sequential identifier codes (**Agent 01 - Agent 12**) and rotated deterministically across 12 sequential **Subtopic Blocks** every 24 hours. Prior to taking new assignments, parent nodes enforce a **hard neural memory sterilization**, committing all generated intelligence to the subtopic block permanently, allowing each agent to begin the day with a pristine clean slate.
          </p>
        </div>
        <div className="flex items-center gap-8 bg-void/55 border border-neon-cyan/21 rounded-8 px-13 py-8">
          <Shield className="w-13 h-13 text-neon-cyan animate-pulse" />
          <span className="text-[9px] font-mono text-neon-cyan font-bold tracking-widest uppercase">CORRUPT_NOT_PERMITTED</span>
        </div>
      </div>

      {/* Active Shift Allocation Visual Map */}
      <div className="glass-panel p-21 rounded-13 border-neon-cyan/13">
        <div className="flex items-center justify-between mb-21 border-b border-neon-cyan/21 pb-13">
          <div className="flex items-center gap-8 text-neon-cyan">
            <Zap className="w-21 h-21 text-neon-cyan drop-shadow-[0_0_5px_rgba(0,230,118,0.5)]" />
            <h3 className="text-13 font-bold uppercase tracking-widest">Active 24-Hour Roster Assignment</h3>
          </div>
          <span className="text-[9px] font-mono text-parchment/34">
            Day Offset: {rotation.dayOffset}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-13">
          {rotation.blockToAgent.map((item, index) => {
            return (
              <div 
                key={item.block.id} 
                className="p-13 bg-void/55 border border-white/5 hover:border-neon-cyan/34 rounded-13 transition-all space-y-13 group relative overflow-hidden"
              >
                {/* Visual glow on active cell */}
                <div className="absolute -inset-y-10 left-0 w-2 bg-gradient-to-b from-neon-cyan to-neon-blue opacity-55" />
                
                <div className="flex justify-between items-start pl-8">
                  <span className="text-[9px] font-mono text-parchment/34 group-hover:text-neon-cyan transition-colors font-bold">
                    {item.block.blockNumber}
                  </span>
                  <span className="text-[8px] bg-green-500/10 border border-green-500/30 text-green-400 px-8 py-2 rounded-full font-mono scale-90 origin-right">
                    STERILITY VERIFIED
                  </span>
                </div>

                <div className="pl-8">
                  <h4 className="text-13 font-bold text-parchment leading-tight group-hover:text-neon-cyan transition-colors">
                    {item.block.name}
                  </h4>
                  <p className="text-[9px] text-parchment/55 mt-5 truncate">
                    {item.block.prompt}
                  </p>
                </div>

                <div className="bg-white/5 rounded-8 p-8 flex items-center justify-between mx-8">
                  <div>
                    <span className="text-[8px] uppercase tracking-wider text-neon-blue font-bold block">ASSIGNED SQUAD MEMBER</span>
                    <span className="text-13 font-display font-medium text-neon-cyan drop-shadow-[0_0_2px_rgba(0,230,118,0.2)]">
                      {item.agent.agentNumber}
                    </span>
                    <span className="text-[10px] text-parchment/55 ml-5 font-mono">
                      ({item.agent.codeName})
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Structured Permanent Ledger List - Real DB items */}
      <div className="glass-panel p-21 rounded-13 border-neon-cyan/13">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-13 mb-21 border-b border-neon-cyan/21 pb-13">
          <div className="flex items-center gap-8 text-neon-cyan">
            <Database className="w-21 h-21 text-neon-blue drop-shadow-[0_0_5px_rgba(0,184,212,0.5)]" />
            <div>
              <h3 className="text-13 font-bold uppercase tracking-widest">Permanent Subtopic Archives</h3>
              <p className="text-[8px] text-parchment/55">Historical trace records from memory-wipe allocations</p>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-8">
            <div className="flex items-center gap-5 bg-void/55 border border-white/5 rounded-8 px-8 py-5">
              <Sliders className="w-13 h-13 text-parchment/34" />
              <select 
                value={selectedBlockFilter}
                onChange={(e) => setSelectedBlockFilter(e.target.value)}
                className="bg-transparent border-none text-[10px] text-parchment focus:outline-none focus:ring-0 cursor-pointer"
              >
                <option value="all" className="bg-void text-parchment">All Blocks</option>
                {SUBTOPIC_BLOCKS.map(b => (
                  <option key={b.id} value={b.blockNumber} className="bg-void text-parchment">{b.blockNumber} - {b.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-5 bg-void/55 border border-white/5 rounded-8 px-8 py-5">
              <Cpu className="w-13 h-13 text-parchment/34" />
              <select 
                value={selectedAgentFilter}
                onChange={(e) => setSelectedAgentFilter(e.target.value)}
                className="bg-transparent border-none text-[10px] text-parchment focus:outline-none focus:ring-0 cursor-pointer"
              >
                <option value="all" className="bg-void text-parchment">All Agents</option>
                {AGENTS.map(a => (
                  <option key={a.agentNumber} value={a.agentNumber} className="bg-void text-parchment">{a.agentNumber} ({a.codeName})</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Ledger logs viewport */}
        <div className="max-h-[500px] overflow-y-auto silk-scroll pr-8 space-y-8">
          {loading ? (
            <div className="py-55 text-center text-[10px] text-parchment/34 caps-modern">
              <RefreshCw className="w-21 h-21 animate-spin text-neon-cyan mx-auto mb-13" />
              Retrieving absolute cryptographic ledger stream...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-55 text-center text-[10px] text-parchment/34 caps-modern border border-dashed border-white/5 rounded-13">
              No archived data blocks recorded in Firestore under select filter query.
              <br />
              <span className="text-neon-cyan text-[8px] font-bold mt-8 block">WAITING FOR NEXT SYSTEM-AGENTS CYCLE SEQUENCE</span>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div 
                key={log.id} 
                className="p-13 bg-void/34 border border-white/5 rounded-8 hover:border-white/13 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-13"
              >
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center gap-8 font-mono text-[9px]">
                    <span className="px-8 py-2 bg-neon-cyan/13 text-neon-cyan border border-neon-cyan/21 rounded font-bold">
                      {log.blockNumber || "BLOCK_N"}
                    </span>
                    <span className="text-parchment">
                      {log.blockName || "General intelligence"}
                    </span>
                    <span className="text-parchment/34">|</span>
                    <span className="text-[10px] text-neon-blue font-bold font-display">
                      {log.agentNumber} ({log.agentCodeName || "Unit"})
                    </span>
                    <span className="text-parchment/34">•</span>
                    <span className="px-8 py-2 bg-green-500/10 text-green-400 border border-green-500/20 rounded text-[8px] font-bold">
                      COGNITIVE FRESH
                    </span>
                  </div>

                  <p className="text-[11px] text-parchment/89 leading-normal">
                    {log.phase === "Summarizer" ? (
                      <span className="text-neon-cyan font-bold mr-5">[INSIGHTS SUMMARIZED]:</span>
                    ) : (
                      <span className="text-parchment/55 mr-5">[{log.phase} INPUT]:</span>
                    )}
                    {(() => {
                      let resolvedData = log.data;
                      if (typeof resolvedData === 'string') {
                        const trimmed = resolvedData.trim();
                        if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
                          try {
                            resolvedData = JSON.parse(trimmed);
                          } catch (e) {
                            // Keep as original string
                          }
                        }
                      }

                      if (Array.isArray(resolvedData)) {
                        return resolvedData.map((item: any, idx: number) => (
                          <span key={idx} className="block mt-8 p-10 bg-void/55 border border-white/8 rounded-8 font-mono text-[10px] whitespace-pre-wrap text-parchment/89">
                            {item.domain && (
                              <span className="text-neon-cyan font-bold block mb-3 uppercase tracking-wider text-[8px]">
                                📌 DOMAIN: {item.domain}
                              </span>
                            )}
                            <span className="block leading-normal text-parchment/80">{item.content || item.insight || (typeof item === 'string' ? item : JSON.stringify(item))}</span>
                            {item.source && (
                              <span className="text-parchment/40 text-[9px] mt-5 block border-t border-white/5 pt-3">
                                <span className="text-neon-magenta/55 font-bold uppercase mr-3">Source:</span> {item.source}
                              </span>
                            )}
                            {item.confidenceScore && (
                              <span className="text-green-400 font-bold text-[9px] mt-3 block">
                                🛡️ Confidence Index: {item.confidenceScore}%
                              </span>
                            )}
                            {item.enrichedContext && (
                              <span className="text-parchment/55 text-[9px] mt-3 block italic whitespace-pre-wrap border-t border-white/5 pt-5 leading-relaxed">
                                Context Enrichment: {item.enrichedContext}
                              </span>
                            )}
                          </span>
                        ));
                      } else if (resolvedData && typeof resolvedData === 'object') {
                        return (
                          <pre className="font-mono text-[10px] bg-void/55 p-8 rounded block overflow-x-auto text-parchment/55 mt-5">
                            {JSON.stringify(resolvedData, null, 2)}
                          </pre>
                        );
                      } else {
                        return (
                          <span className="font-mono text-[10px] text-parchment/89 bg-void/55 p-8 rounded block border border-white/5 mt-5 whitespace-pre-wrap leading-relaxed">
                            {String(resolvedData)}
                          </span>
                        );
                      }
                    })()}
                  </p>
                </div>

                <div className="text-right flex flex-row md:flex-col items-center md:items-end justify-between w-full md:w-auto font-mono text-[9px] text-parchment/34 mt-8 md:mt-0">
                  <span className="bg-void px-8 py-2 border border-white/5 rounded">
                    {log.phase || "EXEC"}
                  </span>
                  <span className="mt-5 block text-[8px]">
                    {log.timestamp ? new Date(log.timestamp).toLocaleString() : "just now"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
