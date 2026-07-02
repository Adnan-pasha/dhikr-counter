import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Flame, Target, BookOpen, ChevronRight,
  Compass, Trophy, Play, Check, Moon, Sun,
  RefreshCw, Star, Clock
} from 'lucide-react';
import { Dhikr, DhikrHistory, Routine, UserPreferences } from '../types';
import { ADHKAAR_LIBRARY } from '../adhkaar-data';
import { isTimestampOnLocalDay } from '../domain';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HomeScreenProps {
  streak: number;
  history: DhikrHistory[];
  routines: Routine[];
  currentDhikrId: string;
  preferences: UserPreferences;
  favouriteIds: string[];
  customDhikrs: Dhikr[];
  onNavigateTo: (tab: 'counter' | 'adhkaar' | 'routine' | 'salah' | 'quran' | 'qibla' | 'stats' | 'settings') => void;
  onStartDhikr: (id: string) => void;
  onStartRoutine: (routineId: string, firstDhikrId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Hijri date calculation
function getHijriDate(): string {
  const now = new Date();
  // Simple Hijri calculation (approximate — within 1 day)
  const jd = Math.floor((now.getTime() / 86400000) + 2440587.5);
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

  const HIJRI_MONTHS = [
    'Muharram','Safar','Rabi al-Awwal','Rabi al-Thani',
    'Jumada al-Awwal','Jumada al-Thani','Rajab','Sha\'ban',
    'Ramadan','Shawwal','Dhul Qa\'dah','Dhul Hijjah'
  ];
  return `${day} ${HIJRI_MONTHS[month - 1]} ${year} AH`;
}

// Time of day greeting
function getGreeting(): { text: string; emoji: string } {
  const h = new Date().getHours();
  if (h >= 4 && h < 7)  return { text: 'Fajr Time',     emoji: '🌄' };
  if (h >= 7 && h < 12) return { text: 'Good Morning',  emoji: '🌅' };
  if (h >= 12 && h < 15) return { text: 'Good Afternoon', emoji: '☀️' };
  if (h >= 15 && h < 18) return { text: 'Asr Time',     emoji: '🌤️' };
  if (h >= 18 && h < 20) return { text: 'Maghrib Time', emoji: '🌇' };
  if (h >= 20 && h < 22) return { text: 'Isha Time',    emoji: '🌙' };
  return { text: 'Good Night',   emoji: '✨' };
}

// Daily ayah - rotates by day of year
const DAILY_AYAHS = [
  { ar: 'أَلَا بِذِكْرِ ٱللَّٰهِ تَطْمَئِنُّ ٱلْقُلُوبُ', en: 'Verily, in the remembrance of Allah do hearts find rest.', ref: 'Quran 13:28' },
  { ar: 'وَٱذْكُر رَّبَّكَ كَثِيرًا', en: 'And remember your Lord much.', ref: 'Quran 3:41' },
  { ar: 'يَٰٓأَيُّهَا ٱلَّذِينَ ءَامَنُوا۟ ٱذْكُرُوا۟ ٱللَّٰهَ ذِكْرًا كَثِيرًا', en: 'O you who believe! Remember Allah with much remembrance.', ref: 'Quran 33:41' },
  { ar: 'فَٱذْكُرُونِىٓ أَذْكُرْكُمْ', en: 'So remember Me; I will remember you.', ref: 'Quran 2:152' },
  { ar: 'إِنَّ ٱللَّٰهَ مَعَ ٱلصَّٰبِرِينَ', en: 'Indeed, Allah is with the patient.', ref: 'Quran 2:153' },
  { ar: 'وَٱللَّٰهُ يُحِبُّ ٱلصَّٰبِرِينَ', en: 'And Allah loves the steadfast.', ref: 'Quran 3:146' },
  { ar: 'حَسْبُنَا ٱللَّٰهُ وَنِعْمَ ٱلْوَكِيلُ', en: 'Allah is sufficient for us and He is the best disposer of affairs.', ref: 'Quran 3:173' },
];

function getDailyAyah() {
  const day = Math.floor(Date.now() / 86400000);
  return DAILY_AYAHS[day % DAILY_AYAHS.length];
}

// Get today's completed dhikr ids from history
function getCompletedTodayIds(history: DhikrHistory[]): string[] {
  return history.filter(h => isTimestampOnLocalDay(h.timestamp)).map(h => h.dhikrId);
}

// Get all-time bead count
function getAllTimeCount(history: DhikrHistory[]): number {
  return history.reduce((sum, h) => sum + h.count, 0);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function HomeScreen({
  streak,
  history,
  routines,
  currentDhikrId,
  preferences,
  favouriteIds,
  customDhikrs,
  onNavigateTo,
  onStartDhikr,
  onStartRoutine,
}: HomeScreenProps) {
  const [time, setTime] = useState(new Date());
  const completedTodayIds = useMemo(() => getCompletedTodayIds(history), [history]);
  const allTimeCount = useMemo(() => getAllTimeCount(history), [history]);
  const greeting = getGreeting();
  const ayah = getDailyAyah();
  const hijriDate = useMemo(() => getHijriDate(), []);
  const allDhikrs = [...ADHKAAR_LIBRARY, ...customDhikrs];
  const currentDhikr = allDhikrs.find(d => d.id === currentDhikrId) ?? ADHKAAR_LIBRARY[0];

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Today's routine progress — position-aware to handle duplicate dhikrIds correctly
  const todayRoutines = routines.slice(0, 3).map(r => {
    const dhikrs = r.dhikrIds.map(id => allDhikrs.find(d => d.id === id)).filter(Boolean) as Dhikr[];
    let completed = 0;
    let firstPending: Dhikr | undefined;
    const seenCompleted = new Map<string, number>();
    for (const dhikr of dhikrs) {
      const seen = seenCompleted.get(dhikr.id) ?? 0;
      const doneCount = completedTodayIds.filter(id => id === dhikr.id).length;
      if (seen < doneCount) {
        completed++;
        seenCompleted.set(dhikr.id, seen + 1);
      } else if (!firstPending) {
        firstPending = dhikr;
      }
    }
    return { ...r, total: dhikrs.length, completed, firstPending };
  });

  // Favourite dhikrs quick access
  const favDhikrs = allDhikrs.filter(d => favouriteIds.includes(d.id)).slice(0, 4);

  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-hide" style={{ background: 'var(--color-bg-base)' }}>

      {/* ── Hero Header ──────────────────────────────────────────────────── */}
      <div className="relative px-5 pt-6 pb-5 overflow-hidden shrink-0"
        style={{ background: 'linear-gradient(180deg, var(--color-bg-surface) 0%, transparent 100%)', borderBottom: '1px solid var(--color-border-muted)' }}
      >
        {/* Decorative glows */}
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.07) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-36 h-36 rounded-full blur-3xl pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)' }} />

        {/* Greeting + date */}
        <div className="relative z-10">
          <div className="flex items-start justify-between">
            <div>
              <p className="section-label" style={{ color: 'var(--color-text-brand)', opacity: 0.9 }}>
                {greeting.emoji} {greeting.text}
              </p>
              <h1 className="font-display font-black text-2xl mt-0.5 leading-tight" style={{ color: 'var(--color-text-primary)' }}>
                Dhikr Counter
              </h1>
              <p className="text-xs mt-1 font-medium" style={{ color: 'var(--color-text-muted)' }}>
                {time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--color-text-brand)', opacity: 0.7 }}>{hijriDate}</p>
            </div>
            {/* Live clock */}
            <div className="text-right">
              <p className="font-display font-black text-2xl tabular-nums leading-none" style={{ color: 'var(--color-text-primary)' }}>
                {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </p>
              <p className="section-label mt-1">Local Time</p>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex gap-2.5 mt-4">
            {[
              { icon: <Flame className="w-3.5 h-3.5" />, label: 'Streak', value: streak, unit: 'days', color: '#FB923C' },
              { icon: <Target className="w-3.5 h-3.5" />, label: 'Today', value: completedTodayIds.length, unit: 'adhkaar', color: '#F59E0B' },
              { icon: <Trophy className="w-3.5 h-3.5" />, label: 'Total', value: allTimeCount >= 1000 ? `${(allTimeCount / 1000).toFixed(1)}k` : allTimeCount, unit: 'beads', color: '#FBBF24' },
            ].map(({ icon, label, value, unit, color }) => (
              <div key={label} className="flex-1 rounded-2xl p-3" style={{ background: 'var(--color-bg-raised)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-1.5 mb-1.5" style={{ color }}>
                  {icon}
                  <span className="section-label" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
                </div>
                <p className="font-display font-black text-xl leading-none" style={{ color }}>{value}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{unit}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="scroll-area space-y-5">

        {/* ── Quick Tasbih ─────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="section-label">Quick Tasbih</h2>
            <button onClick={() => onNavigateTo('counter')} className="text-xs font-black cursor-pointer flex items-center gap-0.5 transition-colors" style={{ color: 'var(--color-text-brand)' }}>
              Open <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => onStartDhikr(currentDhikrId)}
            className="w-full card-featured rounded-2xl p-4 flex items-center gap-4 cursor-pointer transition-all hover:brightness-110"
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <span className="text-xl font-arabic" style={{ color: 'var(--color-text-brand)' }}>{currentDhikr.nameAr.slice(0, 3)}</span>
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="font-display font-black text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{currentDhikr.nameEn}</p>
              {currentDhikr.transliteration && (
                <p className="text-xs italic mt-0.5 truncate" style={{ color: 'var(--color-text-brand)', opacity: 0.7 }}>{currentDhikr.transliteration}</p>
              )}
              <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>{currentDhikr.meaning}</p>
            </div>
            <div className="shrink-0 flex flex-col items-center gap-1">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg, #F59E0B, #F97316)', boxShadow: '0 4px 16px rgba(245,158,11,0.3)' }}>
                <Play className="w-4 h-4 fill-slate-950 text-slate-950" />
              </div>
              <span className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>{currentDhikr.targetCount}×</span>
            </div>
          </motion.button>
        </section>

        {/* ── Daily Ayah ──────────────────────────────────────────────────── */}
        <section>
          <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.06))', border: '1px solid rgba(99,102,241,0.2)' }}>
            <div className="flex items-center gap-1.5 mb-3">
              <Star className="w-3 h-3" style={{ color: '#818CF8' }} />
              <span className="section-label" style={{ color: '#818CF8' }}>Ayah of the Day</span>
            </div>
            <p className="font-arabic text-lg leading-loose text-right mb-2" style={{ color: 'var(--color-text-primary)' }}>{ayah.ar}</p>
            <p className="text-sm leading-relaxed italic" style={{ color: 'var(--color-text-secondary)' }}>"{ayah.en}"</p>
            <p className="text-xs font-bold mt-2" style={{ color: '#818CF8', opacity: 0.7 }}>{ayah.ref}</p>
          </div>
        </section>

        {/* ── Today's Routines ────────────────────────────────────────────── */}
        {todayRoutines.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="section-label">Today's Routines</h2>
              <button onClick={() => onNavigateTo('routine')} className="text-xs font-black cursor-pointer flex items-center gap-0.5" style={{ color: 'var(--color-text-brand)' }}>
                All <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-2.5">
              {todayRoutines.map((routine, idx) => {
                const pct = routine.total > 0 ? Math.round((routine.completed / routine.total) * 100) : 0;
                const allDone = routine.completed === routine.total && routine.total > 0;
                return (
                  <motion.div
                    key={routine.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="rounded-2xl p-3.5"
                    style={{
                      background: allDone ? 'rgba(16,185,129,0.06)' : 'var(--color-bg-surface)',
                      border: `1px solid ${allDone ? 'rgba(16,185,129,0.25)' : 'var(--color-border)'}`,
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{routine.emoji}</span>
                        <div>
                          <p className="text-xs font-black leading-tight" style={{ color: allDone ? '#10B981' : 'var(--color-text-primary)' }}>
                            {routine.name}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            {routine.completed}/{routine.total} adhkaar
                          </p>
                        </div>
                      </div>
                      {allDone ? (
                        <span className="badge badge-emerald"><Check className="w-2.5 h-2.5" /> Done</span>
                      ) : (
                        <motion.button
                          whileTap={{ scale: 0.93 }}
                          onClick={() => routine.firstPending && onStartRoutine(routine.id, routine.firstPending.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-black cursor-pointer"
                          style={{ background: 'linear-gradient(135deg, #F59E0B, #F97316)', color: '#0B1120', boxShadow: '0 2px 10px rgba(245,158,11,0.25)' }}
                        >
                          <Play className="w-2.5 h-2.5 fill-current" />
                          {routine.completed === 0 ? 'Begin' : 'Continue'}
                        </motion.button>
                      )}
                    </div>
                    <div className="progress-bar">
                      <motion.div
                        className="progress-fill"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut', delay: idx * 0.1 }}
                        style={{ background: allDone ? '#10B981' : undefined }}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Favourite Adhkaar ───────────────────────────────────────────── */}
        {favDhikrs.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="section-label">❤️ Favourites</h2>
              <button onClick={() => onNavigateTo('adhkaar')} className="text-xs font-black cursor-pointer flex items-center gap-0.5" style={{ color: 'var(--color-text-brand)' }}>
                All <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {favDhikrs.map((dhikr, idx) => {
                const done = completedTodayIds.includes(dhikr.id);
                return (
                  <motion.button
                    key={dhikr.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onStartDhikr(dhikr.id)}
                    className="text-left p-3 rounded-2xl cursor-pointer transition-all"
                    style={{
                      background: done ? 'rgba(16,185,129,0.06)' : 'var(--color-bg-surface)',
                      border: `1px solid ${done ? 'rgba(16,185,129,0.25)' : 'var(--color-border)'}`,
                    }}
                  >
                    <p className="text-xs font-black truncate" style={{ color: 'var(--color-text-primary)' }}>{dhikr.nameEn}</p>
                    <p className="text-xs italic mt-0.5 truncate" style={{ color: 'var(--color-text-brand)', opacity: 0.7 }}>
                      {dhikr.transliteration ?? dhikr.meaning}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>{dhikr.targetCount}×</span>
                      {done && <Check className="w-3 h-3" style={{ color: '#10B981' }} />}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Explore grid ────────────────────────────────────────────────── */}
        <section>
          <h2 className="section-label mb-2.5">Explore</h2>
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: '📿', label: 'Counter',  tab: 'counter'  as const, bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.18)', text: '#F59E0B' },
              { icon: '📖', label: 'Adhkaar',  tab: 'adhkaar'  as const, bg: 'rgba(20,184,166,0.10)', border: 'rgba(20,184,166,0.18)', text: '#2DD4BF' },
              { icon: '🌅', label: 'Routines', tab: 'routine'  as const, bg: 'rgba(99,102,241,0.10)', border: 'rgba(99,102,241,0.18)', text: '#818CF8' },
              { icon: '🕌', label: 'Salah',    tab: 'salah'    as const, bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.18)', text: '#34D399' },
              { icon: '📗', label: 'Quran',    tab: 'quran'    as const, bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.18)',  text: '#4ADE80' },
              { icon: '🧭', label: 'Qibla',    tab: 'qibla'    as const, bg: 'rgba(6,182,212,0.10)',  border: 'rgba(6,182,212,0.18)',  text: '#22D3EE' },
            ].map(({ icon, label, tab, bg, border, text }) => (
              <motion.button
                key={tab}
                whileTap={{ scale: 0.93 }}
                onClick={() => onNavigateTo(tab)}
                className="flex flex-col items-center gap-2 p-3 rounded-2xl cursor-pointer"
                style={{ background: bg, border: `1px solid ${border}` }}
              >
                <span className="text-2xl">{icon}</span>
                <span className="section-label" style={{ color: text }}>{label}</span>
              </motion.button>
            ))}
          </div>
        </section>

        {/* ── Qibla shortcut ─────────────────────────────────────────────── */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => onNavigateTo('qibla')}
          className="w-full rounded-2xl p-4 flex items-center gap-4 cursor-pointer"
          style={{ background: 'rgba(6,182,212,0.07)', border: '1px solid rgba(6,182,212,0.15)' }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(6,182,212,0.14)', border: '1px solid rgba(6,182,212,0.2)' }}>
            <Compass className="w-5 h-5" style={{ color: '#22D3EE' }} />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-black" style={{ color: 'var(--color-text-primary)' }}>Qibla & Namaz</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Prayer times, compass & Azan</p>
          </div>
          <ChevronRight className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
        </motion.button>

        <div className="h-4" />
      </div>
    </div>
  );
}
