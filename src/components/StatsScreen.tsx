import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart2, 
  Flame, 
  Trophy, 
  Calendar, 
  CheckCircle2, 
  History, 
  AlertCircle, 
  Award, 
  BookOpen, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  Copy, 
  Check, 
  Search,
  Lock,
  Compass
} from 'lucide-react';
import { DhikrHistory, DailyLog, Dhikr } from '../types';

interface StatsScreenProps {
  history: DhikrHistory[];
  streak: number;
  allTimeCount: number;
  onClearHistory: () => void;
  dhikrs: Dhikr[];
}

// Spiritual Gamification Levels Configuration
const LEVELS = [
  { level: 1, name: "Initiate Seeker (Mubtadi)", minBeads: 0, maxBeads: 299, desc: "You have embarked on your beautiful path of mindfulness and remembrance." },
  { level: 2, name: "Constant Rememberer (Zakir)", minBeads: 300, maxBeads: 999, desc: "Your heart is starting to feel the warmth of continuous daily Dhikr." },
  { level: 3, name: "Devoted Servant (Abid)", minBeads: 1000, maxBeads: 2999, desc: "You are consistent in prayer. Your virtuous habits are firmly established." },
  { level: 4, name: "Knower of Truth (Arif)", minBeads: 3000, maxBeads: 9999, desc: "Remembrance of Allah has become a peaceful sanctuary for your daily life." },
  { level: 5, name: "Sincere Friend (Wali)", minBeads: 10000, maxBeads: 9999999, desc: "SubhanAllah! You have achieved excellence in consistency. May Allah grant you steadfastness." },
];

// Authentic referenced Hadiths from top books
const HADITHS = [
  {
    title: "The Living and the Dead",
    source: "Sahih Al-Bukhari 6407",
    narrator: "Narrated Abu Musa (RA)",
    arabic: "مَثَلُ الَّذِي يَذْكُرُ رَبَّهُ وَالَّذِي لَا يَذْكُرُ رَبَّهُ مَثَلُ الْحَيِّ وَالْمَيِّتِ",
    english: "The comparison of the one who remembers his Lord and the one who does not remember Him, is like that of the living and the dead.",
    benefit: "Dhikr is the life-blood of the soul. Without it, the heart is spiritually non-functional, regardless of physical health.",
    category: "Vitality"
  },
  {
    title: "The Supreme Reward",
    source: "Sunan At-Tirmidhi 3377",
    narrator: "Narrated Abu Al-Darda (RA)",
    arabic: "أَلَا أُنَبِّئُكُمْ بِخَيْرِ أَعْمَالِكُمْ وَأَزْكَاهَا عِنْدَ مَلِيكِكُمْ... قَالُوا بَلَى قَالَ ذِكْرُ اللَّهِ",
    english: "Shall I not inform you of the best of your deeds, and the purest in the sight of your King, and the highest in your ranks...? They said: 'Yes, indeed.' He said: 'The remembrance of Allah.'",
    benefit: "Continuous remembrance of the Almighty is declared more valuable than spending gold in charity or fighting in self-defense.",
    category: "Excellence"
  },
  {
    title: "The Divine Presence",
    source: "Sahih Al-Bukhari 7405",
    narrator: "Narrated Abu Hurayrah (RA)",
    arabic: "يَقُولُ اللَّهُ تَعَالَى أَنَا عِنْدَ ظَنِّ عَبْدِي بِي وَأَنَا مَعَهُ إِذَا ذَكَرَنِي",
    english: "Allah says: 'I am as My servant expects Me to be, and I am with him when he remembers Me. If he remembers Me in himself, I remember him in Myself; and if he remembers Me in an assembly, I remember him in a better assembly.'",
    benefit: "You are never alone. The moment you move your lips to remember your Lord, the Creator of the cosmos mentions your name.",
    category: "Divine Bond"
  },
  {
    title: "Light on Tongue, Heavy in Balance",
    source: "Sahih Al-Bukhari 6406 / Muslim 2694",
    narrator: "Narrated Abu Hurayrah (RA)",
    arabic: "كَلِمَتَانِ حَبِيبَتَانِ إِلَى الرَّحْمَنِ خَفِيفَتَانِ عَلَى اللِّسَانِ ثَقِيلَتَانِ فِي الْمِيزَانِ سُبْحَانَ اللَّهِ وَبِحَمْدِهِ سُبْحَانَ اللَّهِ الْعَظِيمِ",
    english: "Two words are beloved to the Most Merciful, light on the tongue, heavy in the Balance: 'Glory is to Allah and praise is to Him, Glory is to Allah the Supreme' (Subhan Allahi wa bihamdihi, Subhan Allahi-l-'Azim).",
    benefit: "Immense, stellar scales on the Day of Judgment achieved through light, loving, simple phrases.",
    category: "Forgiveness"
  },
  {
    title: "1,000 Good Deeds in 5 Minutes",
    source: "Sahih Muslim 2698",
    narrator: "Narrated Sa'd bin Abi Waqqas (RA)",
    arabic: "أَيَعْجِزُ أَحَدُكُمْ أَنْ يَكْسِبَ كُلَّ يَوْمٍ أَلْفَ حَسَنَةٍ... قَالَ يُسَبِّحُ مِائَةَ تَسْبِيحَةٍ",
    english: "Is anyone of you incapable of acquiring one thousand good deeds daily? One of those present asked: 'How?' He said: 'Say \"SubhanAllah\" 100 times, and 1,000 good deeds will be recorded or 1,000 sins wiped away.'",
    benefit: "Provides rapid reward compounding. 100 recitations translate directly into immense bounty.",
    category: "Rewards"
  },
  {
    title: "Sea of Forgiveness",
    source: "Sahih Al-Bukhari 6405 / Muslim 2691",
    narrator: "Narrated Abu Hurayrah (RA)",
    arabic: "مَنْ قَالَ سُبْحَانَ اللَّهِ وَبِحَمْدِهِ فِي يَوْمٍ مِائَةَ مَرَّةٍ حُطَّتْ خَطَايَاهُ وَإِنْ كَانَتْ مِثْلَ زَبَدِ الْبَحْرِ",
    english: "He who says, 'Glory be to Allah and His praise' (Subhan Allahi wa bihamdihi) one hundred times a day, his minor sins will be forgiven even if they were like the foam of the sea.",
    benefit: "Acts as a spiritual cleansing bath, washing away accumulated daily faults and minor errors.",
    category: "Purification"
  },
  {
    title: "Your Estate in Paradise",
    source: "Sunan At-Tirmidhi 3464",
    narrator: "Narrated Jabir (RA)",
    arabic: "مَنْ قَالَ سُبْحَانَ اللَّهِ الْعَظِيمِ وَبِحَمْدِهِ غُرِسَتْ لَهُ نَخْلَةٌ فِي الْجَنَّةِ",
    english: "Whoever says: 'Glory is to Allah the Supreme and praise is to Him' (Subhan Allahi-l-'Azimi wa bihamdihi), a palm tree is planted for him in Paradise.",
    benefit: "Each recitation actively constructs your eternal physical garden estates in the eternal life.",
    category: "Jannah Wealth"
  }
];

export default function StatsScreen({
  history,
  streak,
  allTimeCount,
  onClearHistory,
  dhikrs,
}: StatsScreenProps) {
  
  // Navigation Sub Tabs in Stats viewport
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'calendar' | 'levels' | 'hadith'>('overview');
  
  // Search & Copy states for Hadith
  const [hadithSearch, setHadithSearch] = useState<string>('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  
  // Calendar-wise tracker states
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth()); // 0-based index
  const [selectedDayDetail, setSelectedDayDetail] = useState<{
    day: number;
    dateStr: string;
    logs: DhikrHistory[];
    total: number;
  } | null>(null);

  // Core aggregated counts for custom bar chart
  const getLast7DaysData = (): DailyLog[] => {
    const data: DailyLog[] = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      const daysHistory = history.filter(item => {
        const itemDate = new Date(item.timestamp).toISOString().split('T')[0];
        return itemDate === dateStr;
      });
      
      const dayTotal = daysHistory.reduce((acc, curr) => acc + curr.count, 0);
      
      data.push({
        date: d.toLocaleDateString('en-US', { weekday: 'short' }),
        count: dayTotal
      });
    }
    return data;
  };

  const chartData = getLast7DaysData();
  const maxCount = Math.max(...chartData.map(d => d.count), 1);

  // Level Progression Math
  const getCurrentLevel = () => {
    let result = LEVELS[0];
    for (const lvl of LEVELS) {
      if (allTimeCount >= lvl.minBeads) {
        result = lvl;
      }
    }
    return result;
  };

  const currentLevelObj = getCurrentLevel();
  const nextLevelIndex = LEVELS.findIndex(l => l.level === currentLevelObj.level) + 1;
  const nextLevelObj = nextLevelIndex < LEVELS.length ? LEVELS[nextLevelIndex] : null;

  const getLevelProgressPercentage = () => {
    if (!nextLevelObj) return 100;
    const denominator = nextLevelObj.minBeads - currentLevelObj.minBeads;
    const progress = allTimeCount - currentLevelObj.minBeads;
    return Math.min(Math.max((progress / denominator) * 100, 0), 100);
  };

  const progressPercent = getLevelProgressPercentage();

  // Gamification Badges evaluation
  const evaluateBadges = () => {
    return [
      {
        id: 'fajr',
        title: 'Morning Light',
        req: 'Complete dhikr during Fajr hour (4 AM - 9 AM)',
        desc: 'Recited dhikr in the peaceful morning hours when blessings descend.',
        isUnlocked: history.some(log => {
          const hour = new Date(log.timestamp).getHours();
          return hour >= 4 && hour < 9;
        }),
        colorClass: 'bg-amber-500/20 border-amber-500/30 text-amber-300'
      },
      {
        id: 'isha',
        title: 'Night Devotion',
        req: 'Complete dhikr late night (9 PM - 3 AM)',
        desc: 'Maintained spiritual connection in the quiet security of the night.',
        isUnlocked: history.some(log => {
          const hour = new Date(log.timestamp).getHours();
          return hour >= 21 || hour < 3;
        }),
        colorClass: 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300'
      },
      {
        id: 'consistency',
        title: 'Steadfast Soul',
        req: 'Unlock a daily streak of 3 days',
        desc: 'Achieved consecutive remembrance, paving a path to spiritual habit.',
        isUnlocked: streak >= 3,
        colorClass: 'bg-orange-500/20 border-orange-500/30 text-orange-300'
      },
      {
        id: 'grand',
        title: 'Alhamdulillah Glow',
        req: 'Chant 99+ cumulative Alhamdulillah beads',
        desc: 'Praised Allah heavily with at least 99 completed verses of gratitude.',
        isUnlocked: history
          .filter(log => log.dhikrId === 'alhamdulillah')
          .reduce((sum, item) => sum + item.count, 0) >= 99,
        colorClass: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
      },
      {
        id: 'creator',
        title: 'Creative Seeker',
        req: 'Create at least 1 custom prayer',
        desc: 'Personalized your spiritual journal with custom supplications.',
        isUnlocked: dhikrs.some(d => !d.isSystem),
        colorClass: 'bg-blue-500/20 border-blue-500/30 text-blue-300'
      },
      {
        id: 'millionaire',
        title: 'Grand Master',
        req: 'Chant 1,000+ total beads all-time',
        desc: 'Completed a grand milestone of over 1,000 beads chanted. SubhanAllah!',
        isUnlocked: allTimeCount >= 1000,
        colorClass: 'bg-purple-500/20 border-purple-500/30 text-purple-300'
      }
    ];
  };

  const badges = evaluateBadges();
  const unlockedBadgesCount = badges.filter(b => b.isUnlocked).length;

  // Calendar Engine calculations
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const getDaysInSelectedMonth = () => {
    return new Date(currentYear, currentMonth + 1, 0).getDate();
  };

  const getFirstFirstDayIndex = () => {
    return new Date(currentYear, currentMonth, 1).getDay(); // 0 is Sunday, 6 is Saturday
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
    setSelectedDayDetail(null);
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
    setSelectedDayDetail(null);
  };

  const daysInSelMonth = getDaysInSelectedMonth();
  const firstDayWeeklyOffset = getFirstFirstDayIndex();
  
  const calendarSlots: React.ReactNode[] = [];
  
  // Fill weekly offset days
  for (let b = 0; b < firstDayWeeklyOffset; b++) {
    calendarSlots.push(<div key={`blank-${b}`} className="aspect-square bg-slate-900/10 rounded-lg opacity-25" />);
  }

  // Get log calculations for selected month to display summary stats
  const getSelectedMonthStats = () => {
    let monthTotalCount = 0;
    const activeDaysSet = new Set<number>();
    
    for (let day = 1; day <= daysInSelMonth; day++) {
      const formattedDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayLogs = history.filter(item => {
        const itemDate = new Date(item.timestamp).toISOString().split('T')[0];
        return itemDate === formattedDate;
      });
      if (dayLogs.length > 0) {
        activeDaysSet.add(day);
        monthTotalCount += dayLogs.reduce((acc, curr) => acc + curr.count, 0);
      }
    }
    
    return {
      total: monthTotalCount,
      activeDays: activeDaysSet.size,
      average: activeDaysSet.size > 0 ? Math.round(monthTotalCount / activeDaysSet.size) : 0
    };
  };

  const monthSummaryStats = getSelectedMonthStats();

  const handleSelectDay = (day: number) => {
    const formattedDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayLogs = history.filter(item => {
      const itemDate = new Date(item.timestamp).toISOString().split('T')[0];
      return itemDate === formattedDate;
    });
    
    const totalBeads = dayLogs.reduce((acc, curr) => acc + curr.count, 0);
    
    setSelectedDayDetail({
      day,
      dateStr: formattedDate,
      logs: dayLogs,
      total: totalBeads
    });
  };

  // Hadith Search filter
  const filteredHadiths = HADITHS.filter(h => {
    const query = hadithSearch.toLowerCase();
    return (
      h.title.toLowerCase().includes(query) ||
      h.english.toLowerCase().includes(query) ||
      h.benefit.toLowerCase().includes(query) ||
      h.source.toLowerCase().includes(query)
    );
  });

  const handleCopyHadith = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  return (
    <div id="stats_screen_container" className="flex flex-col h-full bg-[#0f172a] text-slate-100 select-none">
      
      {/* HEADER SECTION */}
      <div className="px-6 pt-5 pb-3 border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md shrink-0">
        <h1 className="text-xl font-black tracking-tight text-slate-50 flex items-center gap-1.5 leading-none">
          <Trophy className="w-5 h-5 text-amber-400" />
          Spiritual Journey
        </h1>
        <p className="text-xs text-slate-400 mt-1 font-medium">Daily streaks, interactive maps, level progression & authentic advice</p>
      </div>

      {/* STATS SUB NAV BAR (Overview, Calendar, Levels, Hadiths) */}
      <div className="flex bg-slate-900 border-b border-slate-800/80 p-1 shrink-0 z-10 sticky top-0">
        {(['overview', 'calendar', 'levels', 'hadith'] as const).map((tab) => (
          <button
            key={tab}
            id={`subtab_trigger_${tab}`}
            onClick={() => {
              setActiveSubTab(tab);
              setSelectedDayDetail(null);
            }}
            className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all cursor-pointer relative z-10 ${
              activeSubTab === tab 
                ? 'text-amber-400 font-extrabold' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>{tab === 'hadith' ? 'Hadiths' : tab}</span>
            {activeSubTab === tab && (
              <motion.div 
                layoutId="activeSubTabIndicator"
                className="absolute inset-0 bg-slate-800/80 rounded-xl -z-10 border border-slate-700/30"
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* SCREEN CONTAINER WITH SCROLL */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <AnimatePresence mode="wait">
          
          {/* TAB 1: OVERVIEW */}
          {activeSubTab === 'overview' && (
            <motion.div
              key="tab_overview"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              {/* Bento Grid Stats */}
              <div className="grid grid-cols-2 gap-3.5">
                
                {/* Daily Streak Card */}
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-md flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Daily Streak</span>
                    <span className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/10">
                      <Flame className="w-4 h-4 fill-orange-500 text-orange-400" />
                    </span>
                  </div>
                  <div className="mt-3.5">
                    <span className="text-3xl font-black text-slate-100 tracking-tight font-mono">{streak}</span>
                    <span className="text-[10px] font-bold text-slate-450 block mt-0.5">Consecutive Days</span>
                  </div>
                </div>

                {/* All Time Beads Card */}
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-md flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">All-Time Beads</span>
                    <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/10">
                      <CheckCircle2 className="w-4 h-4 text-amber-400" />
                    </span>
                  </div>
                  <div className="mt-3.5">
                    <span className="text-3xl font-black text-slate-100 tracking-tight font-mono">{allTimeCount}</span>
                    <span className="text-[10px] font-bold text-slate-450 block mt-0.5">Total Beads Chanted</span>
                  </div>
                </div>
              </div>

              {/* LEVEL QUICK PREVIEW GAUGE CARD */}
              <div 
                onClick={() => setActiveSubTab('levels')}
                className="p-4 rounded-2xl bg-gradient-to-tr from-slate-900 to-slate-850 border border-slate-800/80 shadow-md cursor-pointer hover:border-amber-500/20 transition-all group"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-amber-500">Spiritual Rank</span>
                    <h4 className="text-sm font-black text-slate-100 group-hover:text-amber-400 transition-colors leading-none mt-0.5">{currentLevelObj.name}</h4>
                  </div>
                  <div className="p-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg">
                    <Award className="w-4 h-4 animate-bounce" />
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 leading-relaxed mb-3.5">{currentLevelObj.desc}</p>
                
                {nextLevelObj && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[9px] font-bold text-slate-400 font-mono">
                      <span>{allTimeCount} beads</span>
                      <span>Next Level: {nextLevelObj.minBeads} beads</span>
                    </div>
                    {/* Level fill bar */}
                    <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                      <div 
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 7-DAY BAR GRAPH */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-md">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <BarChart2 className="w-4 h-4 text-amber-400" />
                    Weekly Activity
                  </h3>
                  <span className="text-[10px] font-bold text-slate-450 uppercase">7 Days view</span>
                </div>

                {/* Custom SVG Bar Chart */}
                <div className="relative h-28 w-full flex items-end justify-between px-1 pt-3">
                  {chartData.map((d, index) => {
                    const rectHeight = (d.count / maxCount) * 85; 
                    return (
                      <div key={d.date} className="flex flex-col items-center flex-1 h-full justify-end group">
                        
                        {/* Tooltip on hovering */}
                        <div className="absolute top-0 font-mono text-[9px] font-black text-amber-400 bg-slate-900 border border-slate-800 px-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          {d.count}
                        </div>

                        {/* Chart bar */}
                        <div className="w-6 bg-slate-950 rounded-md relative h-[70px] flex items-end overflow-hidden border border-slate-850">
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${rectHeight}%` }}
                            transition={{ type: 'spring', stiffness: 60, damping: 11, delay: index * 0.05 }}
                            className={`w-full rounded-t-sm ${
                              d.count > 0 
                                ? 'bg-gradient-to-t from-amber-500 to-orange-400' 
                                : 'bg-transparent'
                            }`}
                          />
                        </div>
                        
                        <span className="text-[9px] font-bold text-slate-400 mt-2 block tracking-tight">
                          {d.date}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* LATEST 3 LOGS PREVIEW */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <History className="w-4 h-4 text-amber-400" />
                    Recent completed logs
                  </h4>
                  {history.length > 0 && (
                    <button
                      id="btn_clear_history_overview"
                      onClick={onClearHistory}
                      className="text-[9px] font-bold text-slate-400 hover:text-amber-400 hover:underline cursor-pointer transition-all uppercase tracking-wider"
                    >
                      Reset Logs
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {history.length === 0 ? (
                    <div className="p-6 text-center rounded-2xl bg-slate-900/20 border border-slate-800/80 flex flex-col items-center justify-center">
                      <AlertCircle className="w-7 h-7 text-slate-650 mb-2 stroke-[1.5]" />
                      <p className="text-[10px] font-bold text-slate-400">Complete your first prayer to populate logs!</p>
                    </div>
                  ) : (
                    [...history].reverse().slice(0, 3).map((log) => (
                      <div
                        id={`log_overview_${log.id}`}
                        key={log.id}
                        className="flex justify-between items-center p-3 rounded-xl bg-slate-900/50 border border-slate-805"
                      >
                        <div>
                          <h5 className="font-bold text-xs text-slate-200">{log.dhikrName}</h5>
                          <span className="text-[9px] text-slate-450 mt-0.5 block">
                            {new Date(log.timestamp).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-extrabold text-amber-400 font-mono">+{log.count}</span>
                          <span className="text-[8px] font-bold text-slate-450 block text-right">beads</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 2: INTERACTIVE CALENDAR TRACKER */}
          {activeSubTab === 'calendar' && (
            <motion.div
              key="tab_calendar"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col">
                
                {/* Month Picker Navigation header */}
                <div className="flex justify-between items-center mb-4 border-b border-slate-800/50 pb-3">
                  <button
                    id="btn_calendar_prev"
                    onClick={handlePrevMonth}
                    className="p-1 px-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-350 hover:text-slate-100 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <h3 className="text-sm font-black uppercase text-slate-100 tracking-wider">
                    {monthNames[currentMonth]} {currentYear}
                  </h3>
                  <button
                    id="btn_calendar_next"
                    onClick={handleNextMonth}
                    className="p-1 px-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-350 hover:text-slate-100 transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Calendar grid titles */}
                <div className="grid grid-cols-7 gap-1 text-center font-bold text-[9px] text-slate-450 uppercase tracking-widest mb-1.5">
                  <span>Sun</span>
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span>Sat</span>
                </div>

                {/* Calendar grid cells */}
                <div className="grid grid-cols-7 gap-2.5">
                  {/* Blank placeholder slots */}
                  {calendarSlots}
                  
                  {/* Month's Actual days slots */}
                  {Array.from({ length: daysInSelMonth }, (_, i) => i + 1).map((day) => {
                    const dFormatted = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    
                    // Aggregate beads for this day
                    const dayLogs = history.filter(item => {
                      return new Date(item.timestamp).toISOString().split('T')[0] === dFormatted;
                    });
                    const beadsCount = dayLogs.reduce((acc, curr) => acc + curr.count, 0);
                    const isToday = new Date().toISOString().split('T')[0] === dFormatted;

                    // Dynamically render style based on prayer counts
                    let colorStyles = "bg-slate-900/40 border-slate-800 text-slate-350";
                    if (beadsCount > 0) {
                      if (beadsCount >= 300) {
                        colorStyles = "bg-gradient-to-tr from-amber-500/35 to-orange-400/30 border-amber-500/55 text-amber-200 font-extrabold shadow-sm ring-1 ring-amber-500/10";
                      } else if (beadsCount >= 99) {
                        colorStyles = "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold";
                      } else {
                        colorStyles = "bg-slate-800/80 border-slate-700 text-slate-200 font-semibold";
                      }
                    }

                    return (
                      <button
                        key={`day-${day}`}
                        id={`btn_calendar_day_${day}`}
                        onClick={() => handleSelectDay(day)}
                        className={`aspect-square rounded-xl border flex flex-col items-center justify-center text-xs relative transition-all cursor-pointer hover:border-slate-400/40 select-none ${colorStyles} ${isToday ? 'ring-2 ring-blue-500/45' : ''}`}
                      >
                        <span>{day}</span>
                        {beadsCount > 0 && (
                          <span className={`absolute bottom-0.5 w-1.5 h-1.5 rounded-full ${
                            beadsCount >= 300 
                              ? 'bg-amber-400 animate-pulse' 
                              : beadsCount >= 99 
                              ? 'bg-emerald-400' 
                              : 'bg-slate-300'
                          }`} />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Dynamic Summary bar below calendar */}
                <div className="grid grid-cols-3 gap-1 border-t border-slate-800 mt-4 pt-3 text-center">
                  <div>
                    <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Monthly Beads</span>
                    <p className="text-sm font-extrabold text-amber-400 leading-none mt-1 font-mono">{monthSummaryStats.total}</p>
                  </div>
                  <div>
                    <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Active Days</span>
                    <p className="text-sm font-extrabold text-slate-100 leading-none mt-1 font-mono">{monthSummaryStats.activeDays} days</p>
                  </div>
                  <div>
                    <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Daily Avg</span>
                    <p className="text-sm font-extrabold text-slate-100 leading-none mt-1 font-mono">{monthSummaryStats.average}</p>
                  </div>
                </div>
              </div>

              {/* Day selection pop-open details pane */}
              <AnimatePresence>
                {selectedDayDetail && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-4 rounded-2xl bg-slate-900 border border-slate-850 shadow-inner overflow-hidden relative"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Date: {selectedDayDetail.dateStr}
                      </span>
                      <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-black">
                        Total {selectedDayDetail.total} Beads
                      </span>
                    </div>

                    {selectedDayDetail.logs.length === 0 ? (
                      <p className="text-2xs text-slate-400 leading-relaxed italic">No prayers completed on this specific calendar day.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedDayDetail.logs.map((log) => (
                          <div 
                            key={log.id} 
                            className="p-2.5 rounded-xl bg-slate-950 border border-slate-900 flex justify-between items-center"
                          >
                            <div>
                              <h5 className="text-xs font-bold text-slate-100 leading-none">{log.dhikrName}</h5>
                              <span className="text-[8px] font-semibold text-slate-450 mt-1 block">
                                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <span className="text-xs font-extrabold font-mono text-emerald-400">+{log.count} beads</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* TAB 3: LEVELS & ACHIEVEMENT BADGES */}
          {activeSubTab === 'levels' && (
            <motion.div
              key="tab_levels"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              {/* CURRENT RATING BADGE DETAILS */}
              <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center p-0.5 shadow-lg shadow-amber-950/20">
                  <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center text-amber-400 border border-slate-900">
                    <Trophy className="w-7 h-7" />
                  </div>
                </div>

                <h4 className="text-base font-black text-slate-50 uppercase tracking-wide mt-3">
                  {currentLevelObj.name}
                </h4>
                <p className="text-2xs font-extrabold text-amber-400 tracking-widest uppercase mt-0.5">
                  App rank level {currentLevelObj.level} of 5
                </p>
                <div className="mt-3 text-2xs text-slate-400 max-w-[260px] leading-relaxed">
                  {currentLevelObj.desc}
                </div>

                {/* Level progress gauge bar */}
                {nextLevelObj ? (
                  <div className="w-full space-y-1.5 mt-5 border-t border-slate-800 pt-4">
                    <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                      <span>{allTimeCount} beads chanted</span>
                      <span>Next Level: {nextLevelObj.name}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-850">
                      <div 
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-2xs font-bold text-emerald-400 mt-4 pt-3 border-t border-slate-850 animate-pulse">
                    🏆 Ultimate Level Achieved! May Allah bless you.
                  </div>
                )}
              </div>

              {/* ACHIEVEMENTS BADGES PANEL GRID */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-400" />
                  Achievement Badges ({unlockedBadgesCount} / {badges.length})
                </h4>

                <div className="grid grid-cols-2 gap-3 pb-6">
                  {badges.map((badge) => (
                    <div
                      key={badge.id}
                      className={`p-3 rounded-2xl border flex flex-col justify-between relative transition-all ${
                        badge.isUnlocked 
                          ? `${badge.colorClass} shadow-md` 
                          : 'bg-slate-900/20 border-slate-850 text-slate-500/70'
                      }`}
                    >
                      {/* Lock overlay if locked */}
                      {!badge.isUnlocked && (
                        <div className="absolute top-2 right-2 p-1 rounded-md bg-slate-950/20 text-slate-650">
                          <Lock className="w-3 h-3" />
                        </div>
                      )}

                      {/* Sparkle if unlocked */}
                      {badge.isUnlocked && (
                        <div className="absolute top-2 right-2 p-1 bg-amber-500/10 text-amber-300 rounded-md">
                          <Sparkles className="w-2.5 h-2.5" />
                        </div>
                      )}

                      <div>
                        {/* Title list */}
                        <h5 className={`font-black text-xs leading-tight ${badge.isUnlocked ? 'text-slate-100' : 'text-slate-500'}`}>
                          {badge.title}
                        </h5>
                        <p className={`text-[9px] leading-relaxed mt-1 block h-10 overflow-hidden line-clamp-3 ${badge.isUnlocked ? 'text-slate-350' : 'text-slate-500 opacity-60'}`}>
                          {badge.isUnlocked ? badge.desc : `Unlock: ${badge.req}`}
                        </p>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-800/10 flex justify-between items-center">
                        <span className="text-[8px] font-black tracking-widest uppercase opacity-75">
                          {badge.isUnlocked ? 'Unlocked 🎉' : 'Locked 🔒'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 4: HADITH OF THE DAY & ADVOCACY BENEFITS */}
          {activeSubTab === 'hadith' && (
            <motion.div
              key="tab_hadith"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              {/* HADITH SEARCH BAR */}
              <div className="relative">
                <input
                  id="input_hadith_search"
                  type="text"
                  placeholder="Filter Hadiths (Bukhari, Muslim, blessings...)"
                  value={hadithSearch}
                  onChange={(e) => setHadithSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 focus:outline-none focus:border-amber-500 text-xs text-slate-150 placeholder-slate-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3.5" />
              </div>

              {/* LIST OF Referencing Authentic Hadiths */}
              <div className="space-y-4 pb-12">
                {filteredHadiths.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-slate-800 rounded-3xl text-slate-500">
                    <p className="text-xs">No matching Hadiths found.</p>
                  </div>
                ) : (
                  filteredHadiths.map((h, hIdx) => {
                    const isCopied = copiedIndex === hIdx;
                    const copyString = `"${h.english}" [Reference: ${h.source}]`;

                    return (
                      <div
                        id={`hadith_card_${hIdx}`}
                        key={hIdx}
                        className="p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-850 shadow-md relative"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[8px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/15">
                            {h.category}
                          </span>
                          
                          <button
                            id={`btn_copy_hadith_${hIdx}`}
                            onClick={() => handleCopyHadith(copyString, hIdx)}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                              isCopied 
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                : 'bg-slate-800/80 border-slate-700/80 hover:text-amber-400 text-slate-400'
                            }`}
                            title="Copy reference text"
                          >
                            {isCopied ? <Check className="w-3 h-3 stroke-[3]" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>

                        {/* Title of summary */}
                        <h4 className="text-sm font-black text-slate-100 tracking-tight leading-none mb-1.5">{h.title}</h4>
                        <span className="text-[9px] font-bold text-slate-450 block italic mb-3.5">{h.narrator}</span>

                        {/* Arabic Calligraphy Scripture font */}
                        <div className="text-lg font-arabic font-bold text-slate-100 text-right select-none bg-slate-900/30 p-3 rounded-xl border border-slate-850/50 leading-relaxed mb-3.5">
                          {h.arabic}
                        </div>

                        {/* English translation */}
                        <p className="text-xs text-slate-300 font-medium italic leading-relaxed mb-3">
                          "{h.english}"
                        </p>

                        {/* Benefits highlight advice */}
                        <div className="p-3 border-l-2 border-amber-500/40 bg-slate-950/40 rounded-r-xl">
                          <span className="text-[9px] font-extrabold uppercase tracking-wide text-amber-500 block">Advocacy & Benefit</span>
                          <p className="text-[10px] text-slate-400 font-semibold leading-relaxed mt-1">{h.benefit}</p>
                        </div>

                        {/* Hard authentic citation */}
                        <div className="border-t border-slate-850/50 mt-4.5 pt-2.5 flex justify-between items-center text-[9px] font-bold text-slate-450 tracking-wider">
                          <span>REFERENCE CITATION</span>
                          <span className="text-slate-350">{h.source}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  );
}
