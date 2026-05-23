import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, X } from 'lucide-react';
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
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          className="w-full overflow-hidden z-50 bg-amber-500/10 border-b border-amber-500/30"
        >
          <div className="px-4 py-3 flex items-center gap-3">
            {/* Icon */}
            <div className="p-1.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/20 shrink-0">
              <Clock className="w-3.5 h-3.5 animate-pulse" />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest block leading-none">
                Gentle Remembrance Alert
              </span>
              <h4 className="text-xs font-black text-slate-50 truncate leading-tight mt-0.5">
                {reminder.label}
              </h4>
              <span className="text-[10px] text-slate-400 font-medium">
                {reminder.dhikrName}
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  onStartChanting(reminder.dhikrId);
                  if (preferences.soundOn) {
                    playCompletionSound(preferences.volume);
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 text-slate-950 font-black text-[10px] shadow-md cursor-pointer hover:opacity-90 transition-opacity whitespace-nowrap"
              >
                Start 📿
              </button>
              <button
                onClick={onDismiss}
                aria-label="Dismiss reminder"
                className="p-1.5 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
