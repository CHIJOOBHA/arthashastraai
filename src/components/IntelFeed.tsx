import { ExternalLink, BookOpen, Database, Globe } from 'lucide-react';
import { toDate, type IntelligenceItem } from '../lib/firebase';
import type { Source } from '../lib/api';
import type { Translation } from '../translations';

/** An `intelligence` document as written by server/agents.ts. Older docs may lack the newer fields. */
export interface IntelItem extends IntelligenceItem {
  headline?: string;
  country?: string;
  sources?: Source[];
  metadata?: {
    severity?: string;
    confidence?: string;
    category?: string;
    agentName?: string;
    [k: string]: unknown;
  };
}

const SEVERITY_STYLE: Record<string, string> = {
  High: 'bg-cyber-red/13 text-cyber-red border-cyber-red/34',
  Medium: 'bg-amber-500/13 text-amber-400 border-amber-500/34',
  Low: 'bg-neon-cyan/13 text-neon-cyan border-neon-cyan/34',
};

const safeUrl = (u: unknown) => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : null);
const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
};

export function formatWhen(value: unknown, withDate = true): string {
  const d = toDate(value);
  if (!d) return '';
  return withDate
    ? d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/** Whether a story is bad news, good news or mixed for ordinary people (set by the explainer agent). */
const DIRECTION: Record<string, { label: string; className: string }> = {
  harm: { label: 'Harm', className: 'text-red-400' },
  protection: { label: 'Protection', className: 'text-emerald-400' },
  reassurance: { label: 'Reassuring', className: 'text-emerald-400' },
  mixed: { label: 'Mixed', className: 'text-amber-400' },
};

/** One published story: headline, impact, verification text and its source links. */
export function IntelCard({ item, t, onOpenExplanation }: { item: IntelItem; t: Translation; onOpenExplanation?: (id: string) => void }) {
  const severity = typeof item.metadata?.severity === 'string' ? item.metadata.severity : undefined;
  const direction = typeof item.metadata?.direction === 'string' ? DIRECTION[item.metadata.direction] : undefined;
  const sources = (Array.isArray(item.sources) ? item.sources : []).filter((s) => safeUrl(s?.url));
  const headline = item.headline || '';
  // `content` is "headline — impact"; show only the impact part under the headline.
  const body = headline && item.content?.startsWith(headline) ? item.content.slice(headline.length).replace(/^\s*—\s*/, '') : item.content;

  return (
    <article className="p-13 bg-void/34 border border-neon-cyan/13 rounded-8 hover:border-neon-cyan/55 transition-all group">
      <div className="flex flex-wrap justify-between items-start gap-8 mb-5">
        <div className="flex flex-wrap items-center gap-8 min-w-0">
          {item.metadata?.category && (
            <span className="text-[10px] uppercase tracking-widest text-neon-cyan/55 font-bold">{String(item.metadata.category)}</span>
          )}
          {direction && (
            <span className={`text-[10px] uppercase tracking-widest font-bold ${direction.className}`}>{direction.label}</span>
          )}
          {item.country && (
            <span className="inline-flex items-center gap-3 text-[10px] text-parchment/55">
              <Globe className="w-10 h-10" aria-hidden />
              {item.country}
            </span>
          )}
        </div>
        {severity && (
          <span className={`px-8 py-2 rounded border text-[9px] uppercase tracking-widest font-bold ${SEVERITY_STYLE[severity] || SEVERITY_STYLE.Low}`}>
            {severity} {t.impact}
          </span>
        )}
      </div>
      {headline && <h4 className="text-13 font-bold text-parchment mb-3 leading-snug">{headline}</h4>}
      {body && <p className="text-13 text-parchment/80 leading-relaxed">{body}</p>}

      {sources.length > 0 && (
        <ul className="mt-8 space-y-2" aria-label={t.sources}>
          {sources.slice(0, 5).map((s, i) => (
            <li key={i}>
              <a
                href={safeUrl(s.url)!}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-5 text-[11px] text-neon-cyan/89 hover:text-neon-cyan underline-offset-2 hover:underline break-all"
              >
                <ExternalLink className="w-10 h-10 shrink-0" aria-hidden />
                {s.title || hostOf(s.url)}
                <span className="text-parchment/34 no-underline">({hostOf(s.url)})</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-8">
        <span className="text-[9px] font-mono text-neon-cyan/34">
          {formatWhen(item.timestamp)} · {t.aiGenerated}
          {item.metadata?.confidence ? ` · ${String(item.metadata.confidence)}` : ''}
        </span>
        {item.explanationId && onOpenExplanation && (
          <button
            onClick={() => onOpenExplanation(item.explanationId!)}
            className="inline-flex items-center gap-5 px-8 py-3 border border-neon-cyan/34 rounded text-[10px] uppercase tracking-widest text-neon-cyan hover:bg-neon-cyan/13 transition-colors"
          >
            <BookOpen className="w-10 h-10" aria-hidden />
            {t.readExplanation}
          </button>
        )}
      </div>
    </article>
  );
}

export function IntelList({
  items,
  t,
  onOpenExplanation,
  max,
}: {
  items: IntelItem[];
  t: Translation;
  onOpenExplanation?: (id: string) => void;
  max?: number;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-55 opacity-55 italic text-center">
        <Database className="w-34 h-34 mb-13" aria-hidden />
        <p className="text-13">{t.feedEmpty}</p>
      </div>
    );
  }
  return (
    <div className="space-y-13">
      {(max ? items.slice(0, max) : items).map((item) => (
        <IntelCard key={item.id} item={item} t={t} onOpenExplanation={onOpenExplanation} />
      ))}
    </div>
  );
}

/** Public feed page. */
export function IntelFeedView({ items, t, onOpenExplanation }: { items: IntelItem[]; t: Translation; onOpenExplanation: (id: string) => void }) {
  return (
    <div className="py-34 max-w-3xl mx-auto space-y-21">
      <div className="border-b border-neon-cyan/21 pb-13">
        <h2 className="text-34 font-display font-bold text-neon-cyan uppercase tracking-tighter">{t.feedTitle}</h2>
        <p className="text-[11px] text-parchment/55 mt-5 leading-relaxed">{t.feedSubtitle}</p>
      </div>
      <IntelList items={items} t={t} onOpenExplanation={onOpenExplanation} />
    </div>
  );
}
