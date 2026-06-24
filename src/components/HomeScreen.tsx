import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Flame, Target, BookOpen, ChevronRight,
  Compass, Trophy, Play, Check, Moon, Sun,
  RefreshCw, Star, Clock
} from 'lucide-react';
import { Dhikr, DhikrHistory, Routine, UserPreferences } from '../types';
import { ADHKAAR_LIBRARY } from '../adhkaar-data';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HomeScreenProps {
  streak: number;
  history: DhikrHistory[];
  routines: Routine[];
  currentDhikrId: string;
  preferences: UserPreferences;
  favouriteIds: string[];
  customDhikrs: Dhikr[];
  onNavigateTo: (tab: 'counter' | 'adhkaar' | 'routine' | 'salah' | 'qibla' | 'stats' | 'settings') => void;
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
  const today = new Date();
  return history
    .filter(h => {
      const d = new Date(h.timestamp);
      return d.getFullYear() === today.getFullYear()
        && d.getMonth() === today.getMonth()
        && d.getDate() === today.getDate();
    })
    .map(h => h.dhikrId);
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

  // Today's routine progress
  const todayRoutines = routines.slice(0, 3).map(r => {
    const dhikrs = r.dhikrIds.map(id => allDhikrs.find(d => d.id === id)).filter(Boolean) as Dhikr[];
    const completed = dhikrs.filter(d => completedTodayIds.includes(d.id)).length;
    return { ...r, total: dhikrs.length, completed, firstPending: dhikrs.find(d => !completedTodayIds.includes(d.id)) };
  });

  // Favourite dhikrs quick access
  const favDhikrs = allDhikrs.filter(d => favouriteIds.includes(d.id)).slice(0, 4);

  return (
    <div className="flex flex-col h-full bg-[#0f172a] text-slate-100 overflow-y-auto">

      {/* ── Hero Header ──────────────────────────────────────────────────── */}
      <div className="relative px-5 pt-6 pb-5 bg-gradient-to-b from-slate-900 to-[#0f172a] border-b border-slate-800/60 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Greeting + date */}
        <div className="relative z-10">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-500/80">
                {greeting.emoji} {greeting.text}
              </p>
              <h1 className="text-2xl font-black text-slate-50 mt-0.5 leading-tight">
                Dhikr Counter
              </h1>
              <p className="text-[10px] text-slate-500 mt-1 font-medium">
                {time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              <p className="text-[10px] text-amber-500/70 font-medium">{hijriDate}</p>
            </div>
            {/* Live clock */}
            <div className="text-right">
              <p className="text-2xl font-black text-slate-100 tabular-nums leading-none">
                {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </p>
              <p className="text-[9px] text-slate-500 mt-1 uppercase tracking-widest">Local Time</p>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex gap-3 mt-4">
            <div className="flex-1 bg-slate-800/60 rounded-2xl p-3 border border-slate-700/60">
              <div className="flex items-center gap-1.5 mb-1">
                <Flame className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Streak</span>
              </div>
              <p className="text-xl font-black text-orange-400">{streak}</p>
              <p className="text-[9px] text-slate-500">consecutive days</p>
            </div>
            <div className="flex-1 bg-slate-800/60 rounded-2xl p-3 border border-slate-700/60">
              <div className="flex items-center gap-1.5 mb-1">
                <Target className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Today</span>
              </div>
              <p className="text-xl font-black text-amber-400">{completedTodayIds.length}</p>
              <p className="text-[9px] text-slate-500">adhkaar done</p>
            </div>
            <div className="flex-1 bg-slate-800/60 rounded-2xl p-3 border border-slate-700/60">
              <div className="flex items-center gap-1.5 mb-1">
                <Trophy className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total</span>
              </div>
              <p className="text-xl font-black text-yellow-400">
                {allTimeCount >= 1000 ? `${(allTimeCount / 1000).toFixed(1)}k` : allTimeCount}
              </p>
              <p className="text-[9px] text-slate-500">all-time beads</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-5">

        {/* ── Quick Tasbih ─────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Quick Tasbih</h2>
            <button onClick={() => onNavigateTo('counter')} className="text-[10px] font-black text-amber-400 hover:text-amber-300 cursor-pointer flex items-center gap-0.5">
              Open <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => onStartDhikr(currentDhikrId)}
            className="w-full bg-gradient-to-br from-slate-800 to-slate-900 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:border-amber-500/50 transition-all"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <span className="text-xl font-arabic text-amber-400">{currentDhikr.nameAr.slice(0, 3)}</span>
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-black text-slate-100">{currentDhikr.nameEn}</p>
              {currentDhikr.transliteration && (
                <p className="text-[10px] text-amber-400/70 italic mt-0.5">{currentDhikr.transliteration}</p>
              )}
              <p className="text-[10px] text-slate-500 mt-0.5 truncate">{currentDhikr.meaning}</p>
            </div>
            <div className="shrink-0 flex flex-col items-center gap-1">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center shadow-lg shadow-amber-950/30">
                <Play className="w-4 h-4 text-slate-950 fill-slate-950" />
              </div>
              <span className="text-[9px] text-slate-500">{currentDhikr.targetCount}×</span>
            </div>
          </motion.button>
        </section>

        {/* ── Daily Ayah ──────────────────────────────────────────────────── */}
        <section>
          <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border border-indigo-500/20 rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <Star className="w-3 h-3 text-indigo-400" />
              <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Ayah of the Day</span>
            </div>
            <p className="text-base font-arabic text-slate-100 leading-loose text-right mb-2">{ayah.ar}</p>
            <p className="text-[11px] text-slate-300 leading-relaxed italic">"{ayah.en}"</p>
            <p className="text-[9px] text-indigo-400/70 font-bold mt-2">{ayah.ref}</p>
          </div>
        </section>

        {/* ── Today's Routines ────────────────────────────────────────────── */}
        {todayRoutines.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Today's Routines</h2>
              <button onClick={() => onNavigateTo('routine')} className="text-[10px] font-black text-amber-400 hover:text-amber-300 cursor-pointer flex items-center gap-0.5">
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
                    className={`rounded-2xl border p-3.5 ${allDone ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-slate-900/60 border-slate-800'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{routine.emoji}</span>
                        <div>
                          <p className={`text-xs font-black leading-tight ${allDone ? 'text-emerald-400' : 'text-slate-100'}`}>
                            {routine.name}
                          </p>
                          <p className="text-[9px] text-slate-500">
                            {routine.completed}/{routine.total} adhkaar
                          </p>
                        </div>
                      </div>
                      {allDone ? (
                        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/25">
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-[9px] font-black text-emerald-400">Done!</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => routine.firstPending && onStartRoutine(routine.id, routine.firstPending.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 text-slate-950 font-black text-[9px] cursor-pointer hover:opacity-90 shadow-sm"
                        >
                          <Play className="w-2.5 h-2.5 fill-slate-950" />
                          {routine.completed === 0 ? 'Begin' : 'Continue'}
                        </button>
                      )}
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${allDone ? 'bg-emerald-400' : 'bg-gradient-to-r from-amber-500 to-orange-400'}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut', delay: idx * 0.1 }}
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
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">❤️ Favourites</h2>
              <button onClick={() => onNavigateTo('adhkaar')} className="text-[10px] font-black text-amber-400 hover:text-amber-300 cursor-pointer flex items-center gap-0.5">
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
                    whileTap={{ scale: 0.96 }}
                    onClick={() => onStartDhikr(dhikr.id)}
                    className={`text-left p-3 rounded-2xl border cursor-pointer transition-all ${
                      done ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-slate-900/60 border-slate-800 hover:border-amber-500/30'
                    }`}
                  >
                    <p className="text-xs font-black text-slate-100 truncate">{dhikr.nameEn}</p>
                    <p className="text-[9px] text-amber-400/70 italic mt-0.5 truncate">{dhikr.transliteration ?? dhikr.meaning}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[9px] text-slate-500">{dhikr.targetCount}×</span>
                      {done && <Check className="w-3 h-3 text-emerald-400" />}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Quick Nav Grid ──────────────────────────────────────────────── */}
        <section>
          <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2.5">Explore</h2>
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: '📿', label: 'Counter',  tab: 'counter'  as const, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
              { icon: '📖', label: 'Adhkaar',  tab: 'adhkaar'  as const, color: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
              { icon: '🌅', label: 'Routines', tab: 'routine'  as const, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
              { icon: '🕌', label: 'Salah',    tab: 'salah'    as const, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
              { icon: '🧭', label: 'Qibla',    tab: 'qibla'    as const, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
              { icon: '🏆', label: 'Stats',    tab: 'stats'    as const, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
            ].map(({ icon, label, tab, color }) => (
              <motion.button
                key={tab}
                whileTap={{ scale: 0.94 }}
                onClick={() => onNavigateTo(tab)}
                className={`flex flex-col items-center gap-2 p-3 rounded-2xl border cursor-pointer transition-all hover:scale-105 ${color}`}
              >
                <span className="text-2xl">{icon}</span>
                <span className="text-[9px] font-black uppercase tracking-wider">{label}</span>
              </motion.button>
            ))}
          </div>
        </section>

        {/* ── Qibla shortcut ─────────────────────────────────────────────── */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => onNavigateTo('qibla')}
          className="w-full bg-gradient-to-r from-cyan-500/10 to-teal-500/5 border border-cyan-500/20 rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:border-cyan-500/40 transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center shrink-0">
            <Compass className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-black text-slate-100">Qibla & Namaz</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Prayer times, compass & Azan</p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </motion.button>

        <div className="h-4" />
      </div>
    </div>
  );
}
