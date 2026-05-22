import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock } from 'lucide-react';
import { DhikrReminder, UserPreferences } from '../types';
import { playCompletionSound } from '../audio';

interface ReminderBannerProps {
  reminder: DhikrReminder | null;
  preferences: UserPreferences;
  onDismiss: () => void;
  onStartChanting: (dhikrId: string) => void;
}

export default function ReminderBanner({
  reminder,
  preferences,
  onDismiss,
  onStartChanting,
}: ReminderBannerProps) {
  return (
    <AnimatePresence>
      {reminder && (
        <motion.div
          initial={{ opacity: 0, y: -80, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: -80, x: '-50%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          className="absolute top-4 left-1/2 -translate-x-1/2 w-[92%] z-50 bg-slate-900 border border-amber-500/40 text-slate-100 p-4 rounded-3xl shadow-2xl flex flex-col gap-3.5"
        >
          <div className="flex gap-2.5 items-start">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/15 animate-pulse shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest block">Gentle Remembrance Alert</span>
              <h4 className="text-xs font-black truncate leading-tight text-slate-50">{reminder.label}</h4>
              <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                Time to chant: <span className="text-slate-200 font-bold">{reminder.dhikrName}</span>
              </span>
            </div>
          </div>

          <div className="flex gap-2 border-t border-slate-800/60 pt-3">
            <button
              onClick={onDismiss}
              className="flex-1 py-1.5 rounded-xl border border-slate-800 text-slate-400 font-black text-2xs hover:bg-slate-800 hover:text-white transition-all cursor-pointer"
            >
              Skip
            </button>
            <button
              onClick={() => {
                onStartChanting(reminder.dhikrId);
                if (preferences.soundOn) {
                  playCompletionSound(preferences.volume);
                }
              }}
              className="flex-[2] py-1.5 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 text-slate-950 font-black text-2xs shadow-md shadow-amber-950/20 hover:opacity-95 transition-all text-center flex items-center justify-center gap-1 cursor-pointer"
            >
              Start Chanting Now 📿
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
