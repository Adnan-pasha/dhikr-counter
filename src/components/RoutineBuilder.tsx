import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sun, Moon, Play, Check, ChevronRight, Clock, BookMarked, RefreshCw } from 'lucide-react';
import { Dhikr } from '../types';
import { getMorningRoutine, getEveningRoutine } from '../adhkaar-data';

interface RoutineBuilderProps {
  currentDhikrId: string;
  completedTodayIds: string[];
  onStartDhikr: (id: string) => void;
}

type RoutineType = 'morning' | 'evening';

const ROUTINE_META = {
  morning: {
    label: 'Morning Routine',
    sublabel: 'Adhkaar for after Fajr',
    emoji: '🌅',
    icon: Sun,
    color: 'from-amber-500/20 to-orange-500/10',
    border: 'border-amber-500/30',
    accent: 'text-amber-400',
    badge: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    btn: 'from-amber-500 to-orange-400',
    getDhikrs: getMorningRoutine,
  },
  evening: {
    label: 'Evening Routine',
    sublabel: 'Adhkaar for after Maghrib',
    emoji: '🌙',
    icon: Moon,
    color: 'from-indigo-500/20 to-violet-500/10',
    border: 'border-indigo-500/30',
    accent: 'text-indigo-400',
    badge: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
    btn: 'from-indigo-500 to-violet-500',
    getDhikrs: getEveningRoutine,
  },
};

export default function RoutineBuilder({
  currentDhikrId,
  completedTodayIds,
  onStartDhikr,
}: RoutineBuilderProps) {
  const [activeRoutine, setActiveRoutine] = useState<RoutineType>('morning');
  const meta = ROUTINE_META[activeRoutine];
  const dhikrs = meta.getDhikrs();
  const completedCount = dhikrs.filter((d) => completedTodayIds.includes(d.id)).length;
  const progressPct = dhikrs.length > 0 ? Math.round((completedCount / dhikrs.length) * 100) : 0;
  const firstPending = dhikrs.find((d) => !completedTodayIds.includes(d.id));

  return (
    <div className="flex flex-col h-full bg-[#0f172a] text-slate-100 overflow-hidden">

      {/* Header */}
      <div className="px-5 pt-5 pb-4 bg-slate-900/60 backdrop-blur-md border-b border-slate-800/60">
        <h1 className="text-xl font-black tracking-tight text-slate-50 flex items-center gap-2 leading-none mb-1">
          <RefreshCw className="w-5 h-5 text-amber-500" />
          Daily Routines
        </h1>
        <p className="text-[10px] text-slate-400 font-medium">
          Structured adhkaar sequences from authentic sunnah
        </p>

        {/* Routine toggle */}
        <div className="flex gap-2 mt-4">
          {(['morning', 'evening'] as RoutineType[]).map((r) => {
            const m = ROUTINE_META[r];
            const Icon = m.icon;
            return (
              <button
                key={r}
                aria-label={`Switch to ${m.label}`}
                onClick={() => setActiveRoutine(r)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-black border transition-all cursor-pointer ${
                  activeRoutine === r
                    ? `bg-gradient-to-r ${m.color} ${m.border} ${m.accent}`
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {r === 'morning' ? 'Morning' : 'Evening'}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* Progress card */}
        <div className={`rounded-2xl border bg-gradient-to-br ${meta.color} ${meta.border} p-4`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className={`text-sm font-black ${meta.accent}`}>{meta.emoji} {meta.label}</h2>
              <p className="text-[10px] text-slate-400 mt-0.5">{meta.sublabel}</p>
            </div>
            <div className="text-right">
              <span className={`text-2xl font-black ${meta.accent}`}>{completedCount}</span>
              <span className="text-slate-500 text-sm font-bold">/{dhikrs.length}</span>
              <p className="text-[9px] text-slate-500 mt-0.5">completed today</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full bg-gradient-to-r ${meta.btn}`}
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
          <p className="text-[9px] text-slate-500 mt-1.5">{progressPct}% complete</p>

          {/* Start routine button */}
          {firstPending ? (
            <button
              aria-label={`Start ${meta.label}`}
              onClick={() => onStartDhikr(firstPending.id)}
              className={`mt-3 w-full py-2.5 rounded-xl bg-gradient-to-tr ${meta.btn} text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer hover:opacity-90 transition-opacity`}
            >
              <Play className="w-3.5 h-3.5" />
              {completedCount === 0 ? `Begin ${meta.label}` : `Continue — ${firstPending.nameEn}`}
            </button>
          ) : (
            <div className="mt-3 w-full py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 font-black text-xs flex items-center justify-center gap-2">
              <Check className="w-3.5 h-3.5" />
              Routine Complete! Masha'Allah 🎉
            </div>
          )}
        </div>

        {/* Dhikr sequence list */}
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2.5 px-1">
            Sequence — {dhikrs.length} adhkaar
          </h3>
          <div className="space-y-2">
            <AnimatePresence>
              {dhikrs.map((dhikr, idx) => {
                const isCompleted = completedTodayIds.includes(dhikr.id);
                const isActive = dhikr.id === currentDhikrId;
                const isPending = !isCompleted && dhikr.id === firstPending?.id;
                return (
                  <motion.div
                    key={dhikr.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      isCompleted
                        ? 'bg-emerald-500/5 border-emerald-500/20'
                        : isPending
                        ? `bg-gradient-to-r ${meta.color} ${meta.border}`
                        : 'bg-slate-900/60 border-slate-800'
                    }`}
                  >
                    {/* Step number / check */}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black border ${
                      isCompleted
                        ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                        : isPending
                        ? `bg-gradient-to-br ${meta.btn} border-transparent text-slate-950`
                        : 'bg-slate-800 border-slate-700 text-slate-500'
                    }`}>
                      {isCompleted ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-black leading-tight ${
                        isCompleted ? 'text-slate-400 line-through' : 'text-slate-100'
                      }`}>
                        {dhikr.nameEn}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-0.5 text-[9px] text-slate-500">
                          <Clock className="w-2.5 h-2.5" />
                          {dhikr.targetCount > 0 ? `${dhikr.targetCount}×` : '∞'}
                        </span>
                        {dhikr.sourceBook && (
                          <span className="flex items-center gap-0.5 text-[9px] text-slate-500 truncate">
                            <BookMarked className="w-2.5 h-2.5 shrink-0" />
                            {dhikr.sourceBook}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Arabic + action */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-arabic text-slate-300 max-w-[70px] truncate text-right">
                        {dhikr.nameAr}
                      </span>
                      {!isCompleted && (
                        <button
                          aria-label={`Start reciting ${dhikr.nameEn}`}
                          onClick={() => onStartDhikr(dhikr.id)}
                          className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-amber-400 hover:border-amber-500/30 transition-all cursor-pointer"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
        <div className="h-4" />
      </div>
    </div>
  );
}
