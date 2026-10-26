import { useCallback, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { ApiError, createOrder, verifyPayment } from '../lib/api';
import { SITE } from '../lib/siteConfig';
import { fmt, type Translation } from '../translations';
import type { ModalContext } from '../components/AlertModal';

interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
interface RazorpayFailure {
  error?: { description?: string; metadata?: { payment_id?: string } };
}
interface RazorpayInstance {
  open: () => void;
  on: (event: 'payment.failed', cb: (r: RazorpayFailure) => void) => void;
}
type RazorpayCtor = new (options: Record<string, unknown>) => RazorpayInstance;

export const formatDate = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
};

/**
 * Razorpay checkout: createOrder() → Checkout (key from the server order) →
 * verifyPayment() on success → refresh the account. Every outcome ends in a modal.
 */
export function usePayment(opts: {
  user: User | null;
  t: Translation;
  showModal: (m: ModalContext) => void;
  onPaid: () => Promise<unknown> | void;
}) {
  const { user, t, showModal, onPaid } = opts;
  const [isPaying, setIsPaying] = useState(false);
  const busy = useRef(false);

  const finish = () => {
    busy.current = false;
    setIsPaying(false);
  };

  const startCheckout = useCallback(async () => {
    if (!user || busy.current) return;
    if (user.isAnonymous) {
      showModal({ title: t.planTitle, message: t.planAnonNote, isError: true });
      return;
    }
    busy.current = true;
    setIsPaying(true);
    try {
      const order = await createOrder();
      const Razorpay = (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay;
      if (!Razorpay) throw new ApiError(0, 'NETWORK', t.paymentUnavailable);

      let settled = false;
      const rzp = new Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: SITE.name,
        description: SITE.priceLabel,
        order_id: order.id,
        prefill: { email: user.email || undefined, name: user.displayName || undefined },
        theme: { color: '#00E676' },
        handler: async (response: RazorpaySuccess) => {
          settled = true;
          try {
            const result = await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            await onPaid();
            showModal({ title: t.paymentSuccessTitle, message: fmt(t.paymentSuccessBody, { date: formatDate(result.expiresAt) }) });
          } catch (e) {
            console.error('[payment] verify failed', e);
            await onPaid();
            showModal({
              title: t.paymentFailedTitle,
              message: fmt(t.paymentVerifyFailed, { id: response.razorpay_payment_id }),
              isError: true,
            });
          } finally {
            finish();
          }
        },
        modal: {
          ondismiss: () => {
            if (!settled) showModal({ title: t.paymentFailedTitle, message: t.paymentCancelled, isError: true });
            if (!settled) finish();
          },
        },
      });
      rzp.on('payment.failed', (r) => {
        // Razorpay keeps its window open so the user can retry; the result is shown after it closes.
        console.warn('[payment] failed:', r.error?.description);
        settled = true;
        showModal({
          title: t.paymentFailedTitle,
          message: r.error?.description || t.paymentFailedTitle,
          isError: true,
        });
        finish();
      });
      rzp.open();
    } catch (e) {
      finish();
      showModal({ title: t.paymentFailedTitle, message: e instanceof Error ? e.message : t.errorTitle, isError: true });
    }
  }, [user, t, showModal, onPaid]);

  return { startCheckout, isPaying };
}
