import React, { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { collection, query, orderBy, limit, onSnapshot, setDoc, doc, getDoc, deleteDoc, writeBatch, increment, serverTimestamp } from 'firebase/firestore';
import { db, toDate, signInWithGoogle } from '../lib/firebase';
import { User as UserIcon, Send, Landmark, Zap, Upload, FileText, AlertCircle, Trash2, Calendar, Heart } from 'lucide-react';
import { motion } from 'motion/react';
import { ErrorBoundary } from './ErrorBoundary';
import { ArenaChat, Debate, publicName, arenaErrorMessage } from './ArenaChat';
import { Markdown } from './Markdown';

interface TheArenaProps {
  user?: User | null;
  language?: string;
  isAdmin?: boolean;
  isSubscribed?: boolean;
  onSubscribe?: () => void;
}

const MAX_ARGUMENT_CHARS = 20_000;
const MAX_FILE_BYTES = 256 * 1024;
const AI_LABEL = 'Arthashastra AI · AI-generated';

const pad = (n: number) => String(n).padStart(2, '0');
const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const todayYmd = () => toYmd(new Date());
/** Local calendar date of a debate (pending server timestamps count as "now"). */
const debateYmd = (d: Debate) => toYmd(toDate(d.createdAt) ?? new Date());

function formatDisplayDate(dateStr: string) {
  if (dateStr === todayYmd()) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const d = fromYmd(dateStr);
  if (dateStr === toYmd(yesterday)) return `Yesterday (${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })})`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function TheArena({ user, language = 'English', isAdmin = false }: TheArenaProps) {
  const [active, setActive] = useState<{ debate: Debate; requestVerdict: boolean } | null>(null);
  const [debates, setDebates] = useState<Debate[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(todayYmd());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [cardError, setCardError] = useState<{ id: string; message: string } | null>(null);

  const uid = user?.uid;
  const isGuest = !user || user.isAnonymous;

  useEffect(() => {
    if (!uid) {
      setDebates([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setListError(null);
    const q = query(collection(db, 'debates'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setDebates(snapshot.docs.map((d) => ({ id: d.id, ...(d.data({ serverTimestamps: 'estimate' }) as Omit<Debate, 'id'>) })));
        setLoading(false);
      },
      (error) => {
        console.error('[Arena] list error:', error);
        setListError('Could not load the Arena. Please try again later.');
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [uid]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const processFile = (file: File) => {
    setUploadError(null);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setUploadError(`File too large. Max ${MAX_ARGUMENT_CHARS.toLocaleString()} characters (about ${Math.round(MAX_FILE_BYTES / 1024)} KB).`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text !== 'string') {
        setUploadError('Unrecognised format. Please upload a plain text, CSV, JSON or Markdown file.');
        return;
      }
      const cleaned = text.trim();
      if (!cleaned) {
        setUploadError('The file is empty.');
        return;
      }
      if (cleaned.length > MAX_ARGUMENT_CHARS) {
        setUploadError(`This file has ${cleaned.length.toLocaleString()} characters; the limit is ${MAX_ARGUMENT_CHARS.toLocaleString()}. Please shorten it.`);
        return;
      }
      setInput(cleaned);
      setUploadedFile({ name: file.name, size: file.size });
    };
    reader.onerror = () => setUploadError('Failed to read the file.');
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) processFile(e.target.files[0]);
    e.target.value = '';
  };

  const clearUploadedFile = () => {
    setUploadedFile(null);
    setUploadError(null);
    setInput('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const argument = input.trim();
    if (!argument || isSubmitting || !user) return;
    if (isGuest) {
      setSubmitError('Sign in with Google to post in the Arena. Guests can read but not post.');
      return;
    }
    if (argument.length > MAX_ARGUMENT_CHARS) {
      setSubmitError(`Your argument is too long (max ${MAX_ARGUMENT_CHARS.toLocaleString()} characters).`);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const ref = doc(collection(db, 'debates'));
      const newDebate = {
        id: ref.id,
        userId: user.uid,
        userName: publicName(user),
        userArgument: argument,
        createdAt: serverTimestamp(),
        status: 'pending',
        likesCount: 0,
      };
      await setDoc(ref, newDebate);
      setInput('');
      setUploadedFile(null);
      setUploadError(null);
      setSelectedDate(todayYmd());
      // ArenaChat asks the server for the verdict and shows a waiting state until it arrives.
      setActive({ debate: { ...newDebate, createdAt: new Date() }, requestVerdict: true });
    } catch (err) {
      setSubmitError(arenaErrorMessage(err, 'Your argument could not be posted. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setCardError(null);
    try {
      await deleteDoc(doc(db, 'debates', id));
      setConfirmDeleteId(null);
    } catch (err) {
      setCardError({ id, message: arenaErrorMessage(err, 'Could not delete this debate.') });
    }
  };

  if (active) {
    return (
      <ErrorBoundary>
        <ArenaChat
          key={active.debate.id}
          debate={active.debate}
          user={user}
          language={language}
          isAdmin={isAdmin}
          requestVerdictOnOpen={active.requestVerdict}
          onBack={() => setActive(null)}
        />
      </ErrorBoundary>
    );
  }

  const visible = debates.filter((d) => debateYmd(d) === selectedDate);
  const activeDates = Array.from(new Set([todayYmd(), ...debates.map(debateYmd)])).sort((a, b) => b.localeCompare(a));
  const remaining = MAX_ARGUMENT_CHARS - input.length;

  return (
    <div className="max-w-4xl mx-auto py-34 space-y-34 px-21">
      <div className="text-center space-y-13 mb-55">
        <div className="inline-flex items-center justify-center p-21 bg-cyan-900/13 border hover:border-cyan-500/55 border-cyan-900/34 rounded-full mb-13 relative group transition-all">
          <div className="absolute inset-0 bg-cyan-500 rounded-full opacity-0 group-hover:opacity-10 transition-opacity blur-xl"></div>
          <Landmark className="w-[44px] h-[44px] text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.3)]" />
        </div>
        <h2 className="text-55 font-display font-medium text-cyan-400 uppercase tracking-widest drop-shadow-[0_0_13px_rgba(34,211,238,0.2)]">The Public Forum</h2>
        <p className="text-13 font-sans text-parchment/89 max-w-2xl mx-auto leading-relaxed border-t border-cyan-900/34 pt-13 mt-13">
          Post an argument about a policy, a price, a fee or an economic belief. Arthashastra AI answers publicly with a sourced verdict, and anyone signed in can read and join the discussion. Posts are public: do not include personal details.
        </p>
      </div>

      {!user ? (
        <div className="glass-panel p-34 text-center border-cyan-900/21 bg-void/55">
          <p className="text-13 caps-modern text-cyan-400/89">Sign in to read and join the Arena.</p>
        </div>
      ) : isGuest ? (
        <div className="glass-panel p-34 text-center border-cyan-900/21 bg-void/55 space-y-13">
          <p className="text-13 caps-modern text-cyan-400/89">You are browsing as a guest. Sign in with Google to post or reply.</p>
          <button
            type="button"
            onClick={() => signInWithGoogle().catch(() => undefined)}
            className="px-21 py-8 bg-cyan-900 text-cyan-100 hover:bg-cyan-800 rounded-8 font-bold caps-modern text-[11px] border border-cyan-700"
          >
            Sign in with Google
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="glass-panel p-21 md:p-34 border-cyan-900/34 shadow-[0_0_34px_rgba(34,211,238,0.05)] relative">
          <div className="absolute -top-[1px] left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/34 to-transparent"></div>
          <div className="relative">
            <textarea
              value={input}
              maxLength={MAX_ARGUMENT_CHARS}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_ARGUMENT_CHARS))}
              placeholder="State your argument for public evaluation..."
              className="w-full bg-void border border-cyan-900/34 rounded-8 p-13 pb-34 text-13 text-parchment font-sans focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/55 min-h-[144px] resize-y placeholder:text-parchment/34"
              disabled={isSubmitting}
            />
            <div className={`absolute bottom-13 right-13 text-[10px] font-mono ${remaining <= 0 ? 'text-rose-400' : 'text-parchment/34'}`}>
              {input.length.toLocaleString()} / {MAX_ARGUMENT_CHARS.toLocaleString()}
            </div>
          </div>

          {/* File upload */}
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`mt-13 p-13 border border-dashed rounded-8 transition-all flex flex-col md:flex-row items-center justify-between gap-13 bg-void/34 ${
              dragActive ? 'border-cyan-400 bg-cyan-900/10 shadow-[0_0_13px_rgba(0,240,255,0.15)]' : 'border-cyan-900/34 hover:border-cyan-500/34'
            }`}
          >
            <div className="flex items-center gap-13 w-full md:w-auto">
              {uploadedFile ? (
                <div className="flex items-center gap-8 text-cyan-400">
                  <FileText className="w-21 h-21" />
                  <div className="text-left">
                    <p className="text-[11px] font-bold uppercase tracking-wider truncate max-w-[200px] md:max-w-[300px]">{uploadedFile.name}</p>
                    <p className="text-[10px] text-cyan-400/55 font-mono">{(uploadedFile.size / 1024).toFixed(1)} KB loaded</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-8 text-parchment/55">
                  <Upload className="w-21 h-21 text-cyan-500/55" />
                  <div className="text-left">
                    <p className="text-[11px] font-medium caps-modern">Drag &amp; drop a text file here</p>
                    <p className="text-[9px] text-parchment/34 font-sans">.txt, .md, .csv, .json, .log — up to {MAX_ARGUMENT_CHARS.toLocaleString()} characters</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-13 w-full md:w-auto justify-end">
              {uploadError && (
                <span className="text-[10px] font-medium text-rose-400 flex items-center gap-[4px] bg-rose-950/21 border border-rose-950 px-8 py-[4px] rounded-[4px] max-w-[260px] md:max-w-xs" title={uploadError}>
                  <AlertCircle className="w-13 h-13 shrink-0" /> {uploadError}
                </span>
              )}
              <label className="cursor-pointer px-13 py-8 bg-cyan-950/34 hover:bg-cyan-900/34 border border-cyan-800/55 rounded-[6px] text-[11px] text-cyan-400 hover:text-cyan-300 font-bold tracking-wider uppercase transition-all whitespace-nowrap">
                Browse Files
                <input type="file" className="hidden" onChange={handleFileChange} accept=".txt,.md,.csv,.json,.log" />
              </label>
              {uploadedFile && (
                <button
                  type="button"
                  onClick={clearUploadedFile}
                  className="p-8 text-rose-400/55 hover:text-rose-400 hover:bg-rose-950/21 border border-transparent hover:border-rose-950 rounded-[6px] transition-all"
                  title="Clear document"
                >
                  <Trash2 className="w-13 h-13" />
                </button>
              )}
            </div>
          </div>

          {submitError && (
            <div className="mt-13 p-13 bg-rose-950/21 border border-rose-950/55 rounded-8 flex items-center gap-8 text-rose-400 text-[11px]">
              <AlertCircle className="w-[15px] h-[15px] shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="mt-13 flex justify-between items-center gap-13">
            <p className="text-[10px] text-cyan-400/55 hidden md:block">
              Posts are public and show your name as “{publicName(user)}”. The AI verdict is AI-generated and lists its sources.
            </p>
            <button
              type="submit"
              disabled={isSubmitting || !input.trim()}
              className="px-34 py-13 bg-cyan-900 text-cyan-100 hover:bg-cyan-800 rounded-8 font-bold caps-modern text-13 flex items-center gap-8 shadow-[0_0_21px_rgba(34,211,238,0.2)] transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase border border-cyan-700 shrink-0"
            >
              {isSubmitting ? (
                <>
                  <Zap className="w-13 h-13 animate-pulse" />
                  POSTING
                </>
              ) : (
                <>
                  <Send className="w-13 h-13" />
                  SUBMIT ARGUMENT
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {user && (
        <>
          {/* Date index */}
          <div className="glass-panel p-21 border-cyan-900/34 bg-void/55 space-y-13 mt-55">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-13 border-b border-cyan-900/21 pb-13">
              <div className="flex items-center gap-8">
                <Calendar className="w-[18px] h-[18px] text-cyan-400" />
                <h4 className="text-13 caps-modern font-bold text-cyan-100 tracking-wider">DEBATES BY DATE</h4>
              </div>
              <div className="flex items-center gap-8">
                <span className="text-[10px] text-parchment/55 font-mono">PICK A DATE:</span>
                <input
                  type="date"
                  value={selectedDate}
                  max={todayYmd()}
                  onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                  className="bg-void border border-cyan-900/55 hover:border-cyan-400 rounded px-8 py-[4px] text-[11px] text-cyan-400 font-mono focus:outline-none focus:border-cyan-400 transition-colors"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-8 overflow-x-auto max-h-[144px] pr-8 custom-scrollbar pt-[4px]">
              {activeDates.map((dateStr) => {
                const count = debates.filter((d) => debateYmd(d) === dateStr).length;
                const isSelected = selectedDate === dateStr;
                return (
                  <button
                    type="button"
                    key={dateStr}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`flex items-center gap-8 px-13 py-8 rounded-[6px] text-[11px] font-mono transition-all border ${
                      isSelected
                        ? 'bg-cyan-950/55 border-cyan-400 text-cyan-300 shadow-[0_0_8px_rgba(0,240,255,0.15)]'
                        : 'bg-void/55 border-cyan-900/34 text-parchment/55 hover:text-cyan-400 hover:border-cyan-800/55'
                    }`}
                  >
                    <span>{formatDisplayDate(dateStr)}</span>
                    {count > 0 && (
                      <span className={`px-[6px] py-[1px] rounded-full text-[9px] font-bold ${isSelected ? 'bg-cyan-900 text-cyan-300' : 'bg-void text-parchment/34'}`}>{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-parchment/34">Showing the 50 most recent debates.</p>
          </div>

          <div className="space-y-34">
            <div className="flex items-center justify-between border-b border-cyan-900/34 pb-13">
              <h3 className="text-21 font-display font-medium text-parchment">Debates for {formatDisplayDate(selectedDate)}</h3>
              <span className="text-[11px] font-mono text-cyan-400/55">{visible.length} found</span>
            </div>

            {loading ? (
              <div className="text-center py-55 italic text-parchment/55">Loading debates...</div>
            ) : listError ? (
              <div className="text-center py-34 text-rose-400 text-13">{listError}</div>
            ) : visible.length === 0 ? (
              <div className="text-center py-55 italic text-parchment/55 border border-dashed border-cyan-900/34 rounded-13 px-21">
                <p className="text-13 mb-[4px] text-parchment/55">No debates on this date.</p>
                {selectedDate === todayYmd() && !isGuest && <p className="text-[11px] text-cyan-400/55">Be the first: post an argument above.</p>}
              </div>
            ) : (
              visible.map((debate) => {
                const canDelete = !!uid && (debate.userId === uid || isAdmin);
                const created = toDate(debate.createdAt);
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={debate.id}
                    className="glass-panel border-cyan-900/34 relative overflow-hidden"
                  >
                    <div className="p-21 md:p-34 border-b border-cyan-900/34 bg-void/34">
                      <div className="flex items-center justify-between mb-13 border-l-2 border-cyan-500/55 pl-8 gap-8">
                        <div className="flex items-center gap-8 min-w-0">
                          <UserIcon className="w-13 h-13 text-cyan-400/55 shrink-0" />
                          <span className="text-13 caps-modern font-bold text-cyan-100 tracking-widest uppercase truncate">
                            {debate.userId === uid ? 'You' : debate.userName || 'Citizen'}
                          </span>
                        </div>
                        <span className="text-[10px] text-parchment/34 font-mono hidden md:block">{created ? created.toLocaleString() : ''}</span>
                      </div>
                      <Markdown className="prose prose-invert max-w-none text-parchment/89 font-sans text-13 leading-relaxed opacity-90 pl-13 line-clamp-3">
                        {debate.userArgument || ''}
                      </Markdown>
                    </div>

                    <div className="p-21 md:p-34 bg-cyan-900/5 flex flex-col md:flex-row md:items-center justify-between gap-21 relative">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-8 mb-13">
                          <span className="text-[11px] caps-modern font-bold text-cyan-400 tracking-widest uppercase">Verdict · {AI_LABEL}</span>
                        </div>
                        {debate.aiResponse ? (
                          <Markdown className="prose prose-invert max-w-none prose-p:leading-relaxed text-parchment font-sans text-13 prose-headings:text-cyan-400 prose-strong:text-cyan-400/89 relative z-10 pl-13 border-l-2 border-cyan-500/34 line-clamp-3">
                            {debate.aiResponse}
                          </Markdown>
                        ) : (
                          <div className="flex items-center gap-8 text-[11px] caps-modern text-cyan-400/55 italic animate-pulse py-13">
                            <Zap className="w-13 h-13" />
                            Waiting for the AI verdict...
                          </div>
                        )}
                      </div>
                      <div className="flex md:flex-col items-center md:items-end gap-8 shrink-0">
                        <button
                          type="button"
                          onClick={() => setActive({ debate, requestVerdict: false })}
                          className="px-21 py-13 bg-cyan-950/34 hover:bg-cyan-900/34 border border-cyan-900 rounded-8 font-bold caps-modern text-[11px] text-cyan-400 hover:text-cyan-300 uppercase transition-all cursor-pointer"
                        >
                          {debate.aiResponse ? 'OPEN DISCUSSION' : 'OPEN'}
                        </button>
                        <div className="flex items-center gap-8">
                          <LikeButton debate={debate} user={user} onError={(message) => setCardError({ id: debate.id, message })} />
                          {canDelete &&
                            (confirmDeleteId === debate.id ? (
                              <span className="flex items-center gap-[6px] text-[10px]">
                                <span className="text-rose-400">Delete?</span>
                                <button type="button" onClick={() => handleDelete(debate.id)} className="px-8 py-[4px] border border-rose-900 text-rose-400 rounded-[4px] hover:bg-rose-950/34">
                                  Yes
                                </button>
                                <button type="button" onClick={() => setConfirmDeleteId(null)} className="px-8 py-[4px] border border-cyan-900 text-parchment/55 rounded-[4px]">
                                  No
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(debate.id)}
                                className="p-8 text-rose-400/55 hover:text-rose-400 border border-transparent hover:border-rose-950 rounded-[6px]"
                                title="Delete this debate"
                                aria-label="Delete this debate"
                              >
                                <Trash2 className="w-13 h-13" />
                              </button>
                            ))}
                        </div>
                      </div>
                    </div>
                    {cardError?.id === debate.id && (
                      <div className="px-21 pb-13 text-[11px] text-rose-400 flex items-center gap-[6px]">
                        <AlertCircle className="w-13 h-13" /> {cardError.message}
                      </div>
                    )}
                  </motion.div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** One like per signed-in Google user. Liked state comes from debates/{id}/likes/{uid}. */
function LikeButton({ debate, user, onError }: { debate: Debate; user: User; onError: (message: string) => void }) {
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);
  const count = typeof debate.likesCount === 'number' ? debate.likesCount : 0;

  useEffect(() => {
    let alive = true;
    getDoc(doc(db, 'debates', debate.id, 'likes', user.uid))
      .then((s) => alive && setLiked(s.exists()))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [debate.id, user.uid]);

  const like = async () => {
    if (liked || busy) return;
    if (user.isAnonymous) {
      onError('Sign in with Google to like debates.');
      return;
    }
    setBusy(true);
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'debates', debate.id, 'likes', user.uid), { createdAt: serverTimestamp() });
      batch.update(doc(db, 'debates', debate.id), { likesCount: increment(1) });
      await batch.commit();
      setLiked(true);
    } catch (err) {
      onError(arenaErrorMessage(err, 'Could not save your like (you may have liked this already).'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={like}
      disabled={liked || busy}
      aria-pressed={liked}
      title={liked ? 'You liked this' : 'Like'}
      className={`flex items-center gap-[4px] px-8 py-[6px] border rounded-[6px] text-[11px] font-mono transition-all ${
        liked ? 'border-rose-500/55 text-rose-400 bg-rose-950/21' : 'border-cyan-900 text-parchment/55 hover:text-rose-400 hover:border-rose-900'
      } disabled:cursor-default`}
    >
      <Heart className={`w-13 h-13 ${liked ? 'fill-current' : ''}`} />
      {count}
    </button>
  );
}
