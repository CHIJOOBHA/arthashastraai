import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, ChevronRight, Clock, Copy, Landmark, Link2, Loader2, Share2, User as UserIcon } from 'lucide-react';
import { Markdown } from './Markdown';
import { LogicProof } from './LogicProof';
import { toDate, type Message } from '../lib/firebase';
import { fmt, type Translation } from '../translations';

/** A chat message as shown on screen. `error` messages are never saved or sent to the AI. */
export interface ChatMessage extends Message {
  error?: boolean;
  errorCode?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const localYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const msgYmd = (ts: unknown) => {
  const d = toDate(ts);
  return d ? localYmd(d) : '';
};

interface ChatPanelProps {
  t: Translation;
  language: string;
  messages: ChatMessage[];
  activeChatId: string;
  isSending: boolean;
  isHistoryLoading: boolean;
  isSharing: boolean;
  selectedDateFilter: string;
  onClearDateFilter: () => void;
  onOpenHistory: () => void;
  onShare: () => void;
  onCopy: (text: string) => Promise<boolean>;
  onPrompt: (text: string) => void;
  onSeePlans: () => void;
}

export function ChatPanel(props: ChatPanelProps) {
  const {
    t, language, messages, activeChatId, isSending, isHistoryLoading, isSharing,
    selectedDateFilter, onClearDateFilter, onOpenHistory, onShare, onCopy, onPrompt, onSeePlans,
  } = props;
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const canShare = messages.some((m) => !m.error && m.role === 'model' && m.text) && !isSending;

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-8 mb-21 pb-13 border-b border-neon-cyan/21">
      <div className="flex items-center gap-8 min-w-0">
        <button
          onClick={onOpenHistory}
          aria-label={t.history}
          className="lg:hidden p-5 bg-neon-cyan/13 border border-neon-cyan/34 rounded text-neon-cyan hover:bg-neon-cyan/21 transition-all"
        >
          <Clock className="w-13 h-13" aria-hidden />
        </button>
        <span className="text-[10px] uppercase tracking-widest text-neon-cyan">{t.conversation}</span>
        <span className="text-[10px] font-mono text-neon-cyan/55 truncate" title={activeChatId}>
          {activeChatId.slice(0, 8).toUpperCase()}
        </span>
        {selectedDateFilter !== 'all' && (
          <span className="px-8 py-3 rounded bg-neon-cyan/13 border border-neon-cyan text-neon-cyan text-[9px] font-bold tracking-wider uppercase flex items-center gap-5">
            <Calendar className="w-10 h-10" aria-hidden />
            {selectedDateFilter}
          </span>
        )}
      </div>
      {messages.length > 0 && (
        <button
          onClick={onShare}
          disabled={!canShare || isSharing}
          className="flex items-center gap-5 px-8 py-3 border border-neon-cyan/55 text-neon-cyan/89 hover:bg-neon-cyan hover:text-void transition-colors rounded text-[10px] uppercase tracking-widest disabled:opacity-34"
        >
          {isSharing ? <Loader2 className="w-10 h-10 animate-spin" aria-hidden /> : <Share2 className="w-10 h-10" aria-hidden />}
          {t.shareThread}
        </button>
      )}
    </div>
  );

  if (isHistoryLoading) {
    return (
      <div className="py-34 max-w-[890px] mx-auto w-full">
        {header}
        <div className="py-89 flex justify-center">
          <Loader2 className="w-34 h-34 text-neon-cyan animate-spin" aria-label={t.explLoading} />
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="w-full">
        <div className="pt-21">{header}</div>
        <div className="min-h-[60vh] flex flex-col items-center justify-center py-34">
          <motion.div
            initial={{ y: 34, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.89, ease: [0.16, 1, 0.3, 1] }}
            className="text-center space-y-21 mb-55"
          >
            <div className="inline-flex items-center gap-8 px-21 py-5 bg-neon-cyan/5 border border-neon-cyan/34 mb-13">
              <span className="w-5 h-5 rounded-full bg-neon-cyan" aria-hidden />
              <span className="text-[11px] uppercase tracking-widest text-neon-cyan">{t.tagline}</span>
            </div>
            <h1 className="text-55 md:text-89 font-display font-bold tracking-tighter leading-[0.95] text-parchment uppercase">
              {t.hero1}
              <br />
              <span className="text-neon-cyan drop-shadow-[0_0_21px_rgba(0,230,118,0.5)]">{t.hero2}</span>
            </h1>
            <p className="text-parchment/80 text-13 max-w-[610px] mx-auto leading-relaxed">{t.description}</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-13 w-full max-w-[890px]">
            {t.prompts.map((prompt, i) => (
              <motion.button
                key={i}
                initial={{ y: 21, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.13 * i, duration: 0.61 }}
                whileHover={{ y: -5 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onPrompt(prompt)}
                disabled={isSending}
                className="p-21 text-left glass-panel transition-all duration-377 group relative overflow-hidden rounded-8 border-neon-cyan/21 hover:border-neon-cyan hover:shadow-[0_0_21px_rgba(0,230,118,0.2)]"
              >
                <span className="absolute top-0 left-0 w-1 h-full bg-neon-cyan/0 group-hover:bg-neon-cyan transition-all duration-377" aria-hidden />
                <p className="text-13 leading-relaxed text-parchment/80 group-hover:text-parchment transition-colors font-semibold">{prompt}</p>
                <span className="flex items-center gap-5 mt-8 text-[10px] text-neon-cyan uppercase tracking-widest font-bold opacity-55 group-hover:opacity-100">
                  {t.startAnalysis}
                  <ChevronRight className="w-13 h-13" aria-hidden />
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const visible = messages.filter((m) => selectedDateFilter === 'all' || !m.timestamp || msgYmd(m.timestamp) === selectedDateFilter);
  const last = messages[messages.length - 1];
  const waitingForFirstChunk = isSending && last?.role === 'model' && !last.text;

  return (
    <div className="space-y-21 py-34 pb-89 max-w-[890px] mx-auto w-full">
      {header}
      <AnimatePresence initial={false}>
        {visible.length === 0 ? (
          <div className="p-34 border border-dashed border-neon-cyan/21 bg-void/50 rounded-13 text-center space-y-13 my-21">
            <Calendar className="w-34 h-34 text-neon-cyan/34 mx-auto" aria-hidden />
            <p className="text-13 text-parchment/80">{fmt(t.noMessagesOnDate, { date: selectedDateFilter })}</p>
            <button
              onClick={onClearDateFilter}
              className="px-13 py-8 bg-neon-cyan/10 hover:bg-neon-cyan/21 text-neon-cyan border border-neon-cyan/34 rounded-8 text-[10px] uppercase tracking-widest font-bold transition-all"
            >
              {t.clearFilter}
            </button>
          </div>
        ) : (
          visible.map((msg) => {
            if (msg.role === 'model' && !msg.text && !msg.error) return null; // placeholder: spinner below
            const when = toDate(msg.timestamp);
            const isUser = msg.role === 'user';
            return (
              <motion.div key={msg.id} initial={{ y: 21, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[92%] md:max-w-[80%] p-13 md:p-21 rounded-13 relative ${
                    msg.error
                      ? 'border border-cyber-red/55 bg-cyber-red/5 text-parchment'
                      : isUser
                        ? 'bg-neon-cyan/13 border border-neon-cyan/55 text-parchment'
                        : 'glass-panel border-neon-magenta/34 text-parchment'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-8 mb-8">
                    <div className="flex items-center gap-8">
                      {isUser ? <UserIcon className="w-13 h-13 text-neon-cyan" aria-hidden /> : <Landmark className="w-13 h-13 text-neon-magenta" aria-hidden />}
                      <span className={`text-[10px] uppercase tracking-widest font-bold ${isUser ? 'text-neon-cyan' : 'text-neon-magenta'}`}>
                        {isUser ? t.youLabel : t.aiLabel}
                      </span>
                      {!isUser && !msg.error && (
                        <span className="text-[9px] px-5 py-1 rounded border border-neon-magenta/34 text-neon-magenta/89 uppercase tracking-wider">{t.aiGenerated}</span>
                      )}
                      {when && (
                        <time className="text-[9px] font-mono opacity-55" dateTime={when.toISOString()}>
                          {when.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </time>
                      )}
                    </div>
                    {msg.hash && (
                      <span className="inline-flex items-center gap-5 text-[9px] font-mono text-neon-cyan/55" title={t.hashChainedNote}>
                        <Link2 className="w-10 h-10" aria-hidden />
                        {t.hashChained} · {msg.hash.slice(0, 8)}
                      </span>
                    )}
                  </div>

                  {isUser || msg.error ? (
                    <p className="text-13 leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>
                  ) : (
                    <Markdown className="prose prose-invert prose-neon max-w-none text-13 leading-relaxed break-words">{msg.text}</Markdown>
                  )}

                  {msg.error && (msg.errorCode === 'DAILY_LIMIT' || msg.errorCode === 'PAYWALL') && (
                    <button
                      onClick={onSeePlans}
                      className="mt-8 px-13 py-5 border border-neon-magenta/55 text-neon-magenta rounded text-[10px] uppercase tracking-widest font-bold hover:bg-neon-magenta/13"
                    >
                      {t.seePlans}
                    </button>
                  )}

                  {!isUser && !msg.error && !(isSending && msg.id === last?.id) && <LogicProof text={msg.text} language={language} />}

                  {!msg.error && (
                    <div className="mt-8 pt-8 border-t border-neon-cyan/13 flex justify-end">
                      <button
                        onClick={async () => {
                          if (await onCopy(msg.text)) {
                            setCopiedId(msg.id);
                            window.setTimeout(() => setCopiedId((c) => (c === msg.id ? null : c)), 1500);
                          }
                        }}
                        className="flex items-center gap-3 px-5 py-1 bg-neon-cyan/10 border border-neon-cyan/21 hover:bg-neon-cyan/20 rounded text-[9px] text-neon-cyan transition-colors uppercase"
                      >
                        <Copy className="w-10 h-10" aria-hidden />
                        {copiedId === msg.id ? t.copied : t.copy}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </AnimatePresence>

      {waitingForFirstChunk && (
        <div className="flex justify-start" role="status" aria-live="polite">
          <div className="glass-panel p-21 rounded-13 border-neon-magenta/34 flex items-center gap-13">
            <Loader2 className="w-21 h-21 text-neon-magenta animate-spin" aria-hidden />
            <span className="text-[11px] uppercase tracking-widest text-neon-magenta">{t.thinking}</span>
          </div>
        </div>
      )}
    </div>
  );
}
