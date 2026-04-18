
import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Clock, MessageSquare, ChevronRight, Search, Trash2, Calendar } from 'lucide-react';
import { getConversations, Conversation } from '../lib/chatStore';
import { auth } from '../lib/firebase';

interface AitihyaHistoryProps {
  onSelectConversation: (id: string) => void;
  activeChatId?: string;
}

export function AitihyaHistory({ onSelectConversation, activeChatId }: AitihyaHistoryProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const data = await getConversations();
      setConversations(data);
      setLoading(false);
    };
    fetch();
  }, [auth.currentUser]);

  const filtered = conversations.filter(c => 
    c.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full glass-panel border border-neon-cyan/13 rounded-13 overflow-hidden">
      <div className="p-21 border-b border-neon-cyan/13 bg-neon-cyan/5">
        <div className="flex items-center gap-13 mb-13">
          <Clock className="w-21 h-21 text-neon-cyan drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]" />
          <h2 className="text-13 caps-modern text-neon-cyan tracking-widest uppercase drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]">Temporal Archive</h2>
        </div>
        <div className="relative">
          <Search className="absolute left-13 top-1/2 -translate-y-1/2 w-13 h-13 text-neon-cyan/55" />
          <input
            type="text"
            placeholder="Search the witness chain..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-void/55 border border-neon-cyan/21 rounded-8 py-8 pl-34 pr-13 text-13 text-parchment focus:border-neon-cyan focus:shadow-[0_0_10px_rgba(0,240,255,0.2)] outline-none transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-13 space-y-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-55 gap-13 opacity-34">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Clock className="w-34 h-34 text-neon-cyan drop-shadow-[0_0_8px_rgba(0,240,255,0.5)]" />
            </motion.div>
            <p className="text-13 caps-modern tracking-widest text-neon-cyan">Accessing Archive...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-55 opacity-55">
            <p className="text-13 caps-modern tracking-widest text-neon-cyan">No witnesses found in this sector.</p>
          </div>
        ) : (
          filtered.map((chat) => (
            <motion.button
              key={chat.id}
              whileHover={{ x: 5 }}
              onClick={() => onSelectConversation(chat.id)}
              className={`w-full flex items-start gap-13 p-13 rounded-8 border transition-all text-left group ${
                activeChatId === chat.id 
                  ? 'bg-neon-cyan/13 border-neon-cyan text-neon-cyan shadow-[0_0_8px_rgba(0,240,255,0.3)]' 
                  : 'bg-white/3 border-neon-cyan/13 hover:bg-neon-cyan/5 hover:border-neon-cyan/34 text-parchment/55 hover:text-parchment hover:shadow-[0_0_5px_rgba(0,240,255,0.2)]'
              }`}
            >
              <div className={`p-8 rounded-full ${activeChatId === chat.id ? 'bg-neon-cyan/21 shadow-[0_0_5px_rgba(0,240,255,0.5)]' : 'bg-void/55 group-hover:bg-neon-cyan/13'}`}>
                <MessageSquare className="w-13 h-13" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-13 font-medium truncate mb-3">{chat.title}</p>
                <div className="flex items-center gap-8 opacity-34 text-[10px]">
                  <Calendar className="w-8 h-8" />
                  <span>
                    {new Date((chat.lastMessageAt as any)?.seconds * 1000 || Date.now()).toLocaleDateString()}
                  </span>
                  <span className="ml-auto">Block Auth: {chat.id.substring(0, 8)}</span>
                </div>
              </div>
              <ChevronRight className="w-13 h-13 opacity-0 group-hover:opacity-100 transition-opacity self-center text-neon-cyan" />
            </motion.button>
          ))
        )}
      </div>

      <div className="p-13 border-t border-neon-cyan/13 bg-void/89 text-center">
        <p className="text-[10px] text-neon-cyan/55 caps-modern tracking-[0.21em] drop-shadow-[0_0_2px_rgba(0,240,255,0.3)]">
          All history is witnessed by the Aitihya Chain
        </p>
      </div>
    </div>
  );
}
