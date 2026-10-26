import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import {
  Activity, Archive, Clock, Coins, CreditCard, Download, Ghost, Landmark, LayoutDashboard, Loader2, LogIn, LogOut,
  MessageSquare, Newspaper, Plus, Radio, Send, Shield, ShieldAlert, X, Zap,
} from 'lucide-react';

import { auth, db, handleFirestoreError, OperationType, signInAnonymous, signInWithGoogle, signOut, type AgentLog } from '../lib/firebase';
import { ApiError, getHealth, getMe, runAgentCycle, streamChat, type ChatTurn, type Health, type Me } from '../lib/api';
import { saveMessage, getMessages, getConversations, createSharedTranscript } from '../lib/chatStore';
import { witnessBlock } from '../lib/aitihya';
import { SUPPORTED_LANGUAGES, getTranslation } from '../translations';
import { useLanguage, languageName } from '../hooks/useLanguage';
import { navigate } from '../hooks/useRoute';
import { usePayment } from '../hooks/usePayment';

import { AlertModal, type ModalContext } from './AlertModal';
import { ArthashastraSymbol } from './ArthashastraSymbol';
import { ErrorBoundary } from './ErrorBoundary';
import { AitihyaHistory } from './AitihyaHistory';
import { ArthashastraGazette } from './ArthashastraGazette';
import { TheArena } from './TheArena';
import { TheWarChest } from './TheWarChest';
import { DataSovereignty } from './DataSovereignty';
import { ArchiveOS } from './ArchiveOS';
import { EconomicDisasterPredictor } from './EconomicDisasterPredictor';
import { ChatPanel, type ChatMessage } from './ChatPanel';
import { IntelFeedView, type IntelItem } from './IntelFeed';
import { PlanView } from './PlanView';
import { ExplanationView } from './ExplanationView';
import { BrainView, DashboardView, HealthBanner, LedgerEntries, RoutineView, runAgentsMessage, type LedgerEntry } from './AdminViews';

type View =
  | 'chat' | 'gazette' | 'feed' | 'archive' | 'ledger' | 'arena' | 'warchest' | 'sovereignty' | 'threat'
  | 'plan' | 'explanation' | 'dashboard' | 'brain' | 'routine';

const ADMIN_VIEWS: View[] = ['dashboard', 'brain', 'routine'];
const CHAT_KEY = 'arthashastra_active_chat';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function newChatId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 20);
}
const session = {
  get(key: string): string | null {
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      /* storage blocked */
    }
  },
};

function initialsOf(user: FirebaseUser): string {
  const name = user.displayName?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || 'C';
  }
  return user.isAnonymous ? '?' : 'C';
}

interface MainAppProps {
  /** Set when the page was opened at /explanation/:id. */
  explanationId?: string;
  /** Called after the explanation route was taken over, so the URL can be cleaned. */
  onExplanationRouteHandled?: () => void;
}

export function MainApp({ explanationId, onExplanationRouteHandled }: MainAppProps) {
  const [language, setLanguage] = useLanguage();
  const t = useMemo(() => getTranslation(language), [language]);
  const langName = languageName(language);

  // ---------- auth & account ----------
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showFailsafe, setShowFailsafe] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const isAdmin = !!me?.isAdmin;
  const isSubscribed = !!me?.isSubscribed;

  const [modal, setModal] = useState<ModalContext | null>(null);
  const closeModal = useCallback(() => setModal(null), []);

  const [view, setViewState] = useState<View>('chat');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [planNotice, setPlanNotice] = useState<string | null>(null);
  const [activeExplanationId, setActiveExplanationId] = useState<string | null>(null);

  const setView = useCallback((v: View) => {
    setViewState(v);
    setIsHistoryOpen(false);
    if (v !== 'plan') setPlanNotice(null);
  }, []);

  useEffect(() => {
    const failsafe = window.setTimeout(() => setShowFailsafe(true), 3000);
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
      window.clearTimeout(failsafe);
    });
    return () => {
      unsub();
      window.clearTimeout(failsafe);
    };
  }, []);

  const refreshMe = useCallback(async () => {
    if (!auth.currentUser) {
      setMe(null);
      return null;
    }
    try {
      const m = await getMe();
      setMe(m);
      return m;
    } catch (e) {
      console.warn('[account] getMe failed:', e);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setMe(null);
      return;
    }
    refreshMe();
  }, [user, refreshMe]);

  // Admin-only pages are not reachable for others.
  useEffect(() => {
    if (!isAdmin && ADMIN_VIEWS.includes(view)) setViewState('chat');
  }, [isAdmin, view]);

  // ---------- explanation route (/explanation/:id) ----------
  useEffect(() => {
    if (!explanationId) return;
    setActiveExplanationId(explanationId);
    setViewState('explanation');
    onExplanationRouteHandled?.();
  }, [explanationId, onExplanationRouteHandled]);

  const openExplanation = useCallback(
    (id: string) => {
      setActiveExplanationId(id);
      setView('explanation');
    },
    [setView],
  );
  const openPlans = useCallback(
    (notice?: string) => {
      setView('plan');
      setPlanNotice(notice || null);
    },
    [setView],
  );

  // ---------- PWA install ----------
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstallEvent(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  const handleInstall = async () => {
    if (!installEvent) return;
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
    } catch (e) {
      console.warn('[pwa] install prompt failed', e);
    }
    setInstallEvent(null);
  };

  // ---------- data streams ----------
  const [intelligence, setIntelligence] = useState<IntelItem[]>([]);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const uid = user?.uid;

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'intelligence'), orderBy('timestamp', 'desc'), limit(30));
    return onSnapshot(
      q,
      (snap) => setIntelligence(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as IntelItem)),
      (error) => handleFirestoreError(error, OperationType.LIST, 'intelligence'),
    );
  }, [uid]);

  useEffect(() => {
    if (!uid || !isAdmin) {
      setLogs([]);
      setLedger([]);
      return;
    }
    const unsubLogs = onSnapshot(
      query(collection(db, 'agent_logs'), orderBy('timestamp', 'desc'), limit(100)),
      (snap) => setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AgentLog)),
      (error) => handleFirestoreError(error, OperationType.LIST, 'agent_logs'),
    );
    const unsubLedger = onSnapshot(
      query(collection(db, 'ledger'), orderBy('timestamp', 'desc'), limit(50)),
      (snap) => setLedger(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LedgerEntry)),
      (error) => handleFirestoreError(error, OperationType.LIST, 'ledger'),
    );
    return () => {
      unsubLogs();
      unsubLedger();
    };
  }, [uid, isAdmin]);

  // Server health is only shown to admins.
  const [health, setHealth] = useState<Health | null>(null);
  useEffect(() => {
    if (!isAdmin) {
      setHealth(null);
      return;
    }
    let alive = true;
    const check = () =>
      getHealth()
        .then((h) => alive && setHealth(h))
        .catch(() => undefined);
    check();
    const id = window.setInterval(check, 60_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [isAdmin]);

  const [isRunningAgents, setIsRunningAgents] = useState(false);
  const handleRunAgents = useCallback(async () => {
    if (isRunningAgents) return;
    setIsRunningAgents(true);
    try {
      const r = await runAgentCycle();
      setModal({ title: t.runAgentsDone, message: runAgentsMessage(t, r) });
    } catch (e) {
      setModal({ title: t.errorTitle, message: e instanceof Error ? e.message : t.errorTitle, isError: true });
    } finally {
      setIsRunningAgents(false);
    }
  }, [isRunningAgents, t]);

  // ---------- payments ----------
  const { startCheckout, isPaying } = usePayment({ user, t, showModal: setModal, onPaid: refreshMe });

  // ---------- chat ----------
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [selectedDateFilter, setSelectedDateFilter] = useState('all');
  const [activeChatId, setActiveChatId] = useState<string>(() => {
    const saved = session.get(CHAT_KEY);
    if (saved && /^[A-Za-z0-9_-]{1,128}$/.test(saved)) return saved;
    const id = newChatId();
    session.set(CHAT_KEY, id);
    return id;
  });

  const sendLock = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;
  const pendingSaves = useRef<Promise<boolean>[]>([]);
  const loadSeq = useRef(0);
  const restoredFor = useRef<string | null>(null);
  const userActed = useRef(false);

  const selectChat = (id: string) => {
    setActiveChatId(id);
    session.set(CHAT_KEY, id);
  };

  const trackSave = (p: Promise<boolean>) => {
    pendingSaves.current.push(p);
    p.finally(() => {
      pendingSaves.current = pendingSaves.current.filter((x) => x !== p);
    });
  };

  const loadConversation = useCallback(
    async (id: string, opts: { switchView?: boolean; fromUser?: boolean } = {}) => {
      if (opts.fromUser) userActed.current = true;
      const seq = ++loadSeq.current;
      selectChat(id);
      setMessages([]);
      setSelectedDateFilter('all');
      if (opts.switchView !== false) setView('chat');
      setIsHistoryLoading(true);
      try {
        const msgs = await getMessages(id);
        if (seq === loadSeq.current) setMessages(msgs);
      } catch (e) {
        console.error('[chat] load failed', e);
        if (seq === loadSeq.current) setModal({ title: t.errorTitle, message: t.loadHistoryFailed, isError: true });
      } finally {
        if (seq === loadSeq.current) setIsHistoryLoading(false);
      }
    },
    [setView, t],
  );

  // Restore the last conversation ONCE per signed-in user (never overrides "New conversation").
  useEffect(() => {
    if (!uid || restoredFor.current === uid) return;
    restoredFor.current = uid;
    userActed.current = false;
    let alive = true;
    (async () => {
      try {
        const convs = await getConversations();
        if (!alive || userActed.current || messagesRef.current.length > 0) return;
        const saved = session.get(CHAT_KEY);
        const target = (saved && convs.find((c) => c.id === saved)?.id) || convs[0]?.id;
        if (target) loadConversation(target, { switchView: false });
      } catch (e) {
        console.warn('[chat] restore failed', e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [uid, loadConversation]);

  const startNewChat = () => {
    userActed.current = true;
    loadSeq.current++;
    selectChat(newChatId());
    setMessages([]);
    setIsHistoryLoading(false);
    setSelectedDateFilter('all');
    setView('chat');
  };

  const friendlyError = (e: unknown): { text: string; code?: string } => {
    if (e instanceof ApiError) {
      if (e.code === 'SIGN_IN_REQUIRED') return { text: e.message || t.errSignInRequired, code: e.code };
      return { text: e.message, code: e.code };
    }
    return { text: t.errorTitle };
  };

  const handleSend = async (raw: string = input) => {
    const text = raw.trim();
    if (!text || !user || sendLock.current) return;
    sendLock.current = true;
    userActed.current = true;
    setIsSending(true);
    setInput('');
    setSelectedDateFilter('all');

    const chatId = activeChatId;
    const prior = messagesRef.current.filter((m) => !m.error && m.text);
    const history: ChatTurn[] = prior.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
    const lastBlock = [...prior].reverse().find((m) => typeof m.index === 'number' && m.hash);

    // Optional tamper-evident chain for the user's own history (never sent to the AI).
    let userBlock: { index: number; hash: string; previousHash: string } | null = null;
    try {
      userBlock = await witnessBlock(text, user.uid, 'user', lastBlock ? { index: lastBlock.index!, hash: lastBlock.hash! } : undefined);
    } catch {
      userBlock = null;
    }

    const userMessage: ChatMessage = {
      id: newChatId(),
      role: 'user',
      text,
      timestamp: new Date(),
      ...(userBlock ? { index: userBlock.index, hash: userBlock.hash, previousHash: userBlock.previousHash } : {}),
    };
    const modelId = newChatId();
    setMessages((prev) => [...prev, userMessage, { id: modelId, role: 'model', text: '', timestamp: new Date() }]);
    trackSave(saveMessage(chatId, userMessage));

    let fullText = '';
    try {
      for await (const chunk of streamChat(history, text, langName)) {
        fullText += chunk;
        const snapshot = fullText;
        setMessages((prev) => prev.map((m) => (m.id === modelId ? { ...m, text: snapshot } : m)));
      }
      if (!fullText.trim()) throw new ApiError(0, 'AI_UNAVAILABLE', 'The AI could not answer right now. Please try again in a minute.');

      let modelBlock: { index: number; hash: string; previousHash: string } | null = null;
      if (userBlock) {
        try {
          modelBlock = await witnessBlock(fullText, 'arthashastra-ai', 'model', userBlock);
        } catch {
          modelBlock = null;
        }
      }
      const modelMessage: ChatMessage = {
        id: modelId,
        role: 'model',
        text: fullText,
        timestamp: new Date(),
        ...(modelBlock ? { index: modelBlock.index, hash: modelBlock.hash, previousHash: modelBlock.previousHash } : {}),
      };
      setMessages((prev) => prev.map((m) => (m.id === modelId ? modelMessage : m)));
      trackSave(saveMessage(chatId, modelMessage));
    } catch (e) {
      console.error('[chat] send failed', e);
      const { text: errText, code } = friendlyError(e);
      setMessages((prev) => {
        const errorBubble: ChatMessage = { id: newChatId(), role: 'model', text: errText, error: true, errorCode: code };
        // No answer yet: the placeholder becomes the error. Partial answer: keep it and add the error below.
        if (!fullText) return prev.map((m) => (m.id === modelId ? { ...errorBubble, id: modelId } : m));
        return [...prev, errorBubble];
      });
      if (code === 'DAILY_LIMIT') refreshMe();
    } finally {
      sendLock.current = false;
      setIsSending(false);
    }
  };

  useEffect(() => {
    if (view === 'chat' && messages.length > 0) {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, view]);

  const copyText = async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      setModal({ title: t.errorTitle, message: t.copyFailed, isError: true });
      return false;
    }
  };

  const doShare = async () => {
    setModal(null);
    setIsSharing(true);
    try {
      await Promise.all(pendingSaves.current);
      const id = await createSharedTranscript(activeChatId);
      const url = `${window.location.origin}/share/${encodeURIComponent(id)}`;
      let copied = false;
      try {
        await navigator.clipboard.writeText(url);
        copied = true;
      } catch {
        copied = false;
      }
      setModal({
        title: t.shareDoneTitle,
        message: (
          <>
            <span className="block mb-8">{copied ? t.shareCopied : t.shareCopyManual}</span>
            <a href={url} target="_blank" rel="noopener noreferrer" className="block font-mono text-[11px] text-neon-cyan underline break-all">
              {url}
            </a>
          </>
        ),
      });
    } catch (e) {
      setModal({ title: t.shareFailed, message: friendlyError(e).text, isError: true });
    } finally {
      setIsSharing(false);
    }
  };

  const requestShare = () => {
    if (isSharing || isSending) return;
    setModal({ title: t.shareConfirmTitle, message: t.shareConfirmBody, onConfirm: doShare, confirmLabel: t.share });
  };

  // ---------- sign-in ----------
  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if ((e as { code?: string })?.code === 'auth/popup-closed-by-user') return;
      if (window !== window.parent) {
        setModal({
          title: t.signInBlockedTitle,
          message: t.signInBlockedBody,
          onConfirm: () => {
            window.open(window.location.href, '_blank', 'noopener');
            setModal(null);
          },
        });
      } else {
        setModal({ title: t.signInFailed, message, isError: true });
      }
    }
  };
  const handleAnonymous = async () => {
    try {
      await signInAnonymous();
    } catch (e) {
      setModal({ title: t.signInFailed, message: e instanceof Error ? e.message : String(e), isError: true });
    }
  };
  const handleSignOut = async () => {
    try {
      await signOut();
      loadSeq.current++;
      setMessages([]);
      selectChat(newChatId());
      setView('chat');
    } catch (e) {
      console.error('[auth] sign-out failed', e);
    }
  };

  const goLegal = (path: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(path);
  };

  const modalLabels = { cancel: t.cancel, close: t.close, continue: t.continue };

  const languageSelect = (
    <select
      value={language}
      onChange={(e) => setLanguage(e.target.value)}
      aria-label={t.language}
      className="bg-void border border-neon-cyan/34 text-neon-cyan px-3 py-3 rounded text-[11px] max-w-[96px] sm:max-w-none focus:outline-none focus:border-neon-cyan transition-all"
    >
      {SUPPORTED_LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.native}
        </option>
      ))}
    </select>
  );

  const footer = (
    <footer className="mt-55 pt-21 border-t border-neon-cyan/13 text-center space-y-8 px-13">
      <p className="text-[11px] text-parchment/80 leading-relaxed">{t.disclaimer}</p>
      <p className="text-[10px] text-parchment/55">{t.footer}</p>
      <nav className="flex justify-center gap-13 text-[10px] uppercase tracking-widest text-parchment/55">
        <a href="/terms" onClick={goLegal('/terms')} className="hover:text-neon-cyan">{t.terms}</a>
        <a href="/privacy" onClick={goLegal('/privacy')} className="hover:text-neon-cyan">{t.privacy}</a>
        <a href="/refunds" onClick={goLegal('/refunds')} className="hover:text-neon-cyan">{t.refunds}</a>
      </nav>
    </footer>
  );

  // ---------- loading ----------
  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center p-34 font-sans">
        <div className="text-center relative z-10" role="status" aria-live="polite">
          <ArthashastraSymbol size={144} className="mx-auto mb-34" />
          <h1 className="text-13 uppercase text-neon-cyan tracking-[0.34em] mb-13">{t.loadingApp}</h1>
          <div className="flex items-center justify-center gap-5 text-[11px] text-neon-cyan/55">
            <Loader2 className="w-13 h-13 animate-spin" aria-hidden />
            <span>{t.loadingSub}</span>
          </div>
          {showFailsafe && (
            <button
              onClick={() => setIsAuthReady(true)}
              className="mt-34 px-13 py-8 border border-neon-cyan/34 hover:border-neon-cyan text-[11px] text-neon-cyan/80 hover:text-neon-cyan uppercase tracking-widest transition-all"
            >
              {t.continueAnyway}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ---------- login ----------
  if (!user) {
    return (
      <>
        <AlertModal context={modal} onClose={closeModal} labels={modalLabels} />
        <div className="min-h-screen bg-void flex flex-col items-center justify-center p-13 sm:p-34 relative font-sans">
          <div className="absolute top-13 right-13">{languageSelect}</div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-panel p-34 sm:p-55 border border-neon-cyan/21 rounded-21 max-w-md w-full text-center relative z-10"
          >
            <div className="mb-34 flex justify-center">
              <ArthashastraSymbol size={89} />
            </div>
            <h1 className="text-34 font-bold text-neon-cyan mb-13 tracking-widest leading-none">ARTHASHASTRA AI</h1>
            <p className="text-13 text-parchment/89 mb-34 leading-relaxed">{t.loginTagline}</p>
            <div className="space-y-13">
              <button
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-13 bg-neon-cyan text-void py-13 px-21 rounded-13 font-bold uppercase tracking-widest text-13 hover:bg-neon-cyan/89 transition-all"
              >
                <LogIn className="w-13 h-13" aria-hidden />
                {t.signInGoogle}
              </button>
              <button
                onClick={handleAnonymous}
                className="w-full flex items-center justify-center gap-8 bg-void border border-parchment/21 text-parchment/80 py-13 px-13 rounded-13 font-bold uppercase tracking-widest hover:bg-parchment/5 transition-all text-[11px]"
              >
                <Ghost className="w-13 h-13" aria-hidden />
                {t.useAnonymously}
              </button>
              <p className="text-[11px] text-parchment/55 leading-relaxed">{t.anonNote}</p>
            </div>
            <p className="mt-34 text-[11px] text-parchment/55 leading-relaxed">{t.disclaimer}</p>
            <div className="mt-13 pt-13 border-t border-neon-cyan/8 flex flex-wrap justify-center gap-21 text-[10px] uppercase tracking-widest text-parchment/55">
              <a href="/terms" onClick={goLegal('/terms')} className="hover:text-neon-cyan">{t.terms}</a>
              <a href="/privacy" onClick={goLegal('/privacy')} className="hover:text-neon-cyan">{t.privacy}</a>
            </div>
          </motion.div>
        </div>
      </>
    );
  }

  // ---------- main ----------
  const navItems: { id: View; icon: typeof MessageSquare; label: string; admin?: boolean }[] = [
    { id: 'chat', icon: MessageSquare, label: t.navTerminal },
    { id: 'feed', icon: Radio, label: t.navFeed },
    { id: 'gazette', icon: Newspaper, label: t.navGazette },
    { id: 'archive', icon: Archive, label: t.navDossier },
    { id: 'ledger', icon: Clock, label: t.navArchive },
    { id: 'arena', icon: Landmark, label: t.navArena },
    { id: 'threat', icon: ShieldAlert, label: t.navThreat },
    { id: 'warchest', icon: Coins, label: t.navWarchest },
    { id: 'sovereignty', icon: Shield, label: t.navSovereignty },
    { id: 'plan', icon: CreditCard, label: t.navPlan },
    ...(isAdmin
      ? ([
          { id: 'dashboard', icon: LayoutDashboard, label: t.navDashboard, admin: true },
          { id: 'brain', icon: Zap, label: t.navBrain, admin: true },
          { id: 'routine', icon: Activity, label: t.navHealth, admin: true },
        ] as const)
      : []),
  ];

  const adminProps = {
    t, user, language: langName, intelligence, logs, health,
    onRunAgents: handleRunAgents, isRunningAgents, onOpenExplanation: openExplanation,
  };
  const childProps = { user, language: langName, isAdmin, isSubscribed, onSubscribe: startCheckout };

  const historySidebar = (
    <aside
      className={`lg:col-span-1 flex-col gap-13 ${
        isHistoryOpen ? 'flex fixed inset-0 z-[70] bg-void/95 p-21 pt-89 overflow-y-auto' : 'hidden'
      } lg:flex lg:relative lg:inset-auto lg:z-auto lg:bg-transparent lg:p-0 lg:pt-21 lg:border-r lg:border-neon-cyan/13 lg:pr-21 min-h-[500px]`}
      aria-label={t.history}
    >
      {isHistoryOpen && (
        <button
          onClick={() => setIsHistoryOpen(false)}
          aria-label={t.close}
          className="lg:hidden absolute top-21 right-21 p-8 text-neon-cyan hover:text-[#00ffff] transition-colors"
        >
          <X className="w-34 h-34" aria-hidden />
        </button>
      )}
      <button
        onClick={startNewChat}
        className="w-full flex items-center justify-center gap-13 p-13 glass-panel border border-neon-cyan/34 text-neon-cyan hover:bg-neon-cyan/8 transition-all rounded-8 uppercase tracking-widest text-[11px] font-bold"
      >
        <Plus className="w-13 h-13" aria-hidden />
        {t.newThread}
      </button>
      <div className="flex-1 overflow-hidden flex flex-col min-h-[300px]">
        <ErrorBoundary>
          <AitihyaHistory
            user={user}
            language={langName}
            isAdmin={isAdmin}
            onSelectConversation={(id) => loadConversation(id, { fromUser: true })}
            activeChatId={activeChatId}
            selectedDate={selectedDateFilter}
            setSelectedDate={setSelectedDateFilter}
          />
        </ErrorBoundary>
      </div>
    </aside>
  );

  let content: React.ReactNode;
  if (ADMIN_VIEWS.includes(view) && !isAdmin) {
    content = (
      <div className="flex flex-col items-center justify-center py-144 text-center">
        <ShieldAlert className="w-55 h-55 text-cyber-red mb-21" aria-hidden />
        <p className="text-13 text-parchment/80">{t.adminOnly}</p>
        <button onClick={() => setView('chat')} className="mt-21 px-21 py-8 border border-neon-cyan/34 text-neon-cyan hover:bg-neon-cyan/13 rounded-8 text-13">
          {t.backToChat}
        </button>
      </div>
    );
  } else if (view === 'brain') content = <BrainView {...adminProps} />;
  else if (view === 'routine') content = <RoutineView {...adminProps} />;
  else if (view === 'dashboard') content = <DashboardView {...adminProps} />;
  else if (view === 'feed') content = <IntelFeedView items={intelligence} t={t} onOpenExplanation={openExplanation} />;
  else if (view === 'explanation' && activeExplanationId)
    content = (
      <ExplanationView
        key={activeExplanationId}
        id={activeExplanationId}
        t={t}
        language={language}
        onPaywall={() => openPlans(t.paywallNotice)}
        onLoaded={refreshMe}
        onBack={() => setView('feed')}
      />
    );
  else if (view === 'plan')
    content = <PlanView t={t} me={me} isAnonymous={user.isAnonymous} notice={planNotice} onSubscribe={startCheckout} isPaying={isPaying} />;
  else if (view === 'arena')
    content = (
      <ErrorBoundary>
        <TheArena {...childProps} />
      </ErrorBoundary>
    );
  else if (view === 'warchest')
    content = (
      <ErrorBoundary>
        <TheWarChest {...childProps} isLoading={isPaying} subscriptionExpiresAt={me?.subscriptionExpiresAt || undefined} />
      </ErrorBoundary>
    );
  else if (view === 'sovereignty')
    content = (
      <ErrorBoundary>
        <DataSovereignty user={user} language={langName} isAdmin={isAdmin} />
      </ErrorBoundary>
    );
  else if (view === 'threat')
    content = (
      <ErrorBoundary>
        <EconomicDisasterPredictor {...childProps} />
      </ErrorBoundary>
    );
  else if (view === 'archive')
    content = (
      <ErrorBoundary>
        <ArchiveOS user={user} language={langName} isAdmin={isAdmin} onNavigateToChat={(id) => loadConversation(id, { fromUser: true })} />
      </ErrorBoundary>
    );
  else if (view === 'gazette')
    content = (
      <div className="relative overflow-hidden glass-panel border border-neon-cyan/21 rounded-13 min-h-[80vh] mt-21">
        <ErrorBoundary>
          <ArthashastraGazette user={user} language={langName} isAdmin={isAdmin} />
        </ErrorBoundary>
      </div>
    );
  else if (view === 'ledger')
    content = (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-34 py-34">
        <div className="lg:col-span-1 flex flex-col gap-21 min-h-[500px]">
          <ErrorBoundary>
            <AitihyaHistory
              user={user}
              language={langName}
              isAdmin={isAdmin}
              onSelectConversation={(id) => loadConversation(id, { fromUser: true })}
              activeChatId={activeChatId}
              selectedDate={selectedDateFilter}
              setSelectedDate={setSelectedDateFilter}
            />
          </ErrorBoundary>
          <button
            onClick={startNewChat}
            className="w-full flex items-center justify-center gap-13 p-13 glass-panel border border-neon-cyan/34 text-neon-cyan hover:bg-neon-cyan/8 transition-all rounded-8 uppercase tracking-widest text-[11px] font-bold"
          >
            <Plus className="w-13 h-13" aria-hidden />
            {t.newThread}
          </button>
        </div>
        <div className="lg:col-span-3 space-y-21 pb-55 min-w-0">
          <div className="border-b border-neon-cyan/13 pb-13">
            <h2 className="text-13 uppercase tracking-widest text-neon-cyan font-bold">{isAdmin ? t.ledgerAdminTitle : t.ledgerTitle}</h2>
            <p className="text-[11px] text-parchment/55">{isAdmin ? t.ledgerAdminSubtitle : t.ledgerSubtitle}</p>
          </div>
          {isAdmin ? (
            <LedgerEntries ledger={ledger} t={t} />
          ) : (
            <div className="glass-panel p-34 border border-neon-cyan/13 rounded-13 text-center space-y-13">
              <MessageSquare className="w-34 h-34 text-neon-cyan mx-auto" aria-hidden />
              <h3 className="text-21 font-bold text-neon-cyan">{t.privateArchive}</h3>
              <p className="text-13 text-parchment/80 max-w-md mx-auto leading-relaxed">{t.privateArchiveBody}</p>
            </div>
          )}
        </div>
      </div>
    );
  else
    content = (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-21 lg:gap-34 min-h-[70vh]">
        {historySidebar}
        <div className="lg:col-span-3 flex flex-col min-w-0 min-h-[500px]">
          <ChatPanel
            t={t}
            language={language}
            messages={messages}
            activeChatId={activeChatId}
            isSending={isSending}
            isHistoryLoading={isHistoryLoading}
            isSharing={isSharing}
            selectedDateFilter={selectedDateFilter}
            onClearDateFilter={() => setSelectedDateFilter('all')}
            onOpenHistory={() => setIsHistoryOpen(true)}
            onShare={requestShare}
            onCopy={copyText}
            onPrompt={(p) => handleSend(p)}
            onSeePlans={() => openPlans()}
          />
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-void text-parchment selection:bg-neon-cyan/34 selection:text-neon-cyan">
      <AlertModal context={modal} onClose={closeModal} labels={modalLabels} />
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden>
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-neon-cyan/5 blur-[144px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-neon-magenta/5 blur-[144px] rounded-full" />
        <div className="absolute inset-0 carbon-pattern opacity-[0.05]" />
      </div>

      <header className="fixed top-0 left-0 right-0 h-89 glass-panel border-b border-neon-cyan/13 z-50 flex items-center px-8 md:px-34">
        <div className="max-w-[1440px] mx-auto w-full flex items-center justify-between gap-8">
          <div className="flex items-center gap-8 md:gap-21 min-w-0 flex-1">
            <button className="flex items-center gap-8 shrink-0" onClick={() => setView('chat')} aria-label={t.navTerminal}>
              <ArthashastraSymbol size={42} />
              <span className="hidden sm:block text-left">
                <span className="block text-21 font-display font-bold text-neon-cyan uppercase tracking-tighter leading-none">
                  ARTHASHASTRA<span className="text-parchment/55 ml-2">AI</span>
                </span>
                <span className="flex items-center gap-5 mt-2">
                  <span className="text-[9px] uppercase tracking-[0.2em] text-neon-cyan/80">{t.tagline}</span>
                  {isAdmin && (
                    <span className="text-[8px] px-5 py-1 bg-neon-magenta/13 border border-neon-magenta/55 text-neon-magenta rounded-full font-bold">{t.admin}</span>
                  )}
                  {isSubscribed && (
                    <span className="text-[8px] px-5 py-1 border border-neon-magenta/55 text-neon-magenta rounded-full font-bold">{t.planPaid}</span>
                  )}
                </span>
              </span>
            </button>

            <nav className="flex items-center gap-5 lg:gap-8 overflow-x-auto silk-scroll flex-1 pb-3 min-w-0" aria-label="Main">
              {navItems.map((item) => {
                const active = view === item.id || (item.id === 'feed' && view === 'explanation');
                return (
                  <button
                    key={item.id}
                    onClick={() => setView(item.id)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-5 px-8 py-8 rounded-8 transition-all duration-377 relative shrink-0 ${
                      active
                        ? item.admin
                          ? 'text-neon-magenta bg-neon-magenta/13'
                          : 'text-neon-cyan bg-neon-cyan/13'
                        : item.admin
                          ? 'text-neon-magenta/55 hover:text-neon-magenta hover:bg-neon-magenta/5 border border-dashed border-neon-magenta/13'
                          : 'text-neon-cyan/55 hover:text-neon-cyan hover:bg-neon-cyan/5'
                    }`}
                  >
                    <item.icon className="w-13 h-13" aria-hidden />
                    <span className="text-[10px] uppercase font-bold tracking-widest whitespace-nowrap">{item.label}</span>
                    {active && <motion.span layoutId="nav-active" className={`absolute bottom-0 left-0 right-0 h-1 ${item.admin ? 'bg-neon-magenta' : 'bg-neon-cyan'}`} />}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-5 md:gap-8 shrink-0">
            {installEvent && (
              <button
                onClick={handleInstall}
                aria-label={t.install}
                className="flex items-center gap-5 p-8 sm:px-8 sm:py-5 border border-neon-cyan/34 text-neon-cyan rounded hover:bg-neon-cyan/13 transition-colors"
              >
                <Download className="w-13 h-13" aria-hidden />
                <span className="hidden md:inline text-[10px] uppercase tracking-widest font-bold">{t.install}</span>
              </button>
            )}
            {languageSelect}
            <span
              className="w-34 h-34 rounded-full border border-neon-cyan/34 bg-neon-cyan/13 flex items-center justify-center text-[11px] font-bold text-neon-cyan shrink-0"
              title={user.displayName || ''}
              aria-hidden
            >
              {initialsOf(user)}
            </span>
            <button onClick={handleSignOut} aria-label={t.signOut} title={t.signOut} className="p-8 text-neon-cyan/55 hover:text-cyber-red transition-colors">
              <LogOut className="w-13 h-13" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <main className={`relative z-10 pt-89 ${view === 'chat' ? 'pb-144' : 'pb-34'}`}>
        <div className="max-w-[1440px] mx-auto w-full px-13 md:px-21">
          {isAdmin && <div className="pt-21"><HealthBanner health={health} t={t} /></div>}
          {content}
          {footer}
        </div>
      </main>

      {view === 'chat' && (
        <div className="fixed bottom-13 md:bottom-21 left-13 right-13 md:left-auto md:right-34 z-[60] flex flex-col items-stretch md:items-end gap-5 md:w-[min(800px,calc(100vw-68px))]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="w-full glass-panel p-5 rounded-13 border-neon-cyan/34 flex items-end gap-0 relative min-h-[55px] shadow-[0_0_21px_rgba(0,230,118,0.3)] focus-within:border-neon-cyan"
          >
            <label htmlFor="chat-input" className="sr-only">
              {t.messageInput}
            </label>
            <textarea
              id="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={t.placeholder}
              rows={input.length > 50 || input.includes('\n') ? 3 : 1}
              maxLength={8000}
              className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-13 p-13 text-parchment placeholder:text-neon-cyan/34 font-medium min-w-0 resize-none silk-scroll w-full"
            />
            <button
              type="submit"
              disabled={isSending || !input.trim()}
              aria-label={t.send}
              className="w-34 h-34 self-end mb-5 mr-5 bg-neon-cyan text-void flex items-center justify-center rounded-8 hover:bg-[#00ffff] transition-all disabled:opacity-21 shrink-0"
            >
              {isSending ? <Loader2 className="w-21 h-21 animate-spin" aria-hidden /> : <Send className="w-21 h-21" aria-hidden />}
            </button>
          </form>
          <p className="text-right text-[9px] text-parchment/55 pr-8">{t.disclaimer}</p>
        </div>
      )}
    </div>
  );
}

