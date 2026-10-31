import { useState } from 'react';
import type { User } from 'firebase/auth';
import { Download, Server, Lock, AlertTriangle, FileJson, CheckCircle2, Trash2, Loader2 } from 'lucide-react';
import { collectMyData, deleteAllMyData, ErasureResult } from '../lib/archiveStore';
import { useAuthUser } from '../lib/firebase';

interface DataSovereigntyProps {
  user?: User | null;
  language?: string;
  isAdmin?: boolean;
}

const errMsg = (e: unknown) => (e instanceof Error && e.message ? e.message : 'Something went wrong. Please try again.');
const CONFIRM_WORD = 'DELETE';

export function DataSovereignty({ user: userProp }: DataSovereigntyProps) {
  const user = useAuthUser(userProp);
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [showErase, setShowErase] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isErasing, setIsErasing] = useState(false);
  const [eraseResult, setEraseResult] = useState<ErasureResult | null>(null);
  const [eraseError, setEraseError] = useState<string | null>(null);

  const handleExport = async () => {
    if (!user) return;
    setIsExporting(true);
    setExportComplete(false);
    setExportError(null);
    try {
      const data = await collectMyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const d = new Date();
      a.href = url;
      a.download = `arthashastra-my-data-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportComplete(true);
    } catch (err) {
      console.error('[DataSovereignty] Export failed:', err);
      setExportError(`Export failed: ${errMsg(err)}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleErase = async () => {
    if (!user || confirmText !== CONFIRM_WORD) return;
    setIsErasing(true);
    setEraseError(null);
    try {
      const result = await deleteAllMyData();
      setEraseResult(result);
      setShowErase(false);
      setConfirmText('');
    } catch (err) {
      console.error('[DataSovereignty] Erase failed:', err);
      setEraseError(`Deletion stopped: ${errMsg(err)} Some data may already be deleted; you can run it again.`);
    } finally {
      setIsErasing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-34 space-y-34 px-21">
      <div className="text-center space-y-13 mb-55">
        <div className="inline-flex items-center justify-center p-21 bg-neon-cyan/5 border hover:border-cyan-500/55 border-cyan-500/34 rounded-full mb-13 relative group transition-all">
          <div className="absolute inset-0 bg-cyan-500 rounded-full opacity-0 group-hover:opacity-10 transition-opacity blur-xl"></div>
          <Server className="w-44 h-44 text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
        </div>
        <h2 className="text-55 font-display font-medium text-cyan-400 uppercase tracking-widest drop-shadow-[0_0_13px_rgba(34,211,238,0.3)]">Your Data</h2>
        <p className="text-13 font-sans text-parchment/89 max-w-2xl mx-auto leading-relaxed border-t border-cyan-900/55 pt-13 mt-13">
          Your conversations belong to you. Download a full copy at any time, or delete everything we store for you.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-34">
        {/* Principles */}
        <div className="glass-panel p-34 border-cyan-900/55 shadow-[inset_0_0_21px_rgba(34,211,238,0.05)]">
          <h3 className="text-21 caps-modern text-cyan-400 mb-21 flex items-center gap-8 border-b border-cyan-900/55 pb-8">
            <Lock className="w-13 h-13" />
            What we promise
          </h3>
          <div className="space-y-13">
            {[
              { title: 'No lock-in', text: 'One click gives you everything stored for your account as a plain JSON file: conversations, memory-calendar days, cold archives, share links and your audit log.' },
              { title: 'Where it is stored', text: 'Your data is stored in Google Cloud Firestore under your account. Security rules let only you read your private conversations. It is not end-to-end encrypted.' },
              { title: 'No data selling', text: 'We do not sell your data or show you ads. Your messages are sent to our AI provider (Anthropic Claude, or Google Gemini as a backup) to generate answers.' },
              { title: 'Right to erasure', text: 'You can delete all of your stored conversations and notes yourself, below. Payment records are kept by law.' },
            ].map((p) => (
              <div key={p.title} className="p-13 bg-void/34 border-l-2 border-cyan-500/55 group hover:bg-cyan-900/10 transition-colors">
                <h4 className="text-[11px] caps-modern text-cyan-400 font-bold tracking-widest mb-5">{p.title}</h4>
                <p className="text-13 text-parchment/89 font-sans leading-relaxed opacity-89">{p.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-21">
          <div className="glass-panel p-34 border-cyan-500/55 relative overflow-hidden flex flex-col justify-center text-center">
            <div className="absolute -top-10 -right-10 w-44 h-44 bg-cyan-500/10 rounded-full blur-2xl" />

            <FileJson className="w-21 h-21 text-cyan-400 mx-auto mb-13 animate-pulse" />
            <h3 className="text-21 caps-modern text-cyan-400 mb-8">Download my data</h3>
            <p className="text-11 text-parchment/55 leading-relaxed font-sans mb-21">
              A single JSON file with all your conversations and messages (with their times), memory-calendar days, cold archives, share links and audit log.
            </p>

            {!user ? (
              <div className="p-21 bg-cyber-red/10 border border-cyber-red/34 text-[11px] text-cyber-red caps-modern rounded-8 flex items-center justify-center gap-8">
                <AlertTriangle className="w-13 h-13" />
                Sign in to download your data
              </div>
            ) : exportComplete ? (
              <div className="p-21 bg-neon-green/10 border border-neon-green/34 text-[11px] text-neon-green caps-modern rounded-8 flex flex-col items-center justify-center gap-8 shadow-[0_0_15px_rgba(57,255,20,0.2)]">
                <CheckCircle2 className="w-21 h-21" />
                <span>DOWNLOAD STARTED</span>
                <button onClick={() => setExportComplete(false)} className="mt-8 text-[9px] border-b border-neon-green/34 hover:border-neon-green pb-1 cursor-pointer">
                  Download again
                </button>
              </div>
            ) : (
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="w-full bg-cyan-900 border border-cyan-500 text-cyan-100 py-13 rounded-8 font-bold caps-modern hover:bg-cyan-800 transition-all flex items-center justify-center gap-8 shadow-[0_0_21px_rgba(34,211,238,0.2)] disabled:opacity-50"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-13 h-13 animate-spin" />
                    PREPARING FILE...
                  </>
                ) : (
                  <>
                    <Download className="w-13 h-13" />
                    DOWNLOAD MY DATA (JSON)
                  </>
                )}
              </button>
            )}

            {exportError && <p className="mt-13 text-[11px] text-cyber-red font-sans">{exportError}</p>}

            <div className="mt-21 text-[8px] font-mono text-parchment/34 border-t border-cyan-900/55 pt-13">
              The file is not encrypted. Anyone who gets it can read your conversations, so keep it somewhere safe.
            </div>
          </div>

          {/* Erase */}
          {user && (
            <div className="glass-panel p-34 border-cyber-red/34 bg-cyber-red/5 text-center">
              <Trash2 className="w-21 h-21 text-cyber-red mx-auto mb-13" />
              <h3 className="text-21 caps-modern text-cyber-red mb-8">Delete all my data</h3>
              <p className="text-11 text-parchment/55 leading-relaxed font-sans mb-21">
                Permanently deletes your conversations and messages, memory-calendar days, cold archives and public share links. Your account, subscription and payment records are not affected. This cannot be undone — download a copy first if you want one.
              </p>

              {eraseResult && (
                <div className="mb-13 p-13 bg-neon-green/10 border border-neon-green/34 text-[11px] text-neon-green font-sans rounded-8">
                  Deleted {eraseResult.conversations} conversation(s) with {eraseResult.messages} message(s), {eraseResult.temporalDays} calendar day(s), {eraseResult.coldArchives} cold archive(s) and {eraseResult.sharedLinks} share link(s).
                </div>
              )}

              {!showErase ? (
                <button
                  onClick={() => {
                    setShowErase(true);
                    setEraseResult(null);
                    setEraseError(null);
                  }}
                  className="w-full py-13 bg-cyber-red/10 border border-cyber-red/55 text-cyber-red rounded-8 font-bold caps-modern hover:bg-cyber-red/21 transition-all"
                >
                  DELETE ALL MY DATA…
                </button>
              ) : (
                <div className="space-y-10 text-left">
                  <label className="block text-[11px] text-parchment/89 font-sans">
                    Type <strong className="text-cyber-red">{CONFIRM_WORD}</strong> to confirm:
                  </label>
                  <input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                    className="w-full bg-void/55 border border-cyber-red/34 rounded-8 py-8 px-13 text-13 text-parchment outline-none focus:border-cyber-red"
                    placeholder={CONFIRM_WORD}
                    autoFocus
                  />
                  <div className="flex gap-8">
                    <button
                      onClick={handleErase}
                      disabled={confirmText !== CONFIRM_WORD || isErasing}
                      className="flex-1 py-10 bg-cyber-red text-white rounded-8 font-bold caps-modern text-[11px] disabled:opacity-34 flex items-center justify-center gap-8"
                    >
                      {isErasing ? <Loader2 className="w-13 h-13 animate-spin" /> : <Trash2 className="w-13 h-13" />}
                      {isErasing ? 'DELETING...' : 'DELETE PERMANENTLY'}
                    </button>
                    <button
                      onClick={() => {
                        setShowErase(false);
                        setConfirmText('');
                      }}
                      disabled={isErasing}
                      className="px-21 py-10 border border-white/20 rounded-8 caps-modern text-[11px] text-parchment/89"
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              )}

              {eraseError && <p className="mt-13 text-[11px] text-cyber-red font-sans">{eraseError}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
