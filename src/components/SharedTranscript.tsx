import React, { useEffect, useState } from 'react';
import { getSharedTranscript } from '../lib/chatStore';
import { Message } from '../lib/firebase';
import { Link } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ArthashastraSymbol } from './ArthashastraSymbol';

export function SharedTranscript({ sharedId }: { sharedId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!sharedId) return;
      const msgs = await getSharedTranscript(sharedId);
      setMessages(msgs);
      setLoading(false);
    };
    load();
  }, [sharedId]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-void text-parchment flex items-center justify-center">
        <div className="text-center animate-pulse">
          <ArthashastraSymbol className="w-21 h-21 mx-auto text-neon-cyan mb-8" />
          <p className="text-13 caps-modern text-neon-cyan">DECRYPTING WITNESS RECORD...</p>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="fixed inset-0 bg-void text-parchment flex items-center justify-center">
        <div className="text-center">
          <p className="text-21 caps-modern text-neon-magenta mb-8">404: RECORD NOT FOUND</p>
          <a href="/" className="text-13 text-neon-cyan hover:underline">RETURN TO APEX</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-void text-parchment font-mono p-13 md:p-34">
      <div className="max-w-3xl mx-auto space-y-21">
        <header className="border-b border-neon-cyan/21 pb-13 mb-34 flex items-center justify-between">
          <div className="flex items-center gap-13">
            <ArthashastraSymbol className="w-34 h-34 text-neon-cyan" />
            <div>
              <h1 className="text-21 caps-modern text-neon-cyan font-bold tracking-[0.21em]">VERIFIED RECORD</h1>
              <p className="text-[10px] text-neon-cyan/55 caps-modern">ARTHASHASTRA IMMUTABLE CHAIN</p>
            </div>
          </div>
          <a href="/" className="px-13 py-5 border border-neon-cyan/55 text-neon-cyan hover:bg-neon-cyan hover:text-void transition-colors rounded text-[10px] caps-modern font-bold">
            ACCESS AI
          </a>
        </header>

        <div className="space-y-34 pb-89">
          {messages.map((message, index) => (
            <div 
              key={index} 
              className={`p-21 md:p-34 rounded-13 border ${
                message.role === 'model' 
                  ? 'bg-neon-cyan/5 border-neon-cyan/34 shadow-[0_0_15px_rgba(0,230,118,0.05)] ml-0 md:ml-13' 
                  : 'bg-white/3 border-white/8 mr-0 md:mr-13'
              }`}
            >
              <div className="flex items-center gap-13 mb-13">
                <div className={`text-[10px] caps-modern px-8 py-3 rounded ${
                  message.role === 'model' 
                    ? 'bg-neon-cyan text-void font-bold' 
                    : 'bg-white/13 text-parchment'
                }`}>
                  {message.role === 'model' ? 'ARTHASHASTRA' : 'USER'}
                </div>
              </div>
              <div className="prose prose-invert prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10 max-w-none prose-a:text-neon-cyan data-sovereignty-content text-13 md:text-16">
                <ReactMarkdown>
                  {message.text}
                </ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
