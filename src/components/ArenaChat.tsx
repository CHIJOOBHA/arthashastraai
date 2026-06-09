import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { sendMessage } from '../lib/gemini';
import { User, Send, Landmark, Zap, ArrowLeft, AlertCircle, Scale, MessageSquare, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';

interface ArenaChatMessage {
  id: string;
  userId: string;
  role: 'user' | 'model';
  text: string;
  createdAt: any;
}

interface ArenaChatProps {
  debate: any;
  user: any;
  language: string;
  onBack: () => void;
}

export function ArenaChat({ debate, user, language, onBack }: ArenaChatProps) {
  const [messages, setMessages] = useState<ArenaChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputMsg, setInputMsg] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [streamedResponse, setStreamedResponse] = useState('');
  const [chatError, setChatError] = useState<string | null>(null);
  
  const bottomRef = useRef<HTMLDivElement>(null);

  // Monitor chat database state
  useEffect(() => {
    if (!debate?.id) return;

    setLoading(true);
    const messagesRef = collection(db, 'debates', debate.id, 'chat');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          role: data.role,
          text: data.text,
          createdAt: data.createdAt
        };
      }) as ArenaChatMessage[];
      
      setMessages(msgs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `debates/${debate.id}/chat`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [debate?.id]);

  // Handle continuous auto-scroll to latest updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamedResponse]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() || isSending || !user || !debate) return;

    const userText = inputMsg.trim();
    setInputMsg('');
    setIsSending(true);
    setChatError(null);
    setStreamedResponse('');

    const userMessageId = 'msg_' + Date.now() + Math.random().toString(36).substring(2, 9);
    const aiMessageId = 'ai_' + Date.now() + Math.random().toString(36).substring(2, 9);

    try {
      // 1. Persist User Follow-up Message to Firestore
      const userMessageData = {
        id: userMessageId,
        userId: user.uid,
        role: 'user' as const,
        text: userText,
        createdAt: serverTimestamp()
      };

      await setDoc(doc(db, 'debates', debate.id, 'chat', userMessageId), userMessageData);

      // 2. Build full conversation history (Prepending Original Argument Context)
      const conversationalHistory = [
        { role: 'user', parts: [{ text: `ORIGINAL DEBATE ARGUMENT SUBMITTED FOR EVALUATION:\n"${debate.userArgument}"` }] },
        { role: 'model', parts: [{ text: `ABSOLUTE WITNESS INITIAL ANALYSIS & VERDICT:\n${debate.aiResponse}` }] }
      ];

      // Append previous interactive follow-ups
      messages.forEach((msg) => {
        conversationalHistory.push({
          role: msg.role,
          parts: [{ text: msg.text }]
        });
      });

      // 3. Request Streaming Response from Gemini Model
      const textStream = sendMessage(conversationalHistory, userText, language);
      let accumulatedResponse = '';

      for await (const chunk of textStream) {
        if (chunk?.text) {
          accumulatedResponse += chunk.text;
          setStreamedResponse(accumulatedResponse);
        }
      }

      if (!accumulatedResponse.trim()) {
        throw new Error("No responses received from the Absolute Witness.");
      }

      // 4. Persist AI Response back to Firestore ledger
      const aiMessageData = {
        id: aiMessageId,
        userId: user.uid,
        role: 'model' as const,
        text: accumulatedResponse,
        createdAt: serverTimestamp()
      };

      await setDoc(doc(db, 'debates', debate.id, 'chat', aiMessageId), aiMessageData);
      setStreamedResponse('');

    } catch (err: any) {
      console.error("Interactive Chat Error:", err);
      setChatError(err.message || "Failed to communicate with Absolute Witness.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="glass-panel border-cyan-900/44 bg-void/89 p-13 md:p-21 max-w-4xl mx-auto space-y-21 shadow-[0_0_55px_rgba(34,211,238,0.08)] relative">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/55 to-transparent"></div>
      
      {/* Header Panel */}
      <div className="flex items-center justify-between border-b border-cyan-900/34 pb-13">
        <button
          onClick={onBack}
          className="flex items-center gap-8 px-13 py-8 rounded-6 bg-cyan-950/21 border border-cyan-900/55 text-11 text-cyan-400 font-bold tracking-wider hover:bg-cyan-900/34 transition-all uppercase"
        >
          <ArrowLeft className="w-13 h-13" />
          BACK TO INDEX
        </button>
        <div className="flex items-center gap-8 text-[11px] font-mono text-cyan-400/55">
          <MessageSquare className="w-13 h-13" />
          ACTIVE DISCUSSION LAYER
        </div>
      </div>

      {/* Target Subject Summary Block */}
      <div className="p-13 bg-cyan-950/13 border border-cyan-950 rounded-8 flex flex-col md:flex-row gap-13 md:items-center justify-between">
        <div className="space-y-4">
          <p className="text-[10px] caps-modern text-cyan-400/55 font-bold">TOPIC UNDER SCRUTINY</p>
          <p className="text-13 text-parchment font-medium line-clamp-2 italic">
            "{debate.userArgument}"
          </p>
        </div>
        <div className="flex items-center gap-8 whitespace-nowrap self-end md:self-auto">
          <span className="text-[10px] text-cyan-500 font-mono tracking-wider">CREATOR: {debate.userName}</span>
        </div>
      </div>

      {/* Core Discussion Area */}
      <div className="space-y-13 min-h-[300px] max-h-[500px] overflow-y-auto pr-8 custom-scrollbar pt-8">
        {/* Step 1: Display initial formal Analysis & Verdict */}
        <div className="p-21 bg-cyan-900/5 border border-cyan-900/21 rounded-8 space-y-13 relative">
          <div className="absolute top-13 right-13 text-[10px] text-cyan-400/34 font-mono select-none flex items-center gap-4">
            <Scale className="w-11 h-11" />
            STEP 1: RESPONSE
          </div>
          <div className="flex items-center gap-8 border-b border-cyan-900/21 pb-8">
            <Landmark className="w-15 h-15 text-cyan-400" />
            <h5 className="text-12 caps-modern font-bold text-cyan-400 tracking-widest uppercase">
              ABSOLUTE WITNESS ANALYSIS & VERDICT
            </h5>
          </div>
          <div className="prose prose-invert max-w-none text-13 text-parchment/89 font-sans leading-relaxed">
            <ReactMarkdown>{debate.aiResponse}</ReactMarkdown>
          </div>
        </div>

        {/* Interactive follow-up messages */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col gap-4 max-w-[85%] ${
              msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
            }`}
          >
            <div className="flex items-center gap-4 text-[10px] text-parchment/34 font-mono">
              {msg.role === 'user' ? (
                <>
                  <span className="text-cyan-400/55">You</span>
                  <User className="w-8 h-8" />
                </>
              ) : (
                <>
                  <Landmark className="w-8 h-8 text-cyan-400" />
                  <span className="text-cyan-400">Absolute Witness</span>
                </>
              )}
            </div>
            <div
              className={`p-13 rounded-8 text-13 font-sans leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-cyan-950/34 border border-cyan-900 text-parchment pr-21 pl-13 text-right'
                  : 'bg-void border border-cyan-950 text-parchment py-13 px-18 border-l-2 border-l-cyan-500/55'
              }`}
            >
              <ReactMarkdown>{msg.text}</ReactMarkdown>
            </div>
          </div>
        ))}

        {/* Streaming/typing response container in real-time */}
        {streamedResponse && (
          <div className="flex flex-col gap-4 max-w-[85%] mr-auto items-start">
            <div className="flex items-center gap-4 text-[10px] text-cyan-400 font-mono">
              <Landmark className="w-8 h-8" />
              <span>Absolute Witness is translating...</span>
            </div>
            <div className="p-13 rounded-8 bg-void border border-cyan-950 text-parchment py-13 px-18 border-l-2 border-l-cyan-500 animate-pulse">
              <ReactMarkdown>{streamedResponse}</ReactMarkdown>
            </div>
          </div>
        )}

        {isSending && !streamedResponse && (
          <div className="flex items-center gap-8 text-[11px] caps-modern text-cyan-400/55 italic animate-pulse py-8 pl-13">
            <Loader2 className="w-13 h-13 animate-spin text-cyan-500" />
            Vetting mathematical proof paths ...
          </div>
        )}

        {loading && (
          <div className="text-center py-21 font-mono text-[11px] text-cyan-400/34">
            Securing discussion stream ...
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <form onSubmit={handleSend} className="border-t border-cyan-900/34 pt-13">
        <div className="flex flex-col gap-8">
          {chatError && (
            <div className="p-13 bg-rose-950/21 border border-rose-950/55 rounded-8 flex items-center gap-8 text-rose-400 text-11">
              <AlertCircle className="w-15 h-15 shrink-0" />
              <span>{chatError}</span>
            </div>
          )}

          <div className="flex gap-8 items-center bg-void border border-cyan-900/34 rounded-8 p-4 focus-within:border-cyan-500 focus-within:ring-1 focus-within:ring-cyan-500/55 transition-all">
            <input
              type="text"
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              placeholder="Ask a deep follow-up or challenge this verdict..."
              className="flex-1 bg-transparent border-0 p-8 text-13 text-parchment font-sans focus:outline-none placeholder:text-parchment/34"
              disabled={isSending}
            />
            <button
              type="submit"
              disabled={isSending || !inputMsg.trim()}
              className="px-18 py-8 bg-cyan-900 text-cyan-100 hover:bg-cyan-800 rounded-6 font-bold caps-modern text-11 flex items-center gap-6 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-cyan-700 uppercase"
            >
              <Send className="w-11 h-11" />
              CHALLENGE
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
