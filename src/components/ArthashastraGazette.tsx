import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { User } from 'firebase/auth';
import { motion } from 'motion/react';
import { Globe, ChevronLeft, ChevronRight, Loader2, Database, ShieldAlert, Newspaper, Copy, Check, Send, MessageCircle, Landmark, ExternalLink, AlertCircle } from 'lucide-react';
import { Chronicle, getChronicle, getRecentChronicles, requestTodayChronicle } from '../lib/chronicleStore';
import { ApiError } from '../lib/api';

interface GazetteProps {
  initialDate?: string;
  user?: User | null;
  language?: string;
  isAdmin?: boolean;
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n: number) => String(n).padStart(2, '0');
const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Local calendar date from "YYYY-MM-DD" (never parsed as UTC). */
const fromYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const shiftYmd = (s: string, days: number) => {
  const d = fromYmd(s);
  d.setDate(d.getDate() + days);
  return toYmd(d);
};
const localToday = () => toYmd(new Date());
/** The server dates editions in UTC; it can be a day ahead of the reader's local date. */
const utcToday = () => new Date().toISOString().slice(0, 10);
const latestAllowed = () => (utcToday() > localToday() ? utcToday() : localToday());
const isValidYmd = (s?: string) => !!s && YMD_RE.test(s) && !isNaN(fromYmd(s).getTime());

const POLL_EVERY_MS = 10_000;
const POLL_MAX_MS = 180_000;

export function ArthashastraGazette({ initialDate, user }: GazetteProps) {
  const [selectedDate, setSelectedDate] = useState(() => (isValidYmd(initialDate) ? initialDate! : localToday()));
  const [chronicle, setChronicle] = useState<Chronicle | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [history, setHistory] = useState<Chronicle[]>([]);
  const [linkCopied, setLinkCopied] = useState(false);

  // Increments on every date change / unmount so stale responses and polls are ignored.
  const requestRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    pollTimerRef.current = null;
  }, []);

  const loadHistory = useCallback(async () => {
    setHistory(await getRecentChronicles());
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    const req = ++requestRef.current;
    stopPolling();
    setGenerating(false);
    setGenError(null);
    setLoadError(null);
    setLoading(true);
    getChronicle(selectedDate)
      .then((data) => {
        if (requestRef.current !== req) return;
        setChronicle(data && data.status === 'ready' ? data : null);
      })
      .catch((e) => {
        if (requestRef.current !== req) return;
        console.error('[Gazette] load failed:', e);
        setChronicle(null);
        setLoadError('Could not load this edition. Check your connection and try again.');
      })
      .finally(() => {
        if (requestRef.current === req) setLoading(false);
      });
  }, [selectedDate, stopPolling]);

  // Cancel any polling when the page closes.
  useEffect(
    () => () => {
      requestRef.current++;
      stopPolling();
    },
    [stopPolling],
  );

  const handleGenerate = async () => {
    if (!user || generating) return;
    const req = requestRef.current;
    const startedAt = Date.now();
    setGenerating(true);
    setGenError(null);

    const attempt = async () => {
      try {
        const result = await requestTodayChronicle();
        if (requestRef.current !== req) return;
        if (result.status === 'ready') {
          setGenerating(false);
          loadHistory();
          if (result.date && result.date !== selectedDate) {
            setSelectedDate(result.date); // the date effect reloads it
          } else {
            setChronicle(result);
          }
          return;
        }
        if (result.status === 'failed') {
          setGenerating(false);
          setGenError('Today\'s edition could not be written right now. Please try again later.');
          return;
        }
        if (Date.now() - startedAt >= POLL_MAX_MS) {
          setGenerating(false);
          setGenError('This is taking longer than usual. Please check back in a few minutes.');
          return;
        }
        pollTimerRef.current = setTimeout(attempt, POLL_EVERY_MS);
      } catch (e) {
        if (requestRef.current !== req) return;
        setGenerating(false);
        setGenError(e instanceof ApiError ? e.message : 'Could not reach the server. Please try again.');
      }
    };
    attempt();
  };

  const formatDate = (dateStr: string) =>
    fromYmd(dateStr).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();

  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/gazette/${selectedDate}`;
  const canGoForward = selectedDate < latestAllowed();
  const isTodayish = selectedDate === localToday() || selectedDate === utcToday();

  return (
    <div className="min-h-screen bg-void flex flex-col font-sans text-parchment">
      {/* Header Section */}
      <header className="border-b border-neon-cyan/21 bg-void/55 backdrop-blur-md sticky top-0 z-50 px-21 py-13 flex items-center justify-between gap-13 flex-wrap">
        <a href="/" className="flex items-center gap-13 hover:opacity-80 transition-opacity">
          <Newspaper className="w-21 h-21 text-neon-cyan drop-shadow-[0_0_8px_rgba(0,240,255,0.5)]" />
          <h1 className="text-13 caps-modern text-neon-cyan tracking-[0.34em] font-bold">ARTHASHASTRA GAZETTE</h1>
        </a>

        <div className="flex items-center gap-13">
          <div className="flex items-center gap-21 bg-neon-cyan/5 border border-neon-cyan/13 rounded-full px-13 py-5">
            <div className="flex items-center gap-8 border-r border-neon-cyan/13 pr-13">
              <span className="text-[9px] font-mono text-neon-cyan/55 uppercase tracking-widest">Edition</span>
              <span className="text-13 font-mono text-neon-cyan font-bold">{selectedDate}</span>
            </div>
            <div className="flex gap-8">
              <button
                onClick={() => setSelectedDate((d) => shiftYmd(d, -1))}
                className="p-3 text-neon-cyan/55 hover:text-neon-cyan transition-colors"
                aria-label="Previous day"
              >
                <ChevronLeft className="w-13 h-13" />
              </button>
              <button
                onClick={() => setSelectedDate((d) => (d < latestAllowed() ? shiftYmd(d, 1) : d))}
                className="p-3 text-neon-cyan/55 hover:text-neon-cyan transition-colors disabled:opacity-21 disabled:cursor-not-allowed"
                disabled={!canGoForward}
                aria-label="Next day"
              >
                <ChevronRight className="w-13 h-13" />
              </button>
            </div>
          </div>

          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(shareUrl);
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 2000);
              } catch {
                /* clipboard blocked */
              }
            }}
            className="flex items-center gap-5 px-8 py-5 border border-neon-cyan text-neon-cyan hover:bg-neon-cyan hover:text-void transition-colors rounded text-[10px] caps-modern font-bold shadow-[0_0_8px_rgba(0,230,118,0.3)]"
            title="Copy link to this edition"
          >
            {linkCopied ? <Check className="w-13 h-13" /> : <Copy className="w-13 h-13" />}
            <span className="hidden sm:inline">{linkCopied ? 'LINK COPIED' : 'COPY LINK'}</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row gap-0">
        {/* Left Archive Sidebar */}
        <aside className="w-full lg:w-[280px] border-r border-neon-cyan/13 lg:min-h-[calc(100vh-60px)] p-21 bg-void/34">
          <div className="mb-21">
            <h3 className="text-[10px] caps-modern text-neon-cyan/55 mb-13 tracking-widest flex items-center gap-8">
              <Database className="w-[10px] h-[10px]" />
              PAST EDITIONS
            </h3>
            <div className="space-y-5 max-h-[300px] overflow-y-auto silk-scroll pr-8">
              {history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedDate(item.date || item.id)}
                  className={`w-full text-left p-8 rounded border transition-all flex items-center justify-between group ${
                    selectedDate === (item.date || item.id)
                      ? 'bg-neon-cyan/13 border-neon-cyan text-neon-cyan shadow-[0_0_8px_rgba(0,240,255,0.2)]'
                      : 'border-transparent hover:border-neon-cyan/21 text-parchment/34 hover:text-parchment'
                  }`}
                >
                  <span className="text-13 font-mono">{item.date || item.id}</span>
                  <ChevronRight className={`w-[10px] h-[10px] transition-opacity ${selectedDate === (item.date || item.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                </button>
              ))}
            </div>
            {history.length === 0 && (
              <p className="text-[10px] text-parchment/34 italic py-13">No past editions yet.</p>
            )}
          </div>

          <div className="mt-auto pt-21 border-t border-neon-cyan/8">
            <p className="text-[10px] font-sans text-parchment/55 leading-relaxed">
              One edition per day, written by AI from news reports published in the previous 48 hours. Each edition links its sources: read them before you rely on a story.
            </p>
          </div>
        </aside>

        {/* Content Area */}
        <section className="flex-1 p-21 lg:p-55 overflow-y-auto w-full max-w-5xl mx-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-144 space-y-21">
              <Loader2 className="w-55 h-55 text-neon-cyan animate-spin opacity-55" />
              <p className="text-13 caps-modern tracking-[0.34em] text-neon-cyan animate-pulse">Loading edition...</p>
            </div>
          ) : chronicle ? (
            <div className="space-y-55">
              {/* Newspaper Masthead */}
              <div className="text-center py-55 border-b-4 border-double border-neon-cyan/34 mb-55 bg-neon-cyan/[0.02] relative overflow-hidden px-21">
                <div
                  className="absolute inset-0 opacity-10 pointer-events-none"
                  style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(248,250,240,0.35) 0 1px, transparent 1px 6px)' }}
                />
                <div className="relative z-10 flex flex-col items-center">
                  <h1 className="text-55 md:text-89 font-display font-black tracking-tighter leading-none text-parchment drop-shadow-[0_0_15px_rgba(230,241,255,0.3)] uppercase">
                    THE ARTHASHASTRA <span className="text-neon-cyan [text-shadow:0_0_21px_rgba(0,230,118,0.5)]">GAZETTE</span>
                  </h1>
                  <div className="w-full max-w-[610px] h-1 bg-gradient-to-r from-transparent via-neon-cyan/55 to-transparent mt-13" />
                  <div className="flex items-center justify-center gap-34 mt-21 w-full">
                    <div className="hidden md:block flex-1 h-[1px] bg-neon-cyan/21" />
                    <div className="flex flex-wrap items-center justify-center gap-13 md:gap-21">
                      <span className="text-[11px] caps-modern text-neon-cyan/89 tracking-[0.21em] italic">AI-generated summary of linked news reports</span>
                      <span className="text-[11px] caps-modern text-parchment/34 hidden md:inline">|</span>
                      <span className="text-[11px] caps-modern text-neon-cyan/89 tracking-[0.21em]">{formatDate(chronicle.date || selectedDate)}</span>
                    </div>
                    <div className="hidden md:block flex-1 h-[1px] bg-neon-cyan/21" />
                  </div>
                </div>
              </div>

              {/* Lead */}
              {(chronicle.headline || chronicle.summary) && (
                <div className="space-y-13">
                  {chronicle.headline && (
                    <h2 className="text-34 font-serif italic text-parchment leading-tight tracking-tight">{chronicle.headline}</h2>
                  )}
                  {chronicle.summary && (
                    <div className="bg-neon-cyan/5 border-l-2 border-neon-cyan p-13">
                      <p className="text-13 font-medium text-neon-cyan italic leading-relaxed">{chronicle.summary}</p>
                    </div>
                  )}
                  <DistributionHub title={chronicle.headline || 'The Arthashastra Gazette'} summary={chronicle.summary} shareUrl={shareUrl} />
                </div>
              )}

              {/* Stories */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-34">
                {chronicle.stories.map((story, i) => {
                  const magenta = i % 2 === 1;
                  return (
                    <motion.article
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`space-y-13 p-21 border rounded-8 ${magenta ? 'border-neon-magenta/21 bg-neon-magenta/[0.03]' : 'border-neon-cyan/21 bg-neon-cyan/[0.03]'}`}
                    >
                      <div className="flex items-center gap-8">
                        <Globe className={`w-13 h-13 ${magenta ? 'text-neon-magenta' : 'text-neon-cyan'}`} />
                        <span className={`text-[10px] caps-modern tracking-widest ${magenta ? 'text-neon-magenta' : 'text-neon-cyan'}`}>
                          {(story.region || 'Global').toUpperCase()}
                        </span>
                      </div>
                      {story.title && <h3 className="text-21 font-serif italic text-parchment leading-tight">{story.title}</h3>}
                      {story.whatHappened && (
                        <div>
                          <span className="text-[9px] caps-modern text-parchment/55 block mb-5 font-bold">WHAT HAPPENED</span>
                          <p className="text-13 text-parchment/89 leading-relaxed">{story.whatHappened}</p>
                        </div>
                      )}
                      {story.effectOnPeople && (
                        <div className={`p-13 border-l-4 rounded-r-8 ${magenta ? 'bg-neon-magenta/13 border-neon-magenta' : 'bg-neon-cyan/13 border-neon-cyan'}`}>
                          <span className={`text-[9px] caps-modern block mb-5 font-bold ${magenta ? 'text-neon-magenta' : 'text-neon-cyan'}`}>EFFECT ON PEOPLE</span>
                          <p className="text-13 text-parchment leading-relaxed">{story.effectOnPeople}</p>
                        </div>
                      )}
                      {story.verdict && (
                        <p className="text-[11px] text-emerald-400/89 leading-relaxed">
                          <span className="font-bold">{story.verdict === 'corrected' ? 'Corrected & fact-checked' : 'Fact-checked'}</span>
                          {story.sources.length > 0 && ` by ${story.sources.length} sources`}
                          {story.verificationNote ? ` — ${story.verificationNote}` : ''}
                        </p>
                      )}
                      {story.sources.length > 0 && (
                        <ul className="space-y-2 text-[11px]" aria-label="Sources for this story">
                          {story.sources.map((src, i) => (
                            <li key={src.url}>
                              <a href={src.url} target="_blank" rel="noopener noreferrer nofollow" className="text-neon-cyan/89 hover:underline break-all">
                                [{i + 1}] {src.title}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </motion.article>
                  );
                })}
              </div>

              {/* Sources */}
              <div className="border-t border-neon-cyan/21 pt-34">
                <h3 className="text-13 caps-modern text-neon-cyan tracking-widest mb-13">SOURCES</h3>
                {chronicle.sources.length > 0 ? (
                  <ul className="space-y-8">
                    {chronicle.sources.map((src, i) => (
                      <li key={i} className="text-13 text-parchment/55 leading-tight flex items-start gap-8">
                        <ExternalLink className="w-[11px] h-[11px] mt-[3px] text-neon-cyan/55 shrink-0" />
                        <a href={src.url} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-neon-cyan underline decoration-neon-cyan/21 break-words">
                          {src.title || src.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-13 text-parchment/55 italic">No source links were saved with this edition. Treat it with extra caution.</p>
                )}
              </div>

              <div className="text-center pt-55 border-t border-neon-cyan/8 pb-55">
                <p className="text-[11px] text-parchment/55 max-w-2xl mx-auto leading-relaxed">
                  This edition is an AI-generated summary of the news reports linked above. AI can misread or misstate facts: check the sources before you rely on or share a story. Not financial, legal or investment advice.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-89 space-y-34">
              <div className="relative">
                <ShieldAlert className="w-55 h-55 text-neon-magenta" />
                <div className="absolute inset-0 bg-neon-magenta/21 blur-[21px] rounded-full" />
              </div>
              <div className="text-center space-y-13 max-w-md mx-auto">
                <h3 className="text-21 text-neon-magenta caps-modern font-bold tracking-widest">NO EDITION FOR THIS DATE</h3>
                <p className="text-13 text-parchment/55 leading-relaxed">
                  {loadError
                    ? loadError
                    : isTodayish
                      ? user
                        ? "Today's edition hasn't been written yet. You can ask for it now; it takes about a minute and is shared with every reader."
                        : "Today's edition hasn't been written yet. Sign in to request it, or check back later."
                      : 'There is no edition for this date. Pick another date from the list.'}
                </p>
              </div>

              {genError && (
                <div className="flex items-center gap-8 p-13 border border-rose-950 bg-rose-950/21 rounded-8 text-rose-400 text-13 max-w-md">
                  <AlertCircle className="w-13 h-13 shrink-0" />
                  <span>{genError}</span>
                </div>
              )}

              {user && isTodayish && (
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="px-34 py-13 bg-neon-magenta/13 border border-neon-magenta text-neon-magenta hover:bg-neon-magenta hover:text-void transition-all rounded-8 caps-modern tracking-[0.21em] flex items-center gap-13 group disabled:cursor-wait"
                >
                  {generating ? (
                    <div className="flex flex-col items-center gap-8">
                      <div className="flex items-center gap-13">
                        <Loader2 className="w-13 h-13 animate-spin" />
                        Writing today's edition...
                      </div>
                      <div className="text-[9px] caps-modern text-neon-magenta/55">
                        Searching recent news reports. This can take 1–3 minutes.
                      </div>
                    </div>
                  ) : (
                    <>
                      <Landmark className="w-13 h-13 group-hover:rotate-12 transition-transform" />
                      GENERATE TODAY'S EDITION
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

function DistributionHub({ title, summary, shareUrl }: { title: string; summary: string; shareUrl: string }) {
  const [copied, setCopied] = useState(false);
  const shareText = `Arthashastra Gazette (AI-generated news summary): ${title}${summary ? `\n\n${summary}` : ''}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText}\n\nSources and full edition: ${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  };

  const url = encodeURIComponent(shareUrl);
  const text = encodeURIComponent(shareText);
  const themeClasses =
    'bg-neon-cyan/10 border-neon-cyan/34 hover:bg-neon-cyan/21 text-neon-cyan shadow-[0_0_8px_rgba(0,240,255,0.1)] hover:shadow-[0_0_13px_rgba(0,240,255,0.3)]';

  return (
    <div className="flex flex-wrap items-center gap-8 relative z-10 my-13">
      <span className="text-[9px] caps-modern uppercase font-bold tracking-widest text-neon-cyan/55 mr-8">SHARE:</span>
      <a
        href={`https://api.whatsapp.com/send?text=${text}%0A%0A${url}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`p-8 border rounded-full transition-all ${themeClasses}`}
        title="Share on WhatsApp"
        aria-label="Share on WhatsApp"
      >
        <MessageCircle className="w-13 h-13" />
      </a>
      <a
        href={`https://t.me/share/url?url=${url}&text=${text}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`p-8 border rounded-full transition-all ${themeClasses}`}
        title="Share on Telegram"
        aria-label="Share on Telegram"
      >
        <Send className="w-13 h-13" />
      </a>
      <button onClick={handleCopy} className={`px-13 py-5 border rounded-full text-[10px] caps-modern flex items-center gap-8 transition-all ${themeClasses}`}>
        {copied ? <><Check className="w-13 h-13" /> COPIED</> : <><Copy className="w-13 h-13" /> COPY TEXT</>}
      </button>
    </div>
  );
}
