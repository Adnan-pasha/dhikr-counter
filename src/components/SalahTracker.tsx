import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Flame, Calendar, ChevronLeft, CalendarCheck } from 'lucide-react';
import { SalahLog, SalahName, Routine, SALAH_META, HIJRI_MONTHS } from '../types';
import { AppIcon } from '../icons';
import SalahCalendar from './SalahCalendar';
import {
  FARD_PRAYERS, addDays, browserStorage, dayLabel, earliestDate, prayerCount, readInstallDate, salahStreak, toDateString,
} from '../salah';

// ─── Props ────────────────────────────────────────────────────────────────────

interface SalahTrackerProps {
  salahLogs: SalahLog[];
  onTogglePrayer: (date: string, prayer: SalahName) => void;
  /** Marks all five prayers done for a day, or clears the day. */
  onSetDay: (date: string, done: boolean) => void;
  /** Set right after a prayer is marked done, to offer the dhikr that follows it. */
  afterSalah?: { prayer: SalahName; routine: Routine | null } | null;
  onStartAfterSalah?: () => void;
  onDismissAfterSalah?: () => void;
  onGoBack: () => void;
  /** Today as the app sees it (it rolls over at midnight). Taken from the clock when not given. */
  today?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parse = (value: string): Date => {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
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

const stripBg = (count: number): string => {
  if (count === 0) return 'bg-slate-800 border-slate-700';
  if (count <= 2) return 'bg-brand-500/20 border-brand-500/30';
  if (count <= 4) return 'bg-brand-500/40 border-brand-500/50';
  return 'bg-emerald-500 border-emerald-500';
};

const TOTAL = FARD_PRAYERS.length;

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SalahTracker({ salahLogs, onTogglePrayer, onSetDay, afterSalah, onStartAfterSalah, onDismissAfterSalah, onGoBack, today }: SalahTrackerProps) {
  const todayStr = today ?? toDateString(new Date());
  const [selected, setSelected] = useState(todayStr);
  const [month, setMonth] = useState(() => ({ year: new Date().getFullYear(), month: new Date().getMonth() }));
  const earliest = useMemo(() => earliestDate(salahLogs, readInstallDate(browserStorage(), todayStr), todayStr), [salahLogs, todayStr]);

  const byDate = useMemo(() => new Map(salahLogs.map((l) => [l.date, l])), [salahLogs]);
  const countOn = (date: string) => prayerCount(byDate.get(date));
  const streak = useMemo(() => salahStreak(salahLogs, todayStr), [salahLogs, todayStr]);
  const allTimeTotal = useMemo(() => salahLogs.reduce((sum, log) => sum + prayerCount(log), 0), [salahLogs]);
  const last7 = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(todayStr, i - 6)), [todayStr]);

  const isToday = selected === todayStr;
  const selectedDate = parse(selected);
  const selectedLog = byDate.get(selected);
  const selectedCount = prayerCount(selectedLog);
  const yesterday = addDays(todayStr, -1);
  const showMissedHint = isToday && yesterday >= earliest && countOn(yesterday) < TOTAL;

  const open = (date: string) => {
    setSelected(date);
    const d = parse(date);
    setMonth({ year: d.getFullYear(), month: d.getMonth() });
  };

  // Someone looking at today when midnight passes moves on to the new today.
  const shownToday = React.useRef(todayStr);
  React.useEffect(() => {
    const previous = shownToday.current;
    shownToday.current = todayStr;
    if (previous !== todayStr && selected === previous) open(todayStr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayStr]);

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
            <p className="text-xl font-black" style={{ color: 'var(--color-text-brand)' }} role="img" aria-label={`${selectedCount} of ${TOTAL} prayers`}>
              {selectedCount}<span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>/{TOTAL}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="caption">
              {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: isToday ? undefined : 'numeric' })}
            </p>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-brand)', opacity: 0.8 }}>{getHijriDate(selectedDate)}</p>
          </div>
          {!isToday && (
            <button
              type="button"
              onClick={() => open(todayStr)}
              className="min-h-11 px-4 rounded-xl text-xs font-black cursor-pointer text-on-brand"
              style={{ background: 'var(--color-brand-500)' }}
            >
              Back to today
            </button>
          )}
        </div>

        {isToday && afterSalah?.routine && (
          <div id="after_salah_prompt" role="status" className="mt-4 rounded-2xl p-3.5" style={{ background: 'var(--color-bg-raised)', border: '1px solid var(--color-border)' }}>
            <p className="text-sm font-black" style={{ color: 'var(--color-text-primary)' }}>
              {SALAH_META[afterSalah.prayer].label} logged. Barakallahu feek.
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Continue with your {afterSalah.routine.name.toLowerCase()} dhikr ({afterSalah.routine.dhikrIds.length} adhkaar)?
            </p>
            <div className="flex gap-2 mt-3">
              <button
                id="btn_start_after_salah"
                type="button"
                onClick={onStartAfterSalah}
                className="tap-target flex-1 rounded-xl text-xs font-black cursor-pointer text-on-brand"
                style={{ background: 'var(--color-brand-500)' }}
              >
                Start dhikr
              </button>
              <button
                id="btn_dismiss_after_salah"
                type="button"
                onClick={onDismissAfterSalah}
                className="tap-target rounded-xl px-4 text-xs font-bold cursor-pointer"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Not now
              </button>
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="flex gap-3 mt-4 pb-4">
          <div className="flex-1 bg-slate-800/60 rounded-2xl p-3 border border-slate-700/60 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Streak</span>
            </div>
            <p className="text-xl font-black text-orange-400">{streak}</p>
            <p className="text-xs text-slate-400">days (all 5)</p>
          </div>
          <div className="flex-1 bg-slate-800/60 rounded-2xl p-3 border border-slate-700/60 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Calendar className="w-3.5 h-3.5 text-teal-400" />
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Total</span>
            </div>
            <p className="text-xl font-black text-teal-400">{allTimeTotal}</p>
            <p className="text-xs text-slate-400">prayers logged</p>
          </div>
          <div className="flex-1 bg-slate-800/60 rounded-2xl p-3 border border-slate-700/60 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Week</span>
            </div>
            <p className="text-xl font-black text-emerald-400">{last7.reduce((sum, d) => sum + countOn(d), 0)}</p>
            <p className="text-xs text-slate-400">this week</p>
          </div>
        </div>
      </div>

      <div className="scroll-area space-y-5">

        {showMissedHint && (
          <button
            type="button"
            onClick={() => open(yesterday)}
            className="w-full min-h-11 flex items-center gap-3 rounded-2xl px-4 py-3 text-left cursor-pointer"
            style={{ background: 'var(--color-bg-raised)', border: '1px solid var(--color-border)' }}
          >
            <CalendarCheck className="w-5 h-5 shrink-0 text-brand-400" aria-hidden="true" />
            <span className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
              Yesterday: {countOn(yesterday)}/{TOTAL}. Fill in what you prayed?
            </span>
          </button>
        )}

        {/* ── The day's prayers ──────────────────────────────────────── */}
        <section aria-labelledby="salah-day-heading">
          <div className="flex items-center justify-between mb-3 gap-2">
            <h2 id="salah-day-heading" className="text-xs font-black uppercase tracking-widest text-slate-400">
              {isToday ? "Today's Prayers" : selectedDate.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
            </h2>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => onSetDay(selected, true)}
                disabled={selectedCount === TOTAL}
                className="min-h-11 px-3 rounded-xl text-xs font-black cursor-pointer disabled:opacity-40 disabled:cursor-default"
                style={{ color: 'var(--color-text-brand)' }}
              >
                Mark all {TOTAL}
              </button>
              <button
                type="button"
                onClick={() => onSetDay(selected, false)}
                disabled={selectedCount === 0}
                className="min-h-11 px-3 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-default"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Clear day
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {FARD_PRAYERS.map((prayer, idx) => {
              const meta = SALAH_META[prayer];
              const done = selectedLog?.prayers[prayer] ?? false;
              return (
                <motion.button
                  key={prayer}
                  type="button"
                  role="checkbox"
                  aria-checked={done}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onTogglePrayer(selected, prayer)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${
                    done
                      ? 'bg-emerald-500/8 border-emerald-500/30'
                      : 'bg-slate-900/60 border-slate-800 hover:border-brand-500/30'
                  }`}
                >
                  <span
                    className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${done ? 'bg-emerald-500/15 text-emerald-400' : 'bg-brand-500/10 text-brand-400'}`}
                  >
                    <AppIcon name={meta.icon} className="w-5 h-5" />
                  </span>

                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-black ${done ? 'text-emerald-400' : 'text-slate-100'}`}>
                        {meta.label}
                      </p>
                      <p className="text-sm font-arabic text-slate-400" aria-hidden="true">{meta.arabicName}</p>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{meta.time}</p>
                  </div>

                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                    done
                      ? 'bg-emerald-500 border-emerald-500'
                      : 'border-slate-600 hover:border-brand-500'
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
          {selectedCount === TOTAL && (
            <motion.div
              role="status"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-gradient-to-r from-emerald-500/15 to-teal-500/10 border border-emerald-500/30 rounded-2xl p-4 text-center"
            >
              <AppIcon name="celebrate" className="w-7 h-7 mx-auto mb-2 text-emerald-400" />
              <p className="text-sm font-black text-emerald-400">All {TOTAL} Prayers Complete!</p>
              <p className="text-xs text-slate-300 mt-1">
                Alhamdulillah! May Allah accept your prayers.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Last 7 days ────────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
            Last 7 Days
          </h2>
          <div className="grid grid-cols-7 gap-1.5">
            {last7.map((date) => {
              const count = countOn(date);
              return (
                <button
                  key={date}
                  type="button"
                  aria-label={dayLabel(date, count)}
                  aria-pressed={date === selected}
                  disabled={date < earliest}
                  onClick={() => open(date)}
                  className="flex flex-col items-center gap-1 cursor-pointer disabled:cursor-default disabled:opacity-40"
                >
                  <div className={`w-full aspect-square min-h-11 rounded-xl border flex items-center justify-center ${stripBg(count)} ${date === selected ? 'ring-2 ring-brand-500 ring-offset-1 ring-offset-slate-950' : ''}`}>
                    <span className={`text-xs font-black ${count === TOTAL ? 'text-white' : count > 0 ? 'text-slate-200' : 'text-slate-400'}`}>
                      {count}
                    </span>
                  </div>
                  <span className={`text-xs font-bold ${date === todayStr ? 'text-brand-400' : 'text-slate-400'}`} aria-hidden="true">
                    {parse(date).toLocaleDateString('en-US', { weekday: 'narrow' })}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Calendar ───────────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
            Calendar
          </h2>
          <SalahCalendar
            logs={salahLogs}
            today={todayStr}
            earliest={earliest}
            selected={selected}
            month={month}
            onMonthChange={setMonth}
            onSelect={open}
          />
        </section>

        <div className="h-4" />
      </div>
    </div>
  );
}
