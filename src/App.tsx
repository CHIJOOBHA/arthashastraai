/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * --- MISSION LOCK: ARTHASHASTRA ARCHITECTURE SECURED ---
 * THIS FILE IS PART OF THE IMMORTAL CORE. NO MODIFICATION WITHOUT OVERRIDE.
 */

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Send, User, Landmark, Globe, Briefcase, ChevronRight, TrendingUp, ShieldAlert, AlertTriangle, Languages, Loader2, LayoutDashboard, MessageSquare, MessageCircle, Activity, Database, LogOut, LogIn, ExternalLink, Clock, Blocks, Archive, Shield, Search, Calendar, Zap, CheckCircle2, Coins, X, Lock, Link, Ghost, Terminal, Users, Plus, Newspaper, Download, Share2, Copy } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { sendMessage } from './lib/gemini';
import { SUPPORTED_LANGUAGES, TRANSLATIONS } from './translations';
import { auth, db, signInWithGoogle, signInAnonymous, signOut, IntelligenceItem, Tweet, AgentLog, AgentResponse, handleFirestoreError, OperationType, resilientGetDoc, syncNeuralLink } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, query, orderBy, limit, onSnapshot, addDoc, getDoc, doc, updateDoc, Firestore } from 'firebase/firestore';
import { 
  macroTriad, corporateTriad, regionalIndiaTriad, healthTriad,
  bankingRetailTriad, bankingSystemicRiskTriad, marketsEquitiesTriad,
  marketsDerivativesTriad, regionalUSTriad, regionalChinaTriad, darkWebVettingTriad,
  runTriad
} from './lib/agents';
import { witnessBlock, AitihyaBlock } from './lib/aitihya';
import { Message } from './lib/firebase';
import { AitihyaHistory } from './components/AitihyaHistory';
import { saveMessage, getMessages, getConversations } from './lib/chatStore';
import { TermsPage, PrivacyPage } from './components/LegalPages';

import { ArthashastraSymbol } from './components/ArthashastraSymbol';
import { LogicProof } from './components/LogicProof';
import { ArthashastraGazette } from './components/ArthashastraGazette';
import { SharedTranscript } from './components/SharedTranscript';
import { createSharedTranscript } from './lib/chatStore';
import { TheArena } from './components/TheArena';
import { TheWarChest } from './components/TheWarChest';
import { DataSovereignty } from './components/DataSovereignty';
import { ArchiveOS } from './components/ArchiveOS';
import { ErrorBoundary } from './components/ErrorBoundary';
import { EconomicDisasterPredictor } from './components/EconomicDisasterPredictor';
import AgentRotationPanel from './components/AgentRotationPanel';

const AlertModal = ({ context, onClose }: { context: any, onClose: () => void }) => {
  if (!context) return null;
  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-[#050B14]/80 backdrop-blur-sm p-4">
      <div className="bg-[#050B14] border border-[#00E676] p-8 md:p-13 rounded-13 max-w-sm w-full font-sans shadow-[0_0_34px_rgba(0,230,118,0.2)]">
         <h3 className={`text-21 font-bold caps-modern mb-5 whitespace-pre-wrap ${context.isError ? 'text-[#FF00FF]' : 'text-[#00E676]'}`}>{context.title}</h3>
         <p className="text-13 text-[#E6F1FF]/89 mb-8 whitespace-pre-wrap leading-relaxed">{context.message}</p>
         <div className="flex justify-end gap-5 mt-5">
           <button onClick={onClose} className="px-5 py-3 border border-[#E6F1FF]/13 rounded text-[10px] caps-modern text-[#E6F1FF]/55 hover:text-[#E6F1FF] hover:border-[#E6F1FF]/34 transition bg-transparent uppercase font-bold">Cancel</button>
           {context.onConfirm && (
             <button onClick={context.onConfirm} className="px-5 py-3 text-[10px] caps-modern bg-[#00E676] text-[#050B14] font-bold rounded shadow transition hover:bg-[#00ffff] uppercase">Continue</button>
           )}
         </div>
      </div>
    </div>,
    document.body
  );
};

const MOCK_INTELLIGENCE: IntelligenceItem[] = [];

const MOCK_TWEETS: Tweet[] = [];

export default function App() {
  const [pathname, setPathname] = useState(window.location.pathname);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [modalContext, setModalContext] = useState<{title: string, message: string, onConfirm?: () => void, isError?: boolean} | null>(null);

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      const isIframe = window !== window.parent;
      if (isIframe) {
         setModalContext({
           title: "Open App in New Tab?",
           message: "PWA installation is not supported inside this preview window.\n\nWould you like to open Arthashastra in a new tab so you can install it?",
           onConfirm: () => {
             window.open(window.location.href, '_blank');
             setModalContext(null);
           }
         });
      } else {
         setModalContext({
           title: "Installation Unavailable",
           message: "The automatic install prompt is currently not available.\n\nQuick fixes:\n- Reload the page. Sometimes it takes a moment to become ready.\n- Look for the 'Install' icon (a small computer with a down arrow) in the right side of your browser's URL address bar.\n\nOther reasons:\n1. The app might already be installed on your device.\n2. Your current browser may not support PWA installation (e.g. Incognito mode).",
           isError: true
         });
      }
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    setDeferredPrompt(null);
  };

  if (pathname === '/privacy') return <PrivacyPage />;
  if (pathname === '/terms') return <TermsPage />;
  if (pathname.startsWith('/gazette/')) {
    const dateParam = pathname.split('/')[2];
    return <ArthashastraGazette initialDate={dateParam} />;
  }
  if (pathname.startsWith('/share/')) {
    const shareId = pathname.split('/')[2];
    return <SharedTranscript sharedId={shareId} />;
  }

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [language, setLanguage] = useState('en');
  const [view, setView] = useState<'chat' | 'dashboard' | 'ledger' | 'archive' | 'routine' | 'brain' | 'explanation' | 'subscription' | 'gazette' | 'arena' | 'warchest' | 'sovereignty' | 'threat'>('chat');
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

      if (!order.id) throw new Error(order.error || "Order creation failed");

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
    } catch (err: any) {
      console.error("Payment error:", err);
      alert(err.message || "Payment initiation failed. Ensure Razorpay Keys are configured in Secrets.");
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
  const [activeChatId, setActiveChatId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('arthashastra_active_chat');
      if (saved) return saved;
    }
    const newId = Math.random().toString(36).substring(2, 15);
    if (typeof window !== 'undefined') sessionStorage.setItem('arthashastra_active_chat', newId);
    return newId;
  });
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('all');

  const getLocalDateString = (d: Date): string => {
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getMsgDateStr = (timestamp: any): string => {
    if (!timestamp) return '';
    let d: Date;
    if (timestamp.seconds) {
      d = new Date(timestamp.seconds * 1000);
    } else if (typeof timestamp.toDate === 'function') {
      d = timestamp.toDate();
    } else {
      d = new Date(timestamp);
    }
    if (isNaN(d.getTime())) return '';
    return getLocalDateString(d);
  };
  const [isAccessDenied, setIsAccessDenied] = useState(false);
  const [systemStatus, setSystemStatus] = useState<'ok' | 'warn' | 'unconfigured'>('ok');
  const [systemError, setSystemError] = useState<string | null>(null);
  const [missingKeys, setMissingKeys] = useState<string[]>([]);
  const [statusData, setStatusData] = useState<any>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [activeView, setActiveView] = useState<'chat' | 'gazette'>('chat');
  const [neuralResyncCount, setNeuralResyncCount] = useState(0);

  // Neural Synchronization
  useEffect(() => {
    const performSync = async () => {
      const oldDb = db;
      await syncNeuralLink();
      if (db !== oldDb) {
        console.log("[Sync] Neural Link successfully re-aligned. Refreshing data streams.");
        setNeuralResyncCount(prev => prev + 1);
      }
    };
    performSync();
  }, []);

  // Dashboard State
  const [intelligence, setIntelligence] = useState<IntelligenceItem[]>([]);
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [responses, setResponses] = useState<AgentResponse[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [geminiConfigured, setGeminiConfigured] = useState(false);

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
    { id: 'Compliance', role: 'Compliance', domain: 'System' }
  ];

  // Simulation Effect - REMOVED to prevent token waste and confusion
  // The agents are now fully server-side and autonomous.
  useEffect(() => {
    // No-op
  }, [user]);

  useEffect(() => {
    // Only attempt auto-sync if we have a user and haven't loaded any messages yet.
    // If we have a saved chatId in session, we try to restore it.
    if (user && isAuthReady && messages.length === 0 && view === 'chat') {
       const autoSync = async () => {
         try {
           const savedId = sessionStorage.getItem('arthashastra_active_chat');
           const convs = await getConversations();
           
           if (savedId) {
             const exists = convs.find(c => c.id === savedId);
             if (exists) {
               console.log(`[Sync] Resuming active witness thread: ${savedId}`);
               loadConversation(savedId, false);
               return;
             }
           }

           if (convs.length > 0) {
             console.log("[Sync] Auto-restoring latest witness thread from ledger...");
             loadConversation(convs[0].id, false);
           }
         } catch (e) {
           console.error("[Sync] Neural Link Handshake Failed:", e);
         }
       };
       autoSync();
    }
  }, [user, isAuthReady, view, neuralResyncCount]);

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
  }, [isAuthReady, user, neuralResyncCount]);

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
    // Match against collector, validator, or summarizer names in logs
    const lastLog = logs.find(l => 
      l.agentName.toLowerCase().includes(agentId.toLowerCase().split(' ')[0]) ||
      l.agentName.toLowerCase().includes(agentId.toLowerCase().replace(' ', ''))
    );
    if (!lastLog) return 'idle';
    const timeDiff = Date.now() - new Date(lastLog.timestamp).getTime();
    if (timeDiff < 60000) return 'processing'; // Active for 1m after log
    if (timeDiff < 300000) return 'committed'; // Committed for 5m after log
    return 'idle';
  };

  // Auth Listener
  useEffect(() => {
    // Safety timeout to prevent infinite loading if Firebase hangs
    const safetyTimeout = setTimeout(() => {
      console.warn("[Auth] Safety threshold reached. Forcing auth readiness.");
      setIsAuthReady(true);
      setShowFailsafe(true);
    }, 3000);

    // Show manual override after 2 seconds
    const failsafeTimer = setTimeout(() => {
      setShowFailsafe(true);
    }, 2000);

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

      // If we have a user, we check permissions immediately for whitelisted emails
      const allowedEmails = ["jhansidharmana222@gmail.com", "chitti.bhargav3@gmail.com"];
      const userEmail = u.email?.toLowerCase().trim() || "";
      const isWhitelisted = allowedEmails.some(e => e.toLowerCase().trim() === userEmail);
      
      // Initial role assignment from whitelist to prevent UI lag
      setIsAdmin(isWhitelisted);
      setIsAuthReady(true);
      clearTimeout(safetyTimeout);

      try {
        const userSnap = await resilientGetDoc(doc(db, 'users', u.uid));
        const userData = userSnap.exists() ? userSnap.data() : null;
        const hasAdminRole = userData?.role === 'admin';
        
        // Final role assignment (merging whitelist and firestore role)
        // If they are whitelisted OR have the admin role in firestore, they are an admin.
        const finalizedAdminStatus = isWhitelisted || hasAdminRole;
        setIsAdmin(finalizedAdminStatus);
        
        // Debug telemetry for persistent state issues
        if (finalizedAdminStatus) {
          console.log(`[Auth] Root Authority established for node: ${userEmail}`);
        }
        
        setIsAccessDenied(false); 
      } catch (e: any) {
        const errorMsg = e.message?.toLowerCase() || "";
        const isTransient = errorMsg.includes("offline") || errorMsg.includes("unavailable");
        
        if (isTransient) {
          console.warn("[Auth] Permission check delayed (Neural Link establishing). Falling back to whitelist.");
        } else {
          console.error("[Auth] Permission check failed:", e);
        }
        
        // Fallback to whitelist only
        setIsAdmin(isWhitelisted);
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
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'intelligence'));

    let unsubTweets = () => {};
    let unsubLogs = () => {};
    let unsubResp = () => {};
    let unsubLedger = () => {};

    // Mission Operations - Open for authenticated users
    if (user) {
      const qTweets = query(collection(db, 'tweets'), orderBy('timestamp', 'desc'), limit(50));
      unsubTweets = onSnapshot(qTweets, (snap) => {
        setTweets(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tweet)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'tweets'));

      const qLogs = query(collection(db, 'agent_logs'), orderBy('timestamp', 'desc'), limit(100));
      unsubLogs = onSnapshot(qLogs, (snap) => {
        setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AgentLog)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'agent_logs'));

      const qResp = query(collection(db, 'responses'), orderBy('timestamp', 'desc'), limit(50));
      unsubResp = onSnapshot(qResp, (snap) => {
        setResponses(snap.docs.map(d => ({ id: d.id, ...d.data() } as AgentResponse)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'responses'));

      const qLedgerGlobal = query(collection(db, 'ledger'), orderBy('timestamp', 'desc'), limit(50));
      unsubLedger = onSnapshot(qLedgerGlobal, (snap) => {
        setLedger(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'ledger'));
    }

    return () => {
      unsubIntell();
      unsubTweets();
      unsubLogs();
      unsubResp();
      unsubLedger();
    };
  }, [isAdmin, user, neuralResyncCount]);

  // Connectivity Health - DEPRECATED
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/health');
        const data = await res.json();
        setStatusData(data);
        setGeminiConfigured(!!data.geminiConfigured);
        setSystemStatus(data.status);
        setMissingKeys(data.missingKeys || []);
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
      previousHash: userBlock.previousHash,
      timestamp: new Date()
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

      setMessages((prev) => [...prev, { id: modelMessageId, role: 'model', text: '', timestamp: new Date() }]);

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
    const newId = Math.random().toString(36).substring(2, 15);
    setActiveChatId(newId);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('arthashastra_active_chat', newId);
    }
    setMessages([]);
    setView('chat');
  };

  const loadConversation = async (id: string, shouldSetView = true) => {
    setActiveChatId(id);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('arthashastra_active_chat', id);
    }
    setIsLoading(true);
    const msgs = await getMessages(id);
    setMessages(msgs);
    if (shouldSetView) {
      setView('chat');
    }
    setIsLoading(false);
  };

  const handleApproveTweet = async (tweetId: string) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'tweets', tweetId), {
        userApproved: true,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'tweets');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (e: any) {
      console.error(e);
      const isIframe = window !== window.parent;
      if (isIframe) {
        setModalContext({
          title: "Sign in Blocked",
          message: `Authentication is blocked inside this preview window.\n\n${e.message}\n\nWould you like to open Arthashastra in a new tab to sign in?`,
          onConfirm: () => {
             window.open(window.location.href, '_blank');
             setModalContext(null);
          }
        });
      } else {
        setModalContext({
          title: "Sign in Failed",
          message: e.message,
          isError: true
        });
      }
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center p-34 font-sans overflow-y-auto">
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
      <React.Fragment>
        <AlertModal context={modalContext} onClose={() => setModalContext(null)} />
        <div className="min-h-screen bg-void flex flex-col items-center justify-center p-34 relative overflow-y-auto font-sans">
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
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-13 bg-neon-cyan text-void py-13 px-34 rounded-13 font-bold caps-modern hover:bg-neon-cyan/89 transition-all shadow-[0_0_21px_rgba(0,230,118,0.3)] hover:shadow-[0_0_34px_rgba(0,230,118,0.5)] group"
            >
              <div className="p-5 bg-void/13 rounded-full group-hover:bg-void/21 transition-colors">
                <LogIn className="w-13 h-13" />
              </div>
              Sign in with Google
            </button>

            <div className="grid grid-cols-1 gap-13">
              <button
                onClick={signInAnonymous}
                className="flex items-center justify-center gap-8 bg-void border border-parchment/13 text-parchment/55 py-13 px-13 rounded-13 font-bold caps-modern hover:bg-parchment/5 transition-all text-xs group"
              >
                <Ghost className="w-13 h-13 group-hover:text-neon-magenta transition-colors" />
                Use Anonymously
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
      </React.Fragment>
    );
  }

  return (
    <div className="min-h-screen bg-void text-parchment selection:bg-neon-cyan/34 selection:text-neon-cyan">
      <AlertModal context={modalContext} onClose={() => setModalContext(null)} />
      {/* Neural Background Overlay */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-neon-cyan/5 blur-[144px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-neon-magenta/5 blur-[144px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] mix-blend-overlay" />
      </div>

      <motion.header 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="fixed top-0 left-0 right-0 h-89 glass-panel border-b border-neon-cyan/13 z-50 flex items-center px-13 md:px-34 shadow-[0_5px_34px_rgba(0,230,118,0.05)]"
      >
        <div className="max-w-[1440px] mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-13 md:gap-21 min-w-0 flex-1">
            <div className="relative group cursor-pointer flex items-center gap-13 shrink-0 pr-8" onClick={() => setView('chat')}>
              <div className="group-hover:drop-shadow-[0_0_13px_rgba(0,230,118,0.8)] transition-all">
                <ArthashastraSymbol size={42} />
              </div>
              <div>
                <h1 className="text-[14px] sm:text-21 md:text-21 font-display font-bold text-neon-cyan uppercase tracking-tighter leading-none relative drop-shadow-[0_0_5px_rgba(0,230,118,0.5)]">
                  ARTHASHASTRA<span className="text-parchment/55 ml-2 drop-shadow-none">AI</span>
                </h1>
                <div className="flex items-center gap-2 sm:gap-5 mt-2 flex-wrap">
                   <div className={`w-3 h-3 rounded-full ${systemStatus === 'unconfigured' ? 'bg-cyber-red shadow-[0_0_5px_#FF2A2A]' : 'bg-neon-green shadow-[0_0_5px_#39FF14]'} animate-pulse`} />
                  <span className="text-[8px] caps-modern text-neon-cyan/89 tracking-[0.2em] sm:tracking-[0.34em]">
                    {systemStatus === 'unconfigured' ? 'Unconfigured' : 'Neural Economic Intelligence'}
                  </span>
                  {isAdmin && (
                    <span className="text-[8px] sm:ml-5 px-5 sm:px-8 py-2 bg-neon-magenta/13 border border-neon-magenta/55 text-neon-magenta rounded-full font-bold animate-pulse shadow-[0_0_8px_rgba(255,0,255,0.4)]">
                      ROOT
                    </span>
                  )}
                  <span className="text-[7px] sm:ml-5 px-3 sm:px-5 py-1 border border-neon-blue/34 text-neon-blue rounded bg-neon-blue/5 caps-modern shadow-[0_0_5px_rgba(10,132,255,0.3)]">Active</span>
                </div>
              </div>
            </div>

            <nav className="flex items-center gap-8 lg:gap-13 ml-8 md:ml-13 lg:ml-34 overflow-x-auto silk-scroll flex-1 pr-8 pb-3 min-w-0">
              {[
                { id: 'chat', icon: MessageSquare, label: t.navTerminal || 'Terminal' },
                { id: 'archive', icon: Archive, label: 'Dossier OS' },
                { id: 'ledger', icon: Clock, label: t.navArchive || 'Witness Archive' },
                { id: 'arena', icon: Landmark, label: t.navArena || 'Public Forum' },
                { id: 'warchest', icon: Coins, label: t.navWarchest || 'The War Chest' },
                { id: 'sovereignty', icon: Shield, label: t.navSovereignty || 'Data Sovereignty' },
                { id: 'threat', icon: ShieldAlert, label: 'Threat Oracle' },
                ...(isAdmin ? [
                  { id: 'dashboard', icon: LayoutDashboard, label: t.navDashboard || 'Command Hub', isAdmin: true },
                  { id: 'brain', icon: Zap, label: t.navBrain || 'Neural Assembly', isAdmin: true },
                  { id: 'routine', icon: Activity, label: t.navHealth || 'Fleet Status', isAdmin: true }
                ] : [])
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setView(item.id as any)}
                  className={`flex items-center gap-8 px-13 py-8 rounded-8 transition-all duration-377 group relative ${
                    view === item.id 
                      ? (item.isAdmin ? 'text-neon-magenta bg-neon-magenta/13 drop-shadow-[0_0_8px_rgba(255,0,255,0.5)]' : 'text-neon-cyan bg-neon-cyan/13 drop-shadow-[0_0_5px_rgba(0,230,118,0.5)]') 
                      : (item.isAdmin ? 'text-neon-magenta/34 hover:text-neon-magenta hover:bg-neon-magenta/5 border border-dashed border-neon-magenta/13' : 'text-neon-cyan/34 hover:text-neon-cyan hover:bg-neon-cyan/5')
                  }`}
                >
                  {item.id === 'dashboard' && tweets.filter(t => !t.processed && !t.userApproved && t.draftRebuttal).length > 0 && (
                    <span className="absolute -top-5 -right-5 w-13 h-13 bg-neon-magenta rounded-full flex items-center justify-center text-[8px] text-white font-bold animate-pulse shadow-[0_0_8px_#FF00FF]">
                      {tweets.filter(t => !t.processed && !t.userApproved && t.draftRebuttal).length}
                    </span>
                  )}
                  <item.icon className={`w-13 h-13 ${view === item.id ? (item.isAdmin ? 'text-neon-magenta' : 'text-neon-cyan') : (item.isAdmin ? 'group-hover:text-neon-magenta' : 'group-hover:text-neon-cyan')} transition-colors`} />
                  <span className={`text-[10px] caps-modern font-bold tracking-widest ${item.isAdmin ? 'italic' : ''}`}>{item.label}</span>
                  {view === item.id && (
                    <motion.div layoutId="nav-active" className={`absolute bottom-0 left-0 right-0 h-1 ${item.isAdmin ? 'bg-neon-magenta shadow-[0_0_13px_rgba(255,0,255,0.89)]' : 'bg-neon-cyan shadow-[0_0_13px_rgba(0,230,118,0.89)]'}`} />
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-8 md:gap-13 shrink-0">
            {user ? (
              <div className="flex items-center gap-5 sm:gap-8">
                <div className="w-34 h-34 rounded-full overflow-hidden border border-neon-cyan/34 ml-2 sm:ml-5 relative group shadow-[0_0_8px_rgba(0,230,118,0.3)]">
                  <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} alt="User" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-neon-cyan/0 group-hover:bg-neon-cyan/21 transition-colors" />
                </div>
                <button onClick={signOut} className="p-8 text-neon-cyan/55 hover:text-cyber-red transition-colors hover:drop-shadow-[0_0_5px_rgba(255,42,42,0.8)]">
                  <LogOut className="w-13 h-13" />
                </button>
              </div>
            ) : (
              <button 
                onClick={handleGoogleLogin}
                className="flex items-center gap-8 px-13 py-8 bg-neon-cyan text-void border border-neon-cyan hover:bg-neon-cyan/89 hover:shadow-[0_0_21px_rgba(0,230,118,0.8)] transition-all duration-233 text-13 caps-modern font-bold shadow-[0_0_13px_rgba(0,230,118,0.34)]"
              >
                <LogIn className="w-13 h-13" />
                <span className="hidden sm:inline">Access Intelligence</span>
              </button>
            )}
            <select 
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-void border border-neon-cyan/34 text-neon-cyan px-2 py-1 rounded text-[10px] caps-modern focus:outline-none focus:border-neon-cyan transition-all hidden sm:block"
            >
              {SUPPORTED_LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.native}</option>
              ))}
            </select>
          </div>
        </div>
      </motion.header>

      <main className="pt-89 pb-144">
        <div className="max-w-[1440px] mx-auto w-full px-21">
          {isAdmin && (systemStatus === 'unconfigured' || systemStatus === 'warn') && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="mb-34 overflow-hidden"
            >
              <div className={`glass-panel p-21 border ${systemStatus === 'unconfigured' ? 'border-cyber-red/34 bg-cyber-red/5 animate-pulse shadow-[0_0_21px_-5px_rgba(255,46,99,0.34)]' : 'border-amber-500/34 bg-amber-500/5 shadow-[0_0_21px_-5px_rgba(245,158,11,0.21)]'} rounded-13 flex items-start gap-21`}>
                <div className={`p-13 rounded-full ${systemStatus === 'unconfigured' ? 'bg-cyber-red/13 border-cyber-red/34' : 'bg-amber-500/13 border-amber-500/34'}`}>
                  <AlertTriangle className={`w-21 h-21 ${systemStatus === 'unconfigured' ? 'text-cyber-red drop-shadow-[0_0_5px_#FF2A2A]' : 'text-amber-500 drop-shadow-[0_0_5px_#F59E0B]'}`} />
                </div>
                <div className="flex-1">
                  <h3 className={`text-13 caps-modern font-bold ${systemStatus === 'unconfigured' ? 'text-cyber-red' : 'text-amber-500'} mb-5 tracking-widest uppercase`}>
                    {systemStatus === 'unconfigured' ? 'SYSTEM ADVISORY: NEURAL CALIBRATION' : 'SYSTEM WARNING: LIMITED LINKAGE'}
                  </h3>
                  <p className="text-13 text-parchment/89 mb-13 leading-relaxed">
                    {systemStatus === 'unconfigured' 
                      ? 'Telemetry sync is pending. This usually resolves automatically in the AI Studio environment.' 
                      : 'Non-critical links are missing. The system is functional for chat, but social agents are idle.'}
                  </p>
                  <div className="flex flex-wrap gap-13">
                    {missingKeys.map((key) => (
                      <div key={key} className={`px-13 py-5 rounded-8 bg-black/55 border border-white/5 text-[10px] font-mono ${systemStatus === 'unconfigured' ? 'shadow-[inset_0_0_10px_rgba(255,42,42,0.1)]' : 'shadow-[inset_0_0_10px_rgba(245,158,11,0.05)]'}`}>
                        <span className={`${systemStatus === 'unconfigured' ? 'text-cyber-red/55' : 'text-amber-500/55'} mr-5 font-bold`}>MISSING:</span> {key}
                      </div>
                    ))}
                  </div>
                  <div className="mt-21 flex flex-col gap-13">
                    <div className="flex flex-col gap-8">
                      <span className="text-[10px] text-parchment/34 italic">
                        {statusData?.debug?.lastError ? (
                          <div className="flex flex-col gap-4">
                            <div><span className="text-cyber-red font-bold">Neural Link Error:</span> {statusData.debug.lastError}</div>
                            {statusData.debug.trialErrors && statusData.debug.trialErrors.length > 1 && (
                              <div className="text-[9px] text-parchment/20 border-t border-parchment/10 pt-4 mt-2">
                                <div className="mb-2 uppercase tracking-widest opacity-50">Trial Logs:</div>
                                {statusData.debug.trialErrors.map((err: string, i: number) => (
                                  <div key={i} className="mb-1">{err}</div>
                                ))}
                              </div>
                            )}
                            {statusData.debug.lastError.includes('PERMISSION_DENIED') && (
                              <div className="mt-5 text-neon-cyan/55 not-italic">
                                Tip: Provisioning may be in progress. If this persists beyond 2 minutes, try clicking 'Set up Firebase' again or verify Firestore is enabled in the Firebase Console.
                              </div>
                            )}
                          </div>
                        ) : (
                          'Neural Critical: System Disconnected. Please ensure all required Secrets are configured in the platform settings.'
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'brain' && isAdmin ? (
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
                  <h3 className="text-34 caps-modern font-bold text-neon-cyan">LOGIN REQUIRED</h3>
                  <p className="text-13 text-parchment/89 leading-relaxed">
                    To track your 3 free absolute truth explanations, please sign in. Connect your credentials to proceed.
                  </p>
                  <button 
                    onClick={handleGoogleLogin}
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
                    <li className="flex items-center gap-8"><CheckCircle2 className="w-13 h-13 text-neon-magenta" /> GLOBAL INTEL EXPORT</li>
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
                        { time: 'T-01:20', task: 'Global Monitoring & Sentiment Audit', status: 'Cyclic' },
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
          ) : (view === 'brain' || view === 'routine' || view === 'dashboard') && !isAdmin ? (
            <div className="flex flex-col items-center justify-center py-144">
               <ShieldAlert className="w-55 h-55 text-cyber-red mb-21 animate-pulse" />
               <h2 className="text-21 caps-modern text-cyber-red tracking-widest uppercase">Perimeter Violation Detected</h2>
               <p className="text-13 text-parchment/55 mt-8">These intelligence pipes are restricted to Authorized Witness Agents only.</p>
               <div className="mt-34 flex items-center gap-13">
                 <button 
                   onClick={() => setView('chat')}
                   className="px-21 py-8 border border-neon-cyan/34 text-neon-cyan hover:bg-neon-cyan/13 transition-all rounded-8 caps-modern text-13"
                 >
                   Return to Public Terminal
                 </button>
               </div>
            </div>
          ) : view === 'arena' ? (
            <ErrorBoundary>
              <TheArena user={user} language={language} isAdmin={isAdmin} />
            </ErrorBoundary>
          ) : view === 'warchest' ? (
            <ErrorBoundary>
              <TheWarChest user={user} handlePayment={handlePayment} isLoading={isLoading} />
            </ErrorBoundary>
          ) : view === 'sovereignty' ? (
            <ErrorBoundary>
              <DataSovereignty user={user} />
            </ErrorBoundary>
          ) : view === 'threat' ? (
            <ErrorBoundary>
              <EconomicDisasterPredictor />
            </ErrorBoundary>
          ) : view === 'archive' ? (
            <ErrorBoundary>
              <ArchiveOS 
                onNavigateToChat={(id) => {
                  setActiveChatId(id);
                  setView('chat');
                }}
              />
            </ErrorBoundary>
          ) : view === 'ledger' ? (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-34 py-34">
                <div className="lg:col-span-1 flex flex-col gap-21 h-full min-h-[500px]">
                  <AitihyaHistory 
                    onSelectConversation={loadConversation} 
                    activeChatId={activeChatId} 
                    selectedDate={selectedDateFilter}
                    setSelectedDate={setSelectedDateFilter}
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
                              {(() => {
                                let resolvedData = block.data;
                                if (typeof resolvedData === 'string') {
                                  const trimmed = resolvedData.trim();
                                  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
                                    try {
                                      resolvedData = JSON.parse(trimmed);
                                    } catch (e) {
                                      // Keep as custom string
                                    }
                                  }
                                }

                                if (Array.isArray(resolvedData)) {
                                  return (
                                    <div className="space-y-8 mt-5">
                                      {resolvedData.map((item: any, idx: number) => (
                                        <div key={idx} className="p-10 bg-void/55 border border-white/8 rounded-8 font-mono text-[11px] leading-relaxed">
                                          {item.domain && (
                                            <div className="text-[9px] text-neon-cyan font-bold uppercase tracking-wider mb-3">
                                              📌 DOMAIN: {item.domain}
                                            </div>
                                          )}
                                          <div className="text-parchment/89 leading-normal">
                                            {item.content || item.insight || (typeof item === 'string' ? item : JSON.stringify(item))}
                                          </div>
                                          {item.source && (
                                            <div className="text-[10px] text-parchment/40 mt-5 border-t border-white/5 pt-3">
                                              <span className="text-neon-magenta/55 font-bold uppercase mr-2 text-[8px]">Source:</span> {item.source}
                                            </div>
                                          )}
                                          {item.confidenceScore && (
                                            <div className="text-[10px] text-green-400 font-bold mt-2">
                                              🛡️ Confidence: {item.confidenceScore}%
                                            </div>
                                          )}
                                          {item.enrichedContext && (
                                            <div className="text-[10px] text-parchment/55 italic mt-2 whitespace-pre-wrap border-t border-white/5 pt-3 leading-relaxed">
                                              Context Match: {item.enrichedContext}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  );
                                } else if (resolvedData && typeof resolvedData === 'object') {
                                  return (
                                    <div className="p-10 bg-void/55 border border-white/8 rounded-8 font-mono text-[11px] whitespace-pre-wrap text-parchment/80 leading-normal">
                                      {resolvedData.isApproved !== undefined ? (
                                        <div>
                                          <div className="text-green-400 font-bold mb-3 text-[10px] uppercase tracking-wider">⚖️ COMPLIANCE AUDIT DETAIL</div>
                                          <div className="mb-3 font-bold">Status: {resolvedData.isApproved ? "✅ APPROVED" : "❌ REJECTED"}</div>
                                          <p className="italic text-parchment/70">"{resolvedData.content}"</p>
                                        </div>
                                      ) : JSON.stringify(resolvedData, null, 2)}
                                    </div>
                                  );
                                } else {
                                  return (
                                    <div className="whitespace-pre-wrap font-sans text-parchment/80 leading-relaxed">
                                      {String(resolvedData)}
                                    </div>
                                  );
                                }
                              })()}
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
              <div className="flex items-center justify-between mb-21 p-13 bg-neon-cyan/13 border border-neon-cyan/55 rounded-13 shadow-[0_0_21px_rgba(0,230,118,0.2)]">
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                >
                  <h2 className="text-34 font-display font-bold text-neon-cyan uppercase tracking-tighter leading-none drop-shadow-[0_0_8px_rgba(0,230,118,0.6)]">Witness Command Center</h2>
                  <p className="text-[10px] caps-modern text-neon-magenta mt-5 flex items-center gap-8 font-bold border-t border-neon-magenta/13 pt-5 tracking-[0.21em]">
                    <Shield className="w-8 h-8 animate-pulse text-neon-magenta" />
                    ADMINISTRATIVE ACCESS: ROOT AUTHORITY ACTIVE
                  </p>
                </motion.div>
                <div className="flex items-center gap-13">
                  <div className="flex items-center gap-5 px-13 py-5 bg-neon-cyan/5 border border-neon-cyan/13 rounded-full text-[10px] text-neon-cyan font-bold uppercase tracking-widest">
                    <div className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse shadow-[0_0_5px_#00E676]" />
                    Cycle Frequency: 30m
                  </div>
                </div>
              </div>

              {/* Mission Visualization: The Architecture of Pipes */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-21 mb-34">
                {[
                  { id: 'monitor', label: 'Monitor Pipe', icon: Search, info: 'Scanning alternative intelligence sectors for targets.', status: 'Active', color: 'neon-cyan' },
                  { id: 'brain', label: 'Central Brain', icon: Zap, info: 'Triad Validation & Summarization Engine.', status: 'Processing', color: 'neon-blue' },
                  { id: 'dash', label: 'Witness Gate', icon: User, info: 'Human oversight: Review & Approve Rebuttals.', status: 'Awaiting', color: 'parchment' },
                  { id: 'broadcaster', label: 'Broadcast Pipe', icon: Globe, info: 'Execution of Approved Truth to public ledger.', status: 'Standby', color: 'neon-magenta' }
                ].map((gate, i) => (
                  <div key={gate.id} className={`glass-panel p-21 border border-${gate.color}/21 rounded-13 relative group hover:border-${gate.color}/55 transition-all`}>
                    <div className={`absolute top-0 right-0 p-8 text-${gate.color}/34 group-hover:text-${gate.color} transition-all`}>
                      <gate.icon className="w-21 h-21" />
                    </div>
                    <div className="flex items-start gap-13">
                      <div className="text-[10px] font-mono text-parchment/34">0{i+1}</div>
                      <div>
                        <h4 className={`text-13 caps-modern font-bold text-${gate.color} mb-5`}>{gate.label}</h4>
                        <p className="text-[10px] text-parchment/55 leading-tight mb-13">{gate.info}</p>
                        <div className="inline-flex items-center gap-5 px-8 py-2 bg-void/55 border border-white/5 rounded-full text-[8px] font-bold uppercase">
                          <div className={`w-1.5 h-1.5 rounded-full bg-${gate.color} ${gate.status === 'Processing' ? 'animate-pulse' : ''}`} />
                          {gate.status}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-21">
                {/* Rebuttal Approval Queue (The Critical Pipe Gate) */}
                <div className="lg:col-span-2 space-y-21">
                  <div className="glass-panel p-21 rounded-13 border-neon-cyan/13 shadow-[inset_0_0_20px_rgba(0,230,118,0.05)]">
                    <div className="flex items-center justify-between mb-21 border-b border-neon-cyan/21 pb-13">
                      <div className="flex items-center gap-8 text-neon-cyan">
                        <Globe className="w-21 h-21 drop-shadow-[0_0_5px_rgba(0,230,118,0.5)]" />
                        <h3 className="text-13 font-bold uppercase tracking-widest drop-shadow-[0_0_3px_rgba(0,230,118,0.3)]">Witness Approval Queue</h3>
                      </div>
                      <span className="text-[9px] caps-modern text-neon-cyan/55 px-13 py-5 bg-neon-cyan/5 border border-neon-cyan/13 rounded-full">
                        {tweets.filter(t => !t.processed && !t.userApproved && t.draftRebuttal).length} Actions Pending
                      </span>
                    </div>

                    <div className="space-y-13 max-h-[610px] overflow-y-auto silk-scroll pr-8">
                      {tweets.filter(t => !t.processed).length === 0 && (
                        <div className="py-89 text-center space-y-21 border border-dashed border-neon-cyan/13 rounded-13">
                          <div className="relative inline-block">
                            <Activity className="w-55 h-55 text-neon-cyan/13 mx-auto animate-spin-slow" />
                            <Shield className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-21 h-21 text-neon-cyan/55" />
                          </div>
                          <p className="text-[10px] caps-modern text-neon-cyan/34 tracking-widest leading-relaxed">
                            The Monitor Pipe is scanning high-value economic handles...<br/>
                            Status: Zero deceptions detected in current sector.
                          </p>
                        </div>
                      )}
                      
                      {tweets.filter(t => !t.processed).map((tweet) => (
                        <motion.div 
                          layout
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          key={tweet.id} 
                          className={`p-21 bg-void/34 border rounded-13 hover:shadow-[0_0_15px_rgba(0,230,118,0.1)] transition-all ${tweet.userApproved ? 'border-neon-magenta/34 shadow-[inset_0_0_21px_rgba(255,0,255,0.05)]' : 'border-neon-cyan/13'}`}
                        >
                          <div className="flex items-center justify-between mb-13">
                            <div className="flex items-center gap-13">
                              <div className="w-34 h-34 bg-neon-cyan/13 rounded-full flex items-center justify-center text-neon-cyan font-bold border border-neon-cyan/21 shadow-[0_0_10px_rgba(0,230,118,0.2)]">
                                {tweet.author?.[0]?.toUpperCase()}
                              </div>
                              <div>
                                <h4 className="text-13 font-bold text-neon-cyan drop-shadow-[0_0_3px_rgba(0,230,118,0.3)]">{tweet.author}</h4>
                                <p className="text-[9px] font-mono text-neon-cyan/34 italic">{new Date(tweet.timestamp).toLocaleString()}</p>
                              </div>
                            </div>
                            <div className={`px-13 py-3 rounded-full text-[9px] font-bold uppercase tracking-widest ${tweet.userApproved ? 'bg-neon-magenta/21 text-neon-magenta border border-neon-magenta/34' : 'bg-neon-cyan/13 text-neon-cyan border border-neon-cyan/34'}`}>
                              {tweet.userApproved ? 'Pipeline: Broadcasting' : 'Status: Evaluation Required'}
                            </div>
                          </div>

                          <div className="p-13 bg-black/34 border-l-2 border-neon-cyan/34 rounded-r-8 mb-13 italic text-13 text-parchment/89 leading-relaxed">
                            "{tweet.text}"
                          </div>
                          
                          {tweet.draftRebuttal && !tweet.userApproved && (
                            <div className="space-y-13">
                              <div className="p-13 bg-neon-cyan/5 border border-neon-cyan/21 rounded-8 relative overflow-hidden group/draft shadow-[inset_0_0_15px_rgba(0,230,118,0.03)]">
                                <div className="absolute top-0 left-0 bottom-0 w-1 bg-neon-cyan" />
                                <div className="flex items-center gap-8 text-[10px] text-neon-cyan font-bold uppercase mb-8">
                                  <Shield className="w-13 h-13" />
                                  Brain Drafted Rebuttal
                                </div>
                                <p className="text-13 font-mono text-neon-cyan drop-shadow-[0_0_2px_rgba(0,230,118,0.3)] leading-relaxed">
                                  {tweet.draftRebuttal}
                                </p>
                                <div className="mt-8 pt-8 border-t border-neon-cyan/13">
                                  <div className="flex items-center gap-5 text-[9px] text-parchment/34">
                                    <Database className="w-8 h-8" />
                                    Logic: {tweet.draftLogic || 'Calculated systemic counter-response.'}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-13">
                                <button 
                                  onClick={() => handleApproveTweet(tweet.id!)}
                                  className="flex-1 py-13 bg-neon-cyan text-void text-13 font-bold caps-modern hover:bg-white hover:text-black transition-all shadow-[0_0_21px_rgba(0,230,118,0.4)] hover:shadow-[0_0_34px_rgba(0,230,118,0.6)] rounded flex items-center justify-center gap-8"
                                >
                                  <User className="w-13 h-13" />
                                  Authorize Truth Broadcast
                                </button>
                                <button className="px-21 py-13 border border-cyber-red/34 text-cyber-red text-11 caps-modern hover:bg-cyber-red/5 transition-all rounded">
                                  Bypass
                                </button>
                              </div>
                            </div>
                          )}

                          {tweet.userApproved && (
                            <div className="flex items-center gap-13 p-13 bg-neon-magenta/5 border border-neon-magenta/34 rounded-8 animate-pulse text-[11px] text-neon-magenta font-bold uppercase tracking-widest shadow-[inset_0_0_15px_rgba(255,0,255,0.05)]">
                              <LayoutDashboard className="w-13 h-13" />
                              Intelligence moving through Broadcast Pipe...
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Operation Logs (The Pipe Telemetry) */}
                  <div className="glass-panel p-21 rounded-13 border-neon-cyan/13">
                    <div className="flex items-center gap-8 mb-21 text-neon-cyan drop-shadow-[0_0_5px_rgba(0,230,118,0.5)]">
                      <Activity className="w-21 h-21" />
                      <h3 className="text-13 font-bold uppercase tracking-widest drop-shadow-[0_0_3px_rgba(0,230,118,0.3)]">Pipe Telemetry</h3>
                    </div>
                    <div className="space-y-8 text-[10px] max-h-[300px] overflow-y-auto silk-scroll pr-8 mb-21">
                      {logs.slice(0, 30).map((log) => (
                        <div key={log.id} className="flex gap-13 py-5 border-b border-neon-cyan/13 group hover:bg-neon-cyan/5 transition-all">
                          <span className="text-neon-cyan/34 font-mono w-55 shrink-0">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                          <div className="flex-1 flex gap-8">
                            <span className="text-neon-cyan font-bold uppercase shrink-0">[{log.agentName}]</span>
                            <span className="text-parchment/89">{log.action}</span>
                            <span className={`ml-auto font-bold px-8 py-1 rounded-full text-[8px] ${log.status === 'success' ? 'text-void bg-neon-cyan shadow-[0_0_5px_#00E676]' : 'text-cyber-red border border-cyber-red/34'}`}>{log.status.toUpperCase()}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-21 border-t border-neon-cyan/21">
                      <h3 className="text-11 caps-modern text-neon-cyan mb-13 border-b border-neon-cyan/13 pb-8 flex items-center gap-8">
                        <Users className="w-13 h-13" />
                        Active Agent Fleet
                      </h3>
                      <div className="grid grid-cols-2 gap-8 max-h-[400px] overflow-y-auto silk-scroll pr-8">
                        {agents.map((agent) => (
                          <div key={agent.id} className="flex items-center justify-between p-8 bg-neon-cyan/5 rounded-5 border border-neon-cyan/13 hover:border-neon-cyan/55 transition-all group">
                            <div className="min-w-0">
                               <p className="text-[10px] font-mono text-parchment/89 group-hover:text-neon-cyan truncate">{agent.domain}</p>
                               <p className="text-[8px] caps-modern text-neon-cyan/55">{agent.role}</p>
                            </div>
                            <div className={`w-3 h-3 rounded-full ${(() => {
                              const s = getAgentStatus(agent.domain);
                              if (s === 'processing') return 'bg-neon-green animate-pulse shadow-[0_0_8px_#39FF14]';
                              if (s === 'committed') return 'bg-neon-blue shadow-[0_0_5px_#00E5FF]';
                              return 'bg-neon-cyan/34';
                            })()}`} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sidebar: System & Intelligence Insight */}
                <div className="space-y-21">
                  <div className="glass-panel p-21 rounded-13 border-neon-cyan/13 bg-neon-cyan/5 shadow-[inset_0_0_21px_rgba(0,230,118,0.05)]">
                    <h3 className="text-13 caps-modern text-neon-cyan mb-13 flex items-center gap-8 border-b border-neon-cyan/13 pb-8">
                      <Globe className="w-13 h-13" />
                      Neural Link Health
                    </h3>
                    <div className="space-y-13">
                      <div className="flex justify-between items-center bg-void/55 p-8 rounded border border-neon-cyan/13">
                        <span className="text-[10px] caps-modern text-parchment/55 tracking-widest">Aitihya Sync</span>
                        <div className="w-3 h-3 rounded-full bg-neon-green shadow-[0_0_8px_#39FF14] animate-pulse" />
                      </div>
                      
                      <div className="flex justify-between items-center bg-void/55 p-8 rounded border border-neon-cyan/13">
                        <span className="text-[10px] caps-modern text-parchment/55 tracking-widest">Gemini Engine</span>
                        <div className={`w-3 h-3 rounded-full ${geminiConfigured ? 'bg-neon-green shadow-[0_0_8px_#39FF14]' : 'bg-cyber-red shadow-[0_0_8px_#FF2A2A]'} animate-pulse`} />
                      </div>
                      
                      {!geminiConfigured && (
                        <p className="text-[8px] italic text-cyber-red/89 px-5">Missing: USER_GEMINI_KEY in Secrets</p>
                      )}
                    </div>
                  </div>

                  <div className="glass-panel p-21 rounded-13 border-neon-magenta/13">
                    <h3 className="text-13 caps-modern text-neon-magenta mb-13 flex items-center gap-8 border-b border-neon-magenta/13 pb-8">
                      <Blocks className="w-13 h-13" />
                      Broadcast History
                    </h3>
                    <div className="space-y-8 max-h-[400px] overflow-y-auto silk-scroll pr-5">
                      {intelligence.filter(i => i.isBroadcasted).slice(0, 10).map((item, idx) => (
                        <div key={idx} className="p-13 bg-neon-magenta/5 border border-neon-magenta/13 rounded-8 group hover:border-neon-magenta/55 transition-all">
                          <div className="flex justify-between items-start mb-5">
                            <span className="text-[8px] caps-modern text-neon-magenta/55"># {idx + 1} | BROADCASTED</span>
                            <Globe className="w-10 h-10 text-neon-magenta/34 group-hover:text-neon-magenta transition-colors" />
                          </div>
                          <p className="text-[11px] text-parchment/89 leading-relaxed line-clamp-2">{item.content}</p>
                          <div className="mt-5 flex items-center justify-between">
                            <span className="text-[8px] font-mono text-neon-magenta/34 italic">{new Date(item.timestamp).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      ))}
                      {intelligence.filter(i => i.isBroadcasted).length === 0 && (
                        <div className="py-34 text-center opacity-34 italic text-[10px]">
                          Waiting for first broadcast cycle...
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="glass-panel p-21 rounded-13 border-neon-cyan/21 bg-neon-cyan/5 shadow-[0_0_21px_rgba(0,230,118,0.05)]">
                    <h3 className="text-13 caps-modern text-neon-cyan mb-8 drop-shadow-[0_0_3px_rgba(0,230,118,0.5)]">Operator Directive</h3>
                    <p className="text-[11px] text-parchment/89 leading-relaxed font-sans italic opacity-80">
                      "As the Absolute Witness, your role is the final gate. The agents find, analyze, and draft—but you authorize the truth to enter the public square. Monitor the pipes regularly to ensure maximum systemic impact."
                    </p>
                  </div>
                </div>
              </div>

              {/* Neural Rotation Command Center & Permanent Archive Ledger */}
              <ErrorBoundary>
                <div className="mt-34">
                  <AgentRotationPanel />
                </div>
              </ErrorBoundary>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-34 min-h-[70vh]">
              {view === 'gazette' ? (
                <div className="lg:col-span-4 h-full relative overflow-hidden glass-panel border border-neon-cyan/21 rounded-13 min-h-[80vh]">
                  <ErrorBoundary>
                    <ArthashastraGazette />
                  </ErrorBoundary>
                </div>
              ) : (
                <>
                  {user && (
                    <div className={`lg:col-span-1 flex flex-col gap-13 ${isHistoryOpen ? 'fixed inset-0 z-[70] bg-void/95 p-34 pt-144 lg:p-0 lg:relative lg:inset-auto lg:z-auto lg:bg-transparent' : 'hidden'} lg:flex border-r border-neon-cyan/13 pr-21 animate-in fade-in slide-in-from-left-5 duration-377 min-h-[500px]`}>
                  {isHistoryOpen && (
                    <button 
                      onClick={() => setIsHistoryOpen(false)}
                      className="lg:hidden absolute top-89 right-34 p-13 text-neon-cyan hover:text-[#00ffff] transition-colors"
                    >
                      <X className="w-34 h-34" />
                    </button>
                  )}
                  
                  <div className="flex-1 flex flex-col gap-21 overflow-hidden">
                    <button 
                      onClick={() => setView('chat')}
                      className={`w-full flex items-center gap-13 p-13 rounded-8 transition-all border ${view === 'chat' ? 'bg-neon-cyan/21 border-neon-cyan text-neon-cyan shadow-[0_0_8px_rgba(0,240,255,0.2)]' : 'bg-white/3 border-transparent text-parchment/55 hover:bg-white/8'}`}
                    >
                      <MessageSquare className="w-13 h-13" />
                      <span className="text-13 caps-modern">Neural Chat</span>
                    </button>

                    <button 
                      onClick={() => setView('gazette')}
                      className={`w-full flex items-center gap-13 p-13 rounded-8 transition-all border ${(view as any) === 'gazette' ? 'bg-neon-magenta/21 border-neon-magenta text-neon-magenta shadow-[0_0_8px_rgba(255,0,255,0.2)]' : 'bg-white/3 border-transparent text-parchment/55 hover:bg-white/8'}`}
                    >
                      <Newspaper className="w-13 h-13" />
                      <span className="text-13 caps-modern">Gazette Dossier</span>
                    </button>

                    <div className="flex-1 overflow-hidden flex flex-col">
                      <AitihyaHistory 
                        onSelectConversation={(id) => {
                          loadConversation(id);
                          setIsHistoryOpen(false);
                        }} 
                        activeChatId={activeChatId} 
                        selectedDate={selectedDateFilter}
                        setSelectedDate={setSelectedDateFilter}
                      />
                    </div>

                    <div className="bg-neon-cyan/5 border border-neon-cyan/13 rounded-8 p-13">
                      <h3 className="text-[10px] caps-modern text-neon-cyan mb-8 flex items-center gap-8">
                        <Users className="w-10 h-10" />
                        AGENT FLEET STATUS
                      </h3>
                      <div className="space-y-5 max-h-[200px] overflow-y-auto silk-scroll pr-5">
                        {agents.map((agent) => {
                          const status = getAgentStatus(agent.domain);
                          return (
                            <div key={agent.id} className="flex items-center justify-between py-3 border-b border-neon-cyan/5">
                              <span className="text-[9px] font-mono text-parchment/55 truncate">{agent.domain.split(' ')[0]}</span>
                              <div className={`w-2 h-2 rounded-full ${
                                status === 'processing' ? 'bg-neon-green animate-pulse shadow-[0_0_5px_#39FF14]' :
                                status === 'committed' ? 'bg-neon-green/55' : 'bg-void border border-neon-cyan/13'
                              }`} title={status} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      startNewChat();
                      setIsHistoryOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-13 p-13 glass-panel border border-neon-cyan/34 text-neon-cyan hover:bg-neon-cyan/8 hover:shadow-[0_0_8px_rgba(0,230,118,0.3)] transition-all rounded-8 caps-modern text-13 mt-auto"
                  >
                    <Plus className="w-13 h-13" />
                    New Thread
                  </button>
                </div>
              )}
              
              <div className={`${isAdmin ? 'lg:col-span-3' : 'lg:col-span-4'} flex flex-col overflow-y-auto silk-scroll pr-13 custom-scrollbar min-h-[500px]`}>
                {messages.length === 0 ? (
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
                  <span className="relative z-10 text-neon-cyan drop-shadow-[0_0_3px_rgba(0,230,118,0.5)]">Neural Assembly Synchronized</span>
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
                  {selectedDateFilter !== 'all' && (
                    <span className="px-8 py-3 rounded bg-neon-cyan/15 border border-neon-cyan text-neon-cyan text-[8px] font-bold tracking-wider uppercase animate-pulse flex items-center gap-5">
                      📅 {selectedDateFilter} FILTER
                    </span>
                  )}
                  {user && (
                    <button 
                      onClick={() => setIsHistoryOpen(true)}
                      className="lg:hidden ml-8 p-5 bg-neon-cyan/13 border border-neon-cyan/34 rounded text-neon-cyan hover:bg-neon-cyan/21 transition-all"
                    >
                      <Clock className="w-13 h-13" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-13">
                  <span className="text-[10px] font-mono text-neon-cyan/55">ID: {Math.random().toString(36).substring(7).toUpperCase()}</span>
                  <button 
                    onClick={async () => {
                      if (messages.length === 0 || isSharing) return;
                      setIsSharing(true);
                      try {
                        const sharedId = await createSharedTranscript(messages);
                        const shareUrl = `${window.location.origin}/share/${sharedId}`;
                        await navigator.clipboard.writeText(shareUrl);
                        alert(`Shareable link copied to clipboard: ${shareUrl}`);
                      } catch (e) {
                        alert("Failed to share transcript");
                      } finally {
                        setIsSharing(false);
                      }
                    }}
                    disabled={isSharing || messages.length === 0}
                    className="flex items-center gap-5 px-8 py-3 border border-neon-cyan/55 text-neon-cyan/89 hover:bg-neon-cyan hover:text-void transition-colors rounded text-[10px] caps-modern disabled:opacity-50"
                  >
                    {isSharing ? <Loader2 className="w-10 h-10 animate-spin" /> : <Share2 className="w-10 h-10" />}
                    SHARE THREAD
                  </button>
                </div>
              </div>
              <AnimatePresence>
                {(() => {
                  const filteredActiveMessages = messages.filter(msg => {
                    if (selectedDateFilter === 'all') return true;
                    if (!msg.timestamp) return true; // keep system/unsaved elements
                    return getMsgDateStr(msg.timestamp) === selectedDateFilter;
                  });

                  if (filteredActiveMessages.length === 0 && messages.length > 0) {
                    return (
                      <div className="p-34 border border-dashed border-neon-cyan/21 bg-void/50 rounded-13 text-center space-y-13 my-21">
                        <Calendar className="w-34 h-34 text-neon-cyan/34 mx-auto animate-pulse" />
                        <h3 className="text-13 caps-modern text-neon-cyan font-bold tracking-wider">No Messages Block on {selectedDateFilter}</h3>
                        <p className="text-[11px] text-parchment/55 max-w-md mx-auto leading-relaxed">
                          This specific thread contains no recorded witness statements on <strong className="text-neon-cyan">{selectedDateFilter}</strong>.
                        </p>
                        <button
                          onClick={() => setSelectedDateFilter('all')}
                          className="px-13 py-8 bg-neon-cyan/10 hover:bg-neon-cyan/21 text-neon-cyan border border-neon-cyan/34 rounded-8 text-[10px] caps-modern font-bold transition-all"
                        >
                          Clear Temporal Filter
                        </button>
                      </div>
                    );
                  }

                  return filteredActiveMessages.map((msg) => (
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
                            <span className="text-[8px] font-mono opacity-34 ml-5">
                              {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
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
                      <div className="mt-8 pt-8 border-t border-neon-cyan/21 flex items-center justify-between gap-5 opacity-55 hover:opacity-100 transition-all">
                        <div className="flex items-center gap-5">
                          {msg.previousHash && (
                            <>
                              <Blocks className="w-10 h-10 text-neon-cyan" />
                              <span className="text-[8px] font-mono text-neon-cyan">LINK: {msg.previousHash.substring(0, 8)}...</span>
                            </>
                          )}
                        </div>
                        <div className="flex gap-8">
                          <button 
                            onClick={async () => {
                              await navigator.clipboard.writeText(msg.text);
                              alert("Message copied to clipboard.");
                            }}
                            className="flex items-center gap-2 px-3 py-1 bg-neon-cyan/10 border border-neon-cyan/21 hover:bg-neon-cyan/20 rounded text-[9px] text-neon-cyan transition-colors"
                          >
                            <Copy className="w-8 h-8" />
                            COPY
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                const sharedId = await createSharedTranscript([msg]);
                                const shareUrl = `${window.location.origin}/share/${sharedId}`;
                                await navigator.clipboard.writeText(shareUrl);
                                alert(`Shareable link copied to clipboard: ${shareUrl}`);
                              } catch(e) {
                                alert("Failed to share message");
                              }
                            }}
                            className="flex items-center gap-2 px-3 py-1 bg-neon-cyan/10 border border-neon-cyan/21 hover:bg-neon-cyan/20 rounded text-[9px] text-neon-cyan transition-colors"
                          >
                            <Share2 className="w-8 h-8" />
                            SHARE
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                  ));
                })()}
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
        </>
      )}
    </div>
  )}
  </div>
</main>

      {/* Input Area */}
      {view === 'chat' && (
        <div className="fixed bottom-[89px] md:bottom-34 right-13 md:right-34 z-[60] flex flex-col items-end gap-5 md:gap-8 w-[calc(100vw-26px)] md:w-auto h-auto max-w-[800px]">
          <motion.div 
            initial={false}
            animate={{ 
              width: (input.length > 0 || isLoading) ? '100%' : '100%',
            }}
            whileHover={{ width: '100%' }}
            className="md:!w-auto glass-panel p-5 rounded-13 border-neon-cyan/34 flex items-end gap-0 relative group overflow-hidden min-h-[55px] shadow-[0_0_21px_rgba(0,230,118,0.3)] transition-all duration-377 focus-within:shadow-[0_0_34px_rgba(0,230,118,0.5)] focus-within:border-neon-cyan md:[&]:!w-[min(800px,calc(100vw-68px))]"
          >
            <div className="absolute inset-0 bg-neon-cyan/5 opacity-0 group-focus-within:opacity-100 transition-opacity rounded-13 pointer-events-none" />
            
            <div className="w-34 h-34 md:w-34 md:h-34 flex items-center justify-center flex-shrink-0 text-neon-cyan group-hover:text-neon-cyan/89 transition-colors drop-shadow-[0_0_5px_rgba(0,230,118,0.5)]">
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
              className="flex-1 bg-transparent border-none focus:ring-0 text-13 p-8 md:p-13 py-13 text-parchment placeholder:text-neon-cyan/34 font-medium relative z-10 min-w-0 opacity-100 transition-all duration-377 resize-none silk-scroll w-full"
              style={{ minHeight: '34px' }}
            />

            <button
              onClick={() => handleSend()}
              disabled={isLoading || !input.trim()}
              className="w-34 h-34 md:w-34 md:h-34 self-center md:self-end mb-5 mr-5 bg-neon-cyan text-void flex items-center justify-center rounded-8 hover:bg-[#00ffff] transition-all duration-377 disabled:opacity-21 disabled:grayscale shadow-[0_0_13px_rgba(0,230,118,0.6)] flex-shrink-0"
            >
              {isLoading ? <Loader2 className="w-21 h-21 animate-spin" /> : <Send className="w-21 h-21" />}
            </button>
          </motion.div>
          <p className="text-right text-[8px] md:text-[9px] caps-modern text-neon-cyan/55 pr-13 opacity-55 group-hover:opacity-100 transition-opacity drop-shadow-[0_0_2px_rgba(0,230,118,0.3)]">
            {t.footer}
          </p>
        </div>
      )}
    </div>
  );
}

