import React from 'react';
import { motion } from 'motion/react';
import { Shield, Coins, Activity, Zap, TrendingUp, HandCoins } from 'lucide-react';

interface TheWarChestProps {
  user: any;
  handlePayment: () => void;
  isLoading: boolean;
}

export function TheWarChest({ user, handlePayment, isLoading }: TheWarChestProps) {
  return (
    <div className="max-w-5xl mx-auto py-34 space-y-34 px-21">
      <div className="text-center space-y-13 mb-55">
        <div className="inline-flex items-center justify-center p-21 bg-amber-500/13 border hover:border-amber-500/55 border-amber-500/34 rounded-full mb-13 relative group transition-all">
          <div className="absolute inset-0 bg-amber-500 rounded-full opacity-0 group-hover:opacity-20 transition-opacity blur-xl"></div>
          <Coins className="w-44 h-44 text-amber-500 drop-shadow-[0_0_15px_rgba(245,158,11,0.8)]" />
        </div>
        <h2 className="text-55 font-display font-medium text-amber-500 uppercase tracking-widest drop-shadow-[0_0_13px_rgba(245,158,11,0.5)]">The War Chest</h2>
        <p className="text-13 font-sans text-parchment/89 max-w-2xl mx-auto leading-relaxed border-t border-amber-500/34 pt-13 mt-13">
          Absolute truth requires absolute independence. This platform is not funded by governments, nor monetized by big technology conglomerates via advertising. We rely entirely on Sovereign Nodes (you).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-34">
        {/* Independence Architecture */}
        <div className="space-y-21">
          <div className="glass-panel p-34 border-amber-500/34 relative overflow-hidden group">
            <div className="absolute -left-1 top-0 bottom-0 w-2 bg-amber-500/55 group-hover:bg-amber-500 transition-colors shadow-[0_0_15px_rgba(245,158,11,0.8)]" />
            <h3 className="text-21 caps-modern text-amber-500 mb-13 flex items-center gap-8">
              <Shield className="w-13 h-13" />
              Sovereign Defense Model
            </h3>
            <p className="text-13 leading-relaxed text-parchment/89 opacity-90 mb-21">
               A system's allegiance is determined by its capital structure. If our computing nodes were paid for by corporate advertisements, our truth-engine would silently pivot to defend their interests. 
            </p>
            <ul className="space-y-13">
              {[
                { icon: Zap, text: 'No algorithmic suppression of truth.' },
                { icon: Activity, text: 'Zero reliance on central banking liquidity.' },
                { icon: TrendingUp, text: '100% User-Funded Neural Inference.' }
              ].map((item, idx) => (
                <li key={idx} className="flex items-center gap-13 text-[10px] caps-modern text-amber-500/89">
                  <div className="p-8 bg-amber-500/13 rounded border border-amber-500/34">
                    <item.icon className="w-10 h-10" />
                  </div>
                  {item.text}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Deployment Sector */}
        <div className="glass-panel p-34 border border-amber-500/55 bg-amber-500/5 shadow-[0_0_34px_rgba(245,158,11,0.05)] text-center space-y-21 relative overflow-hidden flex flex-col justify-center">
            
          <h3 className="text-21 caps-modern text-amber-500 tracking-widest drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]">DEPLOY CAPITAL</h3>
          
          <div className="text-89 font-bold text-amber-500 drop-shadow-[0_0_13px_rgba(245,158,11,0.5)] leading-none my-13">
            $34<span className="text-21">/MO</span>
          </div>
          
          <p className="text-[11px] caps-modern text-parchment/55 leading-relaxed tracking-widest max-w-sm mx-auto">
            Authorize a secure subscription to establish yourself as an Absolute Witness and fund the neural engine's monthly server cycle.
          </p>

          <div className="pt-21">
            {!user ? (
               <div className="px-21 py-13 border border-amber-500/34 bg-amber-500/13 text-amber-500/89 text-[11px] caps-modern">
                 Authentication Required: Establish a Neural Identity first to deploy capital.
               </div>
            ) : (
              <button 
                onClick={handlePayment}
                disabled={isLoading}
                className="w-full bg-amber-500 text-void py-21 rounded-8 font-bold caps-modern hover:shadow-[0_0_34px_#F59E0B] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-8"
              >
                {isLoading ? (
                  <>
                    <Zap className="w-13 h-13 animate-pulse" />
                    AUTHORIZING PROTOCOL...
                  </>
                ) : (
                  <>
                    <HandCoins className="w-13 h-13" />
                    SUBSCRIBE AND DEFEND
                  </>
                )}
              </button>
            )}
            
            <div className="mt-13 text-[8px] text-parchment/34 font-mono leading-relaxed">
              * Legal Clause: Transaction cleared via Razorpay. Subject to local jurisdiction compliance.
              Capital deployed ensures server uptime and API bandwidth. No equity implied.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
