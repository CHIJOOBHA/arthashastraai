import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, setDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { generateArenaResponse } from '../lib/gemini';
import { User, Send, Landmark, Zap, Scale, BookOpen, Upload, FileText, AlertCircle, Trash2, Calendar } from 'lucide-react';
import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { ErrorBoundary } from './ErrorBoundary';
import { ArenaChat } from './ArenaChat';

interface TheArenaProps {
  user: any;
  language: string;
  isAdmin: boolean;
}

export function TheArena({ user, language, isAdmin }: TheArenaProps) {
  const [activeDebate, setActiveDebate] = useState<any | null>(null);
  const [debates, setDebates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number } | null>(null);

  // Sync active debate with latest real-time debates updates
  useEffect(() => {
    if (activeDebate) {
      const updated = debates.find(d => d.id === activeDebate.id);
      if (updated && (updated.status !== activeDebate.status || updated.aiResponse !== activeDebate.aiResponse)) {
        setActiveDebate(updated);
      }
    }
  }, [debates, activeDebate]);

  const getTodayDateStr = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const getDebateDateStr = (debate: any) => {
    if (debate.argumentDate) {
      return debate.argumentDate;
    }
    let d = new Date();
    if (debate.createdAt) {
      if (debate.createdAt.toDate) {
        d = debate.createdAt.toDate();
      } else if (debate.createdAt instanceof Date) {
        d = debate.createdAt;
      } else if (typeof debate.createdAt === 'number') {
        d = new Date(debate.createdAt);
      } else if (debate.createdAt.seconds) {
        d = new Date(debate.createdAt.seconds * 1000);
      }
    }
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const formatDisplayDate = (dateStr: string) => {
    const today = getTodayDateStr();
    if (dateStr === today) {
      return "Current Cycle (Today)";
    }
    
    const d = new Date(dateStr + "T12:00:00");
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    
    // Check if it was yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yyyy = yesterday.getFullYear();
    const mm = String(yesterday.getMonth() + 1).padStart(2, '0');
    const dd = String(yesterday.getDate()).padStart(2, '0');
    const yesterdayStr = `${yyyy}-${mm}-${dd}`;
    
    if (dateStr === yesterdayStr) {
      return `Yesterday (${d.toLocaleDateString(language === 'en' ? 'en-US' : 'en-US', { month: 'short', day: 'numeric' })})`;
    }
    
    return d.toLocaleDateString(language === 'en' ? 'en-US' : 'en-US', options);
  };

  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateStr());

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    setUploadError(null);
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      setUploadError("File too large. Max 3MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') {
        const cleanedText = text.trim();
        if (cleanedText.length === 0) {
          setUploadError("The file context is completely empty.");
          return;
        }

        setInput(cleanedText);
        setUploadedFile({ name: file.name, size: file.size });
      } else {
        setUploadError("Format unrecognized. Please upload a plain text, CSV, JSON, or Markdown file.");
      }
    };

    reader.onerror = () => {
      setUploadError("Failed to read document.");
    };

    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const clearUploadedFile = () => {
    setUploadedFile(null);
    setUploadError(null);
    setInput('');
  };

  useEffect(() => {
    const q = query(collection(db, 'debates'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDebates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'debates');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSubmitting || !user) return;

    setIsSubmitting(true);
    const argument = input.trim();
    
    setInput('');
    setUploadedFile(null);
    setUploadError(null);
    
    const newId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    const dateStr = getTodayDateStr();
    
    const newDebate = {
      id: newId,
      userId: user.uid,
      userName: user.email?.split('@')[0] || 'Anonymous Witness',
      userArgument: argument,
      status: 'pending',
      createdAt: serverTimestamp(),
      argumentDate: dateStr
    };

    try {
      // Create pending debate with permanent date field and argument structure
      await setDoc(doc(db, 'debates', newId), newDebate);
      
      // Navigate to current active date to display user submission
      setSelectedDate(dateStr);
      
      // Instantly open the active discussion room with pending loading indicator
      setActiveDebate({
        ...newDebate,
        createdAt: new Date()
      });

      // Fetch AI response
      const aiVerdict = await generateArenaResponse(argument, language);

      // Resolve debate
      const updatedDebate = {
        ...newDebate,
        aiResponse: aiVerdict,
        status: 'resolved' as const,
        createdAt: new Date()
      };
      
      await updateDoc(doc(db, 'debates', newId), {
        aiResponse: aiVerdict,
        status: 'resolved'
      });
      
      setActiveDebate(updatedDebate);

    } catch (err) {
      console.error("Debate Error:", err);
      // Fallback update in case AI fails
      try {
        const errorVerdict = "System Error: The Absolute Witness is currently overloaded and could not process this argument. It has been logged for future evaluation.";
        await updateDoc(doc(db, 'debates', newId), {
          aiResponse: errorVerdict,
          status: 'resolved'
        });
        setActiveDebate(prev => prev ? { ...prev, aiResponse: errorVerdict, status: 'resolved' } : null);
      } catch (innerErr) {
        console.error("Failed to update debate with error status:", innerErr);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (activeDebate) {
    return (
      <ErrorBoundary>
        <ArenaChat
          debate={activeDebate}
          user={user}
          language={language}
          onBack={() => setActiveDebate(null)}
        />
      </ErrorBoundary>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-34 space-y-34 px-21">
      <div className="text-center space-y-13 mb-55">
        <div className="inline-flex items-center justify-center p-21 bg-cyan-900/13 border hover:border-cyan-500/55 border-cyan-900/34 rounded-full mb-13 relative group transition-all">
          <div className="absolute inset-0 bg-cyan-500 rounded-full opacity-0 group-hover:opacity-10 transition-opacity blur-xl"></div>
          <Landmark className="w-44 h-44 text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.3)]" />
        </div>
        <h2 className="text-55 font-display font-medium text-cyan-400 uppercase tracking-widest drop-shadow-[0_0_13px_rgba(34,211,238,0.2)]">The Public Forum</h2>
        <p className="text-13 font-sans text-parchment/89 max-w-2xl mx-auto leading-relaxed border-t border-cyan-900/34 pt-13 mt-13">
          A secure space for objective evaluation. Present your arguments regarding policies, leaders, or economic beliefs for public scrutiny and logical analysis by the Absolute Witness.
        </p>
      </div>

      {!user ? (
        <div className="glass-panel p-34 text-center border-cyan-900/21 bg-void/55">
          <p className="text-13 caps-modern text-cyan-400/89">You must establish a neural identity (login) to participate in the forum.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="glass-panel p-21 md:p-34 border-cyan-900/34 shadow-[0_0_34px_rgba(34,211,238,0.05)] relative">
          <div className="absolute -top-[1px] left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/34 to-transparent"></div>
          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="State your argument for formal evaluation..."
              className="w-full bg-void border border-cyan-900/34 rounded-8 p-13 text-13 text-parchment font-sans focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/55 min-h-[144px] resize-y placeholder:text-parchment/34"
              disabled={isSubmitting}
            />
            <div className="absolute bottom-13 right-13 text-[10px] text-parchment/34 font-mono">
              {input.length.toLocaleString()} characters
            </div>
          </div>

          {/* Secure Document Drag & Drop / Select Upload Zone */}
          <div 
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`mt-13 p-13 border border-dashed rounded-8 transition-all flex flex-col md:flex-row items-center justify-between gap-13 bg-void/34 ${
              dragActive 
                ? 'border-cyan-400 bg-cyan-900/10 shadow-[0_0_13px_rgba(0,240,255,0.15)]' 
                : 'border-cyan-900/34 hover:border-cyan-500/34'
            }`}
          >
            <div className="flex items-center gap-13 w-full md:w-auto">
              {uploadedFile ? (
                <div className="flex items-center gap-8 text-cyan-400">
                  <FileText className="w-21 h-21" />
                  <div className="text-left">
                    <p className="text-11 font-bold uppercase tracking-wider truncate max-w-[200px] md:max-w-[300px]">
                      {uploadedFile.name}
                    </p>
                    <p className="text-[10px] text-cyan-400/55 font-mono">
                      {(uploadedFile.size / 1024).toFixed(1)} KB Loaded
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-8 text-parchment/55">
                  <Upload className="w-21 h-21 text-cyan-500/55" />
                  <div className="text-left">
                    <p className="text-11 font-medium caps-modern">
                      Drag & Drop Document Here
                    </p>
                    <p className="text-[9px] text-parchment/34 font-sans">
                      Supports .txt, .md, .csv, .json, .log (unlimited characters)
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-13 w-full md:w-auto justify-end">
              {uploadError && (
                <span className="text-[9px] font-medium text-rose-400 flex items-center gap-4 bg-rose-950/21 border border-rose-950 px-8 py-4 rounded-4 max-w-[200px] md:max-w-xs truncate" title={uploadError}>
                  <AlertCircle className="w-13 h-13" /> {uploadError}
                </span>
              )}
              
              <label className="cursor-pointer px-13 py-8 bg-cyan-950/34 hover:bg-cyan-900/34 border border-cyan-800/55 rounded-6 text-11 text-cyan-400 hover:text-cyan-300 font-bold tracking-wider uppercase transition-all whitespace-nowrap">
                Browse Files
                <input 
                  type="file" 
                  className="hidden" 
                  onChange={handleFileChange}
                  accept=".txt,.md,.csv,.json,.log,.js,.ts,.html,.css,.xml"
                />
              </label>

              {uploadedFile && (
                <button
                  type="button"
                  onClick={clearUploadedFile}
                  className="p-8 text-rose-400/55 hover:text-rose-400 hover:bg-rose-950/21 border border-transparent hover:border-rose-950 rounded-6 transition-all"
                  title="Clear document"
                >
                  <Trash2 className="w-13 h-13" />
                </button>
              )}
            </div>
          </div>

          <div className="mt-13 flex justify-between items-center">
            <p className="text-[10px] text-cyan-400/55 caps-modern hidden md:block">
              Notice: All submissions are logged for public transparency. Unlimited character support.
            </p>
            <button
              type="submit"
              disabled={isSubmitting || !input.trim()}
              className="px-34 py-13 bg-cyan-900 text-cyan-100 hover:bg-cyan-800 rounded-8 font-bold caps-modern text-13 flex items-center gap-8 shadow-[0_0_21px_rgba(34,211,238,0.2)] transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase border border-cyan-700"
            >
              {isSubmitting ? (
                <>
                  <Zap className="w-13 h-13 animate-pulse" />
                  EVALUATING
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

      {/* Date Navigation / Temporal Archive */}
      <div className="glass-panel p-21 border-cyan-900/34 bg-void/55 space-y-13 mt-55">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-13 border-b border-cyan-900/21 pb-13">
          <div className="flex items-center gap-8">
            <Calendar className="w-18 h-18 text-cyan-400" />
            <h4 className="text-13 caps-modern font-bold text-cyan-100 tracking-wider">
              TEMPORAL DEBATE INDEX
            </h4>
          </div>
          <div className="flex items-center gap-8">
            <span className="text-[10px] text-parchment/55 font-mono">SELECT RECORD CYCLE:</span>
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedDate(e.target.value);
                }
              }}
              className="bg-void border border-cyan-900/55 hover:border-cyan-400 rounded px-8 py-4 text-11 text-cyan-400 font-mono focus:outline-none focus:border-cyan-400 transition-colors"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-8 overflow-x-auto max-h-[144px] pr-8 custom-scrollbar pt-4">
          {(() => {
            const activeDates = Array.from(new Set([
              getTodayDateStr(),
              ...debates.map(d => getDebateDateStr(d))
            ])).sort((a, b) => b.localeCompare(a));

            return activeDates.map((dateStr) => {
              const count = debates.filter(d => getDebateDateStr(d) === dateStr).length;
              const isSelected = selectedDate === dateStr;
              return (
                <button
                  type="button"
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`flex items-center gap-8 px-13 py-8 rounded-6 text-11 font-mono transition-all border ${
                    isSelected 
                      ? 'bg-cyan-950/55 border-cyan-400 text-cyan-300 shadow-[0_0_8px_rgba(0,240,255,0.15)]' 
                      : 'bg-void/55 border-cyan-900/34 text-parchment/55 hover:text-cyan-400 hover:border-cyan-800/55'
                  }`}
                >
                  <span>{formatDisplayDate(dateStr)}</span>
                  {count > 0 && (
                    <span className={`px-6 py-1 rounded-full text-[9px] font-bold ${
                      isSelected ? 'bg-cyan-900 text-cyan-300' : 'bg-void text-parchment/34'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            });
          })()}
        </div>
      </div>

      <div className="space-y-34">
        <div className="flex items-center justify-between border-b border-cyan-900/34 pb-13">
          <h3 className="text-21 font-display font-medium text-parchment">
            Submissions for {formatDisplayDate(selectedDate)}
          </h3>
          <span className="text-11 font-mono text-cyan-400/55">
            {debates.filter(debate => getDebateDateStr(debate) === selectedDate).length} Records Found
          </span>
        </div>
        
        {loading ? (
          <div className="text-center py-55 italic text-parchment/55">Retrieving records...</div>
        ) : debates.filter(debate => getDebateDateStr(debate) === selectedDate).length === 0 ? (
          <div className="text-center py-55 italic text-parchment/55 border border-dashed border-cyan-900/34 rounded-13 px-21">
            <p className="text-13 mb-4 text-parchment/55">No arguments submitted for this cycle yet.</p>
            {selectedDate === getTodayDateStr() ? (
              <p className="text-11 text-cyan-400/55 caps-modern">Today's cycle is a fresh slate. Submit an argument above to secure today's database block.</p>
            ) : (
              <p className="text-11 text-parchment/34">This historical archive cycle is empty. You can browse or select another timeline date.</p>
            )}
          </div>
        ) : (
          debates
            .filter(debate => getDebateDateStr(debate) === selectedDate)
            .map((debate) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={debate.id}
                className="glass-panel border-cyan-900/34 relative overflow-hidden"
              >
                <div className="p-21 md:p-34 border-b border-cyan-900/34 bg-void/34">
                  <div className="flex items-center justify-between mb-13 border-l-2 border-cyan-500/55 pl-8">
                    <div className="flex items-center gap-8">
                      <User className="w-13 h-13 text-cyan-400/55" />
                      <span className="text-13 caps-modern font-bold text-cyan-100 tracking-widest uppercase">{debate.userName}</span>
                    </div>
                    <span className="text-[10px] text-parchment/34 font-mono hidden md:block">
                      {debate.createdAt?.toDate ? debate.createdAt.toDate().toLocaleString() : new Date().toLocaleString()}
                    </span>
                  </div>
                  <div className="prose prose-invert max-w-none text-parchment/89 font-sans text-13 leading-relaxed opacity-90 pl-13 line-clamp-3">
                    <ReactMarkdown>{debate.userArgument}</ReactMarkdown>
                  </div>
                </div>

                <div className="p-21 md:p-34 bg-cyan-900/5 flex flex-col md:flex-row md:items-center justify-between gap-21 relative">
                  <div className="flex-1">
                    <div className="flex items-center gap-8 mb-13">
                      <span className="text-13 caps-modern font-bold text-cyan-400 tracking-widest uppercase drop-shadow-[0_0_5px_rgba(34,211,238,0.2)]">Analysis & Verdict</span>
                    </div>
                    {debate.status === 'pending' ? (
                      <div className="flex items-center gap-8 text-[11px] caps-modern text-cyan-400/55 italic animate-pulse py-13">
                        <Zap className="w-13 h-13" />
                        Processing structural validity...
                      </div>
                    ) : (
                      <div className="prose prose-invert max-w-none prose-p:leading-relaxed text-parchment font-sans text-13 prose-headings:text-cyan-400 prose-strong:text-cyan-400/89 relative z-10 pl-13 border-l-2 border-cyan-500/34 line-clamp-3">
                        <ReactMarkdown>{debate.aiResponse}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                  {debate.status !== 'pending' && (
                    <button
                      type="button"
                      onClick={() => setActiveDebate(debate)}
                      className="px-21 py-13 bg-cyan-950/34 hover:bg-cyan-900/34 border border-cyan-900 rounded-8 font-bold caps-modern text-11 text-cyan-400 hover:text-cyan-300 uppercase shrink-0 transition-all shadow-[0_0_15px_rgba(34,211,238,0.05)] cursor-pointer"
                    >
                      CHALLENGE VERDICT
                    </button>
                  )}
                </div>
              </motion.div>
            ))
        )}
      </div>
    </div>
  );
}
