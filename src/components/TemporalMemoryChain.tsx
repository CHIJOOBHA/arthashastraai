import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import type { User } from 'firebase/auth';
import {
  getTemporalDayBlock,
  initializeDayBlock,
  addMessageBlockToDay,
  importChatToDayBlock,
  getPopulatedBlockDates,
  deleteDayBlock,
  verifyDayChain,
  TemporalDayBlock,
  ChainCheck,
  GENESIS_HASH,
} from '../lib/temporalStore';
import { getConversations, Conversation } from '../lib/chatStore';
import { useAuthUser } from '../lib/firebase';
import {
  Calendar, Link as LinkIcon, Database, CheckCircle2, AlertTriangle,
  Plus, Loader2, ArrowRight, RefreshCw, Sparkles, Lock, Key, X
} from 'lucide-react';
import { Markdown } from './Markdown';

interface TemporalMemoryChainProps {
  user?: User | null;
  language?: string;
  isAdmin?: boolean;
}

type BlockState = 'idle' | 'loading' | 'missing' | 'ready' | 'error';

const pad = (val: number): string => val.toString().padStart(2, '0');
const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();
const errMsg = (e: unknown) => (e instanceof Error && e.message ? e.message : 'Something went wrong. Please try again.');

export function TemporalMemoryChain({ user: userProp }: TemporalMemoryChainProps = {}) {
  const user = useAuthUser(userProp);
  const uid = user?.uid;

  const now = new Date();
  const [activeYear, setActiveYear] = useState<number>(now.getFullYear());
  const [activeMonth, setActiveMonth] = useState<number>(now.getMonth() + 1);
  const [activeDay, setActiveDay] = useState<number>(now.getDate());

  // Data state
  const [populatedDates, setPopulatedDates] = useState<string[]>([]);
  const [currentBlock, setCurrentBlock] = useState<TemporalDayBlock | null>(null);
  const [blockState, setBlockState] = useState<BlockState>('idle');
  const [blockError, setBlockError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [liveChats, setLiveChats] = useState<Conversation[]>([]);
  const [integrity, setIntegrity] = useState<ChainCheck | null>(null);

  // Interaction state
  const [selectedChatForImport, setSelectedChatForImport] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);
  const [newMsgText, setNewMsgText] = useState('');
  const [newMsgRole, setNewMsgRole] = useState<'user' | 'model' | 'system'>('user');
  const [isSavingMsg, setIsSavingMsg] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);

  const MONTH_NAMES = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    name: new Date(2000, i, 1).toLocaleString(undefined, { month: 'long' }),
  }));

  // Years shown: a window around the selected year plus any year that has data.
  const currentYear = now.getFullYear();
  const yearSet = new Set<number>();
  for (let y = activeYear - 5; y <= Math.max(activeYear + 2, currentYear + 1); y++) yearSet.add(y);
  populatedDates.forEach((d) => yearSet.add(Number(d.slice(0, 4))));
  const YEARS = Array.from(yearSet).filter((y) => y > 0).sort((a, b) => a - b);
  const ALL_YEARS: number[] = [];
  for (let y = currentYear - 30; y <= currentYear + 10; y++) ALL_YEARS.push(y);

  const selectedDateStr = `${activeYear}-${pad(activeMonth)}-${pad(activeDay)}`;

  const selectYear = (year: number) => {
    setActiveYear(year);
    setActiveDay((d) => Math.min(d, daysInMonth(year, activeMonth)));
  };
  const selectMonth = (month: number) => {
    setActiveMonth(month);
    setActiveDay((d) => Math.min(d, daysInMonth(activeYear, month)));
  };

  const showFeedback = (kind: 'ok' | 'error', text: string) => {
    setFeedback({ kind, text });
    if (kind === 'ok') setTimeout(() => setFeedback((f) => (f && f.text === text ? null : f)), 4000);
  };

  const loadIndices = useCallback(async () => {
    if (!uid) return;
    try {
      const [dates, chats] = await Promise.all([getPopulatedBlockDates(), getConversations()]);
      setPopulatedDates(dates);
      setLiveChats(chats);
    } catch (e) {
      console.error('[TemporalMemoryChain] Could not load calendar:', e);
      showFeedback('error', `Could not load your calendar: ${errMsg(e)}`);
    }
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      setPopulatedDates([]);
      setLiveChats([]);
      return;
    }
    loadIndices();
  }, [uid, loadIndices]);

  // Load the selected day; ignore responses for days that are no longer selected.
  useEffect(() => {
    if (!uid) {
      setCurrentBlock(null);
      setBlockState('idle');
      return;
    }
    let cancelled = false;
    setBlockState('loading');
    setBlockError(null);
    setConfirmDelete(false);
    getTemporalDayBlock(selectedDateStr)
      .then((block) => {
        if (cancelled) return;
        setCurrentBlock(block);
        setBlockState(block ? 'ready' : 'missing');
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('[TemporalMemoryChain] Could not load day:', e);
        setCurrentBlock(null);
        setBlockError(errMsg(e));
        setBlockState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [uid, selectedDateStr, reloadKey]);

  // Verify the stored chain (read-only).
  useEffect(() => {
    if (!currentBlock) {
      setIntegrity(null);
      return;
    }
    let cancelled = false;
    verifyDayChain(currentBlock.messageBlocks)
      .then((r) => !cancelled && setIntegrity(r))
      .catch(() => !cancelled && setIntegrity(null));
    return () => {
      cancelled = true;
    };
  }, [currentBlock]);

  const refreshDay = () => setReloadKey((k) => k + 1);

  const handleInitializeBlock = async () => {
    setIsBusy(true);
    try {
      await initializeDayBlock(selectedDateStr);
      refreshDay();
      await loadIndices();
      showFeedback('ok', `Day ${selectedDateStr} created.`);
    } catch (e) {
      showFeedback('error', `Could not create the day: ${errMsg(e)}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleImportChat = async () => {
    if (!selectedChatForImport) return;
    setIsImporting(true);
    try {
      const chat = liveChats.find((c) => c.id === selectedChatForImport);
      const added = await importChatToDayBlock(selectedDateStr, selectedChatForImport, chat?.title || 'Untitled');
      refreshDay();
      await loadIndices();
      setSelectedChatForImport('');
      showFeedback('ok', added ? `${added} message(s) added to ${selectedDateStr}.` : 'Those messages are already on this day; nothing was added.');
    } catch (e) {
      showFeedback('error', `Copy failed: ${errMsg(e)}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleAddDirectMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsgText.trim()) return;
    setIsSavingMsg(true);
    try {
      await addMessageBlockToDay(selectedDateStr, newMsgRole, newMsgText.trim());
      setNewMsgText('');
      refreshDay();
      await loadIndices();
      showFeedback('ok', `Entry added to ${selectedDateStr}.`);
    } catch (err) {
      showFeedback('error', `Could not add the entry: ${errMsg(err)}`);
    } finally {
      setIsSavingMsg(false);
    }
  };

  const handleDeleteDay = async () => {
    setIsBusy(true);
    try {
      await deleteDayBlock(selectedDateStr);
      setConfirmDelete(false);
      refreshDay();
      await loadIndices();
      showFeedback('ok', `Day ${selectedDateStr} deleted.`);
    } catch (e) {
      showFeedback('error', `Could not delete the day: ${errMsg(e)}`);
    } finally {
      setIsBusy(false);
    }
  };

  const isLoadingBlock = blockState === 'loading' || isBusy;
  const integrityOk = integrity?.valid ?? true;

  if (!user) {
    return (
      <div className="p-34 bg-void/50 border border-neon-cyan/21 rounded-13 text-center text-[11px] text-parchment/55 font-mono">
        <Lock className="w-21 h-21 text-neon-cyan mx-auto mb-8" />
        Sign in to use your private memory calendar.
      </div>
    );
  }

  return (
    <div className="space-y-21 text-parchment font-mono">
      {/* Title block */}
      <div className="p-13 bg-void/50 border border-neon-cyan/21 rounded-13 flex flex-col md:flex-row md:items-center md:justify-between gap-13">
        <div>
          <h2 className="text-15 font-bold text-neon-cyan tracking-wider flex items-center gap-10">
            <Database className="w-15 h-15 animate-pulse" />
            MEMORY CALENDAR
          </h2>
          <p className="text-[10px] text-parchment/55 leading-relaxed mt-3">
            Private day-by-day notes, stored in your account. Entries of each day are linked with SHA-256 hashes, so later edits to stored entries are detectable. You can delete any day at any time.
          </p>
        </div>
        <div className="flex items-center gap-8 text-[11px] bg-void/80 border border-white/5 py-5 px-10 rounded-8">
          <Calendar className="w-13 h-13 text-neon-cyan" />
          <span>SELECTED DAY: <strong className="text-neon-magenta">{new Date(activeYear, activeMonth - 1, activeDay).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</strong></span>
        </div>
      </div>

      {feedback && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-13 border rounded-8 text-11 flex items-center gap-10 ${
            feedback.kind === 'ok' ? 'bg-neon-cyan/10 border-neon-cyan text-neon-cyan' : 'bg-red-500/10 border-red-500/50 text-red-400'
          }`}
        >
          {feedback.kind === 'ok' ? <CheckCircle2 className="w-13 h-13 shrink-0" /> : <AlertTriangle className="w-13 h-13 shrink-0" />}
          <span className="flex-1">{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="opacity-55 hover:opacity-100" aria-label="Dismiss">
            <X className="w-11 h-11" />
          </button>
        </motion.div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-21">
        {/* LEFT COLUMN: calendar */}
        <div className="xl:col-span-4 space-y-13">
          <div className="bg-void/45 border border-white/5 p-13 rounded-13 space-y-13">
            <div className="flex items-center justify-between border-b border-white/5 pb-10">
              <span className="text-[10px] bg-neon-cyan/8 text-neon-cyan px-8 py-3 rounded border border-neon-cyan/21 flex items-center gap-5 font-bold">
                <Lock className="w-8 h-8" />
                CALENDAR
              </span>
              <button
                onClick={() => {
                  loadIndices();
                  refreshDay();
                }}
                className="p-5 hover:bg-white/5 rounded-5 hover:text-neon-cyan transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-11 h-11" />
              </button>
            </div>

            <div className="space-y-10">
              {/* YEAR */}
              <div className="space-y-5">
                <label className="text-[9px] text-parchment/34 uppercase tracking-widest block font-bold">1. Year</label>
                <div className="flex flex-col gap-5">
                  <div className="flex gap-5 overflow-x-auto silk-scroll pb-5">
                    {YEARS.map((year) => {
                      const hasDataInYear = populatedDates.some((d) => d.startsWith(`${year}-`));
                      return (
                        <button
                          key={year}
                          onClick={() => selectYear(year)}
                          className={`px-10 py-5 text-11 rounded border shrink-0 transition-all font-bold ${
                            activeYear === year
                              ? 'bg-neon-cyan/10 border-neon-cyan text-neon-cyan font-extrabold shadow-[0_0_8px_rgba(0,230,118,0.1)]'
                              : hasDataInYear
                                ? 'bg-white/5 border-neon-cyan/21 text-parchment hover:border-neon-cyan/50'
                                : 'bg-void/40 border-white/5 text-parchment/50 hover:bg-white/5 hover:text-parchment'
                          }`}
                        >
                          {year}
                          {hasDataInYear && <span className="ml-5 text-[8px] text-neon-cyan">●</span>}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex justify-between items-center text-[10px]">
                    <button
                      onClick={() => {
                        const t = new Date();
                        setActiveYear(t.getFullYear());
                        setActiveMonth(t.getMonth() + 1);
                        setActiveDay(t.getDate());
                      }}
                      className="text-parchment/34 hover:text-neon-cyan text-[9px] cursor-pointer"
                    >
                      TODAY
                    </button>
                    <button
                      onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
                      className="text-neon-cyan hover:underline text-[9px] flex items-center gap-3 cursor-pointer"
                    >
                      <span>{isYearDropdownOpen ? 'CLOSE' : 'MORE YEARS ▼'}</span>
                    </button>
                  </div>

                  {isYearDropdownOpen && (
                    <div className="grid grid-cols-5 gap-3 max-h-110 overflow-y-auto silk-scroll p-8 bg-void border border-white/5 rounded-8">
                      {ALL_YEARS.map((y) => (
                        <button
                          key={y}
                          onClick={() => {
                            selectYear(y);
                            setIsYearDropdownOpen(false);
                          }}
                          className={`p-3 text-[10px] rounded hover:bg-white/5 text-center ${
                            activeYear === y ? 'text-neon-cyan bg-neon-cyan/5 border border-neon-cyan/21' : 'text-parchment/40'
                          }`}
                        >
                          {y}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* MONTH */}
              <div className="space-y-5">
                <label className="text-[9px] text-parchment/34 uppercase tracking-widest block font-bold">2. Month</label>
                <div className="grid grid-cols-4 gap-5">
                  {MONTH_NAMES.map((m) => {
                    const hasDataInMonth = populatedDates.some((d) => d.startsWith(`${activeYear}-${pad(m.value)}-`));
                    return (
                      <button
                        key={m.value}
                        onClick={() => selectMonth(m.value)}
                        className={`px-5 py-5 text-[10px] rounded border transition-all text-center font-bold ${
                          activeMonth === m.value
                            ? 'bg-neon-magenta/10 border-neon-magenta text-neon-magenta font-extrabold'
                            : hasDataInMonth
                              ? 'bg-white/5 border-neon-magenta/21 text-parchment hover:border-neon-magenta'
                              : 'bg-void/40 border-white/5 text-parchment/40 hover:bg-white/5'
                        }`}
                      >
                        {m.name.substring(0, 3)}
                        {hasDataInMonth && <span className="ml-3 text-[8px] text-neon-magenta">●</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* DAY GRID */}
              <div className="space-y-5">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] text-parchment/34 uppercase tracking-widest block font-bold">3. Day</label>
                  <span className="text-[9px] text-neon-cyan font-bold bg-neon-cyan/5 px-5 py-1 rounded">
                    {MONTH_NAMES[activeMonth - 1]?.name} {activeYear}
                  </span>
                </div>

                <div className="bg-void/80 border border-white/5 p-8 rounded-8">
                  <div className="grid grid-cols-7 gap-5 text-center mb-5 text-[8px] uppercase tracking-wider text-parchment/34 font-sans font-bold">
                    <div>S</div><div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div>
                  </div>

                  <div className="grid grid-cols-7 gap-5">
                    {(() => {
                      const offset = new Date(activeYear, activeMonth - 1, 1).getDay();
                      const totalDays = daysInMonth(activeYear, activeMonth);
                      const elements = [];
                      for (let i = 0; i < offset; i++) {
                        elements.push(<div key={`empty-${i}`} className="p-5 text-transparent text-[11px]" />);
                      }
                      for (let d = 1; d <= totalDays; d++) {
                        const dayStr = `${activeYear}-${pad(activeMonth)}-${pad(d)}`;
                        const isPopulated = populatedDates.includes(dayStr);
                        const isSelected = activeDay === d;
                        elements.push(
                          <button
                            key={`day-${d}`}
                            onClick={() => setActiveDay(d)}
                            className={`p-5 text-[10px] rounded transition-all font-bold flex flex-col items-center justify-between min-h-34 border ${
                              isSelected
                                ? 'bg-neon-cyan border-neon-cyan text-void font-extrabold shadow-[0_0_10px_rgba(0,230,118,0.3)]'
                                : isPopulated
                                  ? 'bg-neon-cyan/10 border-neon-cyan/34 text-neon-cyan hover:bg-neon-cyan/20'
                                  : 'bg-void border-white/5 text-parchment/40 hover:bg-white/5 hover:text-parchment'
                            }`}
                          >
                            <span>{d}</span>
                            {isPopulated && !isSelected && <span className="w-4 h-4 bg-neon-cyan rounded-full animate-pulse" />}
                          </button>
                        );
                      }
                      return elements;
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* COPY A CONVERSATION */}
          <div className="bg-void/45 border border-white/5 p-13 rounded-13 space-y-10">
            <h4 className="text-[10px] font-bold text-neon-magenta tracking-wider uppercase flex items-center gap-5">
              <Sparkles className="w-11 h-11 text-neon-magenta" />
              COPY A CONVERSATION TO THIS DAY
            </h4>
            <p className="text-[9px] text-parchment/40 leading-snug">
              Adds the messages of one of your conversations to the end of this day, with their original times. Existing entries are kept; messages already copied are skipped.
            </p>

            <div className="space-y-8">
              <select
                value={selectedChatForImport}
                onChange={(e) => setSelectedChatForImport(e.target.value)}
                className="w-full bg-void/55 border border-white/10 rounded-8 py-8 px-10 text-[11px] focus:border-neon-magenta outline-none transition-all pr-13"
              >
                <option value="">-- Choose a conversation --</option>
                {liveChats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {(c.title || 'Untitled').substring(0, 40)}
                  </option>
                ))}
              </select>

              <button
                disabled={!selectedChatForImport || isImporting}
                onClick={handleImportChat}
                className="w-full py-10 rounded-8 border border-neon-magenta bg-neon-magenta/10 hover:bg-neon-magenta/21 text-neon-magenta text-[10px] caps-modern font-bold transition-all flex items-center justify-center gap-8 disabled:opacity-21 disabled:pointer-events-none"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-13 h-13 animate-spin text-neon-magenta" />
                    <span>COPYING...</span>
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-13 h-13" />
                    <span>COPY TO {selectedDateStr}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: the day's entries */}
        <div className="xl:col-span-8">
          <div className="glass-panel border-neon-cyan/21 min-h-[640px] flex flex-col rounded-13 overflow-hidden bg-void/40">
            <div className="p-13 border-b border-white/5 bg-void/80 flex items-center justify-between shrink-0">
              <div className="min-w-0 pr-10">
                <div className="flex items-center gap-8 mb-3">
                  <span className="text-[8px] caps-modern font-bold bg-void px-5 py-2 border border-white/10 text-parchment/55">
                    DAY: {selectedDateStr}
                  </span>
                  {currentBlock && currentBlock.messageBlocks.length > 0 && integrity && (
                    <span
                      className={`text-[8px] caps-modern font-bold px-5 py-2 rounded flex items-center gap-3 ${
                        integrity.valid
                          ? 'bg-neon-cyan/10 border border-neon-cyan/34 text-neon-cyan'
                          : integrity.legacy
                            ? 'bg-white/5 border border-white/20 text-parchment/55'
                            : 'bg-red-500/10 border border-red-500/34 text-red-500'
                      }`}
                    >
                      {integrity.valid
                        ? '✅ HASH LINKS MATCH'
                        : integrity.legacy
                          ? 'OLD FORMAT — NOT VERIFIABLE'
                          : `⚠ HASH MISMATCH AT ENTRY #${integrity.errorIndex}`}
                    </span>
                  )}
                </div>
                <h3 className="text-12 font-bold text-parchment flex items-center gap-5">
                  <Calendar className="w-12 h-12 text-neon-cyan" />
                  Entries for {selectedDateStr}
                </h3>
              </div>

              {currentBlock && !confirmDelete && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  disabled={isLoadingBlock}
                  className="px-8 py-5 text-[9px] bg-red-500/10 border border-red-500/34 text-red-500 rounded hover:bg-red-500/21 hover:text-white transition-all font-bold tracking-widest caps-modern"
                  title="Delete this day"
                >
                  DELETE DAY
                </button>
              )}
            </div>

            {confirmDelete && (
              <div className="p-13 border-b border-red-500/34 bg-red-500/10 text-[10px] text-parchment/89 flex flex-col md:flex-row md:items-center gap-10">
                <span className="flex-1">
                  Permanently delete all {currentBlock?.messageBlocks.length || 0} entries of {selectedDateStr}? This cannot be undone.
                </span>
                <div className="flex gap-8">
                  <button
                    onClick={handleDeleteDay}
                    disabled={isBusy}
                    className="px-10 py-5 bg-red-500 text-white rounded font-bold caps-modern text-[9px] disabled:opacity-50"
                  >
                    {isBusy ? 'DELETING...' : 'YES, DELETE'}
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className="px-10 py-5 border border-white/20 rounded caps-modern text-[9px]">
                    CANCEL
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-21 silk-scroll bg-void/10 min-h-[400px]">
              {isLoadingBlock ? (
                <div className="h-[400px] flex flex-col items-center justify-center space-y-8 text-parchment/34 text-[11px]">
                  <Loader2 className="w-21 h-21 text-neon-cyan animate-spin" />
                  <span>Loading...</span>
                </div>
              ) : blockState === 'error' ? (
                <div className="h-[430px] flex flex-col items-center justify-center text-center p-34 space-y-8 border border-dashed border-red-500/34 rounded-13">
                  <AlertTriangle className="w-21 h-21 text-red-400" />
                  <h4 className="text-[10px] caps-modern text-red-400 tracking-widest uppercase">Could not load this day</h4>
                  <p className="text-[10px] text-parchment/55 max-w-sm font-sans">{blockError}</p>
                  <button
                    onClick={refreshDay}
                    className="mt-8 px-13 py-8 bg-neon-cyan/10 hover:bg-neon-cyan/21 text-neon-cyan border border-neon-cyan/34 rounded-8 text-[10px] caps-modern font-bold transition-all"
                  >
                    Try again
                  </button>
                </div>
              ) : currentBlock ? (
                currentBlock.messageBlocks.length > 0 ? (
                  <div className="space-y-34 relative">
                    <div className="absolute left-[13px] top-[15px] bottom-[15px] w-2 bg-gradient-to-b from-neon-cyan via-neon-magenta to-neon-blue rounded opacity-21 pointer-events-none" />

                    <div className="bg-void/55 border border-white/5 rounded-8 p-10 text-[10px] text-parchment/55 leading-relaxed bg-gradient-to-r from-neon-cyan/5 to-transparent">
                      💡 <strong>How the links work:</strong> each entry stores a SHA-256 hash of its content and of the entry before it. If a stored entry is later changed, the hashes stop matching and the badge above shows where. This detects edits; it does not prevent them.
                    </div>

                    {currentBlock.messageBlocks.map((msg, idx) => {
                      const isModel = msg.role === 'model' || msg.role === 'system';
                      const isHashValid = integrityOk || idx < (integrity?.errorIndex ?? Infinity);
                      const created = new Date(msg.createdAt);
                      return (
                        <motion.div
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          key={msg.id || idx}
                          className="relative pl-34 space-y-5"
                        >
                          <div className={`absolute left-[5px] top-[10px] w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center text-[7px] font-mono font-bold z-10 transition-all ${
                            isModel
                              ? 'bg-void border-neon-magenta text-neon-magenta shadow-[0_0_8px_#FF0080]'
                              : 'bg-void border-neon-cyan text-neon-cyan shadow-[0_0_8px_#00E676]'
                          }`}>
                            {idx}
                          </div>

                          <div className="flex flex-wrap items-center justify-between text-[9px] font-mono text-parchment/34">
                            <span className={`caps-modern font-bold tracking-wider ${isModel ? 'text-neon-magenta' : 'text-neon-cyan'}`}>
                              {msg.role === 'user' ? '👤 YOU' : msg.role === 'system' ? '📝 NOTE' : '🤖 AI (AI-GENERATED)'}
                            </span>
                            <span className="opacity-13 select-none">·</span>
                            <span>{isNaN(created.getTime()) ? `#${pad(idx)}` : created.toLocaleString(undefined)}</span>
                            <span className="opacity-13 select-none">·</span>
                            <span className={isHashValid ? 'text-neon-cyan/55' : 'text-red-500 font-bold'}>
                              HASH: {String(msg.hash || '').substring(0, 15)}
                            </span>
                          </div>

                          <div className="text-[8px] font-mono text-parchment/21 flex items-center gap-5">
                            <LinkIcon className="w-8 h-8 opacity-50 text-neon-cyan" />
                            <span>PREV: {String(msg.previousHash || '').substring(0, 15)}</span>
                          </div>

                          <div className={`p-13 border rounded-8 text-11 leading-relaxed relative overflow-hidden ${
                            isModel
                              ? 'bg-white/5 border-neon-magenta/13 text-parchment/89 shadow-[inset_0_0_12px_rgba(255,0,128,0.02)]'
                              : 'bg-void border-neon-cyan/13 text-parchment/90 font-mono text-[10px]'
                          }`}>
                            <div className={`absolute right-0 top-0 w-8 h-8 rounded-bl-8 ${isModel ? 'bg-neon-magenta/21' : 'bg-neon-cyan/21'}`} />
                            <Markdown className="prose prose-invert max-w-none text-left leading-relaxed">{msg.text}</Markdown>
                          </div>
                        </motion.div>
                      );
                    })}

                    <div className="text-center pt-10 text-[9px] text-parchment/30">
                      🔗 First link of the day: <span className="text-neon-cyan font-bold">{GENESIS_HASH}</span>
                    </div>
                  </div>
                ) : (
                  <div className="h-[430px] flex flex-col items-center justify-center text-center p-34 space-y-13 border border-dashed border-white/5 rounded-13 bg-void/25">
                    <Calendar className="w-34 h-34 text-parchment/13 animate-pulse" />
                    <div>
                      <h4 className="text-[11px] caps-modern text-parchment/55 tracking-widest uppercase">No entries yet</h4>
                      <p className="text-[10px] text-parchment/34 mt-5 max-w-sm leading-normal font-sans">
                        This day exists but is empty. Add an entry below or copy a conversation.
                      </p>
                    </div>
                  </div>
                )
              ) : (
                <div className="h-[430px] flex flex-col items-center justify-center text-center p-34 space-y-8 border border-dashed border-white/5 rounded-13">
                  <AlertTriangle className="w-21 h-21 text-parchment/13" />
                  <h4 className="text-[10px] caps-modern text-parchment/34 tracking-widest uppercase">Nothing saved for this day</h4>
                  <button
                    onClick={handleInitializeBlock}
                    disabled={blockState !== 'missing'}
                    className="mt-8 px-13 py-8 bg-neon-cyan/10 hover:bg-neon-cyan/21 text-neon-cyan border border-neon-cyan/34 rounded-8 text-[10px] caps-modern font-bold transition-all disabled:opacity-21"
                  >
                    Start this day
                  </button>
                </div>
              )}
            </div>

            {/* Add entry */}
            {blockState === 'ready' && currentBlock && (
              <div className="p-13 border-t border-white/5 bg-void/85 shrink-0 space-y-13">
                <form onSubmit={handleAddDirectMessage} className="space-y-10">
                  <div className="flex items-center justify-between text-[9px] text-parchment/34 bg-void/50 p-5 rounded">
                    <span className="flex items-center gap-5">
                      <Key className="w-10 h-10 text-neon-cyan" />
                      ADD AN ENTRY (APPENDED AT THE END)
                    </span>
                    <div className="flex items-center gap-8">
                      <span>TYPE:</span>
                      <select
                        value={newMsgRole}
                        onChange={(e) => setNewMsgRole(e.target.value as 'user' | 'model' | 'system')}
                        className="bg-void border border-white/10 rounded py-2 px-5 text-[9px] text-parchment font-bold focus:border-neon-cyan outline-none"
                      >
                        <option value="user">My words</option>
                        <option value="model">AI answer (pasted)</option>
                        <option value="system">Note</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-10">
                    <input
                      type="text"
                      placeholder="Write an entry for this day..."
                      maxLength={20000}
                      className="flex-1 bg-void/55 border border-white/10 rounded-8 py-8 px-13 text-11 focus:border-neon-cyan transition-all outline-none"
                      value={newMsgText}
                      onChange={(e) => setNewMsgText(e.target.value)}
                    />
                    <button
                      type="submit"
                      disabled={isSavingMsg || !newMsgText.trim()}
                      className="px-13 py-8 bg-neon-cyan/10 hover:bg-neon-cyan/21 text-neon-cyan border border-neon-cyan/34 rounded-8 text-[10px] font-bold caps-modern transition-all flex items-center gap-5 disabled:opacity-21 disabled:pointer-events-none"
                    >
                      {isSavingMsg ? <Loader2 className="w-11 h-11 animate-spin text-neon-cyan" /> : <Plus className="w-11 h-11" />}
                      <span>ADD</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="p-10 border-t border-white/5 bg-void/80 text-[8px] font-mono text-parchment/21 flex items-center justify-between shrink-0">
              <div>{populatedDates.length} DAY(S) SAVED</div>
              <div>PRIVATE · ONLY YOU CAN READ IT</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
