import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  getTemporalDayBlock, 
  saveTemporalDayBlock, 
  addMessageBlockToDay, 
  importChatToDayBlock, 
  getPopulatedBlockDates, 
  MessageBlock,
  TemporalDayBlock,
  computeMessageHash
} from '../lib/temporalStore';
import { 
  getConversations, 
  Conversation 
} from '../lib/chatStore';
import { 
  Calendar, Link as LinkIcon, Database, CheckCircle2, AlertTriangle, 
  Plus, Search, Loader2, ArrowRight, MessageSquare, RefreshCw, Sparkles,
  Lock, Key, FileText, ChevronDown, ChevronRight, HelpCircle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export function TemporalMemoryChain() {
  const [activeYear, setActiveYear] = useState<number>(2026);
  const [activeMonth, setActiveMonth] = useState<number>(5); // May 2026 start
  const [activeDay, setActiveDay] = useState<number>(30); // Pre-select current
  
  // Data State
  const [populatedDates, setPopulatedDates] = useState<string[]>([]);
  const [currentBlock, setCurrentBlock] = useState<TemporalDayBlock | null>(null);
  const [isLoadingBlock, setIsLoadingBlock] = useState(false);
  const [liveChats, setLiveChats] = useState<Conversation[]>([]);
  
  // Interaction State
  const [selectedChatForImport, setSelectedChatForImport] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);
  const [newMsgText, setNewMsgText] = useState('');
  const [newMsgRole, setNewMsgRole] = useState<'user' | 'model' | 'system'>('user');
  const [isSavingMsg, setIsSavingMsg] = useState(false);
  const [isSuccessFeedback, setIsSuccessFeedback] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Dropdown states for mobile/compressed navigation
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);

  const MONTH_NAMES = [
    { value: 1, name: 'January' },
    { value: 2, name: 'February' },
    { value: 3, name: 'March' },
    { value: 4, name: 'April' },
    { value: 5, name: 'May' },
    { value: 6, name: 'June' },
    { value: 7, name: 'July' },
    { value: 8, name: 'August' },
    { value: 9, name: 'September' },
    { value: 10, name: 'October' },
    { value: 11, name: 'November' },
    { value: 12, name: 'December' }
  ];

  // Range 2026 to 2100
  const YEARS: number[] = [];
  for (let y = 2026; y <= 2100; y++) {
    YEARS.push(y);
  }

  // Get days in selected month & year
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
  };

  const getPaddedString = (val: number): string => val.toString().padStart(2, '0');

  const selectedDateStr = `${activeYear}-${getPaddedString(activeMonth)}-${getPaddedString(activeDay)}`;

  useEffect(() => {
    loadBlockIndicesAndChats();
  }, []);

  useEffect(() => {
    loadActiveBlock();
  }, [activeYear, activeMonth, activeDay]);

  const loadBlockIndicesAndChats = async () => {
    try {
      const [dates, chats] = await Promise.all([
        getPopulatedBlockDates(),
        getConversations()
      ]);
      setPopulatedDates(dates);
      setLiveChats(chats);
    } catch (e) {
      console.error('[YugaTemporalChain] Error fetching initial lists:', e);
    }
  };

  const loadActiveBlock = async () => {
    setIsLoadingBlock(true);
    try {
      const block = await getTemporalDayBlock(selectedDateStr);
      setCurrentBlock(block);
    } catch (e) {
      console.error('[YugaTemporalChain] Failed to load day block:', e);
    } finally {
      setIsLoadingBlock(false);
    }
  };

  const triggerSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setIsSuccessFeedback(true);
    setTimeout(() => {
      setIsSuccessFeedback(false);
    }, 4000);
  };

  const handleInitializeBlock = async () => {
    setIsLoadingBlock(true);
    try {
      const emptyBlock: TemporalDayBlock = {
        id: selectedDateStr,
        userId: '', // auto-filled inside temporalStore
        year: activeYear,
        month: activeMonth,
        day: activeDay,
        dateStr: selectedDateStr,
        messageBlocks: [],
        summary: 'Genesis interval activated'
      };
      const success = await saveTemporalDayBlock(emptyBlock);
      if (success) {
        await loadActiveBlock();
        await loadBlockIndicesAndChats();
        triggerSuccess(`Temporal storage block initialized successfully for ${selectedDateStr}`);
      }
    } catch (e) {
      console.error('[YugaTemporalChain] Genesis initiation error:', e);
    } finally {
      setIsLoadingBlock(false);
    }
  };

  const handleImportChat = async () => {
    if (!selectedChatForImport) return;
    setIsImporting(true);
    try {
      const chat = liveChats.find(c => c.id === selectedChatForImport);
      const title = chat?.title || 'System Stream';
      const success = await importChatToDayBlock(selectedDateStr, selectedChatForImport, title);
      if (success) {
        await loadActiveBlock();
        await loadBlockIndicesAndChats();
        setSelectedChatForImport('');
        triggerSuccess(`Connected message chain generated & solidified on ${selectedDateStr}. Integrity Valid!`);
      } else {
        alert("Failed to extract complete chat data. Verify the conversation is not empty.");
      }
    } catch (e) {
      console.error('[YugaTemporalChain] Import failure:', e);
    } finally {
      setIsImporting(false);
    }
  };

  const handleAddDirectMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsgText.trim()) return;
    setIsSavingMsg(true);
    try {
      const success = await addMessageBlockToDay(selectedDateStr, newMsgRole, newMsgText.trim());
      if (success) {
        setNewMsgText('');
        await loadActiveBlock();
        await loadBlockIndicesAndChats();
        triggerSuccess(`Chained block injected securely under index #${currentBlock?.messageBlocks.length || 0}`);
      }
    } catch (e) {
      console.error('[YugaTemporalChain] Append block error:', e);
    } finally {
      setIsSavingMsg(false);
    }
  };

  const handleClearBlock = async () => {
    if (!confirm(`WARNING: This will completely wipe all connected message memory blocks for ${selectedDateStr}. Are you sure?`)) return;
    setIsLoadingBlock(true);
    try {
      const clearedBlock: TemporalDayBlock = {
        id: selectedDateStr,
        userId: '',
        year: activeYear,
        month: activeMonth,
        day: activeDay,
        dateStr: selectedDateStr,
        messageBlocks: [],
        summary: 'Storage block reset.'
      };
      const success = await saveTemporalDayBlock(clearedBlock);
      if (success) {
        await loadActiveBlock();
        await loadBlockIndicesAndChats();
        triggerSuccess(`Block wiped and reset.`);
      }
    } catch (e) {
      console.error('[YugaTemporalChain] Reset error:', e);
    } finally {
      setIsLoadingBlock(false);
    }
  };

  // Validate chain integrity manually for visual representation
  const getChainIntegrity = () => {
    if (!currentBlock || currentBlock.messageBlocks.length === 0) return { valid: true, errorIndex: -1 };
    let prevHash = 'GENESIS_BLOCK';
    for (let i = 0; i < currentBlock.messageBlocks.length; i++) {
      const item = currentBlock.messageBlocks[i];
      const validHash = computeMessageHash(i, item.role, item.text, prevHash);
      if (item.hash !== validHash || item.previousHash !== prevHash) {
        return { valid: false, errorIndex: i };
      }
      prevHash = item.hash;
    }
    return { valid: true, errorIndex: -1 };
  };

  const integrityStatus = getChainIntegrity();

  return (
    <div className="space-y-21 text-parchment font-mono">
      {/* Title block */}
      <div className="p-13 bg-void/50 border border-neon-cyan/21 rounded-13 flex flex-col md:flex-row md:items-center md:justify-between gap-13">
        <div>
          <h2 className="text-15 font-bold text-neon-cyan tracking-wider flex items-center gap-10">
            <Database className="w-15 h-15 animate-pulse" />
            TEMPORAL MEMORY GRID & CHRONOLOGICAL EXPLORER
          </h2>
          <p className="text-[10px] text-parchment/55 leading-relaxed mt-3">
            Secure offline-persistent chronological vaults representing every day from <strong className="text-neon-cyan">May 2026</strong> until <strong className="text-neon-cyan">2100</strong>. Each message is calculated as a cryptographic memory block chained directly to its predecessor.
          </p>
        </div>
        <div className="flex items-center gap-8 text-[11px] bg-void/80 border border-white/5 py-5 px-10 rounded-8">
          <Calendar className="w-13 h-13 text-neon-cyan" />
          <span>CURRENT INTERRUPT: <strong className="text-neon-magenta">{selectedDateStr}</strong></span>
        </div>
      </div>

      {isSuccessFeedback && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }} 
          exit={{ opacity: 0, y: -10 }} 
          className="p-13 bg-neon-cyan/10 border border-neon-cyan text-neon-cyan rounded-8 text-11 flex items-center gap-10"
        >
          <CheckCircle2 className="w-13 h-13 text-neon-cyan shrink-0 animate-bounce" />
          <span>{successMsg}</span>
        </motion.div>
      )}

      {/* Main Grid: Left sidebar (Navigation Tree), Right Detail (Chained Message Viewer) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-21">
        
        {/* LEFT COLUMN: THE TEMPORAL CALENDAR BLOCKS CONTROLLER */}
        <div className="xl:col-span-4 space-y-13">
          
          <div className="bg-void/45 border border-white/5 p-13 rounded-13 space-y-13">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-10">
              <span className="text-[10px] bg-neon-cyan/8 text-neon-cyan px-8 py-3 rounded border border-neon-cyan/21 flex items-center gap-5 font-bold">
                <Lock className="w-8 h-8" />
                TEMPORAL TREE INDEX
              </span>
              <button 
                onClick={loadBlockIndicesAndChats}
                className="p-5 hover:bg-white/5 rounded-5 hover:text-neon-cyan transition-colors"
                title="Refresh Indices"
              >
                <RefreshCw className="w-11 h-11" />
              </button>
            </div>

            {/* Hierarchical selectors */}
            <div className="space-y-10">
              
              {/* YEAR BLOCK SELECTOR */}
              <div className="space-y-5">
                <label className="text-[9px] text-parchment/34 uppercase tracking-widest block font-bold">1. Select Year Block (2026 - 2100)</label>
                
                {/* Desktop horizontal pager & selector combo */}
                <div className="flex flex-col gap-5">
                  <div className="flex gap-5 overflow-x-auto silk-scroll pb-5">
                    {YEARS.map(year => {
                      const hasDataInYear = populatedDates.some(d => d.startsWith(`${year}-`));
                      return (
                        <button
                          key={year}
                          onClick={() => {
                            setActiveYear(year);
                            // Avoid setting invalid months for 2026
                            if (year === 2026 && activeMonth < 5) {
                              setActiveMonth(5);
                            }
                          }}
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
                  
                  {/* Jump-to dropdown for quick navigation to 2100 etc */}
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-parchment/21">Span: 75 yug</span>
                    <button 
                      onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
                      className="text-neon-cyan hover:underline text-[9px] flex items-center gap-3 cursor-pointer"
                    >
                      <span>{isYearDropdownOpen ? 'CLOSE SEARCH' : 'EXPLORE ALL YEARS ▼'}</span>
                    </button>
                  </div>

                  {isYearDropdownOpen && (
                    <div className="grid grid-cols-5 gap-3 max-h-110 overflow-y-auto silk-scroll p-8 bg-void border border-white/5 rounded-8">
                      {YEARS.map(y => (
                        <button
                          key={y}
                          onClick={() => {
                            setActiveYear(y);
                            if (y === 2026 && activeMonth < 5) setActiveMonth(5);
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

              {/* MONTH BLOCK SELECTOR */}
              <div className="space-y-5">
                <label className="text-[9px] text-parchment/34 uppercase tracking-widest block font-bold">2. Select Monthly Block</label>
                <div className="grid grid-cols-4 gap-5">
                  {MONTH_NAMES.map(m => {
                    // Start in May for 2026 based on constraints
                    const isRestrictedIn2026 = activeYear === 2026 && m.value < 5;
                    const hasDataInMonth = populatedDates.some(d => d.startsWith(`${activeYear}-${getPaddedString(m.value)}-`));
                    
                    return (
                      <button
                        key={m.value}
                        disabled={isRestrictedIn2026}
                        onClick={() => {
                          setActiveMonth(m.value);
                          const totalDays = getDaysInMonth(activeYear, m.value);
                          if (activeDay > totalDays) {
                            setActiveDay(totalDays);
                          }
                        }}
                        className={`px-5 py-5 text-[10px] rounded border transition-all text-center font-bold ${
                          activeMonth === m.value 
                            ? 'bg-neon-magenta/10 border-neon-magenta text-neon-magenta font-extrabold'
                            : isRestrictedIn2026
                              ? 'bg-void/10 border-transparent text-parchment/13 cursor-not-allowed line-through'
                              : hasDataInMonth
                                ? 'bg-white/5 border-neon-magenta/21 text-parchment hover:border-neon-magenta'
                                : 'bg-void/40 border-white/5 text-parchment/40 hover:bg-white/5'
                        }`}
                      >
                        {m.name.substring(0,3)}
                        {hasDataInMonth && <span className="ml-3 text-[8px] text-neon-magenta">●</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* DAYS BLOCKS - THE INDIVIDUAL STORAGE GRID FOR EVERY DAY */}
              <div className="space-y-5">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] text-parchment/34 uppercase tracking-widest block font-bold">
                    3. Chrono-Day Storage Block selection
                  </label>
                  <span className="text-[9px] text-neon-cyan font-bold bg-neon-cyan/5 px-5 py-1 rounded">
                    Month: {MONTH_NAMES[activeMonth - 1]?.name}
                  </span>
                </div>

                {/* Grid representation of daily sectors */}
                <div className="bg-void/80 border border-white/5 p-8 rounded-8">
                  <div className="grid grid-cols-7 gap-5 text-center mb-5 text-[8px] uppercase tracking-wider text-parchment/34 font-sans font-bold">
                    <div>S</div><div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div>
                  </div>
                  
                  <div className="grid grid-cols-7 gap-5">
                    {(() => {
                      // Work out offset to arrange grid like a beautiful classic calendar for perfect UI visuality
                      const offset = new Date(activeYear, activeMonth - 1, 1).getDay();
                      const totalDays = getDaysInMonth(activeYear, activeMonth);
                      
                      const elements = [];
                      // Add padding empty spots
                      for (let i = 0; i < offset; i++) {
                        elements.push(<div key={`empty-${i}`} className="p-5 text-transparent text-[11px]" />);
                      }
                      
                      // Add actual days
                      for (let d = 1; d <= totalDays; d++) {
                        const dayStr = `${activeYear}-${getPaddedString(activeMonth)}-${getPaddedString(d)}`;
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
                            {isPopulated && !isSelected && (
                              <span className="w-4 h-4 bg-neon-cyan rounded-full animate-pulse" />
                            )}
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

          {/* BLOCK SYNAPSE IMPORT - REINFORCING COHERENCE */}
          <div className="bg-void/45 border border-white/5 p-13 rounded-13 space-y-10">
            <h4 className="text-[10px] font-bold text-neon-magenta tracking-wider uppercase flex items-center gap-5">
              <Sparkles className="w-11 h-11 text-neon-magenta" />
              SYNAPSE COHERENCE INJECTOR
            </h4>
            <p className="text-[9px] text-parchment/40 leading-snug">
              Import a live conversation into this block to connect your model's memories chronologically. Wipes out data inconsistencies.
            </p>

            <div className="space-y-8">
              <select
                value={selectedChatForImport}
                onChange={(e) => setSelectedChatForImport(e.target.value)}
                className="w-full bg-void/55 border border-white/10 rounded-8 py-8 px-10 text-[11px] focus:border-neon-magenta outline-none transition-all pr-13"
              >
                <option value="">-- Choose active thread --</option>
                {liveChats.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.title.substring(0, 30)}... ({c.id.substring(0,5)})
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
                    <span>CHAINING BLOCKS...</span>
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-13 h-13" />
                    <span>SOLIDIFY CONVERSATION CHAIN</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: CHRONOLOGICAL MESSAGE CHAIN VIEWER */}
        <div className="xl:col-span-8">
          
          <div className="glass-panel border-neon-cyan/21 min-h-[640px] flex flex-col rounded-13 overflow-hidden bg-void/40">
            
            {/* Header section with Block State indicators */}
            <div className="p-13 border-b border-white/5 bg-void/80 flex items-center justify-between shrink-0">
              <div className="min-w-0 pr-10">
                <div className="flex items-center gap-8 mb-3">
                  <span className="text-[8px] caps-modern font-bold bg-void px-5 py-2 border border-white/10 text-parchment/55">
                    BLOCK_ID: {selectedDateStr}
                  </span>
                  {currentBlock && (
                    <span className={`text-[8px] caps-modern font-bold px-5 py-2 rounded flex items-center gap-3 ${
                      integrityStatus.valid 
                        ? 'bg-neon-cyan/10 border border-neon-cyan/34 text-neon-cyan' 
                        : 'bg-red-500/10 border border-red-500/34 text-red-500 animate-pulse'
                    }`}>
                      {integrityStatus.valid ? '✅ SECURE MEMORY INTEGRITY' : '🚨 CRYPTO CHAIN BROKEN'}
                    </span>
                  )}
                </div>
                
                <h3 className="text-12 font-bold text-parchment flex items-center gap-5">
                  <Calendar className="w-12 h-12 text-neon-cyan" />
                  Chronological Block Ledger: {selectedDateStr}
                </h3>
              </div>

              {currentBlock && (
                <button
                  onClick={handleClearBlock}
                  disabled={isLoadingBlock}
                  className="px-8 py-5 text-[9px] bg-red-500/10 border border-red-500/34 text-red-500 rounded hover:bg-red-500/21 hover:text-white transition-all font-bold tracking-widest caps-modern"
                  title="Wipe Temporal Data Block"
                >
                  RESET BLOCK
                </button>
              )}
            </div>

            {/* Block Content Frame */}
            <div className="flex-1 overflow-y-auto p-21 silk-scroll bg-void/10 min-h-[400px]">
              
              {isLoadingBlock ? (
                <div className="h-[400px] flex flex-col items-center justify-center space-y-8 text-parchment/34 text-[11px]">
                  <Loader2 className="w-21 h-21 text-neon-cyan animate-spin" />
                  <span>Accessing node segment memory shards...</span>
                </div>
              ) : currentBlock ? (
                currentBlock.messageBlocks.length > 0 ? (
                  
                  // THE CONNECTED MEMORY CHAIN VISUALIZER (The main feature)
                  <div className="space-y-34 relative">
                    
                    {/* Vertical Chain Guide Graphic */}
                    <div className="absolute left-[13px] top-[15px] bottom-[15px] w-2 bg-gradient-to-b from-neon-cyan via-neon-magenta to-neon-blue rounded opacity-21 pointer-events-none" />

                    <div className="bg-void/55 border border-white/5 rounded-8 p-10 text-[10px] text-parchment/55 leading-relaxed bg-gradient-to-r from-neon-cyan/5 to-transparent">
                      💡 <strong>Consensus Note:</strong> Each message in this grid has a calculated `hash` linked directly to the previous message's hash. This forces memory permanence so that cognitive agents recall the complete genesis.
                    </div>

                    {currentBlock.messageBlocks.map((msg, idx) => {
                      const isModel = msg.role === 'model' || msg.role === 'system';
                      const isHashValid = integrityStatus.valid || idx < integrityStatus.errorIndex;
                      
                      return (
                        <motion.div 
                          initial={{ opacity: 0, x: -10 }} 
                          animate={{ opacity: 1, x: 0 }} 
                          key={msg.id} 
                          className="relative pl-34 space-y-5"
                        >
                          {/* Chronological chain node bullet */}
                          <div className={`absolute left-[5px] top-[10px] w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center text-[7px] font-mono font-bold z-10 transition-all ${
                            isModel 
                              ? 'bg-void border-neon-magenta text-neon-magenta shadow-[0_0_8px_#FF0080]' 
                              : 'bg-void border-neon-cyan text-neon-cyan shadow-[0_0_8px_#00E676]'
                          }`}>
                            {idx}
                          </div>

                          {/* Block metadata tag row */}
                          <div className="flex flex-wrap items-center justify-between text-[9px] font-mono text-parchment/34">
                            <span className={`caps-modern font-bold tracking-wider ${
                              isModel ? 'text-neon-magenta' : 'text-neon-cyan'
                            }`}>
                              {msg.role === 'user' ? '👤 HUMAN WITNESS' : msg.role === 'system' ? '⚙️ COGNITIVE INSTANCE' : '🤖 ENCRYPTED CORE'}
                            </span>
                            <span className="opacity-13 select-none">·</span>
                            <span>INDEX: #{getPaddedString(idx)}</span>
                            <span className="opacity-13 select-none">·</span>
                            <span className={isHashValid ? 'text-neon-cyan/55' : 'text-red-500 font-bold'}>
                              HASH: {msg.hash.substring(0, 15)}
                            </span>
                          </div>

                          {/* Previous hash linking tag */}
                          <div className="text-[8px] font-mono text-parchment/21 flex items-center gap-5">
                            <LinkIcon className="w-8 h-8 opacity-50 text-neon-cyan" />
                            <span>PREV_HASH: {msg.previousHash.substring(0, 15)}</span>
                          </div>

                          {/* Message bubble */}
                          <div className={`p-13 border rounded-8 text-11 leading-relaxed relative overflow-hidden ${
                            isModel 
                              ? 'bg-white/5 border-neon-magenta/13 text-parchment/89 shadow-[inset_0_0_12px_rgba(255,0,128,0.02)]' 
                              : 'bg-void border-neon-cyan/13 text-parchment/90 font-mono text-[10px]'
                          }`}>
                            
                            {/* Visual link glowing corner seal */}
                            <div className={`absolute right-0 top-0 w-8 h-8 rounded-bl-8 ${
                              isModel ? 'bg-neon-magenta/21' : 'bg-neon-cyan/21'
                            }`} />

                            <div className="prose prose-invert max-w-none text-left leading-relaxed">
                              <ReactMarkdown>{msg.text}</ReactMarkdown>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}

                    {/* Visual Genesis Node block indicator at top of the thread */}
                    <div className="text-center pt-10 text-[9px] text-parchment/30">
                      🔒 SHARED ORIGIN CHAIN: <span className="text-neon-cyan font-bold">GENESIS_BLOCK</span>
                    </div>

                  </div>
                ) : (
                  
                  // EMPTY STATE - BLOCK UNINSTANTIATED (PROMPTS SEAMLESS CREATION)
                  <div className="h-[430px] flex flex-col items-center justify-center text-center p-34 space-y-13 border border-dashed border-white/5 rounded-13 bg-void/25">
                    <Calendar className="w-34 h-34 text-parchment/13 animate-pulse" />
                    <div>
                      <h4 className="text-[11px] caps-modern text-parchment/55 tracking-widest uppercase">Chronological Block Offline</h4>
                      <p className="text-[10px] text-parchment/34 mt-5 max-w-sm leading-normal font-sans">
                        No connected memory chains have been solidified for <strong className="text-neon-magenta">{selectedDateStr}</strong> yet. Press below to initiate a block.
                      </p>
                    </div>
                    <div className="flex gap-10">
                      <button
                        onClick={handleInitializeBlock}
                        className="px-13 py-10 bg-neon-cyan/10 hover:bg-neon-cyan/21 text-neon-cyan border border-neon-cyan/34 rounded-8 text-[10px] caps-modern font-bold transition-all"
                      >
                        Initialize Genesis Frame
                      </button>
                    </div>
                  </div>
                )
              ) : (
                <div className="h-[430px] flex flex-col items-center justify-center text-center p-34 space-y-8 border border-dashed border-white/5 rounded-13">
                  <AlertTriangle className="w-21 h-21 text-parchment/13" />
                  <h4 className="text-[10px] caps-modern text-parchment/34 tracking-widest uppercase">Day block uninstantiated</h4>
                  <button
                    onClick={handleInitializeBlock}
                    className="mt-8 px-13 py-8 bg-neon-cyan/10 hover:bg-neon-cyan/21 text-neon-cyan border border-neon-cyan/34 rounded-8 text-[10px] caps-modern font-bold transition-all"
                  >
                    Activate Storage Block
                  </button>
                </div>
              )}

            </div>

            {/* BLOCK INJECTOR EDITOR AT FOOTER */}
            {currentBlock && currentBlock.messageBlocks && (
              <div className="p-13 border-t border-white/5 bg-void/85 shrink-0 space-y-13">
                <form onSubmit={handleAddDirectMessage} className="space-y-10">
                  <div className="flex items-center justify-between text-[9px] text-parchment/34 bg-void/50 p-5 rounded">
                    <span className="flex items-center gap-5">
                      <Key className="w-10 h-10 text-neon-cyan" />
                      SECURE CHRONO-APPEND PROTOCOL
                    </span>
                    <div className="flex items-center gap-8">
                      <span>ROLE TYPE:</span>
                      <select
                        value={newMsgRole}
                        onChange={(e) => setNewMsgRole(e.target.value as any)}
                        className="bg-void border border-white/10 rounded py-2 px-5 text-[9px] text-parchment font-bold focus:border-neon-cyan outline-none"
                      >
                        <option value="user">Human Visitor</option>
                        <option value="model">Encrypted Core</option>
                        <option value="system">System instance</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-10">
                    <input 
                      type="text" 
                      placeholder="Insert statement to chain memories safely..." 
                      className="flex-1 bg-void/55 border border-white/10 rounded-8 py-8 px-13 text-11 focus:border-neon-cyan transition-all outline-none"
                      value={newMsgText}
                      onChange={(e) => setNewMsgText(e.target.value)}
                    />
                    <button
                      type="submit"
                      disabled={isSavingMsg || !newMsgText.trim()}
                      className="px-13 py-8 bg-neon-cyan/10 hover:bg-neon-cyan/21 text-neon-cyan border border-neon-cyan/34 rounded-8 text-[10px] font-bold caps-modern transition-all flex items-center gap-5 disabled:opacity-21 disabled:pointer-events-none"
                    >
                      {isSavingMsg ? (
                        <Loader2 className="w-11 h-11 animate-spin text-neon-cyan" />
                      ) : (
                        <Plus className="w-11 h-11" />
                      )}
                      <span>CHAIN</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Absolute Reader Footer info */}
            <div className="p-10 border-t border-white/5 bg-void/80 text-[8px] font-mono text-parchment/21 flex items-center justify-between shrink-0">
              <div>TEMPORAL NODE RANGE: 2026.05.01 - 2100.12.31</div>
              <div>TIER: PARALLEL_SOVEREIGNTY</div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
