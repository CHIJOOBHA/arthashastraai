import React from 'react';
import { motion } from 'motion/react';

interface ArthashastraSymbolProps {
  className?: string;
  size?: number;
}

export const ArthashastraSymbol: React.FC<ArthashastraSymbolProps> = ({ className, size = 100 }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      {/* Outer Rotating Halo - The Macro-Economic Spheres */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 border border-neon-cyan/21 rounded-full shadow-[0_0_15px_rgba(0,240,255,0.2)]"
      />
      
      {/* Middle Counter-Rotating Shield - The Defensive Perimeter */}
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className="absolute inset-[10%] border border-neon-magenta/34 rounded-full border-dashed shadow-[0_0_10px_rgba(255,0,255,0.2)]"
      />

      {/* The Aitihya Chain Hexagon - Data Integrity */}
      <motion.svg
        viewBox="0 0 100 100"
        className="absolute inset-0 w-full h-full drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        {/* Hexagonal Frame */}
        <path
          d="M50 5 L89 27.5 L89 72.5 L50 95 L11 72.5 L11 27.5 Z"
          fill="none"
          stroke="#00F0FF"
          strokeWidth="0.5"
          className="opacity-55"
        />
        
        {/* The Internal Network (Pins connecting the dots) */}
        <line x1="50" y1="5" x2="50" y2="95" stroke="#00F0FF" strokeWidth="0.2" className="opacity-21" />
        <line x1="11" y1="27.5" x2="89" y2="72.5" stroke="#00F0FF" strokeWidth="0.2" className="opacity-21" />
        <line x1="89" y1="27.5" x2="11" y2="72.5" stroke="#00F0FF" strokeWidth="0.2" className="opacity-21" />
        
        {/* The Central Hub - The Eye of Absolute Truth */}
        <motion.circle
          cx="50" cy="50" r="8"
          fill="#FF00FF"
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.5, 1, 0.5]
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          style={{ filter: "drop-shadow(0 0 5px rgba(255,0,255,0.8))" }}
        />
        
        {/* The Iris Lines */}
        {[0, 60, 120, 180, 240, 300].map((angle) => (
          <motion.line
            key={angle}
            x1="50" y1="50"
            x2={50 + 15 * Math.cos((angle * Math.PI) / 180)}
            y2={50 + 15 * Math.sin((angle * Math.PI) / 180)}
            stroke="#00F0FF"
            strokeWidth="1"
            animate={{ opacity: [0.2, 0.8, 0.2] }}
            transition={{ duration: 2, delay: angle / 60, repeat: Infinity }}
          />
        ))}
      </motion.svg>

      {/* Floating Particles - The Economic Signals */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-neon-cyan rounded-full shadow-[0_0_5px_#00F0FF]"
          animate={{
            x: [0, Math.cos(i * 60 * Math.PI / 180) * (size/2)],
            y: [0, Math.sin(i * 60 * Math.PI / 180) * (size/2)],
            opacity: [0, 1, 0],
            scale: [0, 1.5, 0]
          }}
          transition={{
            duration: 2 + Math.random(),
            repeat: Infinity,
            delay: i * 0.5,
            ease: "easeOut"
          }}
        />
      ))}
    </div>
  );
};
