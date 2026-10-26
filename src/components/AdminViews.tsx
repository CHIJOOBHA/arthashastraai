import { useMemo } from 'react';
import type { User } from 'firebase/auth';
import { Activity, AlertTriangle, Blocks, CheckCircle2, Clock, Loader2, Play, Shield, TrendingUp, Users, XCircle, Zap } from 'lucide-react';
import { ArthashastraSymbol } from './ArthashastraSymbol';
import { ErrorBoundary } from './ErrorBoundary';
import AgentRotationPanel from './AgentRotationPanel';
import { IntelList, formatWhen, type IntelItem } from './IntelFeed';
import { getAgentRotation } from '../lib/agentRoster';
import { toDate, type AgentLog } from '../lib/firebase';
import type { Health } from '../lib/api';
import { fmt, type Translation } from '../translations';

export interface LedgerEntry {
  id: string;
  index?: number;
  timestamp?: unknown;
  data?: unknown;
  hash?: string;
  previousHash?: string;
  agentId?: string;
  role?: string;
}

/** Latest log line for an agent; log names look like "Agent 01 (Chanakya-01)". */
function lastLogFor(logs: AgentLog[], codeName: string): AgentLog | undefined {
  const key = codeName.toLowerCase();
  return logs.find((l) => typeof l.agentName === 'string' && l.agentName.toLowerCase().includes(key));
}

function StatusDot({ status }: { status?: string }) {
  const cls =
    status === 'success'
      ? 'bg-neon-green shadow-[0_0_5px_#39FF14]'
      : status === 'error'
        ? 'bg-cyber-red shadow-[0_0_5px_#FF2A2A]'
        : status
          ? 'bg-amber-400'
          : 'bg-neon-cyan/21';
  return <span className={`inline-block w-5 h-5 rounded-full shrink-0 ${cls}`} title={status || ''} aria-label={status || 'no activity'} />;
}

/** Admin-only server health panel: shows only what is missing, never debug internals. */
export function HealthPanel({ health, t }: { health: Health | null; t: Translation }) {
  if (!health) return null;
  const rows = [
    { label: t.healthAi, ok: health.geminiConfigured },
    { label: t.healthDb, ok: health.firestoreReady },
    { label: t.healthPayments, ok: health.paymentsConfigured },
  ];
  return (
    <div className="glass-panel p-21 rounded-13 border-neon-cyan/13">
      <h3 className="text-13 caps-modern text-neon-cyan mb-13 flex items-center gap-8 border-b border-neon-cyan/13 pb-8">
        <Shield className="w-13 h-13" aria-hidden />
        {t.healthTitle}
      </h3>
      <ul className="space-y-8">
        {rows.map((r) => (
          <li key={r.label} className="flex justify-between items-center bg-void/55 p-8 rounded border border-neon-cyan/13 text-[11px]">
            <span className="text-parchment/80">{r.label}</span>
            <span className={`inline-flex items-center gap-5 font-bold ${r.ok ? 'text-neon-green' : 'text-cyber-red'}`}>
              {r.ok ? <CheckCircle2 className="w-13 h-13" aria-hidden /> : <XCircle className="w-13 h-13" aria-hidden />}
              {r.ok ? t.healthOk : t.healthMissing}
            </span>
          </li>
        ))}
      </ul>
      {health.missingKeys.length > 0 && (
        <p className="mt-13 text-[11px] text-cyber-red/89 font-mono break-words">
          {t.healthMissingKeys} {health.missingKeys.join(', ')}
        </p>
      )}
    </div>
  );
}

export function HealthBanner({ health, t }: { health: Health | null; t: Translation }) {
  if (!health || health.status === 'active') return null;
  const bad = health.status === 'unconfigured';
  return (
    <div
      role="status"
      className={`mb-21 glass-panel p-13 border rounded-13 flex items-start gap-13 ${bad ? 'border-cyber-red/34 bg-cyber-red/5' : 'border-amber-500/34 bg-amber-500/5'}`}
    >
      <AlertTriangle className={`w-21 h-21 shrink-0 ${bad ? 'text-cyber-red' : 'text-amber-500'}`} aria-hidden />
      <div className="text-13">
        <p className={`font-bold ${bad ? 'text-cyber-red' : 'text-amber-500'}`}>{bad ? t.healthUnconfigured : t.healthWarn}</p>
        {health.missingKeys.length > 0 && (
          <p className="text-[11px] font-mono text-parchment/80 mt-3 break-words">
            {t.healthMissingKeys} {health.missingKeys.join(', ')}
          </p>
        )}
      </div>
    </div>
  );
}

function RunAgentsButton({ onRun, running, t }: { onRun: () => void; running: boolean; t: Translation }) {
  return (
    <button
      onClick={onRun}
      disabled={running}
      aria-busy={running}
      className="inline-flex items-center gap-8 px-13 py-8 bg-neon-magenta/13 border border-neon-magenta/55 text-neon-magenta rounded-8 text-[11px] font-bold uppercase tracking-widest hover:bg-neon-magenta/21 transition-colors disabled:opacity-55 disabled:cursor-wait"
    >
      {running ? <Loader2 className="w-13 h-13 animate-spin" aria-hidden /> : <Play className="w-13 h-13" aria-hidden />}
      {running ? t.runAgentsBusy : t.runAgents}
    </button>
  );
}

function AgentRoster({ logs, t, compact = false }: { logs: AgentLog[]; t: Translation; compact?: boolean }) {
  const rotation = useMemo(() => getAgentRotation().agentToBlock, []);
  return (
    <ul className={`space-y-5 ${compact ? '' : 'max-h-[377px] overflow-y-auto silk-scroll pr-8'}`}>
      {rotation.map(({ agent, block }) => {
        const last = lastLogFor(logs, agent.codeName);
        return (
          <li key={agent.agentNumber} className="flex items-center justify-between gap-8 p-8 bg-neon-cyan/5 rounded-5 border border-transparent hover:border-neon-cyan/34 transition-all">
            <div className="min-w-0">
              <p className="text-[11px] font-mono text-parchment/89 truncate">
                {agent.codeName} · <span className="text-parchment/55">{agent.role}</span>
              </p>
              <p className="text-[10px] text-neon-cyan/55 truncate">
                {block.blockNumber}: {block.name}
              </p>
              {!compact && (
                <p className="text-[10px] text-parchment/34 truncate">
                  {t.lastActivity}: {last ? `${formatWhen(last.timestamp)} — ${last.action}` : t.never}
                </p>
              )}
            </div>
            <StatusDot status={last?.status} />
          </li>
        );
      })}
    </ul>
  );
}

function FeedStats({ items, t }: { items: IntelItem[]; t: Translation }) {
  const bySeverity = useMemo(() => {
    const m: Record<string, number> = {};
    items.forEach((i) => {
      const s = typeof i.metadata?.severity === 'string' ? i.metadata.severity : '—';
      m[s] = (m[s] || 0) + 1;
    });
    return Object.entries(m);
  }, [items]);
  const byCategory = useMemo(() => {
    const m: Record<string, number> = {};
    items.forEach((i) => {
      const c = typeof i.metadata?.category === 'string' ? i.metadata.category : '—';
      m[c] = (m[c] || 0) + 1;
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [items]);

  return (
    <div className="glass-panel p-21 rounded-13 border-neon-magenta/34">
      <h3 className="text-13 caps-modern text-neon-magenta mb-13 flex items-center gap-8 border-b border-neon-magenta/13 pb-8">
        <TrendingUp className="w-13 h-13" aria-hidden />
        {t.feedStats}
      </h3>
      <p className="text-13 text-parchment/89 mb-13">
        {t.storiesLoaded}: <strong className="text-neon-cyan">{items.length}</strong>
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-13 text-[11px]">
        <div>
          <p className="uppercase tracking-widest text-parchment/55 mb-5 text-[10px]">{t.bySeverity}</p>
          <ul className="space-y-2">
            {bySeverity.map(([k, v]) => (
              <li key={k} className="flex justify-between gap-8">
                <span>{k}</span>
                <span className="font-mono text-neon-cyan">{v}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="uppercase tracking-widest text-parchment/55 mb-5 text-[10px]">{t.byCategory}</p>
          <ul className="space-y-2">
            {byCategory.map(([k, v]) => (
              <li key={k} className="flex justify-between gap-8">
                <span className="truncate">{k}</span>
                <span className="font-mono text-neon-cyan">{v}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

interface AdminProps {
  t: Translation;
  user: User;
  language: string;
  intelligence: IntelItem[];
  logs: AgentLog[];
  health: Health | null;
  onRunAgents: () => void;
  isRunningAgents: boolean;
  onOpenExplanation: (id: string) => void;
}

/** "Neural Brain": the live published feed plus real counts. */
export function BrainView({ t, intelligence, onOpenExplanation }: AdminProps) {
  return (
    <div className="py-55 space-y-34 flex flex-col items-center">
      <div className="text-center">
        <ArthashastraSymbol size={144} className="mx-auto drop-shadow-[0_0_34px_rgba(0,230,118,0.6)]" />
        <h2 className="mt-21 text-34 md:text-55 font-display font-bold text-neon-cyan uppercase tracking-tighter leading-none">{t.navBrain}</h2>
        <p className="text-[11px] text-parchment/55 mt-8">{t.feedSubtitle}</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-21 w-full">
        <div className="glass-panel p-21 rounded-13 border-neon-cyan/34 lg:col-span-2">
          <h3 className="text-13 caps-modern text-neon-cyan mb-13 flex items-center gap-8 border-b border-neon-cyan/13 pb-8">
            <Zap className="w-13 h-13" aria-hidden />
            {t.feedTitle}
          </h3>
          <div className="overflow-y-auto silk-scroll max-h-[610px] pr-8">
            <IntelList items={intelligence} t={t} onOpenExplanation={onOpenExplanation} max={10} />
          </div>
        </div>
        <div className="lg:col-span-2 space-y-21">
          <FeedStats items={intelligence} t={t} />
        </div>
      </div>
    </div>
  );
}

/** "System Status": real schedule, today's rotation and last activity per agent. */
export function RoutineView({ t, logs, onRunAgents, isRunningAgents }: AdminProps) {
  return (
    <div className="space-y-34 py-34">
      <div className="flex flex-wrap items-center justify-between gap-13">
        <div>
          <h2 className="text-34 font-display font-bold text-neon-cyan uppercase tracking-tighter leading-none">{t.navHealth}</h2>
          <p className="text-[11px] text-parchment/55 mt-8 flex items-center gap-8">
            <Clock className="w-13 h-13" aria-hidden />
            {t.schedule}
          </p>
        </div>
        <RunAgentsButton onRun={onRunAgents} running={isRunningAgents} t={t} />
      </div>
      <div className="glass-panel p-21 rounded-13 border-neon-cyan/13">
        <h3 className="text-13 caps-modern text-neon-cyan mb-13 border-b border-neon-cyan/13 pb-8 flex items-center gap-8">
          <Users className="w-13 h-13" aria-hidden />
          {t.todaysRotation}
        </h3>
        <AgentRoster logs={logs} t={t} />
      </div>
    </div>
  );
}

/** Admin command view: health, manual run, real activity log, recent stories, rotation panel. */
export function DashboardView(props: AdminProps) {
  const { t, logs, health, intelligence, onRunAgents, isRunningAgents, onOpenExplanation, user, language } = props;
  const recent = intelligence.filter((i) => !!toDate(i.timestamp)).slice(0, 8);
  return (
    <div className="space-y-34 py-34">
      <div className="flex flex-wrap items-center justify-between gap-13 p-13 bg-neon-cyan/13 border border-neon-cyan/55 rounded-13">
        <div>
          <h2 className="text-34 font-display font-bold text-neon-cyan uppercase tracking-tighter leading-none">{t.navDashboard}</h2>
          <p className="text-[11px] text-parchment/55 mt-5">{t.schedule}</p>
        </div>
        <RunAgentsButton onRun={onRunAgents} running={isRunningAgents} t={t} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-21">
        <div className="lg:col-span-2 glass-panel p-21 rounded-13 border-neon-cyan/13">
          <h3 className="text-13 font-bold uppercase tracking-widest text-neon-cyan mb-13 flex items-center gap-8">
            <Activity className="w-21 h-21" aria-hidden />
            {t.agentLogs}
          </h3>
          {logs.length === 0 ? (
            <p className="text-[11px] italic text-parchment/55 py-21">{t.agentLogsEmpty}</p>
          ) : (
            <ul className="space-y-5 text-[11px] max-h-[610px] overflow-y-auto silk-scroll pr-8">
              {logs.slice(0, 60).map((log) => (
                <li key={log.id} className="flex flex-wrap gap-8 py-5 border-b border-neon-cyan/13">
                  <span className="text-neon-cyan/55 font-mono shrink-0">{formatWhen(log.timestamp)}</span>
                  <span className="text-neon-cyan font-bold shrink-0">{log.agentName || '—'}</span>
                  <span className="text-parchment/89 flex-1 min-w-0 break-words">{log.action}</span>
                  <span className="inline-flex items-center gap-5 uppercase text-[9px] font-bold">
                    <StatusDot status={log.status} />
                    {log.status || ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-21">
          <HealthPanel health={health} t={t} />
          <div className="glass-panel p-21 rounded-13 border-neon-magenta/13">
            <h3 className="text-13 caps-modern text-neon-magenta mb-13 flex items-center gap-8 border-b border-neon-magenta/13 pb-8">
              <Blocks className="w-13 h-13" aria-hidden />
              {t.recentlyPublished}
            </h3>
            <div className="max-h-[400px] overflow-y-auto silk-scroll pr-5">
              <IntelList items={recent} t={t} onOpenExplanation={onOpenExplanation} />
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel p-21 rounded-13 border-neon-cyan/13">
        <h3 className="text-13 caps-modern text-neon-cyan mb-13 border-b border-neon-cyan/13 pb-8 flex items-center gap-8">
          <Users className="w-13 h-13" aria-hidden />
          {t.todaysRotation}
        </h3>
        <AgentRoster logs={logs} t={t} />
      </div>

      <ErrorBoundary>
        <AgentRotationPanel user={user} language={language} isAdmin />
      </ErrorBoundary>
    </div>
  );
}

/** Admin view of the server-written, hash-chained audit ledger. */
export function LedgerEntries({ ledger, t }: { ledger: LedgerEntry[]; t: Translation }) {
  if (ledger.length === 0) {
    return <div className="h-[300px] flex items-center justify-center opacity-55 italic text-neon-cyan">{t.ledgerEmpty}</div>;
  }
  return (
    <>
      {ledger.map((block) => {
        const data = typeof block.data === 'string' ? block.data : JSON.stringify(block.data ?? '', null, 2);
        return (
          <div key={block.id} className="p-21 glass-panel border border-neon-cyan/13 relative group hover:border-neon-cyan/34">
            <div className="flex flex-wrap items-start justify-between mb-13 gap-8">
              <div className="flex items-center gap-8 min-w-0">
                <span className="text-13 font-mono text-neon-cyan bg-neon-cyan/13 px-8 py-2 border border-neon-cyan/34">#{block.index ?? '?'}</span>
                <span className="text-[10px] uppercase tracking-widest text-parchment/55 truncate">
                  {block.agentId} · {block.role}
                </span>
              </div>
              <span className="text-[10px] font-mono text-neon-magenta/55">{formatWhen(block.timestamp)}</span>
            </div>
            <div className="text-13 leading-relaxed text-parchment/89 whitespace-pre-wrap break-words font-sans">{data}</div>
            <div className="mt-13 pt-13 border-t border-neon-cyan/8 flex flex-wrap items-center gap-21 text-[10px] font-mono text-parchment/34">
              <span title={block.hash}>
                <span className="text-neon-cyan">hash:</span> {block.hash?.slice(0, 16)}…
              </span>
              <span title={block.previousHash}>
                <span className="text-neon-cyan">prev:</span> {block.previousHash?.slice(0, 16)}…
              </span>
            </div>
          </div>
        );
      })}
    </>
  );
}

export const runAgentsMessage = (t: Translation, r: { ran: string[]; published: number; skipped?: string }) =>
  r.skipped ? r.skipped : fmt(t.runAgentsResult, { ran: r.ran.length ? r.ran.join(', ') : '—', published: r.published });

