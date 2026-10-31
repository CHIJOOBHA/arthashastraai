import React from 'react';
import { Link2, AlertTriangle } from 'lucide-react';
import { fmt, getTranslation } from '../translations';

interface LogicProofProps {
  text: string;
  language?: string;
}

/** Counts the links in the "**Sources**" block the server appends to every answer. */
export function countSources(text: string): number {
  const idx = text.lastIndexOf('**Sources**');
  if (idx === -1) return 0;
  const block = text.slice(idx);
  const urls = new Set<string>();
  for (const m of block.matchAll(/\]\((https?:\/\/[^)\s]+)\)|(?:^|\s)(https?:\/\/\S+)/g)) {
    urls.add(m[1] || m[2]);
  }
  return urls.size;
}

/** Shows only true information: how many source links this answer carries. */
export const LogicProof: React.FC<LogicProofProps> = ({ text, language = 'en' }) => {
  if (!text.trim()) return null;
  const t = getTranslation(language);
  const n = countSources(text);

  return (
    <div
      className={`mt-13 px-13 py-8 rounded-8 flex items-center gap-8 border text-[10px] ${
        n > 0 ? 'bg-neon-cyan/5 border-neon-cyan/21 text-neon-cyan/89' : 'bg-amber-500/5 border-amber-500/34 text-amber-400'
      }`}
    >
      {n > 0 ? <Link2 className="w-13 h-13 shrink-0" aria-hidden /> : <AlertTriangle className="w-13 h-13 shrink-0" aria-hidden />}
      <span>{n > 0 ? fmt(t.sourcesCount, { n }) : t.noSources}</span>
    </div>
  );
};
