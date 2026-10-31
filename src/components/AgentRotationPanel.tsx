import { useState, useEffect } from "react";
import type { User } from "firebase/auth";
import {
  RefreshCw,
  Database,
  Cpu,
  Clock,
  Sliders,
  Zap,
  ExternalLink,
  ListChecks
} from "lucide-react";
import { db, toDate, useAuthUser } from "../lib/firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { SUBTOPIC_BLOCKS, AGENTS, getAgentRotation } from "../lib/agentRoster";

interface AgentRotationPanelProps {
  user?: User | null;
  language?: string;
  isAdmin?: boolean;
}

interface LedgerItem {
  headline?: string;
  whatHappened?: string;
  country?: string;
  verdict?: string;
  verificationNote?: string;
  impact?: string;
  severity?: string;
  sources: { title: string; url: string }[];
}

interface LedgerEntry {
  id: string;
  agentNumber?: string;
  agentCodeName?: string;
  blockNumber?: string;
  blockId?: string;
  blockName?: string;
  phase?: string;
  items: LedgerItem[];
  rawText?: string;
  time: Date | null;
}

const PHASE_LABEL: Record<string, string> = {
  Collector: "Collected",
  Validator: "Independently verified",
  Summarizer: "Explained & published",
};

const safeUrl = (u: unknown): string | null =>
  typeof u === "string" && /^https?:\/\//i.test(u) ? u : null;

/** Normalises one agent_block_ledger document (data may be an array, object or JSON string). */
function toEntry(id: string, raw: Record<string, any>): LedgerEntry {
  let data: unknown = raw.data;
  let rawText: string | undefined;
  if (typeof data === "string") {
    const t = data.trim();
    try {
      data = t.startsWith("[") || t.startsWith("{") ? JSON.parse(t) : t;
    } catch {
      data = t;
    }
    if (typeof data === "string") rawText = data;
  }
  const list = Array.isArray(data) ? data : data && typeof data === "object" ? [data] : [];
  const items: LedgerItem[] = list
    .filter((x): x is Record<string, any> => !!x && typeof x === "object")
    .map((x) => ({
      headline: typeof x.headline === "string" ? x.headline : undefined,
      whatHappened: typeof x.whatHappened === "string" ? x.whatHappened : undefined,
      country: typeof x.country === "string" ? x.country : undefined,
      verdict: typeof x.verdict === "string" ? x.verdict : undefined,
      verificationNote: typeof x.verificationNote === "string" ? x.verificationNote : undefined,
      impact: typeof x.impact === "string" ? x.impact : undefined,
      severity: typeof x.severity === "string" ? x.severity : undefined,
      sources: (Array.isArray(x.sources) ? x.sources : [])
        .map((s: any) => ({ url: safeUrl(s?.url), title: typeof s?.title === "string" && s.title ? s.title : String(s?.url || "") }))
        .filter((s: { url: string | null }): s is { url: string; title: string } => !!s.url),
    }));
  return {
    id,
    agentNumber: raw.agentNumber,
    agentCodeName: raw.agentCodeName,
    blockNumber: raw.blockNumber,
    blockId: raw.blockId,
    blockName: raw.blockName,
    phase: raw.phase,
    items,
    rawText,
    time: toDate(raw.timestamp),
  };
}

export default function AgentRotationPanel({ user: userProp }: AgentRotationPanelProps = {}) {
  const user = useAuthUser(userProp);
  const [logs, setLogs] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedBlockFilter, setSelectedBlockFilter] = useState("all");
  const [selectedAgentFilter, setSelectedAgentFilter] = useState("all");
  const [countdown, setCountdown] = useState("");
  const [rotation, setRotation] = useState(() => getAgentRotation());

  // Countdown to the next rotation (UTC midnight)
  useEffect(() => {
    const updateRotationAndTimer = () => {
      setRotation(getAgentRotation());

      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setUTCHours(24, 0, 0, 0);
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

  // Live feed of the agents' work log (agent_block_ledger, server-written). Needs sign-in.
  const uid = user?.uid;
  useEffect(() => {
    if (!uid) {
      setLogs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    const q = query(collection(db, "agent_block_ledger"), orderBy("timestamp", "desc"), limit(100));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setLogs(snapshot.docs.map((d) => toEntry(d.id, d.data())));
        setLoading(false);
      },
      (err) => {
        console.error("[AgentRotationPanel] agent_block_ledger:", err);
        setLoadError("Could not load the agents' work log. Please try again later.");
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [uid]);

  const filteredLogs = logs.filter((log) => {
    const blockMatch = selectedBlockFilter === "all" || log.blockNumber === selectedBlockFilter || log.blockId === selectedBlockFilter;
    const agentMatch = selectedAgentFilter === "all" || log.agentNumber === selectedAgentFilter;
    return blockMatch && agentMatch;
  });

  // Latest run per block: item counts of the most recent Collector/Validator/Summarizer entries.
  const lastRunByBlock = new Map<string, { Collector?: number; Validator?: number; Summarizer?: number; time: Date | null }>();
  for (const log of logs) {
    if (!log.blockId || !log.phase) continue;
    const cur = lastRunByBlock.get(log.blockId) || { time: log.time };
    const phase = log.phase as "Collector" | "Validator" | "Summarizer";
    if (cur[phase] === undefined && (phase === "Collector" || phase === "Validator" || phase === "Summarizer")) {
      cur[phase] = log.items.length;
    }
    lastRunByBlock.set(log.blockId, cur);
  }
  const lastActivity = logs.length ? logs[0].time : null;
  const publishedCount = logs.filter((l) => l.phase === "Summarizer").reduce((n, l) => n + l.items.length, 0);

  return (
    <div id="neural-rotation-panel" className="space-y-34">
      {/* Header metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-21">
        <div className="glass-panel p-21 border border-neon-cyan/21 rounded-13 relative group overflow-hidden">
          <div className="absolute top-0 right-0 p-13 text-neon-cyan/13 group-hover:text-neon-cyan/21 transition-all">
            <Cpu className="w-34 h-34" />
          </div>
          <p className="text-[9px] caps-modern text-parchment/55 tracking-wider">AI AGENTS</p>
          <h3 className="text-34 font-display font-medium text-neon-cyan mt-5 drop-shadow-[0_0_5px_rgba(0,230,118,0.3)]">{AGENTS.length} Agents</h3>
          <p className="text-[10px] text-parchment/34 mt-5">Agent 01–{String(AGENTS.length).padStart(2, "0")}, rotating daily</p>
        </div>

        <div className="glass-panel p-21 border border-neon-blue/21 rounded-13 relative group overflow-hidden">
          <div className="absolute top-0 right-0 p-13 text-neon-blue/13 group-hover:text-neon-blue/21 transition-all">
            <Database className="w-34 h-34" />
          </div>
          <p className="text-[9px] caps-modern text-parchment/55 tracking-wider">WATCH-DESKS</p>
          <h3 className="text-34 font-display font-medium text-neon-blue mt-5 drop-shadow-[0_0_5px_rgba(0,184,212,0.3)]">{SUBTOPIC_BLOCKS.length} Blocks</h3>
          <p className="text-[10px] text-parchment/34 mt-5">Ways ordinary people get cheated</p>
        </div>

        <div className="glass-panel p-21 border border-neon-magenta/21 rounded-13 relative group overflow-hidden">
          <div className="absolute top-0 right-0 p-13 text-neon-magenta/13 group-hover:text-neon-magenta/21 transition-all">
            <Clock className="w-34 h-34" />
          </div>
          <p className="text-[9px] caps-modern text-parchment/55 tracking-wider">NEXT ROTATION</p>
          <h3 className="text-34 font-mono font-medium text-neon-magenta mt-5 drop-shadow-[0_0_5px_rgba(255,0,255,0.3)]">{countdown || "--:--:--"}</h3>
          <p className="text-[10px] text-parchment/34 mt-5">Agents switch desks at 00:00 UTC</p>
        </div>

        <div className="glass-panel p-21 border border-parchment/21 rounded-13 relative group overflow-hidden">
          <div className="absolute top-0 right-0 p-13 text-parchment/13 group-hover:text-parchment/21 transition-all">
            <ListChecks className="w-34 h-34" />
          </div>
          <p className="text-[9px] caps-modern text-parchment/55 tracking-wider">PUBLISHED (LAST 100 LOG ENTRIES)</p>
          <h3 className="text-34 font-display font-medium text-parchment mt-5">{user ? publishedCount : "—"}</h3>
          <p className="text-[10px] text-parchment/34 mt-5">
            {!user ? "Sign in to see the work log" : lastActivity ? `Last activity: ${lastActivity.toLocaleString(undefined)}` : "No agent activity recorded yet"}
          </p>
        </div>
      </div>

      {/* How it works (plain description) */}
      <div className="glass-panel p-21 border border-neon-cyan/13 rounded-13 bg-neon-cyan/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-13">
        <div className="space-y-5">
          <h4 className="text-13 caps-modern font-bold text-neon-cyan uppercase">How the agents work</h4>
          <p className="text-[10px] text-parchment/73 leading-relaxed max-w-3xl">
            Each of the 12 agents covers one watch-desk per day and moves to the next desk every 24 hours. Every run has three steps: a <strong>Collector</strong> searches the web for recent reports, a <strong>Validator</strong> runs a second, independent search to check them, and a <strong>Summarizer</strong> explains the confirmed ones in plain words. Only items that pass verification are published. The log below shows each step with its real item counts and source links. Everything here is AI-generated — check the sources.
          </p>
        </div>
      </div>

      {/* Today's roster */}
      <div className="glass-panel p-21 rounded-13 border-neon-cyan/13">
        <div className="flex items-center justify-between mb-21 border-b border-neon-cyan/21 pb-13">
          <div className="flex items-center gap-8 text-neon-cyan">
            <Zap className="w-21 h-21 text-neon-cyan drop-shadow-[0_0_5px_rgba(0,230,118,0.5)]" />
            <h3 className="text-13 font-bold uppercase tracking-widest">Today's Roster</h3>
          </div>
          <span className="text-[9px] font-mono text-parchment/34">
            Rotation day #{rotation.dayOffset}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-13">
          {rotation.blockToAgent.map((item) => {
            const run = lastRunByBlock.get(item.block.id);
            return (
              <div
                key={item.block.id}
                className="p-13 bg-void/55 border border-white/5 hover:border-neon-cyan/34 rounded-13 transition-all space-y-13 group relative overflow-hidden"
              >
                <div className="absolute -inset-y-10 left-0 w-2 bg-gradient-to-b from-neon-cyan to-neon-blue opacity-55" />

                <div className="flex justify-between items-start pl-8">
                  <span className="text-[9px] font-mono text-parchment/34 group-hover:text-neon-cyan transition-colors font-bold">
                    {item.block.blockNumber}
                  </span>
                  {run && (
                    <span className="text-[8px] bg-white/5 border border-white/10 text-parchment/55 px-8 py-2 rounded-full font-mono scale-90 origin-right" title="Items in the latest logged run: collected / verified / published">
                      {run.Collector ?? "–"} / {run.Validator ?? "–"} / {run.Summarizer ?? "–"}
                    </span>
                  )}
                </div>

                <div className="pl-8">
                  <h4 className="text-13 font-bold text-parchment leading-tight group-hover:text-neon-cyan transition-colors">
                    {item.block.name}
                  </h4>
                  <p className="text-[9px] text-parchment/55 mt-5 line-clamp-2" title={item.block.focus}>
                    {item.block.focus}
                  </p>
                </div>

                <div className="bg-white/5 rounded-8 p-8 flex items-center justify-between mx-8">
                  <div>
                    <span className="text-[8px] uppercase tracking-wider text-neon-blue font-bold block">ASSIGNED AGENT</span>
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

      {/* Work log - real Firestore entries */}
      <div className="glass-panel p-21 rounded-13 border-neon-cyan/13">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-13 mb-21 border-b border-neon-cyan/21 pb-13">
          <div className="flex items-center gap-8 text-neon-cyan">
            <Database className="w-21 h-21 text-neon-blue drop-shadow-[0_0_5px_rgba(0,184,212,0.5)]" />
            <div>
              <h3 className="text-13 font-bold uppercase tracking-widest">Agent Work Log</h3>
              <p className="text-[8px] text-parchment/55">Latest 100 steps written by the server · AI-generated, check the sources</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-8">
            <div className="flex items-center gap-5 bg-void/55 border border-white/5 rounded-8 px-8 py-5">
              <Sliders className="w-13 h-13 text-parchment/34" />
              <select
                value={selectedBlockFilter}
                onChange={(e) => setSelectedBlockFilter(e.target.value)}
                className="bg-transparent border-none text-[10px] text-parchment focus:outline-none focus:ring-0 cursor-pointer"
              >
                <option value="all" className="bg-void text-parchment">All Blocks</option>
                {SUBTOPIC_BLOCKS.map((b) => (
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
                {AGENTS.map((a) => (
                  <option key={a.agentNumber} value={a.agentNumber} className="bg-void text-parchment">{a.agentNumber} ({a.codeName})</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="max-h-[500px] overflow-y-auto silk-scroll pr-8 space-y-8">
          {!user ? (
            <div className="py-55 text-center text-[10px] text-parchment/34 caps-modern border border-dashed border-white/5 rounded-13">
              Sign in to see the agents' work log.
            </div>
          ) : loading ? (
            <div className="py-55 text-center text-[10px] text-parchment/34 caps-modern">
              <RefreshCw className="w-21 h-21 animate-spin text-neon-cyan mx-auto mb-13" />
              Loading the work log...
            </div>
          ) : loadError ? (
            <div className="py-55 text-center text-[10px] text-cyber-red caps-modern border border-dashed border-cyber-red/34 rounded-13">
              {loadError}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-55 text-center text-[10px] text-parchment/34 caps-modern border border-dashed border-white/5 rounded-13">
              No log entries for this filter yet.
              <br />
              <span className="text-neon-cyan text-[8px] font-bold mt-8 block">New entries appear after the next agent run</span>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-13 bg-void/34 border border-white/5 rounded-8 hover:border-white/13 transition-all flex flex-col md:flex-row items-start justify-between gap-13"
              >
                <div className="space-y-5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-8 font-mono text-[9px]">
                    <span className="px-8 py-2 bg-neon-cyan/13 text-neon-cyan border border-neon-cyan/21 rounded font-bold">
                      {log.blockNumber || "Block"}
                    </span>
                    <span className="text-parchment">{log.blockName || "Unknown desk"}</span>
                    <span className="text-parchment/34">|</span>
                    <span className="text-[10px] text-neon-blue font-bold font-display">
                      {log.agentNumber || "Agent"} {log.agentCodeName ? `(${log.agentCodeName})` : ""}
                    </span>
                  </div>

                  <div className="text-[11px] text-parchment/89 leading-normal">
                    <span className={log.phase === "Summarizer" ? "text-neon-cyan font-bold mr-5" : "text-parchment/55 mr-5"}>
                      [{(log.phase && PHASE_LABEL[log.phase]) || log.phase || "Step"}: {log.items.length} item{log.items.length === 1 ? "" : "s"}]
                    </span>
                    {log.rawText && (
                      <span className="font-mono text-[10px] text-parchment/89 bg-void/55 p-8 rounded block border border-white/5 mt-5 whitespace-pre-wrap leading-relaxed">
                        {log.rawText}
                      </span>
                    )}
                    {log.items.map((item, idx) => (
                      <span key={idx} className="block mt-8 p-10 bg-void/55 border border-white/8 rounded-8 text-[10px] text-parchment/89">
                        <span className="flex flex-wrap items-center gap-5 mb-3">
                          {item.severity && (
                            <span className="text-[8px] uppercase font-bold text-neon-magenta border border-neon-magenta/34 rounded px-5">{item.severity}</span>
                          )}
                          {item.verdict && (
                            <span className="text-[8px] uppercase font-bold text-neon-cyan border border-neon-cyan/34 rounded px-5">{item.verdict}</span>
                          )}
                          {item.country && <span className="text-[8px] uppercase text-parchment/40">{item.country}</span>}
                        </span>
                        <span className="block font-bold text-parchment leading-snug">{item.headline || "(no headline)"}</span>
                        {(item.impact || item.whatHappened) && (
                          <span className="block leading-normal text-parchment/70 mt-3">{item.impact || item.whatHappened}</span>
                        )}
                        {item.verificationNote && (
                          <span className="block text-parchment/45 italic mt-3">Check note: {item.verificationNote}</span>
                        )}
                        {item.sources.length > 0 && (
                          <span className="block text-[9px] mt-5 border-t border-white/5 pt-3 space-y-2">
                            <span className="text-neon-magenta/70 font-bold uppercase mr-3">Sources:</span>
                            {item.sources.map((s, i) => (
                              <a
                                key={i}
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer nofollow"
                                className="inline-flex items-center gap-3 text-neon-cyan/80 hover:text-neon-cyan underline mr-8 break-all"
                              >
                                {s.title}
                                <ExternalLink className="w-8 h-8 shrink-0" />
                              </a>
                            ))}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="text-right flex flex-row md:flex-col items-center md:items-end justify-between w-full md:w-auto font-mono text-[9px] text-parchment/34 mt-8 md:mt-0 shrink-0">
                  <span className="bg-void px-8 py-2 border border-white/5 rounded">{log.phase || "Step"}</span>
                  <span className="mt-5 block text-[8px]">{log.time ? log.time.toLocaleString(undefined) : "time unknown"}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
