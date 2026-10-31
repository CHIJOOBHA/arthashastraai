import React, { useEffect, useState } from 'react';
import { getSharedTranscript, SharedTranscriptData } from '../lib/chatStore';
import { Markdown } from './Markdown';
import { ArthashastraSymbol } from './ArthashastraSymbol';

export function SharedTranscript({ sharedId }: { sharedId: string }) {
  const [data, setData] = useState<SharedTranscriptData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!sharedId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    getSharedTranscript(sharedId)
      .then((d) => {
        if (active) setData(d);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sharedId]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-void text-parchment flex items-center justify-center">
        <div className="text-center animate-pulse">
          <ArthashastraSymbol size={34} className="mx-auto text-neon-cyan mb-8" />
          <p className="text-13 caps-modern text-neon-cyan">LOADING SHARED CONVERSATION...</p>
        </div>
      </div>
    );
  }

  if (!data || data.messages.length === 0) {
    return (
      <div className="fixed inset-0 bg-void text-parchment flex items-center justify-center p-21">
        <div className="text-center space-y-8">
          <p className="text-21 caps-modern text-neon-magenta">CONVERSATION NOT FOUND</p>
          <p className="text-13 text-parchment/55">This share link is invalid or was removed by its owner.</p>
          <a href="/" className="text-13 text-neon-cyan hover:underline">Open Arthashastra AI</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-void text-parchment font-mono p-13 md:p-34">
      <div className="max-w-3xl mx-auto space-y-21">
        <header className="border-b border-neon-cyan/21 pb-13 mb-34 flex items-center justify-between gap-13">
          <div className="flex items-center gap-13 min-w-0">
            <ArthashastraSymbol size={34} className="text-neon-cyan shrink-0" />
            <div className="min-w-0">
              <h1 className="text-13 md:text-21 caps-modern text-neon-cyan font-bold tracking-[0.13em]">Shared conversation</h1>
              <p className="text-[11px] text-parchment/55 font-sans">AI answers include their sources</p>
            </div>
          </div>
          <a href="/" className="px-13 py-5 border border-neon-cyan/55 text-neon-cyan hover:bg-neon-cyan hover:text-void transition-colors rounded text-[10px] caps-modern font-bold shrink-0">
            OPEN ARTHASHASTRA AI
          </a>
        </header>

        <div className="space-y-5">
          <h2 className="text-21 font-sans text-parchment break-words">{data.title}</h2>
          {data.createdAt && <p className="text-[11px] text-parchment/34 font-sans">Shared on {data.createdAt.toLocaleString()}</p>}
        </div>

        <div className="space-y-34">
          {data.messages.map((message, index) => (
            <div
              key={index}
              className={`p-21 md:p-34 rounded-13 border ${
                message.role === 'model'
                  ? 'bg-neon-cyan/5 border-neon-cyan/34 shadow-[0_0_15px_rgba(0,230,118,0.05)] ml-0 md:ml-13'
                  : 'bg-white/3 border-white/8 mr-0 md:mr-13'
              }`}
            >
              <div className="flex items-center gap-13 mb-13">
                <div className={`text-[10px] caps-modern px-8 py-3 rounded ${message.role === 'model' ? 'bg-neon-cyan text-void font-bold' : 'bg-white/13 text-parchment'}`}>
                  {message.role === 'model' ? 'ARTHASHASTRA AI · AI-GENERATED' : 'USER'}
                </div>
              </div>
              <Markdown className="prose prose-invert prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10 max-w-none prose-a:text-neon-cyan text-13 md:text-[16px] font-sans">
                {message.text}
              </Markdown>
            </div>
          ))}
        </div>

        <footer className="border-t border-neon-cyan/13 pt-21 pb-89 text-[11px] text-parchment/55 font-sans space-y-8">
          <p>
            AI answers can be wrong. Check the linked sources before you rely on them. Not financial, legal or investment advice.
          </p>
          <p>
            <a href="/" className="text-neon-cyan hover:underline">Ask your own question on Arthashastra AI →</a>
          </p>
        </footer>
      </div>
    </div>
  );
}
