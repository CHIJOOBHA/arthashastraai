import React, { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { motion } from 'motion/react';
import { Activity, Database, Loader2, Radar, AlertCircle, Info } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, toDate } from '../lib/firebase';
import { riskRadar, ApiError } from '../lib/api';
import { Markdown } from './Markdown';

interface RiskRadarProps {
  user?: User | null;
  language?: string;
  isAdmin?: boolean;
  isSubscribed?: boolean;
  onSubscribe?: () => void;
}

interface RadarItem {
  id: string;
  content: string;
  timestamp?: unknown;
}

const DISCLAIMER = 'AI-generated, based on the linked sources — not financial advice.';
const MAX_FOCUS = 200;

/** "Economic Risk Radar": an AI-written overview of current economic risks for ordinary people, with sources. */
export function EconomicDisasterPredictor({ user, language = 'English' }: RiskRadarProps) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState('');
  const [history, setHistory] = useState<RadarItem[]>([]);

  const uid = user?.uid;
  useEffect(() => {
    if (!uid) {
      setHistory([]);
      return;
    }
    // where-only query (no orderBy) so no composite index is needed; sorted on the client.
    const q = query(collection(db, 'threat_matrices'), where('userId', '==', uid));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => {
          const data = d.data({ serverTimestamps: 'estimate' });
          return { id: d.id, content: typeof data.content === 'string' ? data.content : '', timestamp: data.timestamp } as RadarItem;
        });
        items.sort((a, b) => (toDate(b.timestamp)?.getTime() ?? 0) - (toDate(a.timestamp)?.getTime() ?? 0));
        setHistory(items.slice(0, 10));
      },
      (err) => console.error('[RiskRadar] history error:', err),
    );
    return () => unsubscribe();
  }, [uid]);

  const generateReport = async () => {
    if (!user || loading) return;
    setLoading(true);
    setReport(null);
    setError(null);
    try {
      const res = await riskRadar(language, focus.trim() || undefined);
      setReport(res.content || 'The AI returned an empty report. Please try again.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not create the radar right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col p-13 md:p-21 lg:p-34 relative min-h-[60vh] max-w-5xl mx-auto">
      <div className="flex items-center gap-13 mb-21 z-10">
        <div className="w-[44px] h-[44px] rounded-full bg-cyber-red/21 border border-cyber-red flex items-center justify-center text-cyber-red shadow-[0_0_13px_rgba(255,42,42,0.5)] shrink-0">
          <Radar className="w-21 h-21" />
        </div>
        <div>
          <h2 className="text-21 font-bold text-cyber-red caps-modern drop-shadow-[0_0_8px_rgba(255,42,42,0.8)]">Economic Risk Radar</h2>
          <p className="text-13 text-parchment/55">Current economic risks for ordinary people, from recent news, with sources</p>
        </div>
      </div>

      <div className="z-10 bg-void/89 p-21 border-2 border-dashed border-cyber-red/34 rounded-13 mb-21 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyber-red to-transparent opacity-55" />
        <p className="text-13 text-parchment/89 font-mono leading-relaxed mb-13">
          The AI searches recent news and data for economic pressures that can hit ordinary households — prices, jobs, loans, savings, housing — and explains each one with links to its sources. It describes risks; it does not predict the future.
        </p>

        {user ? (
          <div className="flex flex-col md:flex-row gap-13 md:items-end">
            <label className="flex-1 block">
              <span className="text-[10px] caps-modern text-parchment/55 block mb-5">Optional focus (a country, sector or topic)</span>
              <input
                type="text"
                value={focus}
                maxLength={MAX_FOCUS}
                onChange={(e) => setFocus(e.target.value.slice(0, MAX_FOCUS))}
                placeholder="e.g. rent in big cities, food prices in Kenya, credit card debt"
                className="w-full bg-void border border-cyber-red/34 rounded-8 px-13 py-8 text-13 text-parchment focus:outline-none focus:border-cyber-red placeholder:text-parchment/34"
                disabled={loading}
              />
              <span className="text-[10px] text-parchment/34 font-mono block mt-3 text-right">{focus.length}/{MAX_FOCUS}</span>
            </label>
            <button
              onClick={generateReport}
              disabled={loading}
              className="flex items-center justify-center gap-8 px-21 py-13 bg-cyber-red text-void w-full md:w-auto font-bold caps-modern border border-cyber-red hover:bg-void hover:text-cyber-red transition-all duration-377 shadow-[0_0_13px_rgba(255,42,42,0.5)] hover:shadow-[0_0_21px_rgba(255,42,42,0.8)] disabled:opacity-55 disabled:cursor-not-allowed md:mb-[18px]"
            >
              {loading ? <Loader2 className="w-13 h-13 animate-spin" /> : <Activity className="w-13 h-13" />}
              <span>{loading ? 'Searching recent sources...' : 'Run Risk Radar'}</span>
            </button>
          </div>
        ) : (
          <p className="text-13 text-cyber-red/89 caps-modern">Sign in to run the Risk Radar.</p>
        )}

        {error && (
          <div className="mt-13 flex items-center gap-8 p-13 border border-rose-950 bg-rose-950/21 rounded-8 text-rose-400 text-13">
            <AlertCircle className="w-13 h-13 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {report && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="z-10 bg-void/89 p-21 border-2 border-neon-cyan/55 rounded-13 mb-21 relative overflow-hidden shadow-[0_0_21px_rgba(0,240,255,0.2)]"
        >
          <div className="flex items-center gap-8 mb-13 border-b border-neon-cyan/21 pb-8 flex-wrap">
            <Activity className="w-13 h-13 text-neon-cyan" />
            <span className="text-13 caps-modern font-bold text-neon-cyan">LATEST RADAR</span>
          </div>
          <p className="flex items-start gap-5 text-[11px] text-parchment/55 mb-13">
            <Info className="w-[11px] h-[11px] mt-[2px] shrink-0" />
            {DISCLAIMER}
          </p>
          <Markdown className="markdown-body prose prose-invert max-w-none prose-headings:text-cyber-red prose-strong:text-cyber-red prose-a:text-cyber-red text-parchment/89 prose-code:text-cyber-red/89 font-mono max-h-[55vh] overflow-y-auto silk-scroll pr-8">
            {report}
          </Markdown>
        </motion.div>
      )}

      {user && (
        <div className="z-10 mt-34 flex-1">
          <h3 className="text-13 font-bold text-cyber-red caps-modern drop-shadow-[0_0_8px_rgba(255,42,42,0.8)] mb-13 flex items-center gap-8 uppercase">
            <Database className="w-13 h-13" />
            Your past radars (latest 10)
          </h3>

          {history.length > 0 ? (
            <div className="flex flex-col gap-21">
              {history.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 13 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx, 5) * 0.1 }}
                  className="glass-panel p-21 border border-cyber-red/21 rounded-13 relative bg-cyber-red/5"
                >
                  <div className="text-[10px] text-cyber-red/89 font-mono mb-8 opacity-55">
                    {toDate(item.timestamp)?.toLocaleString() ?? 'Saving...'} · {DISCLAIMER}
                  </div>
                  <Markdown className="markdown-body prose prose-invert max-w-none prose-p:text-13 prose-headings:text-13 prose-headings:font-bold prose-headings:text-cyber-red prose-strong:text-cyber-red prose-a:text-cyber-red text-parchment/55 prose-code:text-cyber-red/89 font-mono">
                    {item.content}
                  </Markdown>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="glass-panel p-21 border border-cyber-red/13 rounded-13 text-center opacity-55">
              <Database className="w-21 h-21 mx-auto mb-8 text-cyber-red" />
              <p className="text-13 font-mono text-parchment/89">No radars yet.</p>
              <p className="text-[10px] text-parchment/55">Radars you run are saved to your account and listed here.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
