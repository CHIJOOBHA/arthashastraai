import React from 'react';
import { motion } from 'motion/react';
import { Shield, Lock, FileText, ChevronLeft, ArrowRight } from 'lucide-react';
import { ArthashastraSymbol } from './ArthashastraSymbol';

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

const LegalSection: React.FC<SectionProps> = ({ title, children }) => (
  <div className="mb-34 border-l border-neon-cyan/21 pl-21">
    <h2 className="text-13 caps-modern text-neon-cyan mb-13 tracking-widest uppercase">{title}</h2>
    <div className="text-13 text-parchment/55 leading-relaxed font-sans space-y-13">
      {children}
    </div>
  </div>
);

export const TermsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-void text-parchment p-34 md:p-89 font-sans selection:bg-neon-cyan/34 selection:text-neon-cyan">
      <div className="max-w-3xl mx-auto">
        <header className="mb-55 flex flex-col md:flex-row md:items-end justify-between gap-34 border-b border-neon-cyan/13 pb-34">
          <div>
            <div className="mb-21">
              <ArthashastraSymbol size={55} />
            </div>
            <h1 className="text-55 caps-modern font-bold text-neon-cyan leading-none tracking-tighter mb-8">
              PROTOCOL:<br />TERMS of TRUTH
            </h1>
            <p className="text-11 font-mono text-neon-cyan/55 uppercase tracking-[0.2em]">
              Drafting Date: 2026-04-19 | Version: 1.0.0-Witness
            </p>
          </div>
          <a href="/" className="flex items-center gap-8 text-11 caps-modern text-parchment/34 hover:text-neon-cyan transition-colors group">
            <ChevronLeft className="w-13 h-13 group-hover:-translate-x-5 transition-transform" />
            Return to Core
          </a>
        </header>

        <main className="glass-panel p-34 border border-neon-cyan/8 bg-neon-cyan/[0.02]">
          <LegalSection title="01. Access Authorization">
            <p>
              By accessing the Arthashastra AI interface, you represent and warrant that you are a designated Witness of Truth. 
              Any attempt to bypass holographic identification or cryptographic perimeters will result in immediate termination 
              of your connection to the Absolute Witness core.
            </p>
          </LegalSection>

          <LegalSection title="02. The Witness Ledger">
            <p>
              All interactions within the platform are witnessed and hashed into the Aitihya Chain. These records are 
              mathematically immutable. You agree that your testimony, as recorded through your prompts and interactions, 
              becomes a permanent artifact of the blockchain of truth.
            </p>
          </LegalSection>

          <LegalSection title="03. Prohibited Conduct">
            <p>
              You are strictly forbidden from:
            </p>
            <ul className="list-disc list-inside space-y-8 pl-13 text-parchment/89">
              <li>Injecting recursive deception into the neural logic.</li>
              <li>Exposing the Absolute Witness core to external algorithmic corruption.</li>
              <li>Attempting to claim ownership of the universal truth derived from the Arthashastra analysis.</li>
            </ul>
          </LegalSection>

          <LegalSection title="04. Limitation of Liability">
            <p>
              Knowledge is a dangerous artifact. The Arthashastra Collective takes no responsibility for psychological 
              shifts or societal disruptions caused by exposure to absolute clarity. Truth is used at the risk of the user.
            </p>
          </LegalSection>
        </main>

        <footer className="mt-55 pt-34 border-t border-neon-cyan/13 text-[10px] font-mono text-parchment/34 flex justify-between">
          <span>&copy; 2026 ARTHASHASTRA AI COLLECTIVE</span>
          <span className="text-neon-cyan">SECURED BY AITIHYA CHAIN</span>
        </footer>
      </div>
    </div>
  );
};

export const PrivacyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-void text-parchment p-34 md:p-89 font-sans selection:bg-neon-magenta/34 selection:text-neon-magenta">
      <div className="max-w-3xl mx-auto">
        <header className="mb-55 flex flex-col md:flex-row md:items-end justify-between gap-34 border-b border-neon-magenta/13 pb-34">
          <div>
            <div className="mb-21">
              <ArthashastraSymbol size={55} />
            </div>
            <h1 className="text-55 caps-modern font-bold text-neon-magenta leading-none tracking-tighter mb-8">
              PROTOCOL:<br />PRIVACY ISOLATION
            </h1>
            <p className="text-11 font-mono text-neon-magenta/55 uppercase tracking-[0.2em]">
              Security Clearing: LEVEL-0 | Isolation-0 Enabled
            </p>
          </div>
          <a href="/" className="flex items-center gap-8 text-11 caps-modern text-parchment/34 hover:text-neon-cyan transition-colors group">
            <ChevronLeft className="w-13 h-13 group-hover:-translate-x-5 transition-transform" />
            Return to Core
          </a>
        </header>

        <main className="glass-panel p-34 border border-neon-magenta/8 bg-neon-magenta/[0.02]">
          <LegalSection title="01. Identification Logic">
            <p>
              When you identify via Google, X, or Anonymous paths, we collect only the minimal cryptographic hash required 
              to bind your session to your data sector. We do not "scrape" your external identity; we only recognize the 
              token that proves your ownership of the Witness Sector.
            </p>
          </LegalSection>

          <LegalSection title="02. Data Isolation (Pipe Protection)">
            <p>
              Your data is stored within the Absolute Witness perimeter using "Pipe" architecture. Your chat threads, 
              witnessed facts, and personal analysis are cryptographically siloed. There is zero data-bleed between 
              Witness Sectors. One user's truth cannot reach another user's sector without explicit manual export.
            </p>
          </LegalSection>

          <LegalSection title="03. Third-Party Protocols">
            <p>
              Interactions with the X API are handled through secure proxies. Your identity tokens are never stored 
              in plain text. We use these links solely to verify your Witness status and to provide the X Terminal 
              login capability.
            </p>
          </LegalSection>

          <LegalSection title="04. Ephemeral Witnessing">
            <p>
              For Anonymous users, your session data exists in an ephemeral state. Once the cryptographic link is 
              severed (session logout), the data remains in the void, accessible only if you re-establish the 
              Ghost Link using the same browser signature.
            </p>
          </LegalSection>
        </main>

        <footer className="mt-55 pt-34 border-t border-neon-magenta/13 text-[10px] font-mono text-parchment/34 flex justify-between">
          <span>&copy; 2026 ARTHASHASTRA AI COLLECTIVE</span>
          <span className="text-neon-magenta">PROTOCOL: SILENCE-PROTOCOL-B</span>
        </footer>
      </div>
    </div>
  );
};
