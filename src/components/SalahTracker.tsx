import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Flame, Calendar, ChevronLeft, ChevronRight, Moon } from 'lucide-react';
import { SalahLog, SalahName, SALAH_META, HIJRI_MONTHS } from '../types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface SalahTrackerProps {
  salahLogs: SalahLog[];
  onTogglePrayer: (date: string, prayer: SalahName) => void;
  onGoBack: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getLocalDateString = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getHijriDate = (date: Date): string => {
  const jd = Math.floor((date.getTime() / 86400000) + 2440587.5);
  const l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  const ll = l - 10631 * n + 354;
  const j = Math.floor((10985 - ll) / 5316) * Math.floor((50 * ll) / 17719)
    + Math.floor(ll / 5670) * Math.floor((43 * ll) / 15238);
  const lll = ll - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50)
    - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const month = Math.floor((24 * lll) / 709);
  const day = lll - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  return `${day} ${HIJRI_MONTHS[month - 1]} ${year} AH`;
};

const PRAYERS: SalahName[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];

// Get last 7 days for the heatmap
const getLast7Days = (): Date[] => {
  const days: Date[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  return days;
};

const getPrayerCount = (log: SalahLog | undefined): number => {
  if (!log) return 0;
  return Object.values(log.prayers).filter(Boolean).length;
};

const getStreakCount = (salahLogs: SalahLog[]): number => {
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = getLocalDateString(d);
    const log = salahLogs.find(l => l.date === dateStr);
    const count = getPrayerCount(log);
    if (i === 0 && count === 0) continue; // today doesn't break streak if not done yet
    if (count >= 5) streak++;
    else if (i > 0) break;
  }
  return streak;
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SalahTracker({ salahLogs, onTogglePrayer, onGoBack }: SalahTrackerProps) {
  const today = new Date();
  const todayStr = getLocalDateString(today);
  const last7Days = useMemo(() => getLast7Days(), []);
  const streak = useMemo(() => getStreakCount(salahLogs), [salahLogs]);
  const todayLog = salahLogs.find(l => l.date === todayStr);
  const todayCount = getPrayerCount(todayLog);
  const allTimeTotal = useMemo(() =>
    salahLogs.reduce((sum, log) => sum + getPrayerCount(log), 0),
    [salahLogs]
  );

  return (
    <div className="screen">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="screen-header">
        <div className="header-row">
          <button onClick={onGoBack} className="back-btn" aria-label="Go back to Home">
            <ChevronLeft className="w-5 h-5" />
            <span>Home</span>
          </button>
          <h1 className="screen-title text-center">Salah</h1>
          <div className="text-right min-w-[44px]">
            <p className="text-xl font-black" style={{ color: 'var(--color-text-brand)' }}>{todayCount}<span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>/6</span></p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="caption">
              {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-brand)', opacity: 0.8 }}>{getHijriDate(today)}</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-3 mt-4">
          <div className="flex-1 bg-slate-800/60 rounded-2xl p-3 border border-slate-700/60 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Streak</span>
            </div>
            <p className="text-xl font-black text-orange-400">{streak}</p>
            <p className="text-xs text-slate-500">days (5+ prayers)</p>
          </div>
          <div className="flex-1 bg-slate-800/60 rounded-2xl p-3 border border-slate-700/60 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Calendar className="w-3.5 h-3.5 text-teal-400" />
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Total</span>
            </div>
            <p className="text-xl font-black text-teal-400">{allTimeTotal}</p>
            <p className="text-xs text-slate-500">prayers logged</p>
          </div>
          <div className="flex-1 bg-slate-800/60 rounded-2xl p-3 border border-slate-700/60 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Week</span>
            </div>
            <p className="text-xl font-black text-emerald-400">
              {last7Days.reduce((sum, d) => {
                const log = salahLogs.find(l => l.date === getLocalDateString(d));
                return sum + getPrayerCount(log);
              }, 0)}
            </p>
            <p className="text-xs text-slate-500">this week</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-5">

        {/* ── Today's Prayers ────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
            Today's Prayers
          </h2>
          <div className="space-y-2">
            {PRAYERS.map((prayer, idx) => {
              const meta = SALAH_META[prayer];
              const done = todayLog?.prayers[prayer] ?? false;
              return (
                <motion.button
                  key={prayer}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onTogglePrayer(todayStr, prayer)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${
                    done
                      ? 'bg-emerald-500/8 border-emerald-500/30'
                      : 'bg-slate-900/60 border-slate-800 hover:border-amber-500/30'
                  }`}
                >
                  {/* Emoji */}
                  <span className="text-2xl shrink-0">{meta.emoji}</span>

                  {/* Info */}
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-black ${done ? 'text-emerald-400' : 'text-slate-100'}`}>
                        {meta.label}
                      </p>
                      <p className="text-sm font-arabic text-slate-400">{meta.arabicName}</p>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{meta.time}</p>
                  </div>

                  {/* Check circle */}
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                    done
                      ? 'bg-emerald-500 border-emerald-500'
                      : 'border-slate-600 hover:border-amber-500'
                  }`}>
                    <AnimatePresence>
                      {done && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                        >
                          <Check className="w-4 h-4 text-white stroke-[3]" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* ── Completion message ─────────────────────────────────────── */}
        <AnimatePresence>
          {todayCount === 6 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-gradient-to-r from-emerald-500/15 to-teal-500/10 border border-emerald-500/30 rounded-2xl p-4 text-center"
            >
              <p className="text-2xl mb-2">🎉</p>
              <p className="text-sm font-black text-emerald-400">All 6 Prayers Complete!</p>
              <p className="text-xs text-slate-400 mt-1">
                Alhamdulillah! May Allah accept your prayers. 🤲
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── 7-Day Heatmap ──────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
            Last 7 Days
          </h2>
          <div className="grid grid-cols-7 gap-1.5">
            {last7Days.map((day, idx) => {
              const dateStr = getLocalDateString(day);
              const log = salahLogs.find(l => l.date === dateStr);
              const count = getPrayerCount(log);
              const isToday = dateStr === todayStr;
              const pct = count / 6;

              const getBg = () => {
                if (count === 0) return 'bg-slate-800 border-slate-700';
                if (count <= 2) return 'bg-amber-500/20 border-amber-500/30';
                if (count <= 4) return 'bg-amber-500/40 border-amber-500/50';
                if (count === 5) return 'bg-emerald-500/40 border-emerald-500/50';
                return 'bg-emerald-500 border-emerald-500';
              };

              return (
                <div key={dateStr} className="flex flex-col items-center gap-1">
                  <div className={`w-full aspect-square rounded-xl border flex items-center justify-center relative ${getBg()} ${isToday ? 'ring-2 ring-amber-500 ring-offset-1 ring-offset-slate-950' : ''}`}>
                    <span className={`text-xs font-black ${count === 6 ? 'text-white' : count > 0 ? 'text-slate-200' : 'text-slate-600'}`}>
                      {count}
                    </span>
                  </div>
                  <span className={`text-xs font-bold ${isToday ? 'text-amber-400' : 'text-slate-500'}`}>
                    {day.toLocaleDateString('en-US', { weekday: 'narrow' })}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex items-center justify-end gap-3 mt-2">
            {[
              { color: 'bg-slate-800', label: '0' },
              { color: 'bg-amber-500/30', label: '1-2' },
              { color: 'bg-amber-500/60', label: '3-4' },
              { color: 'bg-emerald-500/60', label: '5' },
              { color: 'bg-emerald-500', label: '6' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1">
                <div className={`w-3 h-3 rounded ${color}`} />
                <span className="text-xs text-slate-500">{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Monthly Overview ───────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
            This Month
          </h2>
          <MonthlyGrid salahLogs={salahLogs} />
        </section>

        <div className="h-4" />
      </div>
    </div>
  );
}

// ─── Monthly Grid ──────────────────────────────────────────────────────────────

function MonthlyGrid({ salahLogs }: { salahLogs: SalahLog[] }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(year, month, i + 1);
    const dateStr = getLocalDateString(date);
    const log = salahLogs.find(l => l.date === dateStr);
    const count = getPrayerCount(log);
    const isToday = dateStr === getLocalDateString(today);
    const isFuture = date > today;
    return { day: i + 1, count, isToday, isFuture, dateStr };
  });

  const getBg = (count: number, isFuture: boolean) => {
    if (isFuture) return 'bg-slate-900 border-slate-800/50 text-slate-700';
    if (count === 0) return 'bg-slate-800/60 border-slate-700 text-slate-500';
    if (count <= 2) return 'bg-amber-500/15 border-amber-500/25 text-amber-400';
    if (count <= 4) return 'bg-amber-500/30 border-amber-500/40 text-amber-300';
    if (count === 5) return 'bg-emerald-500/25 border-emerald-500/35 text-emerald-300';
    return 'bg-emerald-500/40 border-emerald-500 text-emerald-200';
  };

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} className="text-center text-xs font-black text-slate-500">{d}</div>
        ))}
      </div>
      {/* Blank cells for first week */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDay }, (_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {days.map(({ day, count, isToday, isFuture }) => (
          <div
            key={day}
            className={`aspect-square rounded-lg border flex items-center justify-center text-xs font-black relative ${getBg(count, isFuture)} ${isToday ? 'ring-1 ring-amber-500 ring-offset-1 ring-offset-slate-950' : ''}`}
          >
            {day}
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500 text-center mt-2">
        {today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
      </p>
    </div>
  );
}
