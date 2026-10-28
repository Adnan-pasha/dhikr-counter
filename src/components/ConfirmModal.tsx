import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle } from 'lucide-react';
import { ConfirmModalState } from '../types';

interface ConfirmModalProps {
  modal: ConfirmModalState | null;
  onCancel: () => void;
}

export default function ConfirmModal({ modal, onCancel }: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  // Parents pass a fresh onCancel every render; a ref keeps the open/close effect stable.
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  const isOpen = modal !== null;

  // Move focus into the dialog on open and restore it on close; Escape cancels.
  useEffect(() => {
    if (!isOpen) return;
    const returnFocusTo = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancelRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      returnFocusTo?.focus?.();
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {modal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-xs">
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            aria-describedby="confirm-modal-message"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-full max-w-xs p-5 rounded-3xl bg-slate-900 border border-slate-800 text-slate-100 shadow-2xl flex flex-col items-center text-center"
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
              modal.destructive
                ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                : 'bg-brand-500/10 border border-brand-500/20 text-brand-400'
            }`}>
              <AlertTriangle className="w-6 h-6 animate-pulse" aria-hidden="true" />
            </div>

            <h3 id="confirm-modal-title" className="text-sm font-black tracking-tight mb-2 select-none">
              {modal.title}
            </h3>

            <p id="confirm-modal-message" className="text-2xs text-slate-400 font-medium leading-relaxed mb-6 px-1 select-none">
              {modal.message}
            </p>

            <div className="flex w-full gap-3">
              <button
                id="btn_confirm_cancel"
                ref={cancelRef}
                onClick={onCancel}
                className="flex-1 py-2 rounded-xl border border-slate-800 text-slate-300 font-bold text-2xs select-none hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn_confirm_action"
                onClick={modal.onConfirm}
                className={`flex-1 py-2 rounded-xl font-black text-2xs select-none hover:opacity-95 shadow-md cursor-pointer ${
                  modal.destructive
                    ? 'bg-red-600 text-white shadow-red-950/30'
                    : 'bg-gradient-to-tr from-brand-500 to-brand-400 text-on-brand shadow-brand-950/20'
                }`}
              >
                Confirm
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
