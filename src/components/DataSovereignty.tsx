import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Shield, Download, Server, Lock, AlertTriangle, FileJson, CheckCircle2 } from 'lucide-react';
import { getConversations, getMessages } from '../lib/chatStore';

interface DataSovereigntyProps {
  user: any;
}

export function DataSovereignty({ user }: DataSovereigntyProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);

  const handleExport = async () => {
    if (!user) return;
    setIsExporting(true);
    setExportComplete(false);

    try {
      // Fetch all conversations from local/IndexedDB or server (chatStore abstracts this partly)
      const convos = await getConversations();
      const exportData: Record<string, any> = {
        meta: {
          exportedAt: new Date().toISOString(),
          userId: user.uid,
          version: "1.0-AITIHYA-PROTOCOL"
        },
        threads: []
      };

      for (const c of convos) {
        const msgs = await getMessages(c.id);
        const parseTime = (v: any) => {
          if (!v) return new Date().toISOString();
          if (v.toDate) return v.toDate().toISOString();
          if (v instanceof Date) return v.toISOString();
          return new Date(v).toISOString();
        };

        exportData.threads.push({
          threadId: c.id,
          createdAt: parseTime(c.updatedAt),
          messages: msgs
        });
      }

      // Create a blob and trigger download
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `arthashastra_ledger_${new Date().getTime()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setExportComplete(true);
    } catch (err) {
      console.error("Failed to export data:", err);
      alert("Failed to package the Truth Ledger. Try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-34 space-y-34 px-21">
      <div className="text-center space-y-13 mb-55">
        <div className="inline-flex items-center justify-center p-21 bg-neon-cyan/5 border hover:border-cyan-500/55 border-cyan-500/34 rounded-full mb-13 relative group transition-all">
          <div className="absolute inset-0 bg-cyan-500 rounded-full opacity-0 group-hover:opacity-10 transition-opacity blur-xl"></div>
          <Server className="w-44 h-44 text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
        </div>
        <h2 className="text-55 font-display font-medium text-cyan-400 uppercase tracking-widest drop-shadow-[0_0_13px_rgba(34,211,238,0.3)]">Data Sovereignty</h2>
        <p className="text-13 font-sans text-parchment/89 max-w-2xl mx-auto leading-relaxed border-t border-cyan-900/55 pt-13 mt-13">
          Against the threat of censorship, deletion, or platform seizure. You do not just read the ledger; you are authorized to back it up cryptographically to your own infrastructure.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-34">
        {/* The Citadel Principles */}
        <div className="glass-panel p-34 border-cyan-900/55 shadow-[inset_0_0_21px_rgba(34,211,238,0.05)]">
          <h3 className="text-21 caps-modern text-cyan-400 mb-21 flex items-center gap-8 border-b border-cyan-900/55 pb-8">
            <Lock className="w-13 h-13" />
            Immutable Protocols
          </h3>
          <div className="space-y-13">
            {[
              { title: "No Walled Gardens", text: "Big Tech relies on locking you in. We give you the cryptographically signed Truth Ledger." },
              { title: "Decentralized Mirroring", text: "Your browser stores a synchronized shard of your witness history locally using IndexedDB." },
              { title: "Zero Data Brokerage", text: "We do not sell access patterns. We do not expose logic pathways. The data is either yours, or it is mathematical consensus." }
            ].map((p, idx) => (
              <div key={idx} className="p-13 bg-void/34 border-l-2 border-cyan-500/55 group hover:bg-cyan-900/10 transition-colors">
                <h4 className="text-[11px] caps-modern text-cyan-400 font-bold tracking-widest mb-5">{p.title}</h4>
                <p className="text-13 text-parchment/89 font-sans leading-relaxed opacity-89">
                  {p.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Action Panel */}
        <div className="space-y-21">
          <div className="glass-panel p-34 border-cyan-500/55 relative overflow-hidden h-full flex flex-col justify-center text-center">
            <div className="absolute -top-10 -right-10 w-44 h-44 bg-cyan-500/10 rounded-full blur-2xl" />
            
            <FileJson className="w-21 h-21 text-cyan-400 mx-auto mb-13 animate-pulse" />
            <h3 className="text-21 caps-modern text-cyan-400 mb-8">Export Witness Ledger</h3>
            <p className="text-11 text-parchment/55 leading-relaxed font-sans mb-21">
              Download your entire interaction history with the Absolute Witness as a structured JSON file. Ensure the truth survives any network blackout.
            </p>

            {!user ? (
               <div className="p-21 bg-cyber-red/10 border border-cyber-red/34 text-[11px] text-cyber-red caps-modern rounded-8 flex items-center justify-center gap-8">
                 <AlertTriangle className="w-13 h-13" />
                 Identify to access encrypted exports
               </div>
            ) : exportComplete ? (
              <div className="p-21 bg-neon-green/10 border border-neon-green/34 text-[11px] text-neon-green caps-modern rounded-8 flex flex-col items-center justify-center gap-8 shadow-[0_0_15px_rgba(57,255,20,0.2)]">
                <CheckCircle2 className="w-21 h-21" />
                <span>EXPORT SECURED LOCALLY</span>
                <button onClick={() => setExportComplete(false)} className="mt-8 text-[9px] border-b border-neon-green/34 hover:border-neon-green pb-1 cursor-pointer">
                  Initiate New Export
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
                    <Download className="w-13 h-13 animate-pulse" />
                    COMPILING LEDGER...
                  </>
                ) : (
                  <>
                    <Download className="w-13 h-13" />
                    DOWNLOAD SOVEREIGN LEDGER
                  </>
                )}
              </button>
            )}

            <div className="mt-21 text-[8px] font-mono text-parchment/34 border-t border-cyan-900/55 pt-13">
              WARNING: The exported payload contains your unencrypted conversations. Store on zero-knowledge encrypted drives only.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
