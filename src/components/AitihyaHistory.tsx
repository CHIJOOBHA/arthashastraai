import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import type { User } from 'firebase/auth';
import { Clock, MessageSquare, ChevronRight, Search, Calendar, RefreshCw } from 'lucide-react';
import { Conversation } from '../lib/chatStore';
import { db, toDate, useAuthUser } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

interface AitihyaHistoryProps {
  onSelectConversation: (id: string) => void;
  activeChatId?: string;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  user?: User | null;
  language?: string;
  isAdmin?: boolean;
}

const getLocalDateString = (d: Date): string =>
  `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;

/** "YYYY-MM-DD" -> local Date (not UTC midnight). */
const fromLocalDateString = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const lastActivity = (c: Conversation): Date | null => toDate(c.lastMessageAt) || toDate(c.updatedAt);

export function AitihyaHistory({ onSelectConversation, activeChatId, selectedDate, setSelectedDate, user: userProp }: AitihyaHistoryProps) {
  const user = useAuthUser(userProp);
  const uid = user?.uid;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(() => new Date().getMonth() + 1);

  useEffect(() => {
    if (!uid) {
      setConversations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    // No orderBy: avoids needing a composite index. Sorted on the client.
    const q = query(collection(db, 'conversations'), where('userId', '==', uid));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ ...(d.data({ serverTimestamps: 'estimate' }) as Conversation), id: d.id }));
        data.sort((a, b) => (lastActivity(b)?.getTime() || 0) - (lastActivity(a)?.getTime() || 0));
        setConversations(data);
        setLoading(false);
      },
      (err) => {
        console.error('[AitihyaHistory] Could not load conversations:', err);
        setLoadError('Could not load your conversations. Please try again.');
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [uid, refreshKey]);

  const dayOf = (c: Conversation) => {
    const d = lastActivity(c);
    return d ? getLocalDateString(d) : 'unknown';
  };

  const filterDays = Array.from(new Set(conversations.map(dayOf)))
    .filter((d) => d !== 'unknown')
    .sort((a, b) => b.localeCompare(a));

  const term = searchTerm.toLowerCase();
  const filtered = conversations.filter((c) => {
    const matchesSearch = (c.title || '').toLowerCase().includes(term) || c.id.toLowerCase().includes(term);
    if (!matchesSearch) return false;
    if (selectedDate === 'all') return true;
    return dayOf(c) === selectedDate;
  });

  const todayStr = getLocalDateString(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterday);

  const getGroupLabel = (dateStr: string) => {
    if (dateStr === 'unknown') return 'DATE UNKNOWN';
    if (dateStr === todayStr) return 'TODAY';
    if (dateStr === yesterdayStr) return 'YESTERDAY';
    return fromLocalDateString(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
  };

  const groupedConversations = filtered.reduce((groups: { [key: string]: Conversation[] }, conversation) => {
    const dateStr = dayOf(conversation);
    (groups[dateStr] ||= []).push(conversation);
    return groups;
  }, {});

  const sortedGroupDates = Object.keys(groupedConversations).sort((a, b) => b.localeCompare(a));

  return (
    <div className="flex flex-col h-full glass-panel border border-neon-cyan/13 rounded-13 overflow-hidden">
      <div className="p-21 border-b border-neon-cyan/13 bg-neon-cyan/5">
        <div className="flex items-center justify-between mb-13 border-b border-neon-cyan/8 pb-8">
          <div className="flex items-center gap-13">
            <Clock className="w-21 h-21 text-neon-cyan drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]" />
            <h2 className="text-13 caps-modern text-neon-cyan tracking-widest uppercase drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]">Temporal Archive</h2>
          </div>
          <div className="flex items-center gap-8">
            <button 
              onClick={() => setShowDatePicker(prev => !prev)}
              className={`p-5 rounded transition-all border ${
                showDatePicker 
                  ? 'bg-neon-cyan/15 border-neon-cyan text-neon-cyan shadow-[0_0_8px_rgba(0,240,255,0.4)]' 
                  : 'bg-void border-neon-cyan/13 text-neon-cyan/55 hover:text-neon-cyan hover:border-neon-cyan/34'
              }`}
              title="Toggle Calendar Box View"
            >
              <Calendar className="w-13 h-13" />
            </button>
            <button 
              onClick={() => setRefreshKey(prev => prev + 1)}
              disabled={loading}
              className="p-5 text-neon-cyan/55 hover:text-neon-cyan border border-transparent disabled:opacity-21 transition-all"
              title="Reload"
            >
              <motion.div animate={loading ? { rotate: 360 } : {}}>
                <RefreshCw className="w-13 h-13" />
              </motion.div>
            </button>
          </div>
        </div>

        {/* Dynamic Calendar Box Panel */}
        {showDatePicker && (
          <div className="mb-13 p-13 bg-void/90 border border-neon-cyan/34 rounded-8 space-y-10 text-[11px] hover:border-neon-cyan transition-all">
            <div className="flex items-center justify-between text-[10px] uppercase font-bold text-neon-cyan border-b border-neon-cyan/13 pb-5">
              <span>Date Select Grid</span>
              <div className="flex items-center gap-5">
                <button 
                  onClick={() => {
                    if (pickerMonth === 1) {
                      setPickerMonth(12);
                      setPickerYear(p => p - 1);
                    } else {
                      setPickerMonth(p => p - 1);
                    }
                  }} 
                  className="px-5 py-2 hover:bg-neon-cyan/21 border border-neon-cyan/13 rounded text-[8px] cursor-pointer"
                >
                  ◀
                </button>
                <span className="text-[9px] min-w-55 text-center">
                  {new Date(pickerYear, pickerMonth - 1).toLocaleString(undefined, { month: 'short', year: 'numeric' }).toUpperCase()}
                </span>
                <button 
                  onClick={() => {
                    if (pickerMonth === 12) {
                      setPickerMonth(1);
                      setPickerYear(p => p + 1);
                    } else {
                      setPickerMonth(p => p + 1);
                    }
                  }} 
                  className="px-5 py-2 hover:bg-neon-cyan/21 border border-neon-cyan/13 rounded text-[8px] cursor-pointer"
                >
                  ▶
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-3 text-center text-[7px] uppercase tracking-wider text-neon-cyan/34 font-sans font-bold">
              <div>S</div><div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div>
            </div>

            <div className="grid grid-cols-7 gap-3">
              {(() => {
                const offset = new Date(pickerYear, pickerMonth - 1, 1).getDay();
                const totalDays = new Date(pickerYear, pickerMonth, 0).getDate();
                const elements = [];

                for (let i = 0; i < offset; i++) {
                  elements.push(<div key={`empty-${i}`} className="p-3 text-transparent text-[8px]" />);
                }

                for (let d = 1; d <= totalDays; d++) {
                  const dayStr = `${pickerYear}-${(pickerMonth).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
                  const hasData = filterDays.includes(dayStr);
                  const isCurSelected = selectedDate === dayStr;

                  elements.push(
                    <button
                      key={`picker-day-${d}`}
                      onClick={() => {
                        setSelectedDate(dayStr);
                      }}
                      className={`p-3 text-[9px] rounded transition-all font-bold text-center flex flex-col items-center justify-center border ${
                        isCurSelected 
                          ? 'bg-neon-cyan border-neon-cyan text-void font-extrabold shadow-[0_0_8px_#00E676]' 
                          : hasData 
                            ? 'bg-neon-cyan/10 border-neon-cyan/34 text-neon-cyan hover:bg-neon-cyan/21' 
                            : 'bg-void border-white/5 text-parchment/34 hover:bg-white/5'
                      }`}
                    >
                      <span>{d}</span>
                      {hasData && !isCurSelected && (
                        <span className="w-4 h-4 bg-neon-cyan rounded-full animate-pulse mt-1" />
                      )}
                    </button>
                  );
                }

                return elements;
              })()}
            </div>
            
            <div className="flex justify-between items-center pt-5 border-t border-white/5 text-[8px] text-parchment/34 font-mono">
              <span className="flex items-center gap-3">
                <span className="w-[5px] h-[5px] bg-neon-cyan rounded-full" />
                DAYS WITH CONVERSATIONS
              </span>
              <button 
                onClick={() => {
                  setSelectedDate('all');
                  setShowDatePicker(false);
                }} 
                className="text-neon-cyan hover:underline cursor-pointer uppercase tracking-widest font-bold text-[7px]"
              >
                RESET FILTER
              </button>
            </div>
          </div>
        )}

        {/* Temporal Filter Bar */}
        <div className="flex items-center gap-8 overflow-x-auto silk-scroll pb-8 mb-13">
          <button
            onClick={() => setSelectedDate('all')}
            className={`px-8 py-3 rounded-5 text-[9px] caps-modern border transition-all whitespace-nowrap ${
              selectedDate === 'all' 
                ? 'bg-neon-cyan/21 border-neon-cyan text-neon-cyan shadow-[0_0_5px_rgba(0,240,255,0.3)]' 
                : 'bg-void/55 border-neon-cyan/13 text-neon-cyan/55 hover:border-neon-cyan/34'
            }`}
          >
            ALL TIME
          </button>
          {filterDays.map(day => {
            const isToday = day === todayStr;
            const label = isToday ? 'TODAY' : fromLocalDateString(day).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
            
            return (
              <button
                key={day}
                onClick={() => setSelectedDate(day)}
                className={`px-8 py-3 rounded-5 text-[9px] caps-modern border transition-all whitespace-nowrap ${
                  selectedDate === day 
                    ? 'bg-neon-cyan/21 border-neon-cyan text-neon-cyan shadow-[0_0_5px_rgba(0,240,255,0.3)]' 
                    : 'bg-void/55 border-neon-cyan/13 text-neon-cyan/55 hover:border-neon-cyan/34'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="relative">
          <Search className="absolute left-13 top-1/2 -translate-y-1/2 w-13 h-13 text-neon-cyan/55" />
          <input
            type="text"
            placeholder="Search your conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-void/55 border border-neon-cyan/21 rounded-8 py-8 pl-34 pr-13 text-13 text-parchment focus:border-neon-cyan focus:shadow-[0_0_10px_rgba(0,240,255,0.2)] outline-none transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-13 space-y-8">
        <div className="flex items-center justify-between px-8 py-5 mb-8 border-b border-neon-cyan/8">
          <span className="text-[9px] caps-modern text-neon-cyan/55 font-bold uppercase tracking-widest">Your conversations</span>
          <span className="text-[9px] font-mono text-neon-cyan bg-neon-cyan/13 px-5 py-1 rounded border border-neon-cyan/34 flex items-center gap-5">
            <div className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse" />
            {filtered.length} THREADS
          </span>
        </div>
        {!user ? (
          <div className="text-center py-55 opacity-55">
            <p className="text-13 caps-modern tracking-widest text-neon-cyan">Sign in to see your conversations.</p>
          </div>
        ) : loadError ? (
          <div className="text-center py-55">
            <p className="text-13 caps-modern tracking-widest text-cyber-red">{loadError}</p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-55 gap-13 opacity-34">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Clock className="w-34 h-34 text-neon-cyan drop-shadow-[0_0_8px_rgba(0,240,255,0.5)]" />
            </motion.div>
            <p className="text-13 caps-modern tracking-widest text-neon-cyan">Loading...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-55 opacity-55">
            <p className="text-13 caps-modern tracking-widest text-neon-cyan">No conversations found.</p>
          </div>
        ) : (
          <div className="space-y-21">
            {sortedGroupDates.map(dateStr => (
              <div key={dateStr} className="space-y-8">
                <div className="flex items-center gap-8 px-8">
                  <div className="h-px flex-1 bg-neon-cyan/8" />
                  <span className="text-[10px] caps-modern text-neon-cyan/55 font-bold tracking-widest">
                    {getGroupLabel(dateStr)}
                  </span>
                  <div className="h-px flex-1 bg-neon-cyan/8" />
                </div>
                {groupedConversations[dateStr].map((chat) => (
                  <motion.button
                    key={chat.id}
                    whileHover={{ x: 5 }}
                    onClick={() => onSelectConversation(chat.id)}
                    className={`w-full flex items-start gap-13 p-13 rounded-8 border transition-all text-left group ${
                      activeChatId === chat.id 
                        ? 'bg-neon-cyan/13 border-neon-cyan text-neon-cyan shadow-[0_0_8px_rgba(0,240,255,0.3)]' 
                        : 'bg-white/3 border-neon-cyan/13 hover:bg-neon-cyan/5 hover:border-neon-cyan/34 text-parchment/55 hover:text-parchment hover:shadow-[0_0_5px_rgba(0,240,255,0.2)]'
                    }`}
                  >
                    <div className={`p-8 rounded-full ${activeChatId === chat.id ? 'bg-neon-cyan/21 shadow-[0_0_5px_rgba(0,240,255,0.5)]' : 'bg-void/55 group-hover:bg-neon-cyan/13'}`}>
                      <MessageSquare className="w-13 h-13" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-13 font-medium truncate mb-3">{chat.title || 'Untitled conversation'}</p>
                      <div className="flex items-center gap-8 opacity-34 text-[10px]">
                        <Calendar className="w-8 h-8" />
                        <span>
                          {(() => {
                            const d = lastActivity(chat);
                            return d ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—';
                          })()}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-13 h-13 opacity-0 group-hover:opacity-100 transition-opacity self-center text-neon-cyan" />
                  </motion.button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-13 border-t border-neon-cyan/13 bg-void/89 text-center">
        <p className="text-[10px] text-neon-cyan/55 caps-modern tracking-[0.21em] drop-shadow-[0_0_2px_rgba(0,240,255,0.3)]">
          Private to your account · you can export or delete it
        </p>
      </div>
    </div>
  );
}
