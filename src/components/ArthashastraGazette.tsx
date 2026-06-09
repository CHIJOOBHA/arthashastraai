
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Landmark, Globe, Calendar, ChevronLeft, ChevronRight, Hash, Search, Loader2, Database, ShieldAlert, Newspaper, Share2, Copy, Check, Send, MessageCircle } from 'lucide-react';
import { Chronicle, getChronicle, generateDailyChronicle, getRecentChronicles } from '../lib/chronicleStore';
import { auth } from '../lib/firebase';

export function ArthashastraGazette({ initialDate }: { initialDate?: string }) {
  const [selectedDate, setSelectedDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
  const [chronicle, setChronicle] = useState<Chronicle | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [history, setHistory] = useState<Chronicle[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [copiedData, setCopiedData] = useState<string | null>(null);

  useEffect(() => {
    // Check admin status derived from the email list in our rules (approximate client check)
    const adminEmails = ["jhansidharmana222@gmail.com", "chitti.bhargav3@gmail.com"];
    setIsAdmin(auth.currentUser ? adminEmails.includes(auth.currentUser.email || "") : false);
  }, [auth.currentUser]);

  useEffect(() => {
    loadChronicle(selectedDate);
    loadHistory();
  }, [selectedDate]);

  const loadChronicle = async (date: string) => {
    setLoading(true);
    const data = await getChronicle(date);
    setChronicle(data);
    setLoading(false);
  };

  const loadHistory = async () => {
    const data = await getRecentChronicles(30);
    setHistory(data);
  };

  const handleGenerate = async () => {
    if (!isAdmin) return;
    setGenerating(true);
    try {
      const data = await generateDailyChronicle(selectedDate);
      setChronicle(data);
      loadHistory();
    } catch (e: any) {
      console.error("Chronicle Generation Failed:", e);
      alert(`Neural Generation Failed. ${e.message || "Quota issues likely."}`);
    } finally {
      setGenerating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    }).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-void flex flex-col font-sans text-parchment animate-in fade-in duration-555">
      {/* Header Section */}
      <header className="border-b border-neon-cyan/21 bg-void/55 backdrop-blur-md sticky top-0 z-50 px-21 py-13 flex items-center justify-between">
        <a href="/" className="flex items-center gap-13 hover:opacity-80 transition-opacity">
          <Newspaper className="w-21 h-21 text-neon-cyan drop-shadow-[0_0_8px_rgba(0,240,255,0.5)]" />
          <h1 className="text-13 caps-modern text-neon-cyan tracking-[0.34em] font-bold">ARTHASHASTRA CHRONICLE</h1>
        </a>
        
        <div className="flex items-center gap-13">
          <div className="flex items-center gap-21 bg-neon-cyan/5 border border-neon-cyan/13 rounded-full px-13 py-5">
            <div className="flex items-center gap-8 border-r border-neon-cyan/13 pr-13">
              <span className="text-[9px] font-mono text-neon-cyan/55 uppercase tracking-widest">Temporal Node</span>
              <span className="text-13 font-mono text-neon-cyan font-bold">{selectedDate}</span>
            </div>
            <div className="flex gap-8">
              <button 
                onClick={() => {
                  const d = new Date(selectedDate);
                  d.setDate(d.getDate() - 1);
                  setSelectedDate(d.toISOString().split('T')[0]);
                }}
                className="p-3 text-neon-cyan/55 hover:text-neon-cyan transition-colors"
              >
                <ChevronLeft className="w-13 h-13" />
              </button>
              <button 
                onClick={() => {
                  const d = new Date(selectedDate);
                  d.setDate(d.getDate() + 1);
                  setSelectedDate(d.toISOString().split('T')[0]);
                }}
                className="p-3 text-neon-cyan/55 hover:text-neon-cyan transition-colors"
                disabled={selectedDate === new Date().toISOString().split('T')[0]}
              >
                <ChevronRight className="w-13 h-13" />
              </button>
            </div>
          </div>
          
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(`${window.location.origin}/gazette/${selectedDate}`);
                // Could add a temporary state for checkmark, but let's just copy
                alert(`URL copied: ${window.location.origin}/gazette/${selectedDate}`);
              } catch (e) {}
            }}
            className="flex items-center gap-5 px-8 py-5 border border-neon-cyan text-neon-cyan hover:bg-neon-cyan hover:text-void transition-colors rounded text-[10px] caps-modern font-bold shadow-[0_0_8px_rgba(0,230,118,0.3)]"
            title="Copy Signal Link"
          >
            <Copy className="w-13 h-13" />
            <span className="hidden sm:inline">COPY SIGNAL</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row gap-0">
        {/* Left Archive Sidebar */}
        <aside className="w-full lg:w-[280px] border-r border-neon-cyan/13 lg:min-h-[calc(100vh-60px)] p-21 bg-void/34">
          <div className="mb-21">
            <h3 className="text-[10px] caps-modern text-neon-cyan/55 mb-13 tracking-widest flex items-center gap-8">
              <Database className="w-10 h-10" />
              HISTORICAL REPOSITORY
            </h3>
            <div className="space-y-5 max-h-[300px] overflow-y-auto silk-scroll pr-8">
              {history.map(item => (
                <button
                  key={item.id}
                  onClick={() => setSelectedDate(item.id)}
                  className={`w-full text-left p-8 rounded border transition-all flex items-center justify-between group ${
                    selectedDate === item.id 
                      ? 'bg-neon-cyan/13 border-neon-cyan text-neon-cyan shadow-[0_0_8px_rgba(0,240,255,0.2)]' 
                      : 'border-transparent hover:border-neon-cyan/21 text-parchment/34 hover:text-parchment'
                  }`}
                >
                  <span className="text-13 font-mono">{item.id}</span>
                  <ChevronRight className={`w-10 h-10 transition-opacity ${selectedDate === item.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                </button>
              ))}
            </div>
            {history.length === 0 && !loading && (
              <p className="text-[10px] text-parchment/21 italic py-13">No previous records found.</p>
            )}
          </div>

          <div className="mt-auto pt-21 border-t border-neon-cyan/8 opacity-34">
            <p className="text-[9px] font-mono text-neon-cyan/55 leading-relaxed">
              CHRONICLE STATUS: AUTOMATED<br />
              UPDATE_CYCLE: 24H<br />
              SOURCE_VETTING: DARK_WEB_SIMULATED
            </p>
          </div>
        </aside>

        {/* Content Area */}
        <section className="flex-1 p-21 lg:p-55 overflow-y-auto w-full max-w-5xl mx-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-144 space-y-21">
              <Loader2 className="w-55 h-55 text-neon-cyan animate-spin opacity-55" />
              <p className="text-13 caps-modern tracking-[0.34em] text-neon-cyan animate-pulse">Consulting Neural Archive...</p>
            </div>
          ) : chronicle ? (
            <div className="space-y-55 animate-in slide-in-from-bottom-5 duration-777">
              {/* Newspaper Masthead */}
              <div className="text-center py-55 border-b-4 border-double border-neon-cyan/34 mb-55 bg-neon-cyan/[0.02] relative overflow-hidden px-21">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/pinstriped-suit.png')] opacity-10 pointer-events-none" />
                <div className="relative z-10 flex flex-col items-center">
                  <div className="flex items-center gap-13 opacity-55 caps-modern text-[10px] tracking-[0.55em] text-neon-cyan mb-13">
                    <span>VOL. MMXXVI</span>
                    <div className="w-5 h-5 rounded-full bg-neon-cyan/34" />
                    <span>EDITION: ALPHA-NODE</span>
                  </div>
                  <h1 className="text-55 md:text-89 font-display font-black tracking-tighter leading-none text-parchment drop-shadow-[0_0_15px_rgba(230,241,255,0.3)] uppercase">
                    THE ARTHASHASTRA <span className="text-neon-cyan [text-shadow:0_0_21px_rgba(0,230,118,0.5)]">GAZETTE</span>
                  </h1>
                  <div className="w-full max-w-[610px] h-1 bg-gradient-to-r from-transparent via-neon-cyan/55 to-transparent mt-13" />
                  <div className="flex items-center justify-center gap-34 mt-21 w-full">
                    <div className="hidden md:block flex-1 h-[1px] bg-neon-cyan/21" />
                    <div className="flex items-center gap-21 whitespace-nowrap">
                      <span className="text-11 caps-modern text-neon-cyan/89 tracking-[0.21em] italic">Absolute Witness Neural Feed</span>
                      <span className="text-11 caps-modern text-parchment/34">|</span>
                      <span className="text-11 caps-modern text-neon-cyan/89 tracking-[0.21em]">{formatDate(selectedDate)}</span>
                    </div>
                    <div className="hidden md:block flex-1 h-[1px] bg-neon-cyan/21" />
                  </div>
                </div>
              </div>

              {/* Layout: Main Articles */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-55">
                {/* World Article */}
                <article className="space-y-13">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-8">
                      <Globe className="w-13 h-13 text-neon-magenta" />
                      <span className="text-[10px] caps-modern text-neon-magenta tracking-widest">SYSTEMIC GLOBAL ANALYSIS</span>
                    </div>
                    {chronicle.articleWorld.editorialLabel && (
                      <span className="text-[9px] px-8 py-2 bg-neon-magenta/13 text-neon-magenta border border-neon-magenta/34 rounded-full caps-modern tracking-wider">
                        {chronicle.articleWorld.editorialLabel}
                      </span>
                    )}
                  </div>
                  <h2 className="text-34 lg:text-44 font-serif italic text-parchment leading-[0.9] tracking-tight">
                    {chronicle.articleWorld.title}
                  </h2>
                  <DistributionHub 
                    title={chronicle.articleWorld.title}
                    summary={chronicle.articleWorld.summary}
                    region="World"
                    colorTheme="magenta"
                    date={selectedDate}
                  />
                  <div className="bg-neon-magenta/5 border-l-2 border-neon-magenta p-13">
                    <p className="text-13 font-medium text-neon-magenta italic">{chronicle.articleWorld.summary}</p>
                  </div>
                  
                  {chronicle.articleWorld.lead && (
                    <div className="text-15 font-sans font-semibold leading-relaxed text-parchment/89 border-b border-neon-magenta/13 pb-13">
                      {chronicle.articleWorld.lead}
                    </div>
                  )}

                  <div className="prose prose-invert prose-neon text-13 opacity-89 leading-relaxed max-w-none">
                    {chronicle.articleWorld.content.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
                  </div>

                  {chronicle.articleWorld.counterArgument && (
                    <div className="mt-21 p-13 border border-dashed border-neon-magenta/21 bg-void/55 rounded-8">
                      <span className="text-[9px] caps-modern text-neon-magenta/55 mb-8 block font-bold">OPPOSING VIEW & REBUTTAL</span>
                      <p className="text-11 italic text-parchment/55 leading-relaxed">
                        {chronicle.articleWorld.counterArgument}
                      </p>
                    </div>
                  )}

                  {chronicle.articleWorld.callToAction && (
                    <div className="mt-21 p-13 bg-neon-magenta/13 border-l-4 border-neon-magenta rounded-r-8">
                       <span className="text-[9px] caps-modern text-neon-magenta mb-5 block font-bold">CALL TO ACTION</span>
                       <p className="text-13 font-bold text-parchment leading-tight tracking-tight uppercase">
                         {chronicle.articleWorld.callToAction}
                       </p>
                    </div>
                  )}

                  {chronicle.articleWorld.perspective && (
                    <div className="mt-21 p-21 glass-panel border border-neon-magenta/34 bg-neon-magenta/5 relative">
                      <div className="absolute top-0 left-0 w-full h-1 bg-neon-magenta/34" />
                      <h4 className="text-[10px] caps-modern text-neon-magenta mb-8 tracking-widest font-bold">NEURAL PERSPECTIVE: RESOLUTION STRATEGY</h4>
                      <p className="text-13 text-parchment leading-relaxed italic">
                        "{chronicle.articleWorld.perspective}"
                      </p>
                    </div>
                  )}

                  {chronicle.articleWorld.sources && chronicle.articleWorld.sources.length > 0 && (
                    <div className="mt-13 pt-13 border-t border-neon-magenta/13">
                      <span className="text-[9px] caps-modern text-neon-magenta/55 tracking-widest block mb-5">VERIFIED SOURCES & POLICY REFERENCES:</span>
                      <ul className="list-none space-y-3">
                        {chronicle.articleWorld.sources.map((src, i) => (
                          <li key={i} className="text-11 text-parchment/55 leading-tight flex items-start gap-5">
                            <div className="w-3 h-[1px] bg-neon-magenta/34 mt-5" />
                            {src}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {chronicle.articleWorld.auditTrail && (
                    <div className="mt-13 opacity-34 hover:opacity-100 transition-opacity">
                      <details className="cursor-pointer">
                        <summary className="text-[9px] caps-modern text-parchment tracking-widest list-none flex items-center gap-5">
                          <Database className="w-8 h-8" /> AUDIT TRAIL: NEURAL DECISION LOG
                        </summary>
                        <p className="text-[10px] italic mt-5 leading-relaxed bg-void/55 p-8 rounded border border-parchment/8">
                          {chronicle.articleWorld.auditTrail}
                        </p>
                      </details>
                    </div>
                  )}
                </article>

                {/* India Article */}
                <article className="space-y-13">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-8">
                      <Landmark className="w-13 h-13 text-neon-cyan" />
                      <span className="text-[10px] caps-modern text-neon-cyan tracking-widest">REGIONAL CORE INTELLIGENCE: INDIA</span>
                    </div>
                    {chronicle.articleIndia.editorialLabel && (
                      <span className="text-[9px] px-8 py-2 bg-neon-cyan/13 text-neon-cyan border border-neon-cyan/34 rounded-full caps-modern tracking-wider">
                        {chronicle.articleIndia.editorialLabel}
                      </span>
                    )}
                  </div>
                  <h2 className="text-34 lg:text-44 font-serif italic text-parchment leading-[0.9] tracking-tight">
                    {chronicle.articleIndia.title}
                  </h2>
                  <DistributionHub 
                    title={chronicle.articleIndia.title}
                    summary={chronicle.articleIndia.summary}
                    region="India"
                    colorTheme="cyan"
                    date={selectedDate}
                  />
                  <div className="bg-neon-cyan/5 border-l-2 border-neon-cyan p-13">
                    <p className="text-13 font-medium text-neon-cyan italic">{chronicle.articleIndia.summary}</p>
                  </div>

                  {chronicle.articleIndia.lead && (
                    <div className="text-15 font-sans font-semibold leading-relaxed text-parchment/89 border-b border-neon-cyan/13 pb-13">
                      {chronicle.articleIndia.lead}
                    </div>
                  )}

                  <div className="prose prose-invert prose-neon text-13 opacity-89 leading-relaxed max-w-none">
                    {chronicle.articleIndia.content.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
                  </div>

                  {chronicle.articleIndia.counterArgument && (
                    <div className="mt-21 p-13 border border-dashed border-neon-cyan/21 bg-void/55 rounded-8">
                      <span className="text-[9px] caps-modern text-neon-cyan/55 mb-8 block font-bold">OPPOSING VIEW & REBUTTAL</span>
                      <p className="text-11 italic text-parchment/55 leading-relaxed">
                        {chronicle.articleIndia.counterArgument}
                      </p>
                    </div>
                  )}

                  {chronicle.articleIndia.callToAction && (
                    <div className="mt-21 p-13 bg-neon-cyan/13 border-l-4 border-neon-cyan rounded-r-8">
                       <span className="text-[9px] caps-modern text-neon-cyan mb-5 block font-bold">CALL TO ACTION</span>
                       <p className="text-13 font-bold text-parchment leading-tight tracking-tight uppercase">
                         {chronicle.articleIndia.callToAction}
                       </p>
                    </div>
                  )}

                  {chronicle.articleIndia.perspective && (
                    <div className="mt-21 p-21 glass-panel border border-neon-cyan/34 bg-neon-cyan/5 relative">
                      <div className="absolute top-0 left-0 w-full h-1 bg-neon-cyan/34" />
                      <h4 className="text-[10px] caps-modern text-neon-cyan mb-8 tracking-widest font-bold">NEURAL PERSPECTIVE: RESOLUTION STRATEGY</h4>
                      <p className="text-13 text-parchment leading-relaxed italic">
                        "{chronicle.articleIndia.perspective}"
                      </p>
                    </div>
                  )}

                  {chronicle.articleIndia.sources && chronicle.articleIndia.sources.length > 0 && (
                    <div className="mt-13 pt-13 border-t border-neon-cyan/13">
                      <span className="text-[9px] caps-modern text-neon-cyan/55 tracking-widest block mb-5">VERIFIED SOURCES & POLICY REFERENCES:</span>
                      <ul className="list-none space-y-3">
                        {chronicle.articleIndia.sources.map((src, i) => (
                          <li key={i} className="text-11 text-parchment/55 leading-tight flex items-start gap-5">
                            <div className="w-3 h-[1px] bg-neon-cyan/34 mt-5" />
                            {src}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {chronicle.articleIndia.auditTrail && (
                    <div className="mt-13 opacity-34 hover:opacity-100 transition-opacity">
                      <details className="cursor-pointer">
                        <summary className="text-[9px] caps-modern text-parchment tracking-widest list-none flex items-center gap-5">
                          <Database className="w-8 h-8" /> AUDIT TRAIL: NEURAL DECISION LOG
                        </summary>
                        <p className="text-[10px] italic mt-5 leading-relaxed bg-void/55 p-8 rounded border border-parchment/8">
                          {chronicle.articleIndia.auditTrail}
                        </p>
                      </details>
                    </div>
                  )}
                </article>
              </div>

              {/* Layout: Daily Tweets Counter-Stream */}
              <div className="mt-55 border-t border-neon-cyan/21 pt-34">
                <div className="flex items-center gap-13 mb-34">
                  <Globe className="w-21 h-21 text-neon-cyan" />
                  <h3 className="text-21 caps-modern text-neon-cyan tracking-widest">DAILY NEURAL REBUTTALS</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-21">
                  {(chronicle.tweets || []).map((tweet, i) => (
                    <motion.div 
                      key={i}
                      whileHover={{ scale: 1.02 }}
                      className={`p-13 border rounded-8 relative overflow-hidden group ${
                        tweet.region === 'India' ? 'bg-neon-cyan/5 border-neon-cyan/21' : 'bg-neon-magenta/5 border-neon-magenta/21'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-13 border-b border-inherit pb-8">
                        <span className="text-[9px] font-mono opacity-55">LOG NODE_{i+1}</span>
                        <div className="flex items-center gap-8">
                          <button 
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(`Arthashastra Neural Rebuttal:\n\n${tweet.text}\n\nRead more at: ${window.location.origin}/gazette/${selectedDate}`);
                                setCopiedData(`tweet-${i}`);
                                setTimeout(() => setCopiedData(null), 2000);
                              } catch (e) {}
                            }}
                            className={`opacity-34 hover:opacity-100 transition-opacity ${tweet.region === 'India' ? 'text-neon-cyan' : 'text-neon-magenta'}`}
                          >
                            {copiedData === `tweet-${i}` ? <Check className="w-10 h-10" /> : <Copy className="w-10 h-10" />}
                          </button>
                          <div className={`w-1.5 h-1.5 rounded-full ${tweet.region === 'India' ? 'bg-neon-cyan' : 'bg-neon-magenta'} animate-pulse`} />
                        </div>
                      </div>
                      <p className="text-13 leading-relaxed mb-5">{tweet.text}</p>
                      {tweet.source && (
                        <div className="text-[8px] italic opacity-55 mt-5 leading-none border-t border-inherit pt-5">
                          REF: {tweet.source}
                        </div>
                      )}
                      <div className="text-[9px] font-bold caps-modern mt-8 opacity-34 group-hover:opacity-100 transition-opacity flex items-center justify-between">
                        <span>{tweet.region.toUpperCase()}</span>
                        <Hash className="w-8 h-8" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="text-center pt-89 border-t border-neon-cyan/8 space-y-13 pb-55">
                <div className="text-[10px] caps-modern tracking-[0.5em] text-parchment opacity-21">
                  NO TRUTH CAN BE IGNORED. HISTORY IS THE WITNESS.
                </div>
                {chronicle.editorialStandards && (
                  <div className="flex flex-col items-center gap-5">
                    <span className="text-[9px] caps-modern text-neon-cyan/55 tracking-widest">{chronicle.editorialStandards.toUpperCase()}</span>
                    <p className="text-[8px] text-parchment/34 max-w-2xl mx-auto italic leading-relaxed">
                      Adherence to Accuracy, Fairness, and Accountability protocols (aligned with Press Council of India Norms & IFJ Global Charter). 
                      All archived records are subject to neural audit and correction.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-89 space-y-34">
              <div className="relative">
                <ShieldAlert className="w-55 h-55 text-neon-magenta animate-pulse" />
                <div className="absolute inset-0 bg-neon-magenta/21 blur-[21px] rounded-full" />
              </div>
              <div className="text-center space-y-13 max-w-md mx-auto">
                <h3 className="text-21 text-neon-magenta caps-modern font-bold tracking-widest">VOID DETECTED</h3>
                <p className="text-13 opacity-55 leading-relaxed">
                  The chronicle for this temporal node has not been witnessed. 
                  {isAdmin ? " As an authorized agent, you may trigger the neural assembly to finalize this record." : " Please consult valid archives or return later."}
                </p>
              </div>

              {isAdmin && (
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="px-34 py-13 bg-neon-magenta/13 border border-neon-magenta text-neon-magenta hover:bg-neon-magenta hover:text-void transition-all rounded-8 caps-modern tracking-[0.21em] flex items-center gap-13 group"
                >
                  {generating ? (
                    <div className="flex flex-col items-center gap-8">
                      <div className="flex items-center gap-13">
                        <Loader2 className="w-13 h-13 animate-spin" />
                        Neural Assembly Active...
                      </div>
                      <div className="text-[9px] caps-modern text-neon-magenta/55 animate-pulse">
                        Synchronizing global telemetry & verifying historical proof. This may take 60-90 seconds.
                      </div>
                    </div>
                  ) : (
                    <>
                      <Landmark className="w-13 h-13 group-hover:rotate-12 transition-transform" />
                      GENERATE CHRONICLE
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function DistributionHub({ title, summary, region, colorTheme, date }: { title: string, summary: string, region: 'India' | 'World', colorTheme: 'magenta' | 'cyan', date: string }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    try {
      const shareUrl = `${window.location.origin}/gazette/${date}`;
      const shareText = `Arthashastra Gazette (${region}): ${title}\n\n${summary}`;
      await navigator.clipboard.writeText(`${shareText}\n\nRead truth on: ${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const getUrl = () => encodeURIComponent(`${window.location.origin}/gazette/${date}`);
  const getText = () => encodeURIComponent(`Arthashastra Gazette (${region}): ${title}\n\n${summary}`);

  const themeClasses = colorTheme === 'magenta' 
    ? 'bg-neon-magenta/10 border-neon-magenta/34 hover:bg-neon-magenta/21 text-neon-magenta shadow-[0_0_8px_rgba(255,0,255,0.1)] hover:shadow-[0_0_13px_rgba(255,0,255,0.3)]' 
    : 'bg-neon-cyan/10 border-neon-cyan/34 hover:bg-neon-cyan/21 text-neon-cyan shadow-[0_0_8px_rgba(0,240,255,0.1)] hover:shadow-[0_0_13px_rgba(0,240,255,0.3)]';

  return (
    <div className="flex flex-wrap items-center gap-8 relative z-10 my-13">
      <div className="flex items-center gap-5 mr-8">
        <span className={`text-[9px] caps-modern uppercase font-bold tracking-widest ${colorTheme === 'magenta' ? 'text-neon-magenta/55' : 'text-neon-cyan/55'}`}>
          BYPASS CENSORSHIP:
        </span>
      </div>

      <a 
        href={`https://api.whatsapp.com/send?text=${getText()}%20-%20Read%20truth%20on:%20${getUrl()}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`p-8 border rounded-full transition-all ${themeClasses}`} 
        title="Route via WhatsApp"
        aria-label="Share on WhatsApp"
      >
        <MessageCircle className="w-13 h-13" />
      </a>

      <a 
        href={`https://t.me/share/url?url=${getUrl()}&text=${getText()}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`p-8 border rounded-full transition-all ${themeClasses}`} 
        title="Route via Telegram"
        aria-label="Share on Telegram"
      >
        <Send className="w-13 h-13" />
      </a>

      <button 
        onClick={handleCopy} 
        className={`px-13 py-5 border rounded-full text-[10px] caps-modern flex items-center gap-8 transition-all ${themeClasses}`}
      >
        {copied ? <><Check className="w-13 h-13" /> COPIED MESSAGE</> : <><Copy className="w-13 h-13" /> COPY SIGNAL</>}
      </button>
    </div>
  );
}
