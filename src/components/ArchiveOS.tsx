import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { User } from 'firebase/auth';
import {
  Database, Snowflake, RefreshCw, Newspaper, Settings, History,
  LayoutDashboard, Search, Calendar, AlertTriangle, Loader2, ChevronRight,
  MessageSquare, Trash2, X, CheckCircle2
} from 'lucide-react';
import { ArthashastraGazette } from './ArthashastraGazette';
import { TemporalMemoryChain } from './TemporalMemoryChain';
import { Markdown } from './Markdown';
import { toDate, useAuthUser } from '../lib/firebase';
import { Conversation, getConversations, getMessages } from '../lib/chatStore';
import { getPopulatedBlockDates } from '../lib/temporalStore';
import {
  getColdArchives,
  getAuditLogs,
  migrateToCold,
  rehydrateFromCold,
  deleteColdArchive,
  deleteAllMyConversations,
  parseArchivedMessages,
  logAudit,
  ColdArchive,
  AuditEntry,
} from '../lib/archiveStore';

interface ArchiveOSProps {
  onNavigateToChat?: (chatId: string) => void;
  user?: User | null;
  language?: string;
  isAdmin?: boolean;
}

type Tab = 'dashboard' | 'temporal' | 'chats' | 'gazette' | 'cold' | 'audit' | 'settings';

interface ReaderMessage {
  id: string;
  role: string;
  text: string;
  hash?: string;
  time: Date | null;
}

interface PendingAction {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  /** When set, the user must type this word to enable the confirm button. */
  typeToConfirm?: string;
  run: () => Promise<string>;
}

const errMsg = (e: unknown) => (e instanceof Error && e.message ? e.message : 'Something went wrong. Please try again.');
const pad = (n: number) => n.toString().padStart(2, '0');

/** "YYYY-MM-DD" -> local Date. */
const fromLocalDateString = (s: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

const itemDate = (item: Conversation | ColdArchive, cold: boolean): Date | null => {
  if (cold) {
    const a = item as ColdArchive;
    return fromLocalDateString(a.date) || toDate(a.migratedAt);
  }
  const c = item as Conversation;
  return toDate(c.lastMessageAt) || toDate(c.updatedAt);
};

const fmtDate = (d: Date | null, withTime = false) =>
  d
    ? withTime
      ? d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : '—';

const monthName = (month: string) => new Date(2000, Number(month) - 1, 1).toLocaleString(undefined, { month: 'long' });

export function ArchiveOS({ onNavigateToChat, user: userProp }: ArchiveOSProps) {
  const user = useAuthUser(userProp);
  const uid = user?.uid;

  const [activeTab, setActiveTab] = useState<Tab>('temporal');
  const [chats, setChats] = useState<Conversation[]>([]);
  const [coldArchives, setColdArchives] = useState<ColdArchive[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [calendarDays, setCalendarDays] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const [selectedItem, setSelectedItem] = useState<Conversation | ColdArchive | null>(null);
  const [selectedItemMessages, setSelectedItemMessages] = useState<ReaderMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [readerError, setReaderError] = useState<string | null>(null);

  const [pending, setPending] = useState<PendingAction | null>(null);
  const [confirmInput, setConfirmInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const loadAllData = useCallback(async () => {
    if (!uid) return;
    setIsLoading(true);
    const errors: string[] = [];
    const [c, cold, logs, days] = await Promise.allSettled([
      getConversations(),
      getColdArchives(),
      getAuditLogs(),
      getPopulatedBlockDates(),
    ]);
    if (c.status === 'fulfilled') setChats(c.value);
    else errors.push(`Conversations: ${errMsg(c.reason)}`);
    if (cold.status === 'fulfilled') setColdArchives(cold.value);
    else errors.push(`Cold storage: ${errMsg(cold.reason)}`);
    if (logs.status === 'fulfilled') setAuditLogs(logs.value);
    else errors.push(`Activity log: ${errMsg(logs.reason)}`);
    if (days.status === 'fulfilled') setCalendarDays(days.value.length);
    else errors.push(`Memory calendar: ${errMsg(days.reason)}`);
    setLoadErrors(errors);
    setIsLoading(false);
  }, [uid]);

  // Load once per signed-in user; refreshed explicitly after actions.
  useEffect(() => {
    if (!uid) {
      setChats([]);
      setColdArchives([]);
      setAuditLogs([]);
      setCalendarDays(null);
      return;
    }
    loadAllData();
  }, [uid, loadAllData]);

  // Reset navigation and search when switching tabs (no reload).
  useEffect(() => {
    setSelectedYear(null);
    setSelectedMonth(null);
    setSelectedDay(null);
    setSelectedItem(null);
    setSelectedItemMessages([]);
    setReaderError(null);
    setSearchQuery('');
  }, [activeTab]);

  const isCold = activeTab === 'cold';
  const list: (Conversation | ColdArchive)[] = isCold ? coldArchives : chats;

  const dateParts = (item: Conversation | ColdArchive) => {
    const d = itemDate(item, isCold);
    if (!d) return null;
    return { year: String(d.getFullYear()), month: pad(d.getMonth() + 1), day: pad(d.getDate()) };
  };

  const getTemporalTreeData = () => {
    const tree: { [year: string]: { [month: string]: Set<string> } } = {};
    list.forEach((item) => {
      const p = dateParts(item);
      if (!p) return;
      ((tree[p.year] ||= {})[p.month] ||= new Set()).add(p.day);
    });
    return tree;
  };

  const countItemsForTemporal = (year: string, month: string | null = null, day: string | null = null) =>
    list.filter((item) => {
      const p = dateParts(item);
      return !!p && p.year === year && (!month || p.month === month) && (!day || p.day === day);
    }).length;

  const getFilteredItems = () => {
    const q = searchQuery.toLowerCase();
    return list.filter((item) => {
      if (q && !(item.title || '').toLowerCase().includes(q) && !item.id.toLowerCase().includes(q)) return false;
      if (!selectedYear) return true;
      const p = dateParts(item);
      if (!p || p.year !== selectedYear) return false;
      if (selectedMonth && p.month !== selectedMonth) return false;
      if (selectedDay && p.day !== selectedDay) return false;
      return true;
    });
  };

  const handleSelectItem = async (item: Conversation | ColdArchive) => {
    setSelectedItem(item);
    setSelectedItemMessages([]);
    setReaderError(null);
    if (isCold) {
      const msgs = parseArchivedMessages(item as ColdArchive);
      if (!msgs.length && (item as ColdArchive).msgCount > 0) setReaderError('This archive could not be read.');
      setSelectedItemMessages(msgs.map((m) => ({ id: m.id, role: m.role, text: m.text, hash: m.hash, time: m.createdAt })));
      return;
    }
    setIsLoadingMessages(true);
    try {
      const msgs = await getMessages(item.id);
      setSelectedItemMessages(msgs.map((m) => ({ id: m.id, role: m.role, text: m.text, hash: m.hash, time: toDate(m.timestamp) })));
    } catch (err) {
      setReaderError(`Could not load messages: ${errMsg(err)}`);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const ask = (action: PendingAction) => {
    setConfirmInput('');
    setPending(action);
  };

  const runPending = async () => {
    if (!pending) return;
    setIsRunning(true);
    try {
      const msg = await pending.run();
      setNotice({ kind: 'ok', text: msg });
      setSelectedItem(null);
      setSelectedItemMessages([]);
      await loadAllData();
    } catch (e) {
      setNotice({ kind: 'error', text: errMsg(e) });
    } finally {
      setIsRunning(false);
      setPending(null);
    }
  };

  const handleMigrate = (chat: Conversation) =>
    ask({
      title: 'Move to cold storage?',
      body: `"${chat.title || 'Untitled conversation'}" will be copied into one archive document and then removed from your chat list. You can restore it later from Cold Storage.`,
      confirmLabel: 'MOVE TO COLD STORAGE',
      run: async () => {
        const a = await migrateToCold(chat.id);
        return `Archived "${a.title}" (${a.msgCount} messages).`;
      },
    });

  const handleRehydrate = (archive: ColdArchive) =>
    ask({
      title: 'Restore this conversation?',
      body: `"${archive.title}" will be put back in your chat list with its original times, and the archive will be removed.`,
      confirmLabel: 'RESTORE',
      run: async () => {
        await rehydrateFromCold(archive.id);
        setActiveTab('chats');
        return `Restored "${archive.title}".`;
      },
    });

  const handleDeleteArchive = (archive: ColdArchive) =>
    ask({
      title: 'Delete this archive?',
      body: `"${archive.title}" (${archive.msgCount} messages) will be permanently deleted. This cannot be undone.`,
      confirmLabel: 'DELETE PERMANENTLY',
      danger: true,
      run: async () => {
        await deleteColdArchive(archive.id, archive.title);
        return `Deleted archive "${archive.title}".`;
      },
    });

  const handleDeleteAllConversations = () =>
    ask({
      title: 'Delete all your conversations?',
      body: `All ${chats.length} conversation(s) in your chat list and their messages will be permanently deleted. Cold archives and memory-calendar days are not touched (delete those from "Your Data"). This cannot be undone.`,
      confirmLabel: 'DELETE ALL CONVERSATIONS',
      danger: true,
      typeToConfirm: 'DELETE',
      run: async () => {
        const r = await deleteAllMyConversations();
        await logAudit('DELETE_ALL_CONVERSATIONS', `Deleted ${r.conversations} conversations (${r.messages} messages).`);
        return `Deleted ${r.conversations} conversation(s) and ${r.messages} message(s).`;
      },
    });

  const archivedMessages = coldArchives.reduce((n, a) => n + (a.msgCount || 0), 0);

  const StatsCard = ({ title, value, icon: Icon, color }: { title: string; value: string | number; icon: typeof Database; color: string }) => (
    <div className="bg-void/40 border border-neon-cyan/10 p-21 rounded-13 flex flex-col items-center justify-center text-center">
      <Icon className={`w-34 h-34 mb-8 ${color}`} />
      <div className="text-34 font-display font-bold text-parchment leading-none mb-5">{value}</div>
      <div className="text-[10px] caps-modern text-parchment/34 tracking-widest">{title}</div>
    </div>
  );

  const TABS: { id: Tab; label: string; icon: typeof Database; color: string }[] = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, color: 'text-neon-cyan' },
    { id: 'temporal', label: 'Memory Calendar', icon: Database, color: 'text-neon-cyan' },
    { id: 'chats', label: 'Conversations', icon: MessageSquare, color: 'text-neon-magenta' },
    { id: 'gazette', label: 'Daily Gazette', icon: Newspaper, color: 'text-neon-cyan' },
    { id: 'cold', label: 'Cold Storage', icon: Snowflake, color: 'text-neon-blue' },
    { id: 'audit', label: 'Activity Log', icon: History, color: 'text-parchment/55' },
    { id: 'settings', label: 'Delete Data', icon: Settings, color: 'text-parchment/34' },
  ];

  const renderTree = (accent: 'neon-cyan' | 'neon-blue', emptyText: string) => {
    const tree = getTemporalTreeData();
    const ac =
      accent === 'neon-blue'
        ? { text: 'text-neon-blue', active: 'text-neon-blue bg-neon-blue/5 font-bold border-l-2 border-neon-blue pl-8' }
        : { text: 'text-neon-cyan', active: 'text-neon-cyan bg-neon-cyan/5 font-bold border-l-2 border-neon-cyan pl-8' };
    const years = Object.keys(tree).sort((a, b) => b.localeCompare(a));
    return (
      <div className="bg-void/40 border border-white/5 p-13 rounded-13 space-y-13">
        <div className="text-[10px] caps-modern text-parchment/34 flex items-center justify-between">
          <span className={`flex items-center gap-5 ${ac.text} font-bold tracking-wider`}>
            <Calendar className="w-11 h-11" />
            YEAR / MONTH / DAY
          </span>
          {(selectedYear || selectedMonth || selectedDay) && (
            <button
              onClick={() => {
                setSelectedYear(null);
                setSelectedMonth(null);
                setSelectedDay(null);
              }}
              className={`${ac.text} hover:underline text-[9px] cursor-pointer`}
            >
              RESET
            </button>
          )}
        </div>

        <div className="space-y-8 max-h-[400px] overflow-y-auto silk-scroll pr-5 text-[11px]">
          {years.length === 0 ? (
            <div className="text-[10px] text-parchment/21 italic">{emptyText}</div>
          ) : (
            years.map((year) => (
              <div key={year} className="space-y-2">
                <button
                  onClick={() => {
                    setSelectedYear(selectedYear === year ? null : year);
                    setSelectedMonth(null);
                    setSelectedDay(null);
                  }}
                  className={`w-full flex items-center text-left p-5 rounded hover:bg-white/5 transition-all ${selectedYear === year ? ac.active : 'text-parchment/80'}`}
                >
                  <span className="mr-5 text-[8px]">{selectedYear === year ? '▼' : '▶'}</span>
                  {year}
                  <span className="text-[8px] opacity-34 ml-auto font-normal">({countItemsForTemporal(year)})</span>
                </button>

                {selectedYear === year && (
                  <div className="pl-13 border-l border-white/5 space-y-2">
                    {Object.keys(tree[year]).sort((a, b) => b.localeCompare(a)).map((month) => (
                      <div key={month} className="space-y-1">
                        <button
                          onClick={() => {
                            setSelectedMonth(selectedMonth === month ? null : month);
                            setSelectedDay(null);
                          }}
                          className={`w-full flex items-center text-left p-3 rounded hover:bg-white/5 transition-all ${selectedMonth === month ? 'text-neon-magenta bg-neon-magenta/5 font-bold' : 'text-parchment/55'}`}
                        >
                          <span className="mr-5 text-[7px]">{selectedMonth === month ? '▼' : '▶'}</span>
                          {monthName(month)}
                          <span className="text-[7px] opacity-34 ml-auto font-normal">({countItemsForTemporal(year, month)})</span>
                        </button>

                        {selectedMonth === month && (
                          <div className="pl-13 border-l border-white/5 space-y-1">
                            {Array.from(tree[year][month]).sort((a, b) => b.localeCompare(a)).map((day) => (
                              <button
                                key={day}
                                onClick={() => setSelectedDay(selectedDay === day ? null : day)}
                                className={`w-full flex items-center text-left p-3 rounded hover:bg-white/5 transition-all text-[10px] ${selectedDay === day ? 'text-neon-blue bg-neon-blue/10 font-bold border border-neon-blue/21' : 'text-parchment/40'}`}
                              >
                                📅 {new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                                <span className="text-[7px] opacity-32 ml-auto">({countItemsForTemporal(year, month, day)})</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderTranscript = (emptyText: string) =>
    isLoadingMessages ? (
      <div className="h-full flex flex-col items-center justify-center space-y-8 text-parchment/34 text-[10px]">
        <Loader2 className="w-13 h-13 text-neon-cyan animate-spin" />
        <span>Loading messages...</span>
      </div>
    ) : readerError ? (
      <div className="h-full flex flex-col items-center justify-center text-center p-21 text-cyber-red text-[10px]">{readerError}</div>
    ) : selectedItemMessages.length > 0 ? (
      selectedItemMessages.map((msg, idx) => (
        <div key={msg.id || idx} className="space-y-3">
          <div className="flex items-center justify-between text-[8px] font-mono tracking-wider pl-5">
            <span className={msg.role === 'user' ? 'text-neon-cyan font-bold' : 'text-neon-magenta font-semibold'}>
              {msg.role === 'user' ? '👤 YOU' : '🤖 ARTHASHASTRA AI (AI-GENERATED)'}
            </span>
            <span className="text-parchment/21 scale-90">{msg.time ? fmtDate(msg.time, true) : `#${idx + 1}`}</span>
          </div>
          <div
            className={`p-10 rounded-8 border text-11 leading-relaxed ${
              msg.role === 'user'
                ? 'bg-void/80 border-neon-cyan/8 text-parchment/90 selection:bg-neon-cyan/20 font-mono text-[10px]'
                : 'bg-white/5 border-neon-magenta/8 text-parchment/89 font-sans selection:bg-neon-magenta/20 shadow-[inset_0_0_10px_rgba(255,0,128,0.01)]'
            }`}
          >
            <Markdown className="prose prose-invert max-w-none text-left leading-relaxed">{msg.text}</Markdown>
          </div>
        </div>
      ))
    ) : (
      <div className="h-full flex flex-col items-center justify-center text-center p-21 text-parchment/21 italic text-[10px]">{emptyText}</div>
    );

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto py-89 px-21 text-center font-mono text-[11px] text-parchment/55">
        <Database className="w-34 h-34 text-neon-cyan mx-auto mb-13" />
        Sign in to manage your conversations, memory calendar and archives.
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-34 px-21 min-h-[80vh] flex flex-col h-full font-mono">
      <div className="flex flex-col md:flex-row gap-34 h-full">
        <div className="w-full md:w-64 space-y-8">
          <div className="mb-34">
            <div className="text-[10px] caps-modern text-parchment/34 mb-5">YOUR ARCHIVE</div>
            <h2 className="text-21 font-display font-bold text-neon-cyan leading-none">ArchiveOS</h2>
          </div>

          <div className="space-y-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-13 px-13 py-10 rounded-8 transition-all ${activeTab === tab.id ? 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/21 shadow-[0_0_15px_rgba(0,230,118,0.1)]' : 'text-parchment/55 hover:text-parchment hover:bg-white/5'}`}
              >
                <tab.icon className={`w-13 h-13 ${activeTab === tab.id ? tab.color : ''}`} />
                <span className="text-[11px] caps-modern tracking-widest font-bold">{tab.label}</span>
                {activeTab === tab.id && <ChevronRight className="w-8 h-8 ml-auto" />}
              </button>
            ))}
          </div>

          <div className="pt-34 border-t border-neon-cyan/8 mt-34 space-y-8">
            <button
              onClick={loadAllData}
              disabled={isLoading}
              className="flex items-center gap-8 text-[10px] text-parchment/34 caps-modern hover:text-neon-cyan disabled:opacity-50"
            >
              <RefreshCw className={`w-8 h-8 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'LOADING...' : 'REFRESH'}</span>
            </button>
            <div className="text-[10px] text-parchment/21 font-mono">Private to your account</div>
          </div>
        </div>

        <div className="flex-1 min-w-0 space-y-13">
          {notice && (
            <div
              className={`p-13 border rounded-8 text-11 flex items-center gap-10 ${
                notice.kind === 'ok' ? 'bg-neon-cyan/10 border-neon-cyan/55 text-neon-cyan' : 'bg-cyber-red/10 border-cyber-red/55 text-cyber-red'
              }`}
            >
              {notice.kind === 'ok' ? <CheckCircle2 className="w-13 h-13 shrink-0" /> : <AlertTriangle className="w-13 h-13 shrink-0" />}
              <span className="flex-1 font-sans">{notice.text}</span>
              <button onClick={() => setNotice(null)} aria-label="Dismiss">
                <X className="w-11 h-11" />
              </button>
            </div>
          )}
          {loadErrors.length > 0 && (
            <div className="p-13 border border-cyber-red/34 bg-cyber-red/5 rounded-8 text-[10px] text-cyber-red font-sans space-y-3">
              {loadErrors.map((e) => (
                <div key={e}>Could not load — {e}</div>
              ))}
            </div>
          )}

          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div key="dash" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-34">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-21">
                  <StatsCard title="Conversations" value={chats.length} icon={MessageSquare} color="text-neon-magenta" />
                  <StatsCard title="Cold Archives" value={coldArchives.length} icon={Snowflake} color="text-neon-blue" />
                  <StatsCard title="Archived Messages" value={archivedMessages} icon={Database} color="text-neon-blue" />
                  <StatsCard title="Calendar Days" value={calendarDays ?? '—'} icon={Calendar} color="text-neon-cyan" />
                </div>

                <div className="glass-panel p-34 border-neon-cyan/13">
                  <h3 className="text-13 caps-modern text-neon-cyan mb-21 flex items-center gap-8">
                    <Database className="w-13 h-13" />
                    How storage works
                  </h3>
                  <ul className="space-y-10 text-[11px] text-parchment/73 font-sans leading-relaxed list-disc pl-21">
                    <li><strong>Conversations</strong> are your active chats. They are stored in your account and only you can read them.</li>
                    <li><strong>Cold storage</strong> moves an old conversation out of your chat list into one archive document (up to ~900 KB). You can read, restore or delete it at any time. No extra encryption or compression is applied.</li>
                    <li><strong>Memory calendar</strong> holds your own day-by-day notes.</li>
                    <li><strong>Activity log</strong> lists archive, restore and delete actions you took.</li>
                  </ul>
                </div>
              </motion.div>
            )}

            {activeTab === 'temporal' && (
              <motion.div key="temporal" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <TemporalMemoryChain user={user} />
              </motion.div>
            )}

            {activeTab === 'gazette' && (
              <motion.div key="gazette" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="h-full">
                <div className="glass-panel border-neon-cyan/21 h-full overflow-hidden rounded-13">
                  <ArthashastraGazette />
                </div>
              </motion.div>
            )}

            {(activeTab === 'chats' || activeTab === 'cold') && (
              <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-21">
                {isCold ? (
                  <div className="p-13 bg-neon-blue/5 border border-neon-blue/13 rounded-13 flex flex-col md:flex-row gap-13 items-center justify-between">
                    <div className="flex items-center gap-10">
                      <Snowflake className="w-15 h-15 text-neon-blue shrink-0" />
                      <div>
                        <h4 className="text-11 caps-modern font-bold text-neon-blue">Cold Storage</h4>
                        <p className="text-[9px] text-parchment/40 font-sans leading-tight">Conversations you moved out of your chat list. Read them here, restore them, or delete them.</p>
                      </div>
                    </div>
                    <div className="relative w-full md:w-64">
                      <Search className="absolute left-10 top-1/2 -translate-y-1/2 w-11 h-11 text-parchment/34" />
                      <input
                        type="text"
                        placeholder="Search archives..."
                        className="w-full bg-void/55 border border-neon-blue/21 rounded-8 py-8 pl-25 pr-8 text-11 focus:border-neon-blue transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-13">
                    <div className="relative flex-1">
                      <Search className="absolute left-13 top-1/2 -translate-y-1/2 w-13 h-13 text-parchment/34" />
                      <input
                        type="text"
                        placeholder="Search your conversations..."
                        className="w-full bg-void/55 border border-neon-cyan/21 rounded-8 py-10 pl-34 pr-13 text-13 focus:border-neon-cyan transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-21">
                  <div className="lg:col-span-3 space-y-13">
                    {renderTree(isCold ? 'neon-blue' : 'neon-cyan', isCold ? 'No archives yet.' : 'No conversations yet.')}
                  </div>

                  {/* List */}
                  <div className="lg:col-span-4 space-y-8 max-h-[680px] overflow-y-auto silk-scroll pr-5">
                    {getFilteredItems().map((item) => {
                      const archive = item as ColdArchive;
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleSelectItem(item)}
                          className={`glass-panel p-13 border cursor-pointer transition-all flex flex-col justify-between group rounded-10 ${
                            selectedItem?.id === item.id
                              ? isCold
                                ? 'border-neon-blue bg-neon-blue/5'
                                : 'border-neon-cyan bg-neon-cyan/5'
                              : 'border-white/5 hover:bg-white/5'
                          }`}
                        >
                          <div className="flex-1">
                            <div className={`text-11 font-bold text-parchment transition-colors line-clamp-2 leading-snug ${isCold ? 'group-hover:text-neon-blue' : 'group-hover:text-neon-cyan'}`}>
                              {item.title || 'Untitled conversation'}
                            </div>
                            <div className="text-[9px] text-parchment/34 caps-modern mt-8 flex justify-between items-center">
                              <span>{isCold ? `${archive.msgCount} MESSAGES` : fmtDate(itemDate(item, false))}</span>
                              <span className={isCold ? 'text-neon-blue font-semibold' : 'text-neon-cyan font-semibold'}>{isCold ? 'ARCHIVED' : 'ACTIVE'}</span>
                            </div>
                          </div>
                          <div className="mt-8 pt-8 border-t border-white/5 flex items-center justify-between gap-5 text-[8px] text-parchment/30">
                            <span>{isCold ? `Archived ${fmtDate(toDate(archive.migratedAt))}` : `ID ${item.id.substring(0, 8)}`}</span>
                            {isCold ? (
                              <span className="flex gap-5">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRehydrate(archive);
                                  }}
                                  className="px-5 py-2 bg-neon-cyan/10 hover:bg-neon-cyan/34 text-neon-cyan border border-neon-cyan/21 rounded text-[8px] caps-modern font-bold flex items-center gap-3"
                                  title="Restore to your chat list"
                                >
                                  <RefreshCw className="w-8 h-8" />
                                  RESTORE
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteArchive(archive);
                                  }}
                                  className="px-5 py-2 bg-cyber-red/10 hover:bg-cyber-red/34 text-cyber-red border border-cyber-red/21 rounded text-[8px] caps-modern font-bold flex items-center gap-3"
                                  title="Delete permanently"
                                >
                                  <Trash2 className="w-8 h-8" />
                                </button>
                              </span>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMigrate(item as Conversation);
                                }}
                                className="px-5 py-2 bg-neon-blue/10 hover:bg-neon-blue/34 text-neon-blue border border-neon-blue/21 rounded text-[8px] caps-modern font-bold flex items-center gap-3"
                                title="Move to cold storage"
                              >
                                <Snowflake className="w-8 h-8" />
                                ARCHIVE
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {getFilteredItems().length === 0 && (
                      <div className="text-center py-55 text-parchment/21 text-12 italic bg-void/10 border border-dashed border-white/5 rounded-13">
                        {isLoading ? 'Loading...' : isCold ? 'No archives match.' : 'No conversations match.'}
                      </div>
                    )}
                  </div>

                  {/* Reader */}
                  <div className="lg:col-span-5">
                    {selectedItem ? (
                      <div className={`glass-panel ${isCold ? 'border-neon-blue/21' : 'border-neon-cyan/21'} h-[680px] flex flex-col rounded-13 overflow-hidden bg-void/50`}>
                        <div className="p-13 border-b border-white/5 flex items-center justify-between bg-void/85 shrink-0">
                          <div className="min-w-0 pr-8">
                            <div className={`text-[8px] caps-modern mb-3 flex items-center gap-5 font-bold ${isCold ? 'text-neon-blue' : 'text-neon-cyan'}`}>
                              {isCold ? (
                                <span>❄️ ARCHIVED {fmtDate(toDate((selectedItem as ColdArchive).migratedAt), true)}</span>
                              ) : (
                                <span>LAST ACTIVITY: {fmtDate(itemDate(selectedItem, false), true)}</span>
                              )}
                            </div>
                            <h4 className="text-12 font-bold text-parchment leading-tight line-clamp-1">{selectedItem.title || 'Untitled conversation'}</h4>
                          </div>

                          {isCold ? (
                            <button
                              onClick={() => handleRehydrate(selectedItem as ColdArchive)}
                              className="px-8 py-5 shrink-0 bg-neon-cyan/10 hover:bg-neon-cyan/21 text-neon-cyan border border-neon-cyan/34 rounded text-[9px] caps-modern font-bold flex items-center gap-3 transition-all"
                            >
                              <RefreshCw className="w-8 h-8" />
                              RESTORE
                            </button>
                          ) : (
                            onNavigateToChat && (
                              <button
                                onClick={() => onNavigateToChat(selectedItem.id)}
                                className="px-8 py-5 shrink-0 bg-neon-magenta/10 hover:bg-neon-magenta/21 text-neon-magenta border border-neon-magenta/34 rounded text-[9px] caps-modern font-bold flex items-center gap-3 transition-all"
                              >
                                <MessageSquare className="w-8 h-8" />
                                CONTINUE
                              </button>
                            )
                          )}
                        </div>

                        <div className="flex-1 overflow-y-auto p-13 silk-scroll space-y-13 bg-void/21">
                          {renderTranscript(isCold ? 'This archive has no messages.' : 'No messages in this conversation.')}
                        </div>

                        <div className="p-10 border-t border-white/5 bg-void/80 text-[8px] font-mono text-parchment/21 flex items-center justify-between shrink-0">
                          <div>ID: {selectedItem.id.substring(0, 18)}</div>
                          <div>{selectedItemMessages.length} MESSAGE(S) · AI ANSWERS ARE AI-GENERATED</div>
                        </div>
                      </div>
                    ) : (
                      <div className="glass-panel border-white/5 h-[680px] flex flex-col items-center justify-center text-center p-34 text-parchment/21 rounded-13">
                        {isCold ? <Snowflake className="w-21 h-21 text-parchment/13 mb-8" /> : <Database className="w-21 h-21 text-parchment/13 mb-8" />}
                        <h4 className="text-[10px] caps-modern text-parchment/34 tracking-widest uppercase">{isCold ? 'Select an archive' : 'Select a conversation'}</h4>
                        <p className="text-[9px] text-parchment/21 mt-5 max-w-xs leading-normal font-sans">
                          {isCold ? 'Click an archive to read it without restoring it.' : 'Click a conversation to read its full transcript.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'audit' && (
              <motion.div key="audit" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div className="glass-panel border-white/5 overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-white/5 text-[10px] caps-modern text-parchment/34 border-b border-white/10">
                      <tr>
                        <th className="px-21 py-13 font-medium">TIME</th>
                        <th className="px-21 py-13 font-medium">ACTION</th>
                        <th className="px-21 py-13 font-medium">DETAILS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-white/5 transition-colors text-[11px] font-mono">
                          <td className="px-21 py-13 text-parchment/34 whitespace-nowrap">{fmtDate(log.timestamp, true)}</td>
                          <td className="px-21 py-13 text-neon-cyan font-bold">{log.action}</td>
                          <td className="px-21 py-13 text-parchment/89 font-sans">{log.details}</td>
                        </tr>
                      ))}
                      {auditLogs.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-21 py-34 text-center text-[11px] text-parchment/34 italic">
                            No actions recorded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-34">
                <div className="glass-panel p-34 border-cyber-red/21 bg-cyber-red/5">
                  <h3 className="text-13 caps-modern text-cyber-red mb-21 flex items-center gap-8">
                    <AlertTriangle className="w-13 h-13" />
                    Delete all conversations
                  </h3>
                  <p className="text-[11px] text-parchment/55 font-sans mb-21">
                    Permanently deletes all {chats.length} conversation(s) in your chat list and their messages. Cold archives and memory-calendar days are kept; to delete everything, use "Your Data". You will be asked to confirm.
                  </p>
                  <button
                    onClick={handleDeleteAllConversations}
                    disabled={chats.length === 0}
                    className="px-21 py-13 bg-cyber-red text-white text-[11px] caps-modern font-bold rounded-8 hover:bg-cyber-red/89 transition-all shadow-[0_0_15px_rgba(255,42,42,0.3)] disabled:opacity-34"
                  >
                    DELETE ALL CONVERSATIONS…
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Confirmation dialog */}
      {pending && (
        <div className="fixed inset-0 z-[100] bg-void/80 backdrop-blur-sm flex items-center justify-center p-21" role="dialog" aria-modal="true">
          <div className={`glass-panel max-w-md w-full p-34 rounded-13 border ${pending.danger ? 'border-cyber-red/55' : 'border-neon-cyan/34'} bg-void/95 space-y-13`}>
            <h3 className={`text-13 caps-modern font-bold ${pending.danger ? 'text-cyber-red' : 'text-neon-cyan'}`}>{pending.title}</h3>
            <p className="text-[11px] text-parchment/80 font-sans leading-relaxed">{pending.body}</p>
            {pending.typeToConfirm && (
              <div className="space-y-5">
                <label className="text-[10px] text-parchment/55 font-sans">
                  Type <strong className="text-cyber-red">{pending.typeToConfirm}</strong> to confirm:
                </label>
                <input
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value.toUpperCase())}
                  className="w-full bg-void/55 border border-cyber-red/34 rounded-8 py-8 px-13 text-13 text-parchment outline-none"
                  autoFocus
                />
              </div>
            )}
            <div className="flex gap-8 pt-8">
              <button
                onClick={runPending}
                disabled={isRunning || (!!pending.typeToConfirm && confirmInput !== pending.typeToConfirm)}
                className={`flex-1 py-10 rounded-8 text-[10px] caps-modern font-bold flex items-center justify-center gap-5 disabled:opacity-34 ${
                  pending.danger ? 'bg-cyber-red text-white' : 'bg-neon-cyan/10 border border-neon-cyan/55 text-neon-cyan'
                }`}
              >
                {isRunning && <Loader2 className="w-11 h-11 animate-spin" />}
                {isRunning ? 'WORKING...' : pending.confirmLabel}
              </button>
              <button
                onClick={() => setPending(null)}
                disabled={isRunning}
                className="px-21 py-10 border border-white/20 rounded-8 text-[10px] caps-modern text-parchment/80"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
