import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface ModalContext {
  title: string;
  message: ReactNode;
  isError?: boolean;
  /** When set, a confirm button is shown next to Cancel. */
  onConfirm?: () => void;
  confirmLabel?: string;
}

interface AlertModalProps {
  context: ModalContext | null;
  onClose: () => void;
  labels: { cancel: string; close: string; continue: string };
}

/** Accessible dialog in the app's visual style (replaces alert/confirm). */
export function AlertModal({ context, onClose, labels }: AlertModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!context) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = dialogRef.current;
    const focusables = () =>
      node ? Array.from(node.querySelectorAll<HTMLElement>('button, a[href], input, [tabindex]:not([tabindex="-1"])')) : [];
    focusables()[focusables().length - 1]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Tab') {
        const items = focusables();
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [context, onClose]);

  if (!context) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-[#050B14]/80 backdrop-blur-sm p-13"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-modal-title"
        className="bg-[#050B14] border border-[#00E676] p-21 md:p-34 rounded-13 max-w-md w-full font-sans shadow-[0_0_34px_rgba(0,230,118,0.2)]"
      >
        <h3
          id="alert-modal-title"
          className={`text-21 font-bold caps-modern mb-8 whitespace-pre-wrap ${context.isError ? 'text-cyber-red' : 'text-[#00E676]'}`}
        >
          {context.title}
        </h3>
        <div className="text-13 text-[#E6F1FF]/89 mb-13 whitespace-pre-wrap leading-relaxed break-words">{context.message}</div>
        <div className="flex justify-end gap-8 mt-13">
          <button
            onClick={onClose}
            className="px-13 py-8 border border-[#E6F1FF]/13 rounded text-[10px] caps-modern text-[#E6F1FF]/55 hover:text-[#E6F1FF] hover:border-[#E6F1FF]/34 transition bg-transparent uppercase font-bold"
          >
            {context.onConfirm ? labels.cancel : labels.close}
          </button>
          {context.onConfirm && (
            <button
              onClick={context.onConfirm}
              className="px-13 py-8 text-[10px] caps-modern bg-[#00E676] text-[#050B14] font-bold rounded shadow transition hover:bg-[#00ffff] uppercase"
            >
              {context.confirmLabel || labels.continue}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
