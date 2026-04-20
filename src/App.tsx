/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Landmark, Globe, Briefcase, ChevronRight, TrendingUp, ShieldAlert, AlertTriangle, Languages, Loader2, LayoutDashboard, MessageSquare, MessageCircle, Activity, Database, Twitter, LogOut, LogIn, ExternalLink, Clock, Blocks, Shield, Search, Calendar, Zap, CheckCircle2, Coins, X, Lock, Link, Ghost, Terminal } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { sendMessage } from './lib/gemini';
import { SUPPORTED_LANGUAGES, TRANSLATIONS } from './translations';
import { auth, db, signInWithGoogle, signInWithTwitter, signInAnonymous, signOut, IntelligenceItem, Tweet, AgentLog, AgentResponse, handleFirestoreError, OperationType } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, query, orderBy, limit, onSnapshot, addDoc, getDoc, doc } from 'firebase/firestore';
import { 
  macroTriad, corporateTriad, regionalIndiaTriad, healthTriad,
  bankingRetailTriad, bankingSystemicRiskTriad, marketsEquitiesTriad,
  marketsDerivativesTriad, regionalUSTriad, regionalChinaTriad, darkWebVettingTriad,
  runTriad, twitterMonitorAgent, twitterPosterAgent 
} from './lib/agents';
import { witnessBlock, AitihyaBlock } from './lib/aitihya';
import { Message } from './lib/firebase';
import { AitihyaHistory } from './components/AitihyaHistory';
import { saveMessage, getMessages } from './lib/chatStore';
import { TermsPage, PrivacyPage } from './components/LegalPages';

import { ArthashastraSymbol } from './components/ArthashastraSymbol';

const MOCK_INTELLIGENCE: IntelligenceItem[] = [];

const MOCK_TWEETS: Tweet[] = [];

export default function App() {
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (pathname === '/privacy') return <PrivacyPage />;
  if (pathname === '/terms') return <TermsPage />;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [language, setLanguage] = useState('en');
  const [view, setView] = useState<'chat' | 'dashboard' | 'ledger' | 'routine' | 'brain' | 'explanation' | 'subscription'>('chat');
  const [activeExplanation, setActiveExplanation] = useState<any>(null);
  const [paywallReached, setPaywallReached] = useState(false);
  const [remainingFree, setRemainingFree] = useState<number | null>(null);

  const handlePayment = async () => {
    try {
      if (!user) return;
      setIsLoading(true);

      const token = await user.getIdToken();
      // 1. Create Order on Server
      const orderResp = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ planId: 'absolute_witness' })
      });
      
      const order = await orderResp.json();

      if (!order.id) throw new Error("Order creation failed");

      // 2. Open Razorpay Checkout
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: "Arthashastra AI",
        description: "Absolute Witness Subscription",
        order_id: order.id,
        handler: function (response: any) {
          alert(`Payment Successful: ${response.razorpay_payment_id}. Your Witness status is being synchronized.`);
          setView('dashboard');
        },
        prefill: {
          email: user.email,
        },
        theme: {
          color: "#00E676"
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error("Payment error:", err);
      alert("Payment initiation failed. Ensure Razorpay Keys are configured in Secrets.");
    } finally {
      setIsLoading(false);
    }
  };
  const [isCooling, setIsCooling] = useState(false);
  const [coolingTime, setCoolingTime] = useState(0);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showFailsafe, setShowFailsafe] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeChatId, setActiveChatId] = useState<string>(Math.random().toString(36).substring(2, 15));
  const [isAccessDenied, setIsAccessDenied] = useState(false);
  const [systemStatus, setSystemStatus] = useState<'ok' | 'warn' | 'unconfigured'>('ok');
  const [systemError, setSystemError] = useState<string | null>(null);

  // Dashboard State
  const [intelligence, setIntelligence] = useState<IntelligenceItem[]>([]);
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [responses, setResponses] = useState<AgentResponse[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [twitterConnected, setTwitterConnected] = useState(false);

  // Agent Visualization State
  const AGENT_DOMAINS = [
    "MacroPolicy", "CorporateIntel", "RegionalIndia", "HealthPharma",
    "BankingRetail", "BankingSystemicRisk", "MarketsEquities", "MarketsDerivatives",
    "RegionalUS", "RegionalChina", "Cryptoeconomics", "DarkWebVetting"
  ];

  const agents = [
    ...AGENT_DOMAINS.flatMap(domain => [
      { id: `${domain}_Collector`, role: 'Collector', domain },
      { id: `${domain}_Validator`, role: 'Validator', domain },
      { id: `${domain}_Summarizer`, role: 'Summarizer', domain }
    ]),
    { id: 'Compliance', role: 'Compliance', domain: 'System' },
    { id: 'TwitterMonitor', role: 'Monitor', domain: 'Social' },
    { id: 'TwitterPoster', role: 'Poster', domain: 'Social' },
    { id: 'TwitterInteraction', role: 'Interaction', domain: 'Social' }
  ];

  // Simulation Effect - REMOVED to prevent token waste and confusion
  // The agents are now fully server-side and autonomous.
  useEffect(() => {
    // No-op
  }, [user]);

  // Autonomous Agents Orchestrator (Migrated to Server-Side for 24/7 Operation)
  useEffect(() => {
    if (!user || !isAuthReady) return;
    console.log("[System] Autonomous Fleet is active on the server (15m cycle, 24/7).");
  }, [user, isAuthReady]);

  // URL Routing for Explanations
  useEffect(() => {
    const handleUrlRoute = async () => {
      const path = window.location.pathname;
      const match = path.match(/\/explanation\/([a-zA-Z0-9]+)/);
      if (match) {
        const id = match[1];
        setIsLoading(true);
        setView('explanation');
        
        // Wait for user to be ready
        if (!isAuthReady) return;
        
        if (!user) {
          // Requires login to track credits
          setIsLoading(false);
          // We can stay on 'explanation' view but show a login prompt inside it
          return;
        }

        try {
          const token = await user.getIdToken();
          const resp = await fetch(`/api/gatekeeper/explanation/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await resp.json();
          
          if (resp.status === 403 && data.code === 'PAYWALL') {
            setPaywallReached(true);
            setRemainingFree(0);
          } else if (resp.ok) {
            setActiveExplanation(data.explanation);
            setRemainingFree(data.remainingFree);
            setPaywallReached(false);
          } else {
            console.error("Failed to load explanation:", data.error);
          }
        } catch (err) {
          console.error("Explanation route error:", err);
        } finally {
          setIsLoading(false);
        }
      }
    };
    handleUrlRoute();
  }, [isAuthReady, user]);

  // Cooldown Timer
  useEffect(() => {
    if (!isCooling) return;
    const interval = setInterval(() => {
      setCoolingTime(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isCooling]);

  const getAgentStatus = (agentId: string) => {
    if (isCooling) return 'idle';
    const lastLog = logs.find(l => l.agentName === agentId);
    if (!lastLog) return 'idle';
    const timeDiff = Date.now() - new Date(lastLog.timestamp).getTime();
    if (timeDiff < 30000) return 'processing'; // Active for 30s after log
    if (timeDiff < 120000) return 'committed'; // Committed for 2m after log
    return 'idle';
  };

  // Auth Listener
  useEffect(() => {
    // Safety timeout to prevent infinite loading if Firebase hangs
    const safetyTimeout = setTimeout(() => {
      console.warn("[Auth] Safety threshold reached. Forcing auth readiness.");
      setIsAuthReady(true);
      setShowFailsafe(true);
    }, 8000);

    // Show manual override after 4 seconds
    const failsafeTimer = setTimeout(() => {
      setShowFailsafe(true);
    }, 4000);

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      
      // If we don't have a user, we are "ready" to show the login screen
      if (!u) {
        setIsAuthReady(true);
        clearTimeout(safetyTimeout);
        setIsAdmin(false);
        setIsAccessDenied(false);
        return;
      }

      // If we have a user, we check permissions, but we don't block "readiness"
      // unless we specifically want to hide the UI until we know for sure.
      // Given the "stuck on loading" report, I will set readiness true immediately
      // and let the state update gracefully.
      setIsAuthReady(true);
      clearTimeout(safetyTimeout);

      const allowedEmails = ["jhansidharmana222@gmail.com", "chitti.bhargav3@gmail.com"];
      const isAllowed = allowedEmails.includes(u.email || "");
      
      try {
        const userSnap = await getDoc(doc(db, 'users', u.uid));
        const hasAdminRole = userSnap.exists() && userSnap.data().role === 'admin';
        setIsAdmin(isAllowed || hasAdminRole);
        
        // For public service, we don't deny access to logged-in users.
        // We only restrict ADMINT TOOLS.
        setIsAccessDenied(false); 
      } catch (e) {
        console.error("[Auth] Permission check failed:", e);
        setIsAdmin(isAllowed);
        setIsAccessDenied(false);
      }
    });

    return () => {
      unsubscribe();
      clearTimeout(safetyTimeout);
      clearTimeout(failsafeTimer);
    };
  }, []);

  // Real-time Dashboard Data
  useEffect(() => {
    // Public Data (Neural Brain & Archive) - No user check needed
    const qIntell = query(collection(db, 'intelligence'), orderBy('timestamp', 'desc'), limit(20));
    const unsubIntell = onSnapshot(qIntell, (snap) => {
      setIntelligence(snap.docs.map(d => ({ id: d.id, ...d.data() } as IntelligenceItem)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'intelligence'));

    let unsubTweets = () => {};
    let unsubLogs = () => {};
    let unsubResp = () => {};

    // Mission Operations (Twitter Handling & Logs) - ONLY for Admin
    if (isAdmin) {
      const qTweets = query(collection(db, 'tweets'), orderBy('timestamp', 'desc'), limit(20));
      unsubTweets = onSnapshot(qTweets, (snap) => {
        setTweets(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tweet)));
      }, (error) => handleFirestoreError(error, OperationType.GET, 'tweets'));

      const qLogs = query(collection(db, 'agent_logs'), orderBy('timestamp', 'desc'), limit(50));
      unsubLogs = onSnapshot(qLogs, (snap) => {
        setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AgentLog)));
      }, (error) => handleFirestoreError(error, OperationType.GET, 'agent_logs'));

      const qResp = query(collection(db, 'responses'), orderBy('timestamp', 'desc'), limit(20));
      unsubResp = onSnapshot(qResp, (snap) => {
        setResponses(snap.docs.map(d => ({ id: d.id, ...d.data() } as AgentResponse)));
      }, (error) => handleFirestoreError(error, OperationType.GET, 'responses'));

      const qLedgerGlobal = query(collection(db, 'ledger'), orderBy('timestamp', 'desc'), limit(20));
      const unsubLedgerGlobal = onSnapshot(qLedgerGlobal, (snap) => {
        setLedger(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (error) => handleFirestoreError(error, OperationType.GET, 'ledger'));

      const originalUnsubResp = unsubResp;
      unsubResp = () => {
        originalUnsubResp();
        unsubLedgerGlobal();
      };
    }

    return () => {
      unsubIntell();
      unsubTweets();
      unsubLogs();
      unsubResp();
    };
  }, [isAdmin]);

  // Twitter Connectivity Health
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/health');
        const data = await res.json();
        setTwitterConnected(data.twitterConnected);
        setSystemStatus(data.status);
        if (data.status === 'unconfigured') {
          setSystemError(data.error);
        } else {
          setSystemError(null);
        }
      } catch (e) {
        // Silent fail for health check
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  // Listen for OAuth Success
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'TWITTER_AUTH_SUCCESS') {
        setTwitterConnected(true);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleConnectTwitter = async () => {
    if (twitterConnected) return;
    try {
      const res = await fetch('/api/auth/twitter/url');
      const data = await res.json();
      if (data.error) {
        console.error(data.error);
        if (data.details) {
          alert(`Twitter Setup Required:\n\n${data.error}\n\nCallback URL: ${data.details.requiredCallbackUrl}\n\n${data.details.instructions}`);
        } else {
          alert(`Twitter Connection Failed: ${data.error}`);
        }
        return;
      }
      const width = 600, height = 700;
      const left = (window.innerWidth - width) / 2;
      const top = (window.innerHeight - height) / 2;
      window.open(data.url, 'Twitter Auth', `width=${width},height=${height},top=${top},left=${left}`);
    } catch (e) {
      console.error("Failed to initiate Twitter link:", e);
      alert("Failed to connect to backend for Twitter Auth.");
    }
  };

  const handleApproveTweet = async (tweetId: string) => {
    try {
      const { setDoc, doc } = await import('firebase/firestore');
      const tweetRef = doc(db, 'tweets', tweetId);
      await setDoc(tweetRef, { userApproved: true }, { merge: true });
      alert("Rebuttal Approved. Arthashastra will post it on the next cycle.");
    } catch (e) {
      console.error("Failed to approve tweet:", e);
      alert("Approval Failed: Authorization required.");
    }
  };

  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  // Anti-tampering / Shielding logic
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && e.key === 'U') ||
        e.key === 'F12'
      ) {
        e.preventDefault();
      }
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isLoading]);

  const handleSend = async (text: string = input) => {
    if (!text.trim() || isLoading) return;

    const trimmedText = text.trim();
    const lastMsg = messages[messages.length - 1];
    const userBlock = await witnessBlock(
      trimmedText, 
      user?.uid || "anonymous", 
      "Human Operator", 
      lastMsg ? { index: lastMsg.index || 0, hash: lastMsg.hash || "" } as any : undefined
    );

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: trimmedText,
      index: userBlock.index,
      hash: userBlock.hash,
      previousHash: userBlock.previousHash
    };

    if (user) {
      saveMessage(activeChatId, userMessage);
    }

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const history = messages.map(msg => ({
        role: msg.role,
        parts: [{ text: `[Block Index: ${msg.index}] [Hash: ${msg.hash?.substring(0, 8)}] ${msg.text}` }]
      }));

      const modelMessageId = (Date.now() + 1).toString();
      let fullText = '';

      setMessages((prev) => [...prev, { id: modelMessageId, role: 'model', text: '' }]);

      const stream = sendMessage(history, trimmedText, language, { intelligence });
      
      for await (const chunk of stream) {
        fullText += chunk.text;
        setMessages((prev) => prev.map(msg => 
          msg.id === modelMessageId ? { ...msg, text: fullText } : msg
        ));
      }

      // Witness the model's full response
      const modelBlock = await witnessBlock(
        fullText,
        "Arthashastra-AI",
        "Arthashastra Core",
        userBlock as any
      );

      setMessages((prev) => prev.map(msg => 
        msg.id === modelMessageId ? { 
          ...msg, 
          index: modelBlock.index, 
          hash: modelBlock.hash, 
          previousHash: modelBlock.previousHash 
        } : msg
      ));

      if (user) {
        saveMessage(activeChatId, {
          id: modelMessageId,
          role: 'model',
          text: fullText,
          index: modelBlock.index,
          hash: modelBlock.hash,
          previousHash: modelBlock.previousHash
        });
      }

    } catch (error: any) {
      console.error('Failed to send message:', error);
      
      let errorText = "The truth is being suppressed by technical barriers. Please try again.";
      
      if (error.message?.includes('CONFIGURATION_REQUIRED') || error.message?.includes('API_KEY')) {
        errorText = "ARTHASHASTRA ERROR: Configuration required. Please set GEMINI_API_KEY in the Secrets panel to enable neural link.";
      } else if (error.message === 'RESOURCE_EXHAUSTED' || error.message?.includes('429')) {
        errorText = "ARTHASHASTRA ERROR: Neural bandwidth exhausted (Quota Exceeded). The truth is costly; try again later.";
      }
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: errorText,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const startNewChat = () => {
    setActiveChatId(Math.random().toString(36).substring(2, 15));
    setMessages([]);
    setView('chat');
  };

  const loadConversation = async (id: string) => {
    setActiveChatId(id);
    setIsLoading(true);
    const msgs = await getMessages(id);
    setMessages(msgs);
    setView('chat');
    setIsLoading(false);
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center p-34 font-sans overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[610px] h-[610px] bg-neon-cyan/5 blur-[144px] rounded-full animate-pulse" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[377px] h-[377px] bg-neon-magenta/5 blur-[89px] rounded-full" />
        </div>
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center relative z-10"
        >
          <ArthashastraSymbol size={144} className="mx-auto mb-55" />
          <h1 className="text-13 caps-modern text-neon-cyan tracking-[0.55em] animate-pulse mb-13" style={{ textShadow: "0 0 10px rgba(0,230,118, 0.8)" }}>SYNCHRONIZING WITH AITIHYA CHAIN</h1>
          <div className="flex items-center justify-center gap-5 text-[10px] text-neon-cyan/55 caps-modern">
            <Loader2 className="w-8 h-8 animate-spin text-neon-cyan drop-shadow-[0_0_5px_rgba(0,230,118,0.8)]" />
            <span>Establishing Neural Link...</span>
          </div>

          {showFailsafe && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-34"
            >
              <button 
                onClick={() => setIsAuthReady(true)}
                className="px-13 py-8 border border-neon-cyan/13 hover:border-neon-cyan/55 text-[10px] text-neon-cyan/55 hover:text-neon-cyan caps-modern transition-all bg-neon-cyan/5 hover:shadow-[0_0_15px_rgba(0,230,118,0.3)]"
              >
                Force Synchronize
              </button>
            </motion.div>
          )}
        </motion.div>
      </div>
    );
  }

  // Mandatory Authentication and Identity Verification
  if (!user) {
    return (
      <div className="min-h-screen bg-void flex flex-col items-center justify-center p-34 relative overflow-hidden font-sans">
        {/* Neural Background Overlay */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-neon-cyan/5 blur-[144px] rounded-full animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-neon-magenta/5 blur-[144px] rounded-full animate-pulse" />
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel p-55 border border-neon-cyan/21 rounded-21 max-w-md w-full text-center relative z-10 shadow-[0_0_34px_rgba(0,230,118,0.1)]"
        >
          <div className="mb-34 flex justify-center drop-shadow-[0_0_10px_rgba(0,230,118,0.5)]">
            <ArthashastraSymbol size={89} />
          </div>
          <h1 className="text-34 caps-modern font-bold text-neon-cyan mb-21 tracking-widest leading-none drop-shadow-[0_0_5px_rgba(0,230,118,0.5)]">ARTHASHASTRA AI</h1>
          <p className="text-13 text-parchment/89 mb-34 font-sans leading-relaxed tracking-wide opacity-80 drop-shadow-[0_0_2px_rgba(230,241,255,0.3)]">
            Absolute truth is the most dangerous artifact in history. Access is restricted to designated Witnesses.
          </p>
          <div className="space-y-13">
            <button
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-13 bg-neon-cyan text-void py-13 px-34 rounded-13 font-bold caps-modern hover:bg-neon-cyan/89 transition-all shadow-[0_0_21px_rgba(0,230,118,0.3)] hover:shadow-[0_0_34px_rgba(0,230,118,0.5)] group"
            >
              <div className="p-5 bg-void/13 rounded-full group-hover:bg-void/21 transition-colors">
                <LogIn className="w-13 h-13" />
              </div>
              Identity with Google
            </button>

            <div className="grid grid-cols-2 gap-13">
              <button
                onClick={signInWithTwitter}
                className="flex items-center justify-center gap-8 bg-void border border-neon-cyan/34 text-neon-cyan py-13 px-13 rounded-13 font-bold caps-modern hover:bg-neon-cyan/5 transition-all text-xs group"
              >
                <Twitter className="w-13 h-13 group-hover:scale-110 transition-transform" />
                X Terminal
              </button>
              <button
                onClick={signInAnonymous}
                className="flex items-center justify-center gap-8 bg-void border border-parchment/13 text-parchment/55 py-13 px-13 rounded-13 font-bold caps-modern hover:bg-parchment/5 transition-all text-xs group"
              >
                <Ghost className="w-13 h-13 group-hover:text-neon-magenta transition-colors" />
                Anonymous
              </button>
            </div>
          </div>

          <div className="mt-55 pt-34 border-t border-neon-cyan/8 flex flex-wrap justify-center gap-21 text-[10px] caps-modern text-parchment/34">
            <a href="/terms" className="hover:text-neon-cyan transition-colors" onClick={(e) => { e.preventDefault(); setPathname('/terms'); window.history.pushState({}, '', '/terms'); }}>Terms & Protocols</a>
            <span className="opacity-21">|</span>
            <a href="/privacy" className="hover:text-neon-magenta transition-colors" onClick={(e) => { e.preventDefault(); setPathname('/privacy'); window.history.pushState({}, '', '/privacy'); }}>Privacy Isolation</a>
            <span className="opacity-21">|</span>
            <span className="text-void bg-neon-cyan/21 px-5 py-2">STRICT COMPLIANCE 2026</span>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-void text-parchment selection:bg-neon-cyan/34 selection:text-neon-cyan">
      {/* Neural Background Overlay */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-neon-cyan/5 blur-[144px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-neon-magenta/5 blur-[144px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] mix-blend-overlay" />
      </div>

      <motion.header 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="fixed top-0 left-0 right-0 h-89 glass-panel border-b border-neon-cyan/13 z-50 flex items-center px-21 md:px-34 shadow-[0_5px_34px_rgba(0,230,118,0.05)]"
      >
        <div className="max-w-[1440px] mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-21">
            <div className="relative group cursor-pointer flex items-center gap-13" onClick={() => setView('chat')}>
              <div className="group-hover:drop-shadow-[0_0_13px_rgba(0,230,118,0.8)] transition-all">
                <ArthashastraSymbol size={42} />
              </div>
              <div>
                <h1 className="text-13 md:text-21 font-display font-bold text-neon-cyan uppercase tracking-tighter leading-none relative drop-shadow-[0_0_5px_rgba(0,230,118,0.5)]">
                  ARTHASHASTRA<span className="text-parchment/55 ml-2 drop-shadow-none">AI</span>
                </h1>
                <div className="flex items-center gap-5 mt-2">
                   <div className={`w-3 h-3 rounded-full ${systemStatus === 'unconfigured' ? 'bg-cyber-red shadow-[0_0_5px_#FF2A2A]' : 'bg-neon-green shadow-[0_0_5px_#39FF14]'} animate-pulse`} />
                  <span className="text-[8px] caps-modern text-neon-cyan/89 tracking-[0.34em]">
                    {systemStatus === 'unconfigured' ? 'System Unconfigured' : 'Neural Economic Intelligence'}
                  </span>
                  <span className="text-[7px] ml-5 px-5 py-1 border border-neon-blue/34 text-neon-blue rounded bg-neon-blue/5 caps-modern shadow-[0_0_5px_rgba(10,132,255,0.3)]">Perimeter: Active</span>
                </div>
              </div>
            </div>

            <nav className="hidden md:flex items-center gap-13 ml-34">
              {[
                { id: 'chat', icon: MessageSquare, label: 'Terminal' },
                { id: 'brain', icon: Zap, label: 'Main Brain' },
                { id: 'ledger', icon: Clock, label: 'Archive' },
                ...(isAdmin ? [
                  { id: 'dashboard', icon: LayoutDashboard, label: 'Command' },
                  { id: 'routine', icon: Activity, label: 'Routine' }
                ] : [])
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setView(item.id as any)}
                  className={`flex items-center gap-8 px-13 py-8 rounded-8 transition-all duration-377 group relative ${
                    view === item.id ? 'text-neon-cyan bg-neon-cyan/13 drop-shadow-[0_0_5px_rgba(0,230,118,0.5)]' : 'text-neon-cyan/34 hover:text-neon-cyan hover:bg-neon-cyan/5'
                  }`}
                >
                  {item.id === 'dashboard' && tweets.filter(t => !t.processed && !t.userApproved && t.draftRebuttal).length > 0 && (
                    <span className="absolute -top-5 -right-5 w-13 h-13 bg-neon-magenta rounded-full flex items-center justify-center text-[8px] text-white font-bold animate-pulse shadow-[0_0_8px_#FF00FF]">
                      {tweets.filter(t => !t.processed && !t.userApproved && t.draftRebuttal).length}
                    </span>
                  )}
                  <item.icon className={`w-13 h-13 ${view === item.id ? 'text-neon-cyan' : 'group-hover:text-neon-cyan'} transition-colors`} />
                  <span className="text-[10px] caps-modern font-bold tracking-widest">{item.label}</span>
                  {view === item.id && (
                    <motion.div layoutId="nav-active" className="absolute bottom-0 left-0 right-0 h-1 bg-neon-cyan shadow-[0_0_13px_rgba(0,230,118,0.89)]" />
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-13">
            {user ? (
              <div className="flex items-center gap-8">
                <div className="w-34 h-34 rounded-full overflow-hidden border border-neon-cyan/34 ml-5 relative group shadow-[0_0_8px_rgba(0,230,118,0.3)]">
                  <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} alt="User" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-neon-cyan/0 group-hover:bg-neon-cyan/21 transition-colors" />
                </div>
                <button onClick={signOut} className="p-8 text-neon-cyan/55 hover:text-cyber-red transition-colors hover:drop-shadow-[0_0_5px_rgba(255,42,42,0.8)]">
                  <LogOut className="w-13 h-13" />
                </button>
              </div>
            ) : (
              <button 
                onClick={signInWithGoogle}
                className="flex items-center gap-8 px-13 py-8 bg-neon-cyan text-void border border-neon-cyan hover:bg-neon-cyan/89 hover:shadow-[0_0_21px_rgba(0,230,118,0.8)] transition-all duration-233 text-13 caps-modern font-bold shadow-[0_0_13px_rgba(0,230,118,0.34)]"
              >
                <LogIn className="w-13 h-13" />
                <span className="hidden sm:inline">Access Intelligence</span>
              </button>
            )}
            <div className="relative group">
              <button className="flex items-center gap-8 px-13 py-8 bg-void/34 border border-neon-cyan/21 hover:border-neon-cyan/55 hover:shadow-[0_0_8px_rgba(0,230,118,0.3)] transition-all duration-233 text-13 caps-modern">
                <Languages className="w-13 h-13 text-neon-cyan drop-shadow-[0_0_3px_rgba(0,230,118,0.5)]" />
                <span className="hidden sm:inline text-neon-cyan drop-shadow-[0_0_3px_rgba(0,230,118,0.5)]">{SUPPORTED_LANGUAGES.find(l => l.code === language)?.native}</span>
              </button>
              <div className="absolute right-0 mt-8 w-233 py-13 glass-panel shadow-[0_34px_89px_-21px_rgba(0,0,0,0.89)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-377 z-[60] max-h-[377px] overflow-y-auto silk-scroll rounded-8 border-neon-cyan/21">
                <div className="px-13 pb-8 mb-8 border-b border-neon-cyan/13">
                  <span className="text-[10px] uppercase tracking-[0.34em] text-neon-cyan/89 font-bold drop-shadow-[0_0_5px_rgba(0,230,118,0.5)]">Select Intelligence Language</span>
                </div>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
                    className={`w-full px-13 py-8 text-left text-13 hover:bg-neon-cyan/13 transition-all duration-233 flex items-center justify-between group/lang ${language === lang.code ? 'text-neon-cyan bg-neon-cyan/13' : 'text-parchment/55 hover:text-neon-cyan'}`}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium tracking-wide drop-shadow-[0_0_3px_rgba(0,230,118,0)] group-hover/lang:drop-shadow-[0_0_3px_rgba(0,230,118,0.5)]">{lang.native}</span>
                      <span className="text-[10px] opacity-55 uppercase tracking-wider group-hover/lang:opacity-89">{lang.name}</span>
                    </div>
                    {language === lang.code && <div className="w-5 h-5 rounded-full bg-neon-cyan shadow-[0_0_8px_rgba(0,230,118,0.89)]" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.header>

      <main className="pt-89 pb-144">
        <div className="max-w-[1440px] mx-auto w-full px-21">
          {isAdmin && systemStatus === 'unconfigured' && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="mb-34 overflow-hidden"
            >
              <div className="glass-panel p-21 border border-cyber-red/34 rounded-13 bg-cyber-red/5 flex items-start gap-21 animate-pulse shadow-[0_0_21px_-5px_rgba(255,46,99,0.34)]">
                <div className="p-13 rounded-full bg-cyber-red/13 border border-cyber-red/34">
                  <AlertTriangle className="w-21 h-21 text-cyber-red drop-shadow-[0_0_5px_#FF2A2A]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-13 caps-modern font-bold text-cyber-red mb-5 tracking-widest drop-shadow-[0_0_3px_#FF2A2A]">CRITICAL SYSTEM ERROR: CONFIGURATION REQUIRED</h3>
                  <p className="text-13 text-parchment/89 mb-13 leading-relaxed">
                    The backend has detected placeholder values in your configuration. To enable the agents and synchronize with the Truth Ledger, you must provide your real credentials.
                  </p>
                  <div className="flex flex-wrap gap-13">
                    <div className="px-13 py-5 rounded-8 bg-black/55 border border-white/5 text-[10px] font-mono shadow-[inset_0_0_10px_rgba(255,42,42,0.1)]">
                      <span className="text-cyber-red/55 mr-5">MISSING:</span> GEMINI_API_KEY
                    </div>
                    <div className="px-13 py-5 rounded-8 bg-black/55 border border-white/5 text-[10px] font-mono shadow-[inset_0_0_10px_rgba(255,42,42,0.1)]">
                      <span className="text-cyber-red/55 mr-5">MISSING:</span> FIREBASE_PROJECT_ID
                    </div>
                    <div className="px-13 py-5 rounded-8 bg-black/55 border border-white/5 text-[10px] font-mono shadow-[inset_0_0_10px_rgba(255,42,42,0.1)]">
                      <span className="text-cyber-red/55 mr-5">MISSING:</span> AITIHYA_SIGNING_SECRET
                    </div>
                  </div>
                  <div className="mt-21 flex items-center gap-13">
                    <span className="text-[10px] text-parchment/34 italic">Instruction: Open the "Secrets" panel in settings and add these keys.</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'brain' ? (
            <div className="py-55 space-y-55 min-h-[calc(100vh-144px)] flex flex-col items-center">
              <div className="text-center relative">
                <motion.div
                  animate={{ 
                    scale: [1, 1.05, 1],
                    rotate: [0, 5, -5, 0]
                  }}
                  transition={{ 
                    duration: 13, 
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="relative z-10"
                >
                  <div className="absolute inset-0 bg-neon-cyan/21 blur-[89px] rounded-full animate-pulse" />
                  <ArthashastraSymbol size={233} className="relative z-10 drop-shadow-[0_0_55px_rgba(0,230,118,0.8)]" />
                </motion.div>
                
                <div className="mt-34 relative z-10">
                  <h2 className="text-55 font-display font-bold text-neon-cyan uppercase tracking-tighter leading-none drop-shadow-[0_0_13px_rgba(0,230,118,1)]">ARTHASHASTRA CORE</h2>
                  <p className="text-13 caps-modern text-neon-cyan/89 tracking-[0.55em] mt-8 animate-pulse">Spherical Economic Intelligence | Unified Neural Brain</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-21 w-full max-w-[1440px]">
                <div className="glass-panel p-21 rounded-13 border-neon-cyan/34 col-span-1 lg:col-span-2 shadow-[0_0_21px_rgba(0,230,118,0.1)]">
                  <h3 className="text-13 caps-modern text-neon-cyan mb-21 flex items-center gap-8 border-b border-neon-cyan/13 pb-8">
                    <Zap className="w-13 h-13" />
                    Unified Intelligence Stream
                  </h3>
                  <div className="space-y-13 overflow-y-auto silk-scroll max-h-[444px] pr-8">
                    {intelligence.length > 0 ? intelligence.slice(0, 10).map((item, idx) => (
                      <div key={idx} className="p-13 bg-void/34 border border-neon-cyan/13 rounded-8 hover:border-neon-cyan/55 transition-all group">
                        <div className="flex justify-between items-start mb-5">
                          <span className="text-[10px] caps-modern text-neon-cyan/55 font-bold tracking-widest">{item.source}</span>
                          <div className={`px-8 py-2 rounded text-[8px] caps-modern ${item.metadata?.severity === 'High' ? 'bg-cyber-red/13 text-cyber-red border border-cyber-red/34' : 'bg-neon-cyan/13 text-neon-cyan border border-neon-cyan/34'}`}>
                            {item.metadata?.severity || 'Low'} IMPACT
                          </div>
                        </div>
                        <p className="text-13 text-parchment/89 leading-relaxed group-hover:text-parchment transition-colors">{item.content}</p>
                        <div className="mt-5 flex items-center justify-between">
                          <span className="text-[9px] font-mono text-neon-cyan/34 italic">{new Date(item.timestamp).toLocaleTimeString()}</span>
                          <span className="text-[9px] caps-modern text-neon-cyan/55 font-bold">Confidence: {item.metadata?.confidence || '100%'}</span>
                        </div>
                      </div>
                    )) : (
                      <div className="flex flex-col items-center justify-center py-55 opacity-34 italic">
                        <Database className="w-34 h-34 mb-13 animate-pulse" />
                        <p className="text-13">Initializing Spherical Neural Mapping...</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-21 col-span-1 lg:col-span-2">
                  <div className="glass-panel p-21 rounded-13 border-neon-magenta/34 shadow-[inset_0_0_21px_rgba(255,0,255,0.05)]">
                    <h3 className="text-13 caps-modern text-neon-magenta mb-13 flex items-center gap-8 border-b border-neon-magenta/13 pb-8">
                      <TrendingUp className="w-13 h-13" />
                      Global State Perception
                    </h3>
                    <div className="p-21 bg-neon-magenta/5 border border-neon-magenta/13 rounded-8 relative overflow-hidden">
                       <div className="absolute top-0 right-0 p-8">
                         <Activity className="w-34 h-34 text-neon-magenta/13 animate-pulse" />
                       </div>
                       <p className="text-13 text-parchment/89 leading-relaxed italic relative z-10">
                        "The Brain currently perceives multiple wealth-translocation vectors across the Asia-Pacific corridor. Corporate earnings volatility is being masked by central bank liquidity injections. The common man's purchasing power remains the critical focal point."
                       </p>
                    </div>
                  </div>

                  <div className="glass-panel p-21 rounded-13 border-neon-cyan/34 shadow-[0_0_13px_rgba(0,230,118,0.1)]">
                    <h3 className="text-13 caps-modern text-neon-cyan mb-13 flex items-center gap-8 border-b border-neon-cyan/13 pb-8">
                      <Shield className="w-13 h-13" />
                      Mission Security State
                    </h3>
                    <div className="grid grid-cols-2 gap-13">
                      <div className="p-13 bg-void/34 border border-neon-cyan/13 rounded-8 text-center">
                        <p className="text-[10px] caps-modern text-neon-cyan/55 mb-5">Ledger Integrity</p>
                        <p className="text-21 font-bold text-neon-cyan">100% SECURE</p>
                      </div>
                      <div className="p-13 bg-void/34 border border-neon-cyan/13 rounded-8 text-center">
                        <p className="text-[10px] caps-modern text-neon-cyan/55 mb-5">Agent Sync Status</p>
                        <p className="text-21 font-bold text-neon-cyan">STABLE</p>
                      </div>
                    </div>
                  </div>

                  <div className="glass-panel p-21 rounded-13 border-neon-cyan/21 bg-neon-cyan/5 shadow-[0_0_21px_rgba(0,230,118,0.05)]">
                    <h3 className="text-13 caps-modern text-neon-cyan mb-13 flex items-center gap-8 border-b border-neon-cyan/13 pb-8">
                      <Globe className="w-13 h-13" />
                      Spherical Cross-Disciplinary Awareness
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
                      {[
                        { label: 'Politics', icon: Landmark, color: 'neon-cyan' },
                        { label: 'Technology', icon: Zap, color: 'neon-blue' },
                        { label: 'Biology', icon: Activity, color: 'neon-magenta' },
                        { label: 'Anthropology', icon: Globe, color: 'parchment' },
                        { label: 'Psychology', icon: Shield, color: 'neon-blue' },
                        { label: 'Cryptoeconomics', icon: Coins, color: 'neon-cyan' },
                      ].map((field, idx) => (
                        <div key={idx} className={`p-8 bg-void/34 border border-${field.color}/13 rounded-5 flex flex-col items-center gap-5 hover:border-${field.color}/55 transition-all group cursor-default shadow-[0_0_5px_rgba(0,0,0,0.2)]`}>
                          <field.icon className={`w-13 h-13 text-${field.color} opacity-55 group-hover:opacity-100 group-hover:drop-shadow-[0_0_5px_currentColor] transition-all`} />
                          <span className={`text-[8px] caps-modern text-${field.color}/55 group-hover:text-${field.color} transition-all`}>{field.label}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-13 text-[9px] text-parchment/55 leading-relaxed bg-void/21 p-8 rounded border border-neon-cyan/8">
                      <p className="italic">"The Brain strip-searches every human discipline to reveal its hidden economic pulse. There are no isolated subjects—only nodes in the Global Wealth Organism."</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : view === 'explanation' ? (
            <div className="py-55 max-w-3xl mx-auto space-y-34">
              <div className="flex items-center justify-between border-b border-neon-cyan/21 pb-21">
                <div>
                  <h2 className="text-34 font-display font-bold text-neon-cyan uppercase tracking-tighter drop-shadow-[0_0_8px_rgba(0,230,118,0.6)]">Economic Analysis</h2>
                  <p className="text-[10px] caps-modern text-neon-cyan/55 mt-5">Verified by Arthashastra AI | Absolute Witness Ledger</p>
                </div>
                {!paywallReached && remainingFree !== null && (
                  <div className="px-13 py-8 bg-neon-cyan/5 border border-neon-cyan/34 rounded-full text-[10px] text-neon-cyan font-bold uppercase tracking-widest shadow-[0_0_8px_rgba(0,230,118,0.2)]">
                    Free Credits: {remainingFree}
                  </div>
                )}
              </div>

              {!user ? (
                <div className="glass-panel p-55 border border-neon-cyan/34 rounded-21 text-center space-y-34">
                  <div className="mx-auto w-89 h-89 bg-neon-cyan/13 rounded-full flex items-center justify-center">
                    <User className="w-55 h-55 text-neon-cyan drop-shadow-[0_0_10px_#00E676]" />
                  </div>
                  <h3 className="text-34 caps-modern font-bold text-neon-cyan">IDENTITY REQUIRED</h3>
                  <p className="text-13 text-parchment/89 leading-relaxed">
                    To track your 3 free absolute truth explanations, you must identify as a Witness. Connect your credentials to proceed.
                  </p>
                  <button 
                    onClick={signInWithGoogle}
                    className="w-full bg-neon-cyan text-void py-13 rounded-13 font-bold caps-modern hover:bg-neon-cyan/89 shadow-[0_0_34px_rgba(0,230,118,0.5)] transition-all"
                  >
                    Identify as Witness
                  </button>
                </div>
              ) : paywallReached ? (
                <div className="glass-panel p-55 border border-neon-magenta/34 bg-neon-magenta/5 rounded-21 text-center space-y-34 shadow-[0_0_55px_rgba(255,0,255,0.1)]">
                  <div className="mx-auto w-89 h-89 bg-neon-magenta/13 rounded-full flex items-center justify-center animate-pulse">
                    <Shield className="w-55 h-55 text-neon-magenta drop-shadow-[0_0_10px_#FF00FF]" />
                  </div>
                  <h3 className="text-34 caps-modern font-bold text-neon-magenta drop-shadow-[0_0_5px_rgba(255,0,255,0.8)]">CREDITS DEPLETED</h3>
                  <p className="text-13 text-parchment/89 leading-relaxed">
                    You have exhausted your 3 free absolute truth explanations. Access to the full neural economic engine requires a Witness Subscription.
                  </p>
                  <button 
                    onClick={handlePayment}
                    className="w-full bg-neon-magenta text-white py-13 rounded-13 font-bold caps-modern hover:bg-neon-magenta/89 shadow-[0_0_34px_rgba(255,0,255,0.5)] transition-all"
                  >
                    Authorize Subscription
                  </button>
                </div>
              ) : activeExplanation ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-panel p-34 border border-neon-cyan/13 rounded-13 space-y-21 bg-void/55 backdrop-blur-xl"
                >
                  <div className="prose prose-invert max-w-none text-parchment/89 prose-p:leading-relaxed prose-headings:text-neon-cyan">
                    <ReactMarkdown>{activeExplanation.content}</ReactMarkdown>
                  </div>
                  <div className="pt-21 border-t border-neon-cyan/13 flex justify-between items-center text-[10px] caps-modern text-neon-cyan/55">
                    <span>Ledger ID: {activeExplanation.id}</span>
                    <span>Witnessed: {new Date(activeExplanation.timestamp).toLocaleString()}</span>
                  </div>
                </motion.div>
              ) : (
                <div className="py-89 text-center space-y-13 opacity-55 italic">
                  <Database className="w-55 h-55 mx-auto animate-pulse" />
                  <p>Searching the Aitihya Ledger...</p>
                </div>
              )}
            </div>
          ) : view === 'subscription' ? (
            <div className="py-55 max-w-5xl mx-auto space-y-55 text-center">
              <div className="space-y-13">
                <h2 className="text-55 font-display font-bold text-neon-cyan uppercase tracking-tighter drop-shadow-[0_0_13px_rgba(0,230,118,0.8)]">WITNESS ACCESS</h2>
                <p className="text-13 caps-modern text-neon-cyan/55 tracking-[0.55em]">Unlimited Economic Reality Unlocked</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-34">
                <div className="glass-panel p-34 border border-neon-cyan/13 hover:border-neon-cyan/55 transition-all text-left space-y-21 opacity-55 grayscale cursor-not-allowed group">
                  <h3 className="text-21 caps-modern text-neon-cyan/89">Trial Witness</h3>
                  <div className="text-55 font-bold text-neon-cyan/55">FREE</div>
                  <ul className="space-y-8 text-[10px] caps-modern text-parchment/55">
                    <li className="flex items-center gap-8"><CheckCircle2 className="w-13 h-13" /> 3 Explanations</li>
                    <li className="flex items-center gap-8"><CheckCircle2 className="w-13 h-13" /> Public Terminal</li>
                    <li className="flex items-center gap-8 opacity-34"><X className="w-13 h-13" /> Unlimited Analysis</li>
                  </ul>
                  <div className="pt-13 text-[10px] text-neon-cyan italic">STATUS: DEPLETED</div>
                </div>

                <div className="glass-panel p-34 border border-neon-magenta/55 bg-neon-magenta/5 shadow-[0_0_34px_rgba(255,0,255,0.1)] text-left space-y-21 group relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-13 bg-neon-magenta text-white text-[10px] caps-modern font-bold shadow-[0_0_13px_#FF00FF]">PRIORITY</div>
                  <h3 className="text-21 caps-modern text-neon-magenta">Absolute Witness</h3>
                  <div className="text-55 font-bold text-neon-magenta drop-shadow-[0_0_5px_rgba(255,0,255,0.5)]">$34<span className="text-13">/MO</span></div>
                  <ul className="space-y-8 text-[10px] caps-modern text-parchment/89">
                    <li className="flex items-center gap-8"><CheckCircle2 className="w-13 h-13 text-neon-magenta" /> UNLIMITED EXPLANATIONS</li>
                    <li className="flex items-center gap-8"><CheckCircle2 className="w-13 h-13 text-neon-magenta" /> PRIORITY NEURAL LINK</li>
                    <li className="flex items-center gap-8"><CheckCircle2 className="w-13 h-13 text-neon-magenta" /> AITIHYA CHAIN ACCESS</li>
                    <li className="flex items-center gap-8"><CheckCircle2 className="w-13 h-13 text-neon-magenta" /> TWITTER INTEL EXPORT</li>
                  </ul>
                  <button 
                    onClick={handlePayment}
                    className="w-full bg-neon-magenta text-white py-13 rounded-8 font-bold caps-modern hover:shadow-[0_0_21px_#FF00FF] transition-all"
                  >
                    ACTIVATE LINK
                  </button>
                  <p className="text-[8px] text-parchment/34 leading-tight mt-13 italic">
                    * Compliance: All payments processed via Razorpay SECURE. Users subject to regional central bank KYC rules. 
                    Mission legal review active per jurisdiction. No PII stored off-chain.
                  </p>
                </div>
              </div>
            </div>
          ) : (view === 'routine' && isAdmin) ? (
            <div className="space-y-34 py-34">
              <div className="flex items-center justify-between mb-21">
                <div>
                  <h2 className="text-34 font-display font-bold text-neon-cyan uppercase tracking-tighter leading-none drop-shadow-[0_0_8px_rgba(0,230,118,0.6)]">Operational Routine</h2>
                  <div className="flex items-center gap-8 mt-5">
                    <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse shadow-[0_0_5px_#39FF14]" />
                    <p className="text-[10px] caps-modern text-neon-cyan/89">24/7 Global Surveillance | Absolute Truth Protocol</p>
                  </div>
                </div>
                <div className="flex items-center gap-13">
                  <div className="px-13 py-8 bg-neon-cyan/5 border border-neon-cyan/34 rounded-full text-[10px] text-neon-cyan font-bold uppercase tracking-widest flex items-center gap-8 shadow-[0_0_8px_rgba(0,230,118,0.3)]">
                    <Clock className="w-13 h-13" />
                    Interval: 15m
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-21">
                <div className="lg:col-span-2 space-y-21">
                  <div className="glass-panel p-21 rounded-13 border-neon-cyan/13">
                    <h3 className="text-13 caps-modern text-neon-cyan mb-13 flex items-center gap-8 drop-shadow-[0_0_3px_rgba(0,230,118,0.5)]">
                      <Zap className="w-13 h-13" />
                      Mission Lifecycle
                    </h3>
                    <div className="space-y-13">
                      {[
                        { time: 'T-00:00', task: 'MacroPolicy & Global Triad Activation', status: 'Cyclic' },
                        { time: 'T-00:20', task: 'Regional Intel & Domestic Analysis', status: 'Cyclic' },
                        { time: 'T-00:40', task: 'Banking & Systemic Risk Vetting', status: 'Cyclic' },
                        { time: 'T-01:00', task: 'Market Markets (Equities/Derivatives)', status: 'Cyclic' },
                        { time: 'T-01:20', task: 'Twitter Monitoring & Sentiment Audit', status: 'Cyclic' },
                        { time: 'T-01:40', task: 'Public Truth Posting & Engagement', status: 'Cyclic' }
                      ].map((step, idx) => (
                        <div key={idx} className="flex items-center gap-13 group">
                          <div className="w-55 text-[10px] font-mono text-neon-cyan/55 group-hover:text-neon-cyan transition-colors">{step.time}</div>
                          <div className="flex-1 p-8 bg-neon-cyan/5 border border-neon-cyan/13 group-hover:border-neon-cyan/55 hover:shadow-[0_0_10px_rgba(0,230,118,0.1)] transition-all rounded-5 flex items-center justify-between">
                            <span className="text-13 text-parchment/89 group-hover:text-parchment">{step.task}</span>
                            <span className="text-[10px] caps-modern text-neon-cyan opacity-89 drop-shadow-[0_0_2px_rgba(0,230,118,0.5)]">{step.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="glass-panel p-21 rounded-13 border-neon-cyan/13">
                    <h3 className="text-13 caps-modern text-neon-cyan mb-13 flex items-center gap-8 drop-shadow-[0_0_3px_rgba(0,230,118,0.5)]">
                      <Calendar className="w-13 h-13" />
                      Day-Cycle Witness
                    </h3>
                    <div className="grid grid-cols-12 gap-5 h-89">
                      {Array.from({ length: 96 }).map((_, i) => (
                        <div 
                          key={i} 
                          title={`Cycle ${Math.floor(i/4)}:${(i%4)*15}`}
                          className={`rounded-2 h-full ${i % 4 === 0 ? 'bg-neon-cyan/34 shadow-[0_0_5px_rgba(0,230,118,0.3)]' : 'bg-neon-cyan/13'} hover:bg-neon-cyan hover:shadow-[0_0_8px_#00E676] transition-all cursor-crosshair`} 
                        />
                      ))}
                    </div>
                    <div className="flex justify-between mt-8 text-[10px] font-mono text-neon-cyan/55 px-2">
                      <span>00:00</span>
                      <span>06:00</span>
                      <span>12:00</span>
                      <span>18:00</span>
                      <span>23:59</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-21">
                  <div className="glass-panel p-21 rounded-13 border-neon-cyan/13">
                    <h3 className="text-13 caps-modern text-neon-cyan mb-13 border-b border-neon-cyan/13 pb-8 drop-shadow-[0_0_3px_rgba(0,230,118,0.5)]">Active Fleet Roster</h3>
                    <div className="space-y-8 max-h-[377px] overflow-y-auto silk-scroll pr-8">
                      {agents.map((agent) => (
                        <div key={agent.id} className="flex items-center justify-between p-8 bg-neon-cyan/5 rounded-5 border border-transparent hover:border-neon-cyan/34 hover:shadow-[0_0_8px_rgba(0,230,118,0.1)] transition-all group">
                          <div>
                            <p className="text-13 font-mono text-parchment/89 group-hover:text-neon-cyan drop-shadow-[0_0_1px_rgba(0,230,118,0)] group-hover:drop-shadow-[0_0_2px_rgba(0,230,118,0.5)] transition-all">{agent.domain}</p>
                            <p className="text-[10px] caps-modern text-neon-cyan/55 group-hover:text-neon-cyan/89">{agent.role}</p>
                          </div>
                          <div className={`w-5 h-5 rounded-full ${getAgentStatus(agent.id) === 'processing' ? 'bg-neon-green animate-pulse shadow-[0_0_5px_#39FF14]' : 'bg-neon-cyan/34'}`} />
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="glass-panel p-21 rounded-13 border-neon-cyan/13 bg-neon-cyan/5 shadow-[inset_0_0_15px_rgba(0,230,118,0.05)]">
                    <h3 className="text-13 caps-modern text-neon-cyan mb-8 drop-shadow-[0_0_3px_rgba(0,230,118,0.5)]">Node Awareness</h3>
                    <p className="text-11 text-parchment/89 leading-relaxed">
                      All agents are bound to the <span className="text-neon-cyan italic drop-shadow-[0_0_2px_rgba(0,230,118,0.3)]">Aitihya Chain</span>. Every 15 minutes, the fleet performs a complete sweep of their assigned domains. Results are committed directly to the blockchain to prevent informational decay.
                    </p>
                    <div className="mt-13 flex items-center gap-8 text-[10px] text-neon-cyan font-bold uppercase tracking-widest drop-shadow-[0_0_3px_rgba(0,230,118,0.5)]">
                      <CheckCircle2 className="w-13 h-13" />
                      System Nominal
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : view === 'ledger' ? (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-34 py-34 h-[calc(100vh-144px)] overflow-hidden">
                <div className="lg:col-span-1 h-full flex flex-col gap-13">
                  <AitihyaHistory 
                    onSelectConversation={loadConversation} 
                    activeChatId={activeChatId} 
                  />
                  <button 
                    onClick={startNewChat}
                    className="w-full flex items-center justify-center gap-13 p-13 glass-panel border border-neon-cyan/34 text-neon-cyan hover:bg-neon-cyan/8 hover:shadow-[0_0_8px_rgba(0,230,118,0.3)] transition-all rounded-8 caps-modern text-13"
                  >
                    <Zap className="w-13 h-13" />
                    New Witness Thread
                  </button>
                </div>
                
                <div className="lg:col-span-3 space-y-21 overflow-y-auto custom-scrollbar pr-13 pb-55">
                  <div className="flex items-center justify-between mb-13 border-b border-neon-cyan/13 pb-13">
                    <div className="flex items-center gap-13">
                      <Blocks className="w-34 h-34 text-neon-cyan drop-shadow-[0_0_5px_rgba(0,230,118,0.5)]" />
                      <div>
                        <h2 className="text-13 caps-modern text-neon-cyan tracking-widest uppercase drop-shadow-[0_0_3px_rgba(0,230,118,0.3)]">{isAdmin ? 'The Ledger of Proof' : 'Your Witness Threads'}</h2>
                        <p className="text-[10px] text-parchment/34 uppercase">{isAdmin ? 'Immutable verification of elite deception' : 'Synchronized with the Aitihya Chain'}</p>
                      </div>
                    </div>
                  </div>

                  {isAdmin ? (
                    <>
                      {ledger.filter(b => 
                        !searchTerm || 
                        b.hash?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        b.agentId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        String(b.data).toLowerCase().includes(searchTerm.toLowerCase())
                      ).length === 0 ? (
                        <div className="h-[300px] flex items-center justify-center opacity-34 italic text-neon-cyan">
                          No blocks witnessed in the absolute truth chain.
                        </div>
                      ) : (
                        ledger.filter(b => 
                          !searchTerm || 
                          b.hash?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          b.agentId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          String(b.data).toLowerCase().includes(searchTerm.toLowerCase())
                        ).map((block) => (
                          <motion.div
                            key={block.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="p-21 glass-panel border border-neon-cyan/13 relative group hover:border-neon-cyan/34 hover:shadow-[0_0_15px_rgba(0,230,118,0.2)]"
                          >
                            <div className="absolute -left-2 top-0 bottom-0 w-3 bg-neon-cyan/34 group-hover:bg-neon-cyan group-hover:shadow-[0_0_10px_rgba(0,230,118,0.8)] transition-colors" />
                            <div className="flex items-start justify-between mb-13 gap-13">
                              <div className="flex items-center gap-8">
                                <span className="text-13 font-mono text-neon-cyan bg-neon-cyan/13 px-8 py-2 border border-neon-cyan/34 tracking-tighter drop-shadow-[0_0_2px_rgba(0,230,118,0.5)]">
                                  B-{block.index}
                                </span>
                                <span className="text-[10px] caps-modern text-parchment/55 truncate">
                                  Witness: <span className="text-neon-cyan">{block.agentId}</span> | Level: {block.role}
                                </span>
                              </div>
                              <span className="text-[10px] font-mono text-neon-magenta/55">
                                {new Date(block.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <div className="text-13 leading-relaxed text-parchment/89 font-sans selection:bg-neon-cyan/55">
                              {typeof block.data === 'string' ? block.data : JSON.stringify(block.data)}
                            </div>
                            <div className="mt-13 pt-13 border-t border-neon-cyan/8 flex items-center gap-21 text-[10px] font-mono text-parchment/34">
                              <div className="flex items-center gap-5">
                                <span className="text-neon-cyan">Hash:</span>
                                <span className="truncate max-w-[100px]">{block.hash}</span>
                              </div>
                              <div className="flex items-center gap-5">
                                <span className="text-neon-cyan">Prev:</span>
                                <span className="truncate max-w-[100px]">{block.previousHash}</span>
                              </div>
                              <div className="ml-auto flex items-center gap-5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Shield className="w-10 h-10 text-neon-green" />
                                <span className="text-neon-green uppercase drop-shadow-[0_0_3px_rgba(57,255,20,0.5)]">Verified Integrity</span>
                              </div>
                            </div>
                          </motion.div>
                        ))
                      )}
                    </>
                  ) : (
                    <div className="glass-panel p-34 border border-neon-cyan/13 rounded-13 text-center space-y-21">
                      <div className="w-55 h-55 bg-neon-cyan/13 rounded-full flex items-center justify-center mx-auto">
                        <MessageSquare className="w-34 h-34 text-neon-cyan drop-shadow-[0_0_5px_rgba(0,230,118,0.5)]" />
                      </div>
                      <h3 className="text-21 caps-modern text-neon-cyan">Private Archive</h3>
                      <p className="text-13 text-parchment/55 max-w-md mx-auto">
                        This view displays your authenticated, cryptographically signed witness threads. 
                        Each thread is isolated and secured within the absolute witness perimeter.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-13 text-left">
                        <div className="p-13 bg-void/34 border border-neon-cyan/13 rounded-8">
                          <div className="flex items-center gap-8 mb-8">
                            <Shield className="w-13 h-13 text-neon-cyan" />
                            <span className="text-[10px] caps-modern text-neon-cyan font-bold tracking-widest">ISOLATION-0</span>
                          </div>
                          <p className="text-[11px] text-parchment/55 leading-relaxed">Zero-trust containment for all operative communications.</p>
                        </div>
                        <div className="p-13 bg-void/34 border border-neon-cyan/13 rounded-8">
                          <div className="flex items-center gap-8 mb-8">
                            <Lock className="w-13 h-13 text-neon-magenta" />
                            <span className="text-[10px] caps-modern text-neon-magenta font-bold tracking-widest">PRIVATE LEDGER</span>
                          </div>
                          <p className="text-[11px] text-parchment/55 leading-relaxed">Your data remains witnessed only by you and the absolute core.</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (view === 'dashboard' && isAdmin) ? (
            <div className="space-y-34 py-34">
              <div className="flex items-center justify-between mb-21">
                <div>
                  <h2 className="text-34 font-display font-bold text-neon-cyan uppercase tracking-tighter leading-none drop-shadow-[0_0_8px_rgba(0,230,118,0.6)]">Neural Command Center</h2>
                  <p className="text-[10px] caps-modern text-neon-cyan/89 mt-5">Autonomous Agent Fleet Monitoring (24/7 Server-Side)</p>
                </div>
                <div className="flex items-center gap-13">
                  {isCooling && (
                    <div className="flex items-center gap-5 px-13 py-5 bg-cyber-red/10 border border-cyber-red/34 rounded-full text-[10px] text-cyber-red font-bold uppercase tracking-widest shadow-[0_0_8px_rgba(255,42,42,0.3)]">
                      <Clock className="w-13 h-13" />
                      Neural Cooling: {coolingTime}s
                    </div>
                  )}
                  {isSimulating && (
                    <div className="flex items-center gap-5 px-13 py-5 bg-neon-cyan/5 border border-neon-cyan/13 rounded-full text-[10px] text-neon-cyan font-bold uppercase tracking-widest animate-pulse shadow-[0_0_8px_rgba(0,230,118,0.3)]">
                      <Activity className="w-13 h-13" />
                      Simulation Active
                    </div>
                  )}
                  <div className="flex items-center gap-5 px-13 py-5 bg-neon-cyan/5 border border-neon-cyan/13 rounded-full text-[10px] text-neon-cyan font-bold uppercase tracking-widest">
                    <div className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse shadow-[0_0_5px_#00E676]" />
                    Fleet Active: 36/36
                  </div>
                </div>
              </div>

              {/* Agent Grid Visualization */}
              <div className="glass-panel p-21 rounded-13 border-neon-cyan/13 mb-34 shadow-[inset_0_0_20px_rgba(0,230,118,0.05)]">
                <div className="flex items-center justify-between mb-21">
                  <div className="flex items-center gap-8 text-neon-cyan">
                    <Activity className="w-21 h-21 drop-shadow-[0_0_5px_rgba(0,230,118,0.8)]" />
                    <h3 className="text-13 font-bold uppercase tracking-widest drop-shadow-[0_0_3px_rgba(0,230,118,0.5)]">Agent Neural Map</h3>
                  </div>
                  <div className="flex items-center gap-13 text-[9px] caps-modern">
                    <div className="flex items-center gap-3"><div className="agent-node idle" /> Idle</div>
                    <div className="flex items-center gap-3"><div className="agent-node processing" /> Processing</div>
                    <div className="flex items-center gap-3"><div className="agent-node committed" /> Committed</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-13">
                  {agents.map((agent) => {
                    const status = getAgentStatus(agent.id);
                    return (
                      <div key={agent.id} className="flex flex-col items-center gap-5 group">
                        <div className={`agent-node ${status} ${status !== 'idle' ? 'active' : ''}`} />
                        <span className="text-[8px] font-mono text-parchment/34 group-hover:text-neon-cyan transition-colors truncate w-full text-center">
                          {agent.id.split('_')[0]}
                        </span>
                        <span className="text-[7px] caps-modern text-neon-cyan/21 group-hover:text-neon-cyan/89">{agent.role}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-21">
                {/* Intelligence Feed */}
                <div className="lg:col-span-2 space-y-21">
                  <div className="glass-panel p-21 rounded-13 border-neon-cyan/13">
                    <div className="flex items-center gap-8 mb-13 text-neon-cyan">
                      <Database className="w-21 h-21 drop-shadow-[0_0_5px_rgba(0,230,118,0.5)]" />
                      <h3 className="text-13 font-bold uppercase tracking-widest drop-shadow-[0_0_3px_rgba(0,230,118,0.3)]">Intelligence Stream</h3>
                    </div>
                    <div className="space-y-13 max-h-[500px] overflow-y-auto silk-scroll pr-8">
                      {intelligence.map((item) => (
                        <div key={item.id} className="p-13 bg-void/34 border border-neon-cyan/13 rounded-8 hover:border-neon-cyan/55 hover:shadow-[0_0_15px_rgba(0,230,118,0.1)] transition-all group">
                          <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-5 flex-wrap">
                              <span className="text-[10px] text-neon-cyan font-bold uppercase tracking-widest px-8 py-2 bg-neon-cyan/13 rounded-full drop-shadow-[0_0_2px_rgba(0,230,118,0.5)]">{item.source}</span>
                              <span className="text-[9px] text-void bg-neon-cyan px-5 py-2 rounded-full uppercase font-bold flex items-center gap-3 shadow-[0_0_8px_rgba(0,230,118,0.6)]">
                                <Shield className="w-8 h-8" />
                                Fact Checked
                              </span>
                              {item.metadata && Object.entries(item.metadata).map(([key, value]) => (
                                <span key={key} className={`text-[9px] px-5 py-2 rounded-full uppercase font-bold border ${
                                  key === 'confidence' ? 'border-neon-magenta text-neon-magenta shadow-[0_0_5px_rgba(255,0,255,0.3)]' : 'border-parchment/13 text-parchment/55'
                                }`}>
                                  {key === 'confidence' ? 'Evidence Score' : key}: {String(value)}
                                </span>
                              ))}
                            </div>
                            <span className="text-[10px] text-neon-cyan/55 font-mono whitespace-nowrap ml-8">{new Date(item.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-13 text-parchment/89 leading-relaxed group-hover:text-parchment transition-colors">{item.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="glass-panel p-21 rounded-13 border-neon-cyan/13">
                    <div className="flex items-center justify-between mb-13 border-b border-neon-cyan/13 pb-13">
                      <div className="flex items-center gap-8 text-neon-cyan">
                        <Twitter className="w-21 h-21 drop-shadow-[0_0_5px_rgba(0,230,118,0.5)]" />
                        <h3 className="text-13 font-bold uppercase tracking-widest drop-shadow-[0_0_3px_rgba(0,230,118,0.3)]">Social Engagement</h3>
                      </div>
                      <div className="flex items-center gap-8">
                        <div className={`px-8 py-2 rounded-full text-[9px] font-bold uppercase tracking-widest ${twitterConnected ? 'bg-inst-green/20 text-inst-green border border-inst-green/34' : 'bg-cyber-red/20 text-cyber-red border border-cyber-red/34'}`}>
                          {twitterConnected ? 'Connected to X' : 'Social Offline'}
                        </div>
                        {!twitterConnected && (
                          <button 
                            onClick={handleConnectTwitter}
                            className="px-13 py-5 bg-neon-cyan border border-void text-void text-[10px] font-bold uppercase tracking-widest hover:bg-neon-cyan/89 hover:shadow-[0_0_15px_rgba(0,230,118,0.6)] active:scale-95 transition-all rounded-full flex items-center gap-5 shadow-[0_0_8px_rgba(0,230,118,0.3)]"
                          >
                            <Zap className="w-13 h-13" />
                            Connect X Handle
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-13 max-h-[400px] overflow-y-auto silk-scroll pr-8">
                      {tweets.length === 0 && (
                        <div className="py-55 text-center space-y-13 border border-dashed border-neon-cyan/13 rounded-13">
                          <Activity className="w-34 h-34 text-neon-cyan/21 mx-auto animate-spin-slow" />
                          <p className="text-[10px] caps-modern text-neon-cyan/34 tracking-widest">
                            Agents are scanning for economically significant targets...<br/>
                            Status: Awaiting first cycle (15-20s)
                          </p>
                        </div>
                      )}
                      {tweets.map((tweet) => (
                        <div key={tweet.id} className="p-13 bg-void/34 border border-neon-cyan/13 rounded-8 hover:shadow-[0_0_8px_rgba(0,230,118,0.1)] transition-all">
                          <div className="flex items-center justify-between mb-5">
                            <span className="text-13 font-bold text-neon-cyan drop-shadow-[0_0_2px_rgba(0,230,118,0.4)]">{tweet.author}</span>
                            <span className="text-[10px] text-neon-cyan/55 font-mono">{new Date(tweet.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-13 text-parchment/89 mb-8 italic">"{tweet.text}"</p>
                          
                          {/* Approval Flow */}
                          {!tweet.processed && !tweet.userApproved && tweet.draftRebuttal && (
                            <div className="mt-8 p-13 bg-neon-cyan/5 border border-neon-cyan/21 rounded-8 space-y-8 shadow-[inset_0_0_15px_rgba(0,230,118,0.05)]">
                              <div className="flex items-center gap-5 text-[10px] text-neon-cyan font-bold uppercase">
                                <Search className="w-13 h-13" />
                                AI Suggested Rebuttal
                              </div>
                              <p className="text-12 text-parchment/89 font-mono">{tweet.draftRebuttal}</p>
                              <div className="flex items-center gap-13 pt-5">
                                <button 
                                  onClick={() => handleApproveTweet(tweet.id!)}
                                  className="flex-1 py-5 bg-neon-cyan text-void text-[10px] font-bold uppercase tracking-widest hover:bg-neon-cyan/89 transition-all shadow-[0_0_10px_rgba(0,230,118,0.3)] rounded"
                                >
                                  Deploy Truth Rebuttal
                                </button>
                                <button className="px-8 py-5 border border-cyber-red/34 text-cyber-red text-[10px] font-bold uppercase hover:bg-cyber-red/5 transition-all rounded">
                                  Ignore
                                </button>
                              </div>
                            </div>
                          )}

                          {tweet.userApproved && !tweet.processed && (
                            <div className="mt-8 flex items-center gap-5 p-8 bg-neon-cyan/13 border border-neon-cyan/34 rounded-8 animate-pulse text-[10px] text-neon-cyan font-bold uppercase">
                              <Clock className="w-13 h-13" />
                              Pending Posting Cycle...
                            </div>
                          )}

                          {(() => {
                            const response = responses.find(r => r.targetId === tweet.tweetId);
                            if (!response) return null;
                            return (
                              <div className="mt-8 pt-8 border-t border-neon-cyan/21 space-y-8">
                                <div>
                                  <div className="flex items-center gap-5 text-[10px] text-neon-cyan font-bold uppercase mb-2">
                                    <Landmark className="w-13 h-13" />
                                    Economic Truth Analysis
                                  </div>
                                  <p className="text-13 text-parchment/89">{response.responseText}</p>
                                </div>
                                {response.counterTweet && (
                                  <div className="bg-neon-cyan/5 p-8 rounded-5 border border-neon-cyan/34 relative overflow-hidden group/reply shadow-[inset_0_0_10px_rgba(0,230,118,0.05)]">
                                    <div className="absolute top-0 right-0 p-5 opacity-0 group-hover/reply:opacity-100 transition-opacity">
                                      <Twitter className="w-13 h-13 text-neon-cyan/34" />
                                    </div>
                                    <div className="flex items-center gap-5 text-[10px] text-neon-magenta font-bold uppercase mb-2 drop-shadow-[0_0_3px_rgba(255,0,255,0.4)]">
                                      <Shield className="w-13 h-13 text-neon-magenta" />
                                      Counter Tweet (Rebuttal)
                                    </div>
                                    <p className="text-13 font-mono font-bold text-neon-cyan leading-tight drop-shadow-[0_0_2px_rgba(0,230,118,0.3)]">
                                      {response.counterTweet}
                                    </p>
                                    <div className="mt-5 flex justify-end">
                                      <span className={`text-[9px] font-mono ${response.counterTweet.length > 160 ? 'text-cyber-red shadow-[0_0_5px_#FF2A2A]' : 'text-neon-cyan/55'}`}>
                                        {response.counterTweet.length}/160
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sidebar: Logs & Status */}
                <div className="space-y-21">
                  <div className="glass-panel p-21 rounded-13 border-neon-cyan/13">
                    <div className="flex items-center gap-8 mb-13 text-neon-cyan drop-shadow-[0_0_5px_rgba(0,230,118,0.5)]">
                      <Activity className="w-21 h-21" />
                      <h3 className="text-13 font-bold uppercase tracking-widest drop-shadow-[0_0_2px_rgba(0,230,118,0.3)]">Operation Logs</h3>
                    </div>
                    <div className="space-y-8 text-[10px] max-h-[800px] overflow-y-auto silk-scroll pr-5">
                      {logs.map((log) => (
                        <div key={log.id} className="flex gap-8 py-5 border-b border-neon-cyan/13 group hover:bg-neon-cyan/5 transition-colors">
                          <span className="text-neon-cyan/55 font-mono flex-shrink-0">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <div className="flex-1">
                            <span className="text-neon-cyan font-bold uppercase mr-5 group-hover:text-neon-cyan group-hover:drop-shadow-[0_0_5px_rgba(0,230,118,0.8)] transition-all">[{log.agentName}]</span>
                            <span className="text-parchment/55">{log.action}</span>
                            <span className={`ml-5 font-bold ${log.status === 'success' ? 'text-void bg-neon-cyan px-5 py-1 rounded-full shadow-[0_0_5px_#00E676]' : 'text-cyber-red drop-shadow-[0_0_3px_#FF2A2A]'}`}>{log.status.toUpperCase()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="min-h-[70vh] flex flex-col items-center justify-center py-89">
              <motion.div 
                initial={{ y: 34, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.89, ease: [0.16, 1, 0.3, 1] }}
                className="text-center space-y-21 mb-55"
              >
                <div className="inline-flex items-center gap-8 px-21 py-5 bg-neon-cyan/5 border border-neon-cyan/34 caps-modern mb-13 relative shadow-[0_0_15px_rgba(0,230,118,0.1)]">
                  <div className="absolute inset-0 bg-neon-cyan/13 blur-md" />
                  <div className="w-5 h-5 rounded-full bg-neon-cyan animate-pulse relative z-10 shadow-[0_0_8px_#00E676]" />
                  <span className="relative z-10 text-neon-cyan drop-shadow-[0_0_3px_rgba(0,230,118,0.5)]">Neural Interface Active</span>
                </div>
                <h1 className="text-55 md:text-89 font-display font-bold tracking-tighter leading-[0.95] text-parchment uppercase">
                  {t.hero1}<br />
                  <span className="text-neon-cyan drop-shadow-[0_0_21px_rgba(0,230,118,0.5)]">{t.hero2}</span>
                </h1>
                <p className="text-neon-cyan/55 text-13 max-w-[610px] mx-auto leading-relaxed font-light caps-modern opacity-89">
                  {t.description}
                </p>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-13 w-full max-w-[890px]">
                {t.prompts.map((prompt: string, i: number) => (
                  <motion.button
                    key={i}
                    initial={{ y: 21, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.13 * i, duration: 0.61 }}
                    whileHover={{ y: -5, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSend(prompt)}
                    className="p-21 text-left glass-panel transition-all duration-377 group relative overflow-hidden rounded-8 border-neon-cyan/21 hover:border-neon-cyan hover:shadow-[0_0_21px_rgba(0,230,118,0.2)]"
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-neon-cyan/0 group-hover:bg-neon-cyan transition-all duration-377 shadow-[0_0_13px_rgba(0,230,118,0.89)]" />
                    <p className="text-13 leading-relaxed text-neon-cyan/55 group-hover:text-parchment transition-colors font-semibold uppercase tracking-widest group-hover:drop-shadow-[0_0_3px_rgba(230,241,255,0.5)]">
                      {prompt}
                    </p>
                    <div className="flex items-center gap-5 mt-8 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-8px] group-hover:translate-x-0">
                      <span className="text-[10px] text-neon-cyan uppercase tracking-[0.34em] font-bold drop-shadow-[0_0_3px_rgba(0,230,118,0.5)]">Initiate Analysis</span>
                      <ChevronRight className="w-13 h-13 text-neon-cyan drop-shadow-[0_0_3px_rgba(0,230,118,0.5)]" />
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-34 py-34 pb-89 max-w-[890px] mx-auto">
              <div className="flex items-center justify-between mb-34 pb-13 border-b border-neon-cyan/21">
                <div className="flex items-center gap-8">
                  <div className="w-8 h-8 rounded-full bg-neon-cyan animate-pulse shadow-[0_0_8px_#00E676]" />
                  <span className="text-[10px] caps-modern text-neon-cyan drop-shadow-[0_0_3px_rgba(0,230,118,0.5)]">Secure Terminal Session</span>
                </div>
                <span className="text-[10px] font-mono text-neon-cyan/55">ID: {Math.random().toString(36).substring(7).toUpperCase()}</span>
              </div>
              <AnimatePresence>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    layout
                    initial={{ y: 21, opacity: 0, scale: 0.98 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] p-21 rounded-13 relative group ${
                      msg.role === 'user' 
                        ? 'bg-neon-cyan/21 border border-neon-cyan/55 text-parchment ml-34 shadow-[0_0_15px_rgba(0,230,118,0.2)]' 
                        : 'glass-panel border-neon-magenta/34 text-parchment mr-34 shadow-[inset_0_0_15px_rgba(255,0,255,0.1)]'
                    }`}>
                      <div className="flex items-center justify-between mb-8 opacity-89">
                        <div className="flex items-center gap-8">
                          {msg.role === 'user' ? <User className="w-13 h-13 text-neon-cyan drop-shadow-[0_0_5px_rgba(0,230,118,0.8)]" /> : <Landmark className="w-13 h-13 text-neon-magenta drop-shadow-[0_0_5px_rgba(255,0,255,0.8)]" />}
                          <span className={`text-[10px] caps-modern ${msg.role === 'user' ? 'text-neon-cyan' : 'text-neon-magenta'} drop-shadow-[0_0_3px_currentColor]`}>{msg.role === 'user' ? 'Human Operator' : 'Arthashastra Core'}</span>
                        </div>
                        {msg.hash && (
                          <div className="flex items-center gap-5 px-8 py-2 bg-neon-cyan/13 border border-neon-cyan/34 rounded-full">
                            <Shield className="w-10 h-10 text-neon-cyan drop-shadow-[0_0_3px_rgba(0,230,118,0.5)]" />
                            <span className="text-[8px] font-mono text-neon-cyan/89">BLOCK {msg.index} | {msg.hash.substring(0, 8)}</span>
                          </div>
                        )}
                      </div>
                      <div className="prose prose-invert prose-neon max-w-none text-13 leading-relaxed">
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                      </div>
                      {msg.previousHash && (
                        <div className="mt-8 pt-8 border-t border-neon-cyan/21 flex items-center gap-5 opacity-55 hover:opacity-100 transition-all">
                          <Blocks className="w-10 h-10 text-neon-cyan" />
                          <span className="text-[8px] font-mono text-neon-cyan">LINK: {msg.previousHash.substring(0, 8)}...</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {isLoading && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="glass-panel p-21 rounded-13 border-neon-magenta/34 flex items-center gap-13 shadow-[0_0_15px_rgba(255,0,255,0.1)]">
                    <Loader2 className="w-21 h-21 text-neon-magenta animate-spin drop-shadow-[0_0_5px_rgba(255,0,255,0.8)]" />
                    <span className="text-[10px] caps-modern text-neon-magenta animate-pulse drop-shadow-[0_0_3px_rgba(255,0,255,0.5)]">Decrypting Economic Reality...</span>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Input Area */}
      {view === 'chat' && (
        <div className="fixed bottom-34 right-34 z-[60] flex flex-col items-end gap-8">
          <motion.div 
            initial={false}
            animate={{ 
              width: (input.length > 0 || isLoading) ? 'min(800px, calc(100vw - 68px))' : '280px',
            }}
            whileHover={{ width: 'min(800px, calc(100vw - 68px))' }}
            className="glass-panel p-5 rounded-13 border-neon-cyan/34 flex items-end gap-0 relative group overflow-hidden min-h-[55px] h-auto shadow-[0_0_21px_rgba(0,230,118,0.3)] transition-all duration-377 focus-within:shadow-[0_0_34px_rgba(0,230,118,0.5)] focus-within:border-neon-cyan"
          >
            <div className="absolute inset-0 bg-neon-cyan/5 opacity-0 group-focus-within:opacity-100 transition-opacity rounded-13 pointer-events-none" />
            
            <div className="w-44 h-44 flex items-center justify-center flex-shrink-0 text-neon-cyan group-hover:text-neon-cyan/89 transition-colors drop-shadow-[0_0_5px_rgba(0,230,118,0.5)]">
              <MessageSquare className="w-21 h-21" />
            </div>

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={t.placeholder}
              rows={input.length > 50 || input.includes('\n') ? 3 : 1}
              className="flex-1 bg-transparent border-none focus:ring-0 text-13 p-13 py-12 text-parchment placeholder:text-neon-cyan/34 font-medium relative z-10 min-w-0 opacity-100 transition-all duration-377 resize-none silk-scroll"
              style={{ minHeight: '44px' }}
            />

            <button
              onClick={() => handleSend()}
              disabled={isLoading || !input.trim()}
              className="w-44 h-44 bg-neon-cyan text-void flex items-center justify-center rounded-8 hover:bg-[#00ffff] transition-all duration-377 disabled:opacity-21 disabled:grayscale shadow-[0_0_13px_rgba(0,230,118,0.6)] flex-shrink-0"
            >
              {isLoading ? <Loader2 className="w-21 h-21 animate-spin" /> : <Send className="w-21 h-21" />}
            </button>
          </motion.div>
          <p className="text-right text-[9px] caps-modern text-neon-cyan/55 pr-13 opacity-55 group-hover:opacity-100 transition-opacity drop-shadow-[0_0_2px_rgba(0,230,118,0.3)]">
            {t.footer}
          </p>
        </div>
      )}
    </div>
  );
}

