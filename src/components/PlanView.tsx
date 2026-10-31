import { CheckCircle2, Loader2 } from 'lucide-react';
import type { Me } from '../lib/api';
import { SITE } from '../lib/siteConfig';
import { fmt, type Translation } from '../translations';
import { formatDate } from '../hooks/usePayment';

interface PlanViewProps {
  t: Translation;
  me: Me | null;
  isAnonymous: boolean;
  notice?: string | null;
  onSubscribe: () => void;
  isPaying: boolean;
}

/** Free vs supporter plan, current status and expiry. Price comes from SITE.priceLabel. */
export function PlanView({ t, me, isAnonymous, notice, onSubscribe, isPaying }: PlanViewProps) {
  const subscribed = !!me?.isSubscribed;
  const expires = formatDate(me?.subscriptionExpiresAt);
  const freeCount = me?.freeExplanations ?? 3;

  return (
    <div className="py-55 max-w-5xl mx-auto space-y-34">
      <div className="space-y-8 text-center">
        <h2 className="text-34 md:text-55 font-display font-bold text-neon-cyan uppercase tracking-tighter">{t.planTitle}</h2>
        <p className="text-13 text-parchment/55">{t.planSubtitle}</p>
      </div>

      {notice && (
        <div role="status" className="p-13 border border-neon-magenta/55 bg-neon-magenta/5 rounded-13 text-center text-13 text-neon-magenta font-bold">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-34">
        <div className={`glass-panel p-34 border text-left space-y-21 rounded-13 ${!subscribed ? 'border-neon-cyan/55' : 'border-neon-cyan/13 opacity-80'}`}>
          <div className="flex items-center justify-between gap-8">
            <h3 className="text-21 font-bold uppercase tracking-widest text-neon-cyan/89">{t.planFree}</h3>
            {!subscribed && <span className="text-[10px] uppercase tracking-widest text-neon-cyan border border-neon-cyan/34 rounded-full px-8 py-2">{t.planCurrent}</span>}
          </div>
          <div className="text-34 font-bold text-neon-cyan/80">0</div>
          <ul className="space-y-8 text-13 text-parchment/80">
            <li className="flex items-center gap-8"><CheckCircle2 className="w-13 h-13 text-neon-cyan" aria-hidden /> {fmt(t.planFreeExpl, { n: freeCount })}</li>
            <li className="flex items-center gap-8"><CheckCircle2 className="w-13 h-13 text-neon-cyan" aria-hidden /> {t.planFreeChat}</li>
            <li className="flex items-center gap-8"><CheckCircle2 className="w-13 h-13 text-neon-cyan" aria-hidden /> {t.planFreeAll}</li>
          </ul>
          {me && !subscribed && (
            <p className="text-[11px] text-parchment/55">{fmt(t.planUsed, { used: Math.min(me.explanationViewCount, freeCount), free: freeCount })}</p>
          )}
        </div>

        <div className={`glass-panel p-34 border text-left space-y-21 rounded-13 relative overflow-hidden ${subscribed ? 'border-neon-magenta' : 'border-neon-magenta/55'} bg-neon-magenta/5`}>
          <div className="flex items-center justify-between gap-8">
            <h3 className="text-21 font-bold uppercase tracking-widest text-neon-magenta">{t.planPaid}</h3>
            {subscribed && <span className="text-[10px] uppercase tracking-widest text-neon-magenta border border-neon-magenta/55 rounded-full px-8 py-2">{t.planCurrent}</span>}
          </div>
          <div className="text-34 font-bold text-neon-magenta">{SITE.priceLabel}</div>
          <ul className="space-y-8 text-13 text-parchment/89">
            <li className="flex items-center gap-8"><CheckCircle2 className="w-13 h-13 text-neon-magenta" aria-hidden /> {t.planPaidExpl}</li>
            <li className="flex items-center gap-8"><CheckCircle2 className="w-13 h-13 text-neon-magenta" aria-hidden /> {t.planPaidChat}</li>
            <li className="flex items-center gap-8"><CheckCircle2 className="w-13 h-13 text-neon-magenta" aria-hidden /> {t.planPaidSame}</li>
          </ul>
          {subscribed && expires && <p className="text-13 font-bold text-neon-magenta">{fmt(t.planActiveUntil, { date: expires })}</p>}
          {me && me.paymentsEnabled === false ? (
            <p className="text-13 text-emerald-400">{t.paymentsComingSoon}</p>
          ) : isAnonymous ? (
            <p className="text-13 text-amber-400">{t.planAnonNote}</p>
          ) : (
            <button
              onClick={onSubscribe}
              disabled={isPaying}
              aria-busy={isPaying}
              className="w-full inline-flex items-center justify-center gap-8 bg-neon-magenta text-void py-13 rounded-8 font-bold uppercase tracking-widest hover:shadow-[0_0_21px_#FFB300] transition-all disabled:opacity-55 disabled:cursor-wait"
            >
              {isPaying && <Loader2 className="w-13 h-13 animate-spin" aria-hidden />}
              {isPaying ? t.paymentProcessing : subscribed ? t.planRenew : `${t.planSubscribe} · ${SITE.priceLabel}`}
            </button>
          )}
          <p className="text-[11px] text-parchment/55 leading-relaxed">{t.planNote}</p>
        </div>
      </div>
    </div>
  );
}
