import React, { useState, useEffect, useRef } from 'react';
import type { User } from 'firebase/auth';
import { collection, query, orderBy, limitToLast, onSnapshot, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { db, toDate } from '../lib/firebase';
import { arenaReply, ApiError } from '../lib/api';
import { User as UserIcon, Send, Landmark, ArrowLeft, AlertCircle, MessageSquare, Loader2, RefreshCw } from 'lucide-react';
import { Markdown } from './Markdown';

export const MAX_CHAT_CHARS = 2000;
const AI_LABEL = 'Arthashastra AI · AI-generated';
/** A verdict request that has not produced anything after this long may be retried by the author. */
const VERDICT_RETRY_AFTER_MS = 90_000;

export interface Debate {
  id: string;
  userId: string;
  userName: string;
  userArgument: string;
  status: 'pending' | 'resolved' | string;
  likesCount?: number;
  aiResponse?: string;
  createdAt?: unknown;
}

interface ArenaChatMessage {
  id: string;
  userId: string;
  userName?: string;
  role: 'user' | 'model';
  text: string;
  createdAt: unknown;
}

interface ArenaChatProps {
  debate: Debate;
  user?: User | null;
  language?: string;
  isAdmin?: boolean;
  /** Ask the server for the verdict as soon as the room opens (used right after the author posts). */
  requestVerdictOnOpen?: boolean;
  onBack: () => void;
}

/** Public display name: never an email address. */
export function publicName(user: User): string {
  const name = (user.displayName || '').trim();
  return (name || `Citizen-${user.uid.slice(0, 6)}`).slice(0, 100);
}

/** Turns API / Firestore errors into a message for the user. */
export function arenaErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    if (e.code === 'SIGN_IN_REQUIRED') return 'Sign in with Google to post in the Arena. Guests can read but not post.';
    return e.message;
  }
  if (e instanceof FirebaseError && e.code === 'permission-denied') {
    return 'Not allowed. Guests can read the Arena, but you must sign in with Google to post, reply or like.';
  }
  if (e instanceof Error && e.message === 'AUTH_REQUIRED') return 'Please sign in first.';
  return fallback;
}

/** Verdict requests already sent from this tab (guards against double requests). */
const requestedVerdicts = new Set<string>();

export function ArenaChat({ debate: initialDebate, user, language = 'English', requestVerdictOnOpen, onBack }: ArenaChatProps) {
  const [debate, setDebate] = useState<Debate>(initialDebate);
  const [deleted, setDeleted] = useState(false);
  const [messages, setMessages] = useState<ArenaChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputMsg, setInputMsg] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [requestingVerdict, setRequestingVerdict] = useState(false);
  const [verdictError, setVerdictError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const bottomRef = useRef<HTMLDivElement>(null);
  const debateId = initialDebate.id;
  const uid = user?.uid;
  const isGuest = !user || user.isAnonymous;
  const isAuthor = !!uid && debate.userId === uid;

  // Live debate document (the verdict arrives here).
  useEffect(() => {
    if (!uid || !debateId) return;
    const unsubscribe = onSnapshot(
      doc(db, 'debates', debateId),
      (snap) => {
        if (!snap.exists()) {
          setDeleted(true);
          return;
        }
        setDebate({ id: snap.id, ...(snap.data({ serverTimestamps: 'estimate' }) as Omit<Debate, 'id'>) });
      },
      (err) => console.error('[ArenaChat] debate listener:', err),
    );
    return () => unsubscribe();
  }, [debateId, uid]);

  // Live discussion messages.
  useEffect(() => {
    if (!uid || !debateId) return;
    setLoading(true);
    const q = query(collection(db, 'debates', debateId, 'chat'), orderBy('createdAt', 'asc'), limitToLast(200));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setMessages(
          snapshot.docs.map((d) => {
            const data = d.data({ serverTimestamps: 'estimate' });
            return {
              id: d.id,
              userId: String(data.userId || ''),
              userName: typeof data.userName === 'string' ? data.userName : undefined,
              role: data.role === 'model' ? 'model' : 'user',
              text: typeof data.text === 'string' ? data.text : '',
              createdAt: data.createdAt,
            };
          }),
        );
        setLoading(false);
      },
      (err) => {
        console.error('[ArenaChat] chat listener:', err);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [debateId, uid]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, debate.aiResponse, isSending]);

  // Tick while waiting for a verdict, so the retry button can appear.
  useEffect(() => {
    if (debate.aiResponse) return;
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, [debate.aiResponse]);

  const requestVerdict = async () => {
    if (!isAuthor || debate.aiResponse || requestingVerdict) return;
    requestedVerdicts.add(debateId);
    setRequestingVerdict(true);
    setVerdictError(null);
    try {
      await arenaReply(debateId, language);
    } catch (e) {
      setVerdictError(arenaErrorMessage(e, 'The AI could not give a verdict right now. Please try again.'));
    } finally {
      setRequestingVerdict(false);
    }
  };

  useEffect(() => {
    if (requestVerdictOnOpen && isAuthor && !initialDebate.aiResponse && !requestedVerdicts.has(debateId)) {
      requestVerdict();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debateId, requestVerdictOnOpen, isAuthor]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const userText = inputMsg.trim();
    if (!userText || isSending || !user || !debate.aiResponse) return;
    if (isGuest) {
      setChatError('Sign in with Google to reply in the Arena. Guests can read but not post.');
      return;
    }
    if (userText.length > MAX_CHAT_CHARS) {
      setChatError(`Messages can be at most ${MAX_CHAT_CHARS.toLocaleString()} characters.`);
      return;
    }

    setIsSending(true);
    setChatError(null);
    try {
      const ref = doc(collection(db, 'debates', debateId, 'chat'));
      await setDoc(ref, {
        id: ref.id,
        userId: user.uid,
        userName: publicName(user),
        role: 'user',
        text: userText,
        createdAt: serverTimestamp(),
      });
      setInputMsg('');
      // The server reads the debate itself and writes the AI reply; the listener shows it.
      await arenaReply(debateId, language);
    } catch (err) {
      setChatError(arenaErrorMessage(err, 'Your message could not be sent. Please try again.'));
    } finally {
      setIsSending(false);
    }
  };

  const createdMs = toDate(debate.createdAt)?.getTime() ?? now;
  const canRetryVerdict =
    isAuthor && !debate.aiResponse && !requestingVerdict && (!!verdictError || !requestedVerdicts.has(debateId) || now - createdMs > VERDICT_RETRY_AFTER_MS);

  const labelFor = (msg: ArenaChatMessage) => {
    if (msg.role === 'model') return AI_LABEL;
    if (uid && msg.userId === uid) return 'You';
    return msg.userName || 'Citizen';
  };

  if (deleted) {
    return (
      <div className="glass-panel border-cyan-900/34 bg-void/89 p-21 max-w-4xl mx-auto text-center space-y-13">
        <p className="text-13 text-parchment/89">This debate was deleted.</p>
        <button onClick={onBack} className="px-13 py-8 rounded-[6px] bg-cyan-950/21 border border-cyan-900/55 text-[11px] text-cyan-400 font-bold uppercase">
          Back to the Arena
        </button>
      </div>
    );
  }

  return (
    <div className="glass-panel border-cyan-900/34 bg-void/89 p-13 md:p-21 max-w-4xl mx-auto space-y-21 shadow-[0_0_55px_rgba(34,211,238,0.08)] relative">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/55 to-transparent"></div>

      {/* Header Panel */}
      <div className="flex items-center justify-between border-b border-cyan-900/34 pb-13 gap-8">
        <button
          onClick={onBack}
          className="flex items-center gap-8 px-13 py-8 rounded-[6px] bg-cyan-950/21 border border-cyan-900/55 text-[11px] text-cyan-400 font-bold tracking-wider hover:bg-cyan-900/34 transition-all uppercase"
        >
          <ArrowLeft className="w-13 h-13" />
          BACK
        </button>
        <div className="flex items-center gap-8 text-[11px] font-mono text-cyan-400/55">
          <MessageSquare className="w-13 h-13" />
          PUBLIC DISCUSSION
        </div>
      </div>

      {/* Opening argument */}
      <div className="p-13 bg-cyan-950/13 border border-cyan-950 rounded-8 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-8">
          <p className="text-[10px] caps-modern text-cyan-400/55 font-bold">OPENING ARGUMENT</p>
          <span className="text-[10px] text-cyan-500 font-mono tracking-wider">
            BY {isAuthor ? 'YOU' : (debate.userName || 'Citizen').toUpperCase()}
            {toDate(debate.createdAt) ? ` · ${toDate(debate.createdAt)!.toLocaleString()}` : ''}
          </span>
        </div>
        <Markdown className="prose prose-invert max-w-none text-13 text-parchment font-sans max-h-[240px] overflow-y-auto custom-scrollbar pr-8">
          {debate.userArgument}
        </Markdown>
      </div>

      {/* Discussion */}
      <div className="space-y-13 min-h-[300px] max-h-[500px] overflow-y-auto pr-8 custom-scrollbar pt-8">
        <div className="p-21 bg-cyan-900/5 border border-cyan-900/21 rounded-8 space-y-13 relative">
          <div className="flex items-center gap-8 border-b border-cyan-900/21 pb-8">
            <Landmark className="w-[15px] h-[15px] text-cyan-400" />
            <h5 className="text-[12px] caps-modern font-bold text-cyan-400 tracking-widest uppercase">VERDICT · {AI_LABEL}</h5>
          </div>
          {debate.aiResponse ? (
            <Markdown className="prose prose-invert max-w-none text-13 text-parchment/89 font-sans leading-relaxed">{debate.aiResponse}</Markdown>
          ) : (
            <div className="space-y-8">
              {(requestingVerdict || (isAuthor && !canRetryVerdict)) && (
                <div className="flex items-center gap-8 text-[11px] caps-modern text-cyan-400/55 italic animate-pulse py-8">
                  <Loader2 className="w-13 h-13 animate-spin text-cyan-500" />
                  Arthashastra AI is checking sources and writing its verdict. This can take up to a minute.
                </div>
              )}
              {verdictError && (
                <div className="p-13 bg-rose-950/21 border border-rose-950/55 rounded-8 flex items-center gap-8 text-rose-400 text-[11px]">
                  <AlertCircle className="w-[15px] h-[15px] shrink-0" />
                  <span>{verdictError}</span>
                </div>
              )}
              {canRetryVerdict && (
                <button
                  type="button"
                  onClick={requestVerdict}
                  className="flex items-center gap-8 px-13 py-8 bg-cyan-950/34 hover:bg-cyan-900/34 border border-cyan-800/55 rounded-[6px] text-[11px] text-cyan-400 font-bold uppercase"
                >
                  <RefreshCw className="w-[11px] h-[11px]" /> Request the AI verdict
                </button>
              )}
              {!isAuthor && !debate.aiResponse && (
                <p className="text-[11px] text-parchment/55">The verdict has not been written yet.</p>
              )}
            </div>
          )}
        </div>

        {messages.map((msg) => {
          const mine = msg.role === 'user' && !!uid && msg.userId === uid;
          return (
            <div key={msg.id} className={`flex flex-col gap-[4px] max-w-[85%] ${mine ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
              <div className="flex items-center gap-[4px] text-[10px] text-parchment/34 font-mono">
                {msg.role === 'model' ? <Landmark className="w-[10px] h-[10px] text-cyan-400" /> : <UserIcon className="w-[10px] h-[10px]" />}
                <span className={msg.role === 'model' ? 'text-cyan-400' : 'text-cyan-400/55'}>{labelFor(msg)}</span>
                {toDate(msg.createdAt) && <span>· {toDate(msg.createdAt)!.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>}
              </div>
              <div
                className={`p-13 rounded-8 text-13 font-sans leading-relaxed ${
                  msg.role === 'model'
                    ? 'bg-void border border-cyan-950 text-parchment border-l-2 border-l-cyan-500/55'
                    : mine
                      ? 'bg-cyan-950/34 border border-cyan-900 text-parchment'
                      : 'bg-white/[0.03] border border-white/10 text-parchment'
                }`}
              >
                <Markdown className="prose prose-invert max-w-none text-13">{msg.text}</Markdown>
              </div>
            </div>
          );
        })}

        {isSending && (
          <div className="flex items-center gap-8 text-[11px] caps-modern text-cyan-400/55 italic animate-pulse py-8 pl-13">
            <Loader2 className="w-13 h-13 animate-spin text-cyan-500" />
            Arthashastra AI is writing a reply...
          </div>
        )}

        {loading && <div className="text-center py-21 font-mono text-[11px] text-cyan-400/34">Loading discussion...</div>}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-cyan-900/34 pt-13">
        {chatError && (
          <div className="mb-8 p-13 bg-rose-950/21 border border-rose-950/55 rounded-8 flex items-center gap-8 text-rose-400 text-[11px]">
            <AlertCircle className="w-[15px] h-[15px] shrink-0" />
            <span>{chatError}</span>
          </div>
        )}
        {isGuest ? (
          <p className="text-[11px] text-cyan-400/89 caps-modern text-center py-8">Sign in with Google to reply. Guests can read the Arena.</p>
        ) : !debate.aiResponse ? (
          <p className="text-[11px] text-parchment/55 text-center py-8">Replies open once the AI verdict is posted.</p>
        ) : (
          <form onSubmit={handleSend} className="flex flex-col gap-[4px]">
            <div className="flex gap-8 items-center bg-void border border-cyan-900/34 rounded-8 p-[4px] focus-within:border-cyan-500 focus-within:ring-1 focus-within:ring-cyan-500/55 transition-all">
              <input
                type="text"
                value={inputMsg}
                maxLength={MAX_CHAT_CHARS}
                onChange={(e) => setInputMsg(e.target.value.slice(0, MAX_CHAT_CHARS))}
                placeholder="Ask a follow-up or challenge this verdict..."
                className="flex-1 bg-transparent border-0 p-8 text-13 text-parchment font-sans focus:outline-none placeholder:text-parchment/34"
                disabled={isSending}
              />
              <button
                type="submit"
                disabled={isSending || !inputMsg.trim()}
                className="px-[18px] py-8 bg-cyan-900 text-cyan-100 hover:bg-cyan-800 rounded-[6px] font-bold caps-modern text-[11px] flex items-center gap-[6px] transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-cyan-700 uppercase"
              >
                <Send className="w-[11px] h-[11px]" />
                SEND
              </button>
            </div>
            <div className={`text-right text-[10px] font-mono ${inputMsg.length >= MAX_CHAT_CHARS ? 'text-rose-400' : 'text-parchment/34'}`}>
              {inputMsg.length.toLocaleString()} / {MAX_CHAT_CHARS.toLocaleString()}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
