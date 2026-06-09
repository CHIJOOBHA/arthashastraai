
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Database, Archive, Snowflake, RefreshCw, Newspaper, 
  Zap, Settings, History, Lock, 
  LayoutDashboard, FileText, Activity, Brain as IntelIcon, Shield,
  Search, Calendar, Plus, Trash2, Download, AlertTriangle,
  Loader2, CheckCircle2, ChevronRight, MessageSquare
} from 'lucide-react';
import { ArthashastraGazette } from './ArthashastraGazette';
import { TemporalMemoryChain } from './TemporalMemoryChain';
import { auth, db } from '../lib/firebase';
import { 
  Conversation, 
  getConversations, 
  getMessages 
} from '../lib/chatStore';
import { 
  getColdArchives, 
  getAuditLogs, 
  logAudit, 
  migrateToCold,
  rehydrateFromCold,
  ColdArchive,
  AuditEntry
} from '../lib/archiveStore';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';

interface ArchiveOSProps {
  onNavigateToChat: (chatId: string) => void;
}

export function ArchiveOS({ onNavigateToChat }: ArchiveOSProps) {
  const [activeTab, setActiveTab] = useState('temporal');
  const [chats, setChats] = useState<Conversation[]>([]);
  const [coldArchives, setColdArchives] = useState<ColdArchive[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [retentionDays, setRetentionDays] = useState(30);

  // Temporal Navigation State
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Full Thread Reader State
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [selectedItemMessages, setSelectedItemMessages] = useState<any[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  useEffect(() => {
    loadAllData();
    // Reset temporal state when changing views
    setSelectedYear(null);
    setSelectedMonth(null);
    setSelectedDay(null);
    setSelectedItem(null);
    setSelectedItemMessages([]);
  }, [activeTab]);

  const getParsedDate = (val: any) => {
    let d = new Date();
    if (!val) return d;
    if (val.seconds) d = new Date(val.seconds * 1000);
    else if (typeof val.toDate === 'function') d = val.toDate();
    else d = new Date(val);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const MONTH_NAMES: { [key: string]: string } = {
    '01': 'January', '02': 'February', '03': 'March', '04': 'April',
    '05': 'May', '06': 'June', '07': 'July', '08': 'August',
    '09': 'September', '10': 'October', '11': 'November', '12': 'December'
  };

  const getTemporalTreeData = () => {
    const list = activeTab === 'cold' ? coldArchives : chats;
    const tree: { [year: string]: { [month: string]: Set<string> } } = {};
    
    list.forEach((item) => {
      const dateSource = activeTab === 'cold' 
        ? ((item as any).date || (item as any).migratedAt) 
        : ((item as any).updatedAt || (item as any).lastMessageAt);
      const d = getParsedDate(dateSource);
      const year = d.getFullYear().toString();
      const monthNum = (d.getMonth() + 1).toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      
      if (!tree[year]) tree[year] = {};
      if (!tree[year][monthNum]) tree[year][monthNum] = new Set();
      tree[year][monthNum].add(day);
    });
    
    return tree;
  };

  const countItemsForTemporal = (year: string, month: string | null = null, day: string | null = null) => {
    const list = activeTab === 'cold' ? coldArchives : chats;
    return list.filter(item => {
      const dateSource = activeTab === 'cold' 
        ? ((item as any).date || (item as any).migratedAt) 
        : ((item as any).updatedAt || (item as any).lastMessageAt);
      const d = getParsedDate(dateSource);
      
      const matchYear = d.getFullYear().toString() === year;
      if (!matchYear) return false;
      
      if (month) {
        const m = (d.getMonth() + 1).toString().padStart(2, '0');
        if (m !== month) return false;
        
        if (day) {
          const dy = d.getDate().toString().padStart(2, '0');
          if (dy !== day) return false;
        }
      }
      return true;
    }).length;
  };

  const getFilteredItems = (): any[] => {
    const list: any[] = activeTab === 'cold' ? coldArchives : chats;
    let filtered = list;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(item => {
        const title = (item as any).title || '';
        const id = item.id || '';
        return title.toLowerCase().includes(q) || id.toLowerCase().includes(q);
      });
    }

    if (selectedYear) {
      filtered = filtered.filter(item => {
        const dateSource = activeTab === 'cold' 
          ? ((item as any).date || (item as any).migratedAt) 
          : ((item as any).updatedAt || (item as any).lastMessageAt);
        const d = getParsedDate(dateSource);
        return d.getFullYear().toString() === selectedYear;
      });
    }

    if (selectedMonth) {
      filtered = filtered.filter(item => {
        const dateSource = activeTab === 'cold' 
          ? ((item as any).date || (item as any).migratedAt) 
          : ((item as any).updatedAt || (item as any).lastMessageAt);
        const d = getParsedDate(dateSource);
        const m = (d.getMonth() + 1).toString().padStart(2, '0');
        return m === selectedMonth;
      });
    }

    if (selectedDay) {
      filtered = filtered.filter(item => {
        const dateSource = activeTab === 'cold' 
          ? ((item as any).date || (item as any).migratedAt) 
          : ((item as any).updatedAt || (item as any).lastMessageAt);
        const d = getParsedDate(dateSource);
        const day = d.getDate().toString().padStart(2, '0');
        return day === selectedDay;
      });
    }

    return filtered;
  };

  const handleSelectItem = async (item: any) => {
    setSelectedItem(item);
    setSelectedItemMessages([]);
    
    if (activeTab === 'cold') {
      if (item.messages) {
        try {
          const msgs = typeof item.messages === 'string' ? JSON.parse(item.messages) : item.messages;
          if (Array.isArray(msgs)) {
            msgs.sort((a: any, b: any) => {
              const getTime = (ca: any) => {
                if (!ca) return 0;
                if (ca.seconds) return ca.seconds * 1000;
                return new Date(ca).getTime() || 0;
              };
              return getTime(a.createdAt) - getTime(b.createdAt);
            });
            setSelectedItemMessages(msgs);
          }
        } catch (e) {
          console.error("Failed to parse cold messages:", e);
        }
      }
    } else {
      setIsLoadingMessages(true);
      try {
        const msgs = await getMessages(item.id);
        setSelectedItemMessages(msgs);
      } catch (err) {
        console.error("Failed to load live messages:", err);
      } finally {
        setIsLoadingMessages(false);
      }
    }
  };

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [c, cold, logs] = await Promise.all([
        getConversations(),
        getColdArchives(),
        getAuditLogs()
      ]);
      setChats(c);
      setColdArchives(cold);
      setAuditLogs(logs);
    } catch (error) {
      console.error("ArchiveOS Data Loading Failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMigrate = async (chatId: string) => {
    if (!confirm("Move this conversation to Cold Storage? It will be removed from the active Witness ledger.")) return;
    const success = await migrateToCold(chatId);
    if (success) {
      loadAllData();
    }
  };

  const handleRehydrate = async (archiveId: string) => {
    if (!confirm("Rehydrate this conversation back to the active Witness ledger?")) return;
    const success = await rehydrateFromCold(archiveId);
    if (success) {
      loadAllData();
      setActiveTab('chats');
    }
  };

  const StatsCard = ({ title, value, icon: Icon, color }: any) => (
    <div className="bg-void/40 border border-neon-cyan/10 p-21 rounded-13 flex flex-col items-center justify-center text-center">
      <Icon className={`w-34 h-34 mb-8 ${color}`} />
      <div className="text-34 font-display font-bold text-parchment leading-none mb-5">{value}</div>
      <div className="text-[10px] caps-modern text-parchment/34 tracking-widest">{title}</div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto py-34 px-21 min-h-[80vh] flex flex-col h-full font-mono">
      {/* Sidebar-like Header or Layout */}
      <div className="flex flex-col md:flex-row gap-34 h-full">
        <div className="w-full md:w-64 space-y-8">
          <div className="mb-34">
            <div className="text-[10px] caps-modern text-parchment/34 mb-5">SYSTEM_MANAGEMENT</div>
            <h2 className="text-21 font-display font-bold text-neon-cyan leading-none">ArchiveOS <span className="opacity-34 text-[10px]">v1.0</span></h2>
          </div>

          <div className="space-y-2">
            {[
              { id: 'dashboard', label: 'Command Center', icon: LayoutDashboard, color: 'text-neon-cyan' },
              { id: 'intel', label: 'Neural Intelligence', icon: IntelIcon, color: 'text-amber-500' },
              { id: 'temporal', label: 'Yuga Memory Chain', icon: Database, color: 'text-neon-cyan' },
              { id: 'chats', label: 'Witness Threads', icon: MessageSquare, color: 'text-neon-magenta' },
              { id: 'gazette', label: 'Absolute Gazette', icon: Newspaper, color: 'text-neon-cyan' },
              { id: 'cold', label: 'Cold Storage', icon: Snowflake, color: 'text-neon-blue' },
              { id: 'audit', label: 'Ledger of Proof', icon: History, color: 'text-parchment/55' },
              { id: 'settings', label: 'Node Settings', icon: Settings, color: 'text-parchment/34' }
            ].map((tab) => (
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

          <div className="pt-34 border-t border-neon-cyan/8 mt-34">
             <div className="flex items-center gap-8 text-[10px] text-parchment/34 caps-modern">
               <Lock className="w-8 h-8" />
               <span>ENCRYPTED_AT_REST</span>
             </div>
             <div className="mt-8 text-[10px] text-parchment/21 font-mono">
               HOT_RETENTION: {retentionDays}d
             </div>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div key="dash" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-34">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-21">
                  <StatsCard title="Hot Msgs" value={chats.length} icon={MessageSquare} color="text-neon-magenta" />
                  <StatsCard title="Cold Archives" value={coldArchives.length} icon={Snowflake} color="text-neon-blue" />
                  <StatsCard title="Retained Days" value={retentionDays} icon={Calendar} color="text-neon-cyan" />
                  <StatsCard title="Uptime" value="100%" icon={Zap} color="text-neon-cyan" />
                </div>

                <div className="glass-panel p-34 border-neon-cyan/13">
                  <h3 className="text-13 caps-modern text-neon-cyan mb-21 flex items-center gap-8">
                    <Database className="w-13 h-13" />
                    Storage Utilization Shards
                  </h3>
                  <div className="space-y-21">
                    <div>
                      <div className="flex justify-between text-[10px] caps-modern text-parchment/55 mb-8">
                        <span>Hot Tier (Neural Persistence)</span>
                        <span>{chats.length * 2} KB utilized</span>
                      </div>
                      <div className="h-4 bg-void/55 rounded-full overflow-hidden border border-white/5">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (chats.length / 100) * 100)}%` }} className="h-full bg-neon-cyan shadow-[0_0_10px_#00E676]" />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] caps-modern text-parchment/55 mb-8">
                        <span>Cold Tier (Compressed Blobs)</span>
                        <span>{coldArchives.length * 5} KB utilized</span>
                      </div>
                      <div className="h-4 bg-void/55 rounded-full overflow-hidden border border-white/5">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (coldArchives.length / 50) * 100)}%` }} className="h-full bg-neon-blue shadow-[0_0_10px_#0A84FF]" />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'temporal' && (
              <motion.div key="temporal" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <TemporalMemoryChain />
              </motion.div>
            )}

            {activeTab === 'intel' && (
              <motion.div key="intel" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="h-full">
                 <div className="glass-panel border-neon-cyan/21 h-full overflow-y-auto silk-scroll p-21 rounded-13">
                    <h3 className="text-21 caps-modern text-neon-cyan mb-34 flex items-center gap-13">
                      <IntelIcon className="w-21 h-21 text-amber-500" />
                      UNIFIED NEURAL INTELLIGENCE
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-21">
                      {/* Placeholder for the Brain View logic if I want to move it here */}
                      <div className="p-34 border border-neon-cyan/13 bg-void/34 rounded-13 text-center space-y-13">
                        <Activity className="w-34 h-34 text-neon-cyan mx-auto animate-pulse" />
                        <p className="text-13 caps-modern text-neon-cyan/55 italic">Consulting higher-order economic vectors...</p>
                        <p className="text-[10px] text-parchment/34">The Neural Brain is currently syncing with global telemetry nodes.</p>
                      </div>
                      <div className="p-34 border border-neon-magenta/13 bg-void/34 rounded-13 text-center space-y-13">
                        <Shield className="w-34 h-34 text-neon-magenta mx-auto" />
                        <p className="text-13 caps-modern text-neon-magenta/55 italic">Ledger Integrity: 100%</p>
                        <p className="text-[10px] text-parchment/34">Aitihya Proof-of-Witness is active on all nodes.</p>
                      </div>
                    </div>
                 </div>
              </motion.div>
            )}

            {activeTab === 'gazette' && (
              <motion.div key="gazette" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="h-full">
                <div className="glass-panel border-neon-cyan/21 h-full overflow-hidden rounded-13">
                  <ArthashastraGazette />
                </div>
              </motion.div>
            )}

            {activeTab === 'chats' && (
              <motion.div key="chats" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-21">
                {/* Search Bar / Controls */}
                <div className="flex items-center gap-13">
                  <div className="relative flex-1">
                    <Search className="absolute left-13 top-1/2 -translate-y-1/2 w-13 h-13 text-parchment/34" />
                    <input 
                      type="text" 
                      placeholder="Search absolute ledger..." 
                      className="w-full bg-void/55 border border-neon-cyan/21 rounded-8 py-10 pl-34 pr-13 text-13 focus:border-neon-cyan transition-all"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-21">
                  {/* PANE 1: TEMPORAL NAVIGATION (3 cols) */}
                  <div className="lg:col-span-3 space-y-13">
                    <div className="bg-void/40 border border-white/5 p-13 rounded-13 space-y-13">
                      <div className="text-[10px] caps-modern text-parchment/34 flex items-center justify-between">
                        <span className="flex items-center gap-5 text-neon-cyan font-bold tracking-wider">
                          <Calendar className="w-11 h-11" />
                          YEAR / MONTH / DATE
                        </span>
                        {(selectedYear || selectedMonth || selectedDay) && (
                          <button 
                            onClick={() => {
                              setSelectedYear(null);
                              setSelectedMonth(null);
                              setSelectedDay(null);
                            }}
                            className="text-neon-cyan hover:underline text-[9px] cursor-pointer"
                          >
                            RESET
                          </button>
                        )}
                      </div>

                      <div className="space-y-8 max-h-[400px] overflow-y-auto silk-scroll pr-5 text-[11px]">
                        {(() => {
                          const tree = getTemporalTreeData();
                          const years = Object.keys(tree).sort((a,b) => b.localeCompare(a));
                          if (years.length === 0) {
                            return <div className="text-[10px] text-parchment/21 italic">No records found.</div>;
                          }
                          return years.map(year => (
                            <div key={year} className="space-y-2">
                              <button 
                                onClick={() => {
                                  setSelectedYear(selectedYear === year ? null : year);
                                  setSelectedMonth(null);
                                  setSelectedDay(null);
                                }}
                                className={`w-full flex items-center text-left p-5 rounded hover:bg-white/5 transition-all ${selectedYear === year ? 'text-neon-cyan bg-neon-cyan/5 font-bold border-l-2 border-neon-cyan pl-8' : 'text-parchment/80'}`}
                              >
                                <span className="mr-5 text-[8px]">{selectedYear === year ? '▼' : '▶'}</span>
                                {year}
                                <span className="text-[8px] opacity-34 ml-auto font-normal">
                                  ({countItemsForTemporal(year)} threads)
                                </span>
                              </button>

                              {selectedYear === year && (
                                <div className="pl-13 border-l border-white/5 space-y-2">
                                  {Object.keys(tree[year]).sort((a,b) => b.localeCompare(a)).map(month => (
                                    <div key={month} className="space-y-1">
                                      <button 
                                        onClick={() => {
                                          setSelectedMonth(selectedMonth === month ? null : month);
                                          setSelectedDay(null);
                                        }}
                                        className={`w-full flex items-center text-left p-3 rounded hover:bg-white/5 transition-all ${selectedMonth === month ? 'text-neon-magenta bg-neon-magenta/5 font-bold' : 'text-parchment/55'}`}
                                      >
                                        <span className="mr-5 text-[7px]">{selectedMonth === month ? '▼' : '▶'}</span>
                                        {MONTH_NAMES[month] || month}
                                        <span className="text-[7px] opacity-34 ml-auto font-normal">
                                          ({countItemsForTemporal(year, month)})
                                        </span>
                                      </button>

                                      {selectedMonth === month && (
                                        <div className="pl-13 border-l border-white/5 space-y-1">
                                          {Array.from(tree[year][month]).sort((a,b) => b.localeCompare(a)).map(day => (
                                            <button 
                                              key={day}
                                              onClick={() => setSelectedDay(selectedDay === day ? null : day)}
                                              className={`w-full flex items-center text-left p-3 rounded hover:bg-white/5 transition-all text-[10px] ${selectedDay === day ? 'text-neon-blue bg-neon-blue/10 font-bold border border-neon-blue/21' : 'text-parchment/40'}`}
                                            >
                                              📅 {day} {MONTH_NAMES[month]?.substring(0,3)}
                                              <span className="text-[7px] opacity-32 ml-auto">
                                                ({countItemsForTemporal(year, month, day)})
                                              </span>
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* PANE 2: THREADS LIST (4 cols) */}
                  <div className="lg:col-span-4 space-y-8 max-h-[680px] overflow-y-auto silk-scroll pr-5">
                    {getFilteredItems().map((chat) => (
                      <div 
                        key={chat.id} 
                        onClick={() => handleSelectItem(chat)}
                        className={`glass-panel p-13 border cursor-pointer hover:border-neon-cyan/21 transition-all flex flex-col justify-between group rounded-10 ${
                          selectedItem?.id === chat.id 
                            ? 'border-neon-cyan bg-neon-cyan/5 shadow-[0_0_15px_rgba(0,230,118,0.05)]' 
                            : 'border-white/5 hover:bg-white/5'
                        }`}
                      >
                        <div className="flex-1">
                          <div className="text-11 font-bold text-parchment group-hover:text-neon-cyan transition-colors line-clamp-2 leading-snug">{chat.title}</div>
                          <div className="text-[9px] text-parchment/34 caps-modern mt-8 flex justify-between items-center">
                            <span>ID: {chat.id.substring(0, 10)}...</span>
                            <span className="text-neon-cyan font-semibold">HOT</span>
                          </div>
                        </div>
                        <div className="mt-8 pt-8 border-t border-white/5 flex items-center justify-between text-[8px] text-parchment/30">
                          <span>
                            {(() => {
                              try {
                                const lat = (chat.updatedAt as any);
                                let d = getParsedDate(lat);
                                return format(d, 'PP');
                              } catch (e) {
                                return 'RECENT';
                              }
                            })()}
                          </span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMigrate(chat.id);
                            }}
                            className="px-5 py-2 bg-neon-blue/10 hover:bg-neon-blue/34 text-neon-blue border border-neon-blue/21 rounded text-[8px] caps-modern font-bold flex items-center gap-3"
                            title="Compress to Cold Storage"
                          >
                            <Snowflake className="w-8 h-8" />
                            COLD
                          </button>
                        </div>
                      </div>
                    ))}
                    {getFilteredItems().length === 0 && (
                      <div className="text-center py-55 text-parchment/21 text-12 italic bg-void/10 border border-dashed border-white/5 rounded-13">
                        No hot witness threads match query.
                      </div>
                    )}
                  </div>

                  {/* PANE 3: CHAT DETAILS READER (5 cols) */}
                  <div className="lg:col-span-5">
                    {selectedItem ? (
                      <div className="glass-panel border-neon-cyan/21 h-[680px] flex flex-col rounded-13 overflow-hidden bg-void/50">
                        {/* Reader Header */}
                        <div className="p-13 border-b border-white/5 flex items-center justify-between bg-void/85 shrink-0">
                          <div className="min-w-0 pr-8">
                            <div className="text-[8px] caps-modern text-neon-cyan mb-3 flex items-center gap-5 font-bold">
                              <span className="flex items-center gap-3">
                                <span className="w-4 h-4 bg-neon-cyan rounded-full animate-ping" />
                                ACTIVE PROTOCOL
                              </span>
                              <span>·</span>
                              <span>DATE: {format(getParsedDate(selectedItem.updatedAt || selectedItem.lastMessageAt), 'PPp')}</span>
                            </div>
                            <h4 className="text-12 font-bold text-parchment leading-tight line-clamp-1">{selectedItem.title}</h4>
                          </div>
                          
                          <button 
                            onClick={() => onNavigateToChat(selectedItem.id)}
                            className="px-8 py-5 shrink-0 bg-neon-magenta/10 hover:bg-neon-magenta/21 text-neon-magenta border border-neon-magenta/34 rounded text-[9px] caps-modern font-bold flex items-center gap-3 transition-all"
                          >
                            <MessageSquare className="w-8 h-8" />
                            CONTINUE
                          </button>
                        </div>
                        
                        {/* Transcript Viewer */}
                        <div className="flex-1 overflow-y-auto p-13 silk-scroll space-y-13 bg-void/21">
                          {isLoadingMessages ? (
                            <div className="h-full flex flex-col items-center justify-center space-y-8 text-parchment/34 text-[10px]">
                              <Loader2 className="w-13 h-13 text-neon-cyan animate-spin" />
                              <span>Fetching decentralized transcript nodes...</span>
                            </div>
                          ) : selectedItemMessages.length > 0 ? (
                            selectedItemMessages.map((msg, idx) => (
                              <div key={msg.id || idx} className="space-y-3">
                                <div className="flex items-center justify-between text-[8px] font-mono tracking-wider pl-5">
                                  <span className={msg.role === 'user' ? 'text-neon-cyan font-bold' : 'text-neon-magenta font-semibold'}>
                                    {msg.role === 'user' ? '👤 USER WITNESS' : '🤖 SYSTEM COMMANDER'}
                                  </span>
                                  <span className="text-parchment/21 scale-90">
                                    {msg.hash ? `HASH: ${msg.hash.substring(0, 8)}` : `#${idx + 1}`}
                                  </span>
                                </div>
                                
                                <div className={`p-10 rounded-8 border text-11 leading-relaxed ${
                                  msg.role === 'user' 
                                    ? 'bg-void/80 border-neon-cyan/8 text-parchment/90 selection:bg-neon-cyan/20 font-mono text-[10px]' 
                                    : 'bg-white/5 border-neon-magenta/8 text-parchment/89 font-sans selection:bg-neon-magenta/20 shadow-[inset_0_0_10px_rgba(255,0,128,0.01)]'
                                }`}>
                                  <div className="prose prose-invert max-w-none text-left leading-relaxed">
                                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-21 text-parchment/21 italic text-[10px]">
                              No active message logs recorded.
                            </div>
                          )}
                        </div>

                        {/* Reader Footer */}
                        <div className="p-10 border-t border-white/5 bg-void/80 text-[8px] font-mono text-parchment/21 flex items-center justify-between shrink-0">
                          <div>SECURE ID: {selectedItem.id.substring(0, 18)}...</div>
                          <div>TIER: NEURAL_PERSISTENCE</div>
                        </div>
                      </div>
                    ) : (
                      <div className="glass-panel border-white/5 h-[680px] flex flex-col items-center justify-center text-center p-34 text-parchment/21 rounded-13">
                        <Database className="w-21 h-21 text-parchment/13 mb-8 animate-pulse" />
                        <h4 className="text-[10px] caps-modern text-parchment/34 tracking-widest uppercase">Select active ledger</h4>
                        <p className="text-[9px] text-parchment/21 mt-5 max-w-xs leading-normal font-sans">
                          Click on any hot witness thread to pull up the complete system transcript logs safely.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'cold' && (
              <motion.div key="cold" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-21">
                {/* Archive Warning & Search */}
                <div className="p-13 bg-neon-blue/5 border border-neon-blue/13 rounded-13 flex flex-col md:flex-row gap-13 items-center justify-between">
                  <div className="flex items-center gap-10">
                    <AlertTriangle className="w-15 h-15 text-neon-blue shrink-0 animate-pulse" />
                    <div>
                      <h4 className="text-11 caps-modern font-bold text-neon-blue">Absolute Compression Protocols Active</h4>
                      <p className="text-[9px] text-parchment/40 font-sans leading-tight">Conversation streams under cold tier are secured in read-only deep vault structures.</p>
                    </div>
                  </div>
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-10 top-1/2 -translate-y-1/2 w-11 h-11 text-parchment/34" />
                    <input 
                      type="text" 
                      placeholder="Search archive..." 
                      className="w-full bg-void/55 border border-neon-blue/21 rounded-8 py-8 pl-25 pr-8 text-11 focus:border-neon-blue transition-all"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-21">
                  {/* PANE 1: TEMPORAL NAVIGATION (3 cols) */}
                  <div className="lg:col-span-3 space-y-13">
                    <div className="bg-void/40 border border-white/5 p-13 rounded-13 space-y-13">
                      <div className="text-[10px] caps-modern text-parchment/34 flex items-center justify-between">
                        <span className="flex items-center gap-5 text-neon-blue font-bold tracking-wider">
                          <Calendar className="w-11 h-11" />
                          YEAR / MONTH / DATE
                        </span>
                        {(selectedYear || selectedMonth || selectedDay) && (
                          <button 
                            onClick={() => {
                              setSelectedYear(null);
                              setSelectedMonth(null);
                              setSelectedDay(null);
                            }}
                            className="text-neon-blue hover:underline text-[9px] cursor-pointer"
                          >
                            RESET
                          </button>
                        )}
                      </div>

                      <div className="space-y-8 max-h-[400px] overflow-y-auto silk-scroll pr-5 text-[11px]">
                        {(() => {
                          const tree = getTemporalTreeData();
                          const years = Object.keys(tree).sort((a,b) => b.localeCompare(a));
                          if (years.length === 0) {
                            return <div className="text-[10px] text-parchment/21 italic">No archive indices found.</div>;
                          }
                          return years.map(year => (
                            <div key={year} className="space-y-2">
                              <button 
                                onClick={() => {
                                  setSelectedYear(selectedYear === year ? null : year);
                                  setSelectedMonth(null);
                                  setSelectedDay(null);
                                }}
                                className={`w-full flex items-center text-left p-5 rounded hover:bg-white/5 transition-all ${selectedYear === year ? 'text-neon-blue bg-neon-blue/5 font-bold border-l-2 border-neon-blue pl-8' : 'text-parchment/80'}`}
                              >
                                <span className="mr-5 text-[8px]">{selectedYear === year ? '▼' : '▶'}</span>
                                {year}
                                <span className="text-[8px] opacity-34 ml-auto font-normal">
                                  ({countItemsForTemporal(year)} threads)
                                </span>
                              </button>

                              {selectedYear === year && (
                                <div className="pl-13 border-l border-white/5 space-y-2">
                                  {Object.keys(tree[year]).sort((a,b) => b.localeCompare(a)).map(month => (
                                    <div key={month} className="space-y-1">
                                      <button 
                                        onClick={() => {
                                          setSelectedMonth(selectedMonth === month ? null : month);
                                          setSelectedDay(null);
                                        }}
                                        className={`w-full flex items-center text-left p-3 rounded hover:bg-white/5 transition-all ${selectedMonth === month ? 'text-neon-magenta bg-neon-magenta/5 font-bold' : 'text-parchment/55'}`}
                                      >
                                        <span className="mr-5 text-[7px]">{selectedMonth === month ? '▼' : '▶'}</span>
                                        {MONTH_NAMES[month] || month}
                                        <span className="text-[7px] opacity-34 ml-auto font-normal">
                                          ({countItemsForTemporal(year, month)})
                                        </span>
                                      </button>

                                      {selectedMonth === month && (
                                        <div className="pl-13 border-l border-white/5 space-y-1">
                                          {Array.from(tree[year][month]).sort((a,b) => b.localeCompare(a)).map(day => (
                                            <button 
                                              key={day}
                                              onClick={() => setSelectedDay(selectedDay === day ? null : day)}
                                              className={`w-full flex items-center text-left p-3 rounded hover:bg-white/5 transition-all text-[10px] ${selectedDay === day ? 'text-neon-blue bg-neon-blue/10 font-bold border border-neon-blue/21' : 'text-parchment/40'}`}
                                            >
                                              📅 {day} {MONTH_NAMES[month]?.substring(0,3)}
                                              <span className="text-[7px] opacity-32 ml-auto">
                                                ({countItemsForTemporal(year, month, day)})
                                              </span>
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* PANE 2: THE COLD FILE LIST (4 cols) */}
                  <div className="lg:col-span-4 space-y-8 max-h-[680px] overflow-y-auto silk-scroll pr-5">
                    {getFilteredItems().map((archive) => (
                      <div 
                        key={archive.id} 
                        onClick={() => handleSelectItem(archive)}
                        className={`glass-panel p-13 border cursor-pointer hover:border-neon-blue/21 transition-all flex flex-col justify-between group rounded-10 ${
                          selectedItem?.id === archive.id 
                            ? 'border-neon-blue bg-neon-blue/5 shadow-[0_0_15px_rgba(10,132,255,0.05)]' 
                            : 'border-white/5 hover:bg-white/5'
                        }`}
                      >
                        <div className="flex-1">
                          <div className="text-11 font-bold text-parchment group-hover:text-neon-blue transition-colors line-clamp-2 leading-snug">{archive.title || archive.id}</div>
                          <div className="text-[9px] text-parchment/34 caps-modern mt-8 flex justify-between items-center">
                            <span>MESSAGES: {archive.msgCount}</span>
                            <span className="text-neon-blue font-semibold">COLD</span>
                          </div>
                        </div>
                        <div className="mt-8 pt-8 border-t border-white/5 flex items-center justify-between text-[8px] text-parchment/30">
                          <span>
                            {(() => {
                              try {
                                const lat = (archive.migratedAt as any);
                                let d = getParsedDate(lat);
                                return format(d, 'PP');
                              } catch (e) {
                                return 'RECENT';
                              }
                            })()}
                          </span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRehydrate(archive.id);
                            }}
                            className="px-5 py-2 bg-neon-cyan/10 hover:bg-neon-cyan/34 text-neon-cyan border border-neon-cyan/21 rounded text-[8px] caps-modern font-bold flex items-center gap-3"
                            title="Rehydrate Conversation block"
                          >
                            <RefreshCw className="w-8 h-8" />
                            REHYDRATE
                          </button>
                        </div>
                      </div>
                    ))}
                    {getFilteredItems().length === 0 && (
                      <div className="text-center py-55 text-parchment/21 text-12 italic bg-void/10 border border-dashed border-white/5 rounded-13">
                        No cold storage shards match query.
                      </div>
                    )}
                  </div>

                  {/* PANE 3: CHAT DETAILS READER (5 cols) */}
                  <div className="lg:col-span-5">
                    {selectedItem ? (
                      <div className="glass-panel border-neon-blue/21 h-[680px] flex flex-col rounded-13 overflow-hidden bg-void/50">
                        {/* Reader Header */}
                        <div className="p-13 border-b border-white/5 flex items-center justify-between bg-void/85 shrink-0">
                          <div className="min-w-0 pr-8">
                            <div className="text-[8px] caps-modern text-neon-blue mb-3 flex items-center gap-5 font-bold">
                              <span>❄️ SECURED CRYPTOGRAPHIC STORAGE</span>
                              <span>·</span>
                              <span>MIGRATED: {format(getParsedDate(selectedItem.migratedAt), 'PPp')}</span>
                            </div>
                            <h4 className="text-12 font-bold text-parchment leading-tight line-clamp-1">{selectedItem.title || selectedItem.id}</h4>
                          </div>
                          
                          <button 
                            onClick={() => handleRehydrate(selectedItem.id)}
                            className="px-8 py-5 shrink-0 bg-neon-cyan/10 hover:bg-neon-cyan/21 text-neon-cyan border border-neon-cyan/34 rounded text-[9px] caps-modern font-bold flex items-center gap-3 transition-all"
                          >
                            <RefreshCw className="w-8 h-8" />
                            REHYDRATE
                          </button>
                        </div>
                        
                        {/* Transcript Viewer */}
                        <div className="flex-1 overflow-y-auto p-13 silk-scroll space-y-13 bg-void/21">
                          {selectedItemMessages.length > 0 ? (
                            selectedItemMessages.map((msg, idx) => (
                              <div key={msg.id || idx} className="space-y-3">
                                <div className="flex items-center justify-between text-[8px] font-mono tracking-wider pl-5">
                                  <span className={msg.role === 'user' ? 'text-neon-cyan font-bold' : 'text-neon-magenta font-semibold'}>
                                    {msg.role === 'user' ? '👤 HUMAN VISITOR' : '🤖 ENCRYPTED CORE'}
                                  </span>
                                  <span className="text-parchment/21 scale-90">
                                    {msg.hash ? `HASH: ${msg.hash.substring(0, 8)}` : `#${idx + 1}`}
                                  </span>
                                </div>
                                
                                <div className={`p-10 rounded-8 border text-11 leading-relaxed ${
                                  msg.role === 'user' 
                                    ? 'bg-void/80 border-neon-cyan/8 text-parchment/90 selection:bg-neon-cyan/20 font-mono text-[10px]' 
                                    : 'bg-white/5 border-neon-magenta/8 text-parchment/89 font-sans selection:bg-neon-magenta/20 shadow-[inset_0_0_10px_rgba(255,0,128,0.01)]'
                                }`}>
                                  <div className="prose prose-invert max-w-none text-left leading-relaxed">
                                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-21 text-parchment/21 italic text-[10px]">
                              Transcript is loading or structural parsing failed.
                            </div>
                          )}
                        </div>

                        {/* Reader Footer */}
                        <div className="p-10 border-t border-white/5 bg-void/80 text-[8px] font-mono text-parchment/21 flex items-center justify-between shrink-0">
                          <div>MANIFEST: {selectedItem.manifest || 'UNMANIFESTED'}</div>
                          <div>TIER: COLD_COMPRESSION_BLOB</div>
                        </div>
                      </div>
                    ) : (
                      <div className="glass-panel border-white/5 h-[680px] flex flex-col items-center justify-center text-center p-34 text-parchment/21 rounded-13">
                        <Snowflake className="w-21 h-21 text-parchment/13 mb-8 animate-pulse" />
                        <h4 className="text-[10px] caps-modern text-parchment/34 tracking-widest uppercase">Select cold archive</h4>
                        <p className="text-[9px] text-parchment/21 mt-5 max-w-xs leading-normal font-sans">
                          Click on any cold compressed node to instantly parse, decrypt, and display its complete dialog transcripts without rehydration.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'audit' && (
              <motion.div key="audit" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div className="glass-panel border-white/5 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-white/5 text-[10px] caps-modern text-parchment/34 border-b border-white/10">
                      <tr>
                        <th className="px-21 py-13 font-medium">TIMESTAMP</th>
                        <th className="px-21 py-13 font-medium">ACTION</th>
                        <th className="px-21 py-13 font-medium">DETAIL</th>
                        <th className="px-21 py-13 font-medium">ENTITY</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {auditLogs.map((log, idx) => (
                        <tr key={idx} className="hover:bg-white/5 transition-colors text-[11px] font-mono">
                          <td className="px-21 py-13 text-parchment/34 whitespace-nowrap">{log.time}</td>
                          <td className="px-21 py-13 text-neon-cyan font-bold">{log.action}</td>
                          <td className="px-21 py-13 text-parchment/89">{log.detail}</td>
                          <td className="px-21 py-13 text-parchment/55">{log.participant}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-34">
                 <div className="glass-panel p-34 border-neon-cyan/13">
                    <h3 className="text-13 caps-modern text-neon-cyan mb-34 flex items-center gap-8 border-b border-neon-cyan/13 pb-8">
                       <Settings className="w-13 h-13" />
                       Persistence Protocols
                    </h3>
                    <div className="space-y-21">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-13">
                        <div>
                          <div className="text-13 font-bold text-parchment">Hot Tier Retention</div>
                          <div className="text-[11px] text-parchment/34 font-sans">Number of days before a witness thread is migrated to cold storage.</div>
                        </div>
                        <div className="flex items-center gap-8">
                          <input 
                            type="range" min="1" max="365" value={retentionDays} 
                            onChange={(e) => setRetentionDays(parseInt(e.target.value))}
                            className="accent-neon-cyan w-44"
                          />
                          <span className="text-13 text-neon-cyan font-bold">{retentionDays} DAYS</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-13 pt-21 border-t border-white/5">
                        <div>
                          <div className="text-13 font-bold text-parchment">Zero-Knowledge Sharding</div>
                          <div className="text-[11px] text-parchment/34 font-sans">Automatically encrypt cold archives with a secondary neural key.</div>
                        </div>
                        <div className="w-13 h-8 bg-neon-cyan/10 border border-neon-cyan/21 rounded-full relative p-2 shadow-[inset_0_0_10px_rgba(0,230,118,0.1)]">
                          <div className="absolute right-2 top-2 w-4 h-4 bg-neon-cyan rounded-full shadow-[0_0_8px_#00E676]" />
                        </div>
                      </div>
                    </div>
                 </div>

                 <div className="glass-panel p-34 border-cyber-red/21 bg-cyber-red/5">
                    <h3 className="text-13 caps-modern text-cyber-red mb-21 flex items-center gap-8">
                       <AlertTriangle className="w-13 h-13" />
                       Neural Wipe (Emergency)
                    </h3>
                    <p className="text-[11px] text-parchment/55 font-sans mb-21">
                      Immediately purge all hot and cold storage shards. This action is immutable and irreversible within the Aitihya Chain.
                    </p>
                    <button className="px-21 py-13 bg-cyber-red text-white text-[11px] caps-modern font-bold rounded-8 hover:bg-cyber-red/89 transition-all shadow-[0_0_15px_rgba(255,42,42,0.3)]">
                      PURGE_ALL_WITNESS_HISTORY
                    </button>
                 </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
