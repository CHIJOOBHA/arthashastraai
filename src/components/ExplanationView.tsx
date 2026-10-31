import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Database, Loader2 } from 'lucide-react';
import { Markdown } from './Markdown';
import { LogicProof } from './LogicProof';
import { ApiError, getExplanation, type ExplanationResponse } from '../lib/api';
import { fmt, type Translation } from '../translations';
import { formatWhen } from './IntelFeed';

interface ExplanationViewProps {
  id: string;
  t: Translation;
  language: string;
  /** Called once when the server says the free views are used up. */
  onPaywall: () => void;
  /** Called after a successful load (e.g. to refresh the account counters). */
  onLoaded?: () => void;
  onBack: () => void;
}

/** Loads one explanation exactly once per id (guards against double-charging a free view). */
export function ExplanationView({ id, t, language, onPaywall, onLoaded, onBack }: ExplanationViewProps) {
  const [data, setData] = useState<ExplanationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requested = useRef<string | null>(null);
  const callbacks = useRef({ onPaywall, onLoaded });
  callbacks.current = { onPaywall, onLoaded };

  useEffect(() => {
    // StrictMode mounts effects twice in development; this ref makes the request happen once per id.
    if (requested.current === id) return;
    requested.current = id;
    let alive = true;
    setData(null);
    setError(null);
    getExplanation(id)
      .then((res) => {
        if (!alive) return;
        setData(res);
        callbacks.current.onLoaded?.();
      })
      .catch((e: unknown) => {
        if (!alive) return;
        if (e instanceof ApiError && e.code === 'PAYWALL') {
          callbacks.current.onPaywall();
          return;
        }
        setError(e instanceof Error && e.message ? e.message : t.explFailed);
        requested.current = null; // allow a retry by re-opening
      });
    return () => {
      alive = false;
    };
  }, [id, t.explFailed]);

  return (
    <div className="py-34 max-w-3xl mx-auto space-y-21">
      <button onClick={onBack} className="inline-flex items-center gap-5 text-[11px] uppercase tracking-widest text-neon-cyan/80 hover:text-neon-cyan">
        <ArrowLeft className="w-13 h-13" aria-hidden />
        {t.back}
      </button>
      <div className="flex flex-wrap items-center justify-between gap-13 border-b border-neon-cyan/21 pb-13">
        <div>
          <h2 className="text-34 font-display font-bold text-neon-cyan uppercase tracking-tighter">{t.explTitle}</h2>
          <p className="text-[11px] text-neon-cyan/55 mt-5">{t.explSubtitle}</p>
        </div>
        {data && !data.isSubscribed && data.remainingFree !== null && (
          <div className="px-13 py-5 bg-neon-cyan/5 border border-neon-cyan/34 rounded-full text-[10px] text-neon-cyan font-bold uppercase tracking-widest">
            {fmt(t.explFreeLeft, { n: data.remainingFree })}
          </div>
        )}
      </div>

      {error ? (
        <div role="alert" className="p-21 border border-cyber-red/34 bg-cyber-red/5 rounded-13 text-13 text-cyber-red">
          {error}
        </div>
      ) : !data ? (
        <div className="py-89 text-center space-y-13 opacity-55">
          <Loader2 className="w-34 h-34 mx-auto animate-spin" aria-hidden />
          <p>{t.explLoading}</p>
        </div>
      ) : (
        <article className="glass-panel p-21 md:p-34 border border-neon-cyan/13 rounded-13 space-y-13 bg-void/55">
          <Markdown className="prose prose-invert prose-neon max-w-none text-parchment/89 prose-p:leading-relaxed prose-headings:text-neon-cyan">
            {data.explanation.content}
          </Markdown>
          <LogicProof text={data.explanation.content} language={language} />
          <div className="pt-13 border-t border-neon-cyan/13 flex flex-wrap justify-between items-center gap-8 text-[10px] uppercase tracking-widest text-neon-cyan/55">
            <span className="inline-flex items-center gap-5">
              <Database className="w-10 h-10" aria-hidden />
              {t.aiGenerated}
            </span>
            {data.explanation.timestamp && <span>{formatWhen(data.explanation.timestamp)}</span>}
          </div>
        </article>
      )}
    </div>
  );
}
