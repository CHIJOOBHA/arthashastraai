
import React from 'react';
import { ShieldCheck, History, Hammer } from 'lucide-react';
import { motion } from 'motion/react';

interface LogicProofProps {
  text: string;
}

export const LogicProof: React.FC<LogicProofProps> = ({ text }) => {
  const hasVerification = text.includes('Arthashastra Logic Verification');
  
  if (!hasVerification) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-13 p-13 bg-neon-cyan/5 border border-neon-cyan/21 rounded-8 flex items-center justify-between gap-13"
    >
      <div className="flex items-center gap-13">
        <div className="p-8 bg-neon-cyan/13 rounded-full shadow-[0_0_10px_rgba(0,240,255,0.2)]">
          <ShieldCheck className="w-13 h-13 text-neon-cyan" />
        </div>
        <div>
          <p className="text-[10px] caps-modern text-neon-cyan/55 uppercase tracking-widest leading-none mb-3">MISSION ALIGNMENT</p>
          <p className="text-13 font-mono text-neon-cyan font-bold drop-shadow-[0_0_5px_rgba(0,240,255,0.4)]">CORE RULES SECURED: 100%</p>
        </div>
      </div>
      
      <div className="flex items-center gap-13 border-l border-neon-cyan/13 pl-13">
        <History className="w-13 h-13 text-neon-cyan/55" />
        <p className="text-[10px] caps-modern text-neon-cyan/55 uppercase tracking-widest">HISTORICAL GROUNDING: ACTIVE</p>
      </div>

      <div className="hidden lg:flex items-center gap-8 ml-auto">
        <Hammer className="w-13 h-13 text-neon-cyan opacity-34" />
        <span className="text-[9px] font-mono text-neon-cyan/34">WITNESS PROTOCOL V3.0</span>
      </div>
    </motion.div>
  );
};
