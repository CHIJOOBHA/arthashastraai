import React from 'react';
import type { User } from 'firebase/auth';
import { Shield, Coins, Zap, HandCoins, CheckCircle2, MessageSquare, BookOpen, Info } from 'lucide-react';
import { SITE } from '../lib/siteConfig';

interface TheWarChestProps {
  user?: User | null;
  language?: string;
  isAdmin?: boolean;
  isSubscribed?: boolean;
  /** False while subscriptions are not open yet. */
  paymentsEnabled?: boolean;
  /** Preferred: starts the Razorpay checkout. */
  onSubscribe?: () => void;
  /** Older name for onSubscribe, still accepted. */
  handlePayment?: () => void;
  isLoading?: boolean;
  /** ISO date the current plan ends, if known. */
  subscriptionExpiresAt?: string | null;
}

export function TheWarChest({ user, isSubscribed, paymentsEnabled = true, onSubscribe, handlePayment, isLoading, subscriptionExpiresAt }: TheWarChestProps) {
  const subscribe = onSubscribe || handlePayment;
  const expires = subscriptionExpiresAt ? new Date(subscriptionExpiresAt) : null;
  const expiresLabel = expires && !isNaN(expires.getTime()) ? expires.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  return (
    <div className="max-w-5xl mx-auto py-34 space-y-34 px-21">
      <div className="text-center space-y-13 mb-55">
        <div className="inline-flex items-center justify-center p-21 bg-amber-500/13 border hover:border-amber-500/55 border-amber-500/34 rounded-full mb-13 relative group transition-all">
          <div className="absolute inset-0 bg-amber-500 rounded-full opacity-0 group-hover:opacity-20 transition-opacity blur-xl"></div>
          <Coins className="w-[44px] h-[44px] text-amber-500 drop-shadow-[0_0_15px_rgba(245,158,11,0.8)]" />
        </div>
        <h2 className="text-55 font-display font-medium text-amber-500 uppercase tracking-widest drop-shadow-[0_0_13px_rgba(245,158,11,0.5)]">The War Chest</h2>
        <p className="text-13 font-sans text-parchment/89 max-w-2xl mx-auto leading-relaxed border-t border-amber-500/34 pt-13 mt-13">
          Arthashastra AI shows no ads. Running the AI and the servers costs real money, so the extra features are paid for by the people who use them.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-34">
        {/* What you get */}
        <div className="space-y-21">
          <div className="glass-panel p-34 border-amber-500/34 relative overflow-hidden group">
            <div className="absolute -left-1 top-0 bottom-0 w-2 bg-amber-500/55 group-hover:bg-amber-500 transition-colors shadow-[0_0_15px_rgba(245,158,11,0.8)]" />
            <h3 className="text-21 caps-modern text-amber-500 mb-13 flex items-center gap-8">
              <Shield className="w-13 h-13" />
              What you get
            </h3>
            <ul className="space-y-13">
              {[
                { icon: MessageSquare, text: 'More questions to the AI every day than the free plan.' },
                { icon: BookOpen, text: 'Unlimited explanations of intelligence reports (free accounts get a few).' },
                { icon: Zap, text: 'Every AI answer still shows its sources so you can check them.' },
              ].map((item, idx) => (
                <li key={idx} className="flex items-center gap-13 text-13 text-parchment/89">
                  <div className="p-8 bg-amber-500/13 rounded border border-amber-500/34 text-amber-500 shrink-0">
                    <item.icon className="w-[11px] h-[11px]" />
                  </div>
                  {item.text}
                </li>
              ))}
            </ul>
            <p className="mt-21 text-[11px] text-parchment/55 leading-relaxed">
              Your money keeps the service running (AI usage and hosting). It does not buy any share, investment or financial product.
            </p>
          </div>
        </div>

        {/* Plan */}
        <div className="glass-panel p-34 border border-amber-500/55 bg-amber-500/5 shadow-[0_0_34px_rgba(245,158,11,0.05)] text-center space-y-21 relative overflow-hidden flex flex-col justify-center">
          <h3 className="text-21 caps-modern text-amber-500 tracking-widest drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]">SUPPORTER PLAN</h3>

          <div className="text-55 font-bold text-amber-500 drop-shadow-[0_0_13px_rgba(245,158,11,0.5)] leading-none my-13">
            {SITE.priceLabel}
          </div>

          <p className="text-13 text-parchment/89 leading-relaxed max-w-sm mx-auto">
            One-time payment. It does <strong>not</strong> renew automatically — when the 30 days end, you can choose to pay again.
          </p>

          <div className="pt-21">
            {isSubscribed ? (
              <div className="px-21 py-13 border border-emerald-500/55 bg-emerald-500/13 text-emerald-400 text-13 rounded-8 flex items-center justify-center gap-8">
                <CheckCircle2 className="w-13 h-13" />
                <span>Your plan is active{expiresLabel ? ` until ${expiresLabel}` : ''}. Thank you!</span>
              </div>
            ) : !paymentsEnabled ? (
              <div className="px-21 py-13 border border-emerald-500/55 bg-emerald-500/13 text-emerald-400 text-13 rounded-8">
                Subscriptions open soon. Until then, every feature is free.
              </div>
            ) : !user || user.isAnonymous ? (
              <div className="px-21 py-13 border border-amber-500/34 bg-amber-500/13 text-amber-500/89 text-[11px] caps-modern">
                Sign in with Google to subscribe.
              </div>
            ) : (
              <button
                onClick={subscribe}
                disabled={isLoading || !subscribe}
                className="w-full bg-amber-500 text-void py-21 rounded-8 font-bold caps-modern hover:shadow-[0_0_34px_#F59E0B] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-8"
              >
                {isLoading ? (
                  <>
                    <Zap className="w-13 h-13 animate-pulse" />
                    OPENING CHECKOUT...
                  </>
                ) : (
                  <>
                    <HandCoins className="w-13 h-13" />
                    PAY {SITE.priceLabel.toUpperCase()}
                  </>
                )}
              </button>
            )}

            <div className="mt-13 text-[10px] text-parchment/55 leading-relaxed flex items-start gap-5 text-left">
              <Info className="w-[11px] h-[11px] mt-[2px] shrink-0" />
              <span>
                Payments are processed by Razorpay; we never see or store your card details. See the{' '}
                <a href="/terms#refunds" className="underline hover:text-amber-500">refund &amp; cancellation policy</a> and{' '}
                <a href="/terms" className="underline hover:text-amber-500">terms</a>.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
