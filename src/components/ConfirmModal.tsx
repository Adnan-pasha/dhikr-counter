import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  modal: {
    title: string;
    message: string;
    onConfirm: () => void;
  } | null;
  onCancel: () => void;
}

export default function ConfirmModal({ modal, onCancel }: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {modal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-full max-w-xs p-5 rounded-3xl bg-slate-900 border border-slate-800 text-slate-100 shadow-2xl flex flex-col items-center text-center"
          >
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>

            <h3 className="text-sm font-black tracking-tight mb-2 select-none">
              {modal.title}
            </h3>

            <p className="text-2xs text-slate-400 font-medium leading-relaxed mb-6 px-1 select-none">
              {modal.message}
            </p>

            <div className="flex w-full gap-3">
              <button
                id="btn_confirm_cancel"
                onClick={onCancel}
                className="flex-1 py-2 rounded-xl border border-slate-800 text-slate-300 font-bold text-2xs select-none hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn_confirm_action"
                onClick={modal.onConfirm}
                className="flex-1 py-2 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 text-slate-950 font-black text-2xs select-none hover:opacity-95 shadow-md shadow-amber-950/20 cursor-pointer"
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
