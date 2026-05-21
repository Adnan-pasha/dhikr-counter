import React from 'react';
import { motion } from 'motion/react';
import { BarChart2, Flame, RefreshCw, Trophy, Calendar, CheckCircle2, History, AlertCircle } from 'lucide-react';
import { DhikrHistory, DailyLog } from '../types';

interface StatsScreenProps {
  history: DhikrHistory[];
  streak: number;
  allTimeCount: number;
  onClearHistory: () => void;
}

export default function StatsScreen({
  history,
  streak,
  allTimeCount,
  onClearHistory,
}: StatsScreenProps) {
  
  // Calculate aggregated counts over the last 7 days for our custom SVG chart
  const getLast7DaysData = (): DailyLog[] => {
    const data: DailyLog[] = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Filter history for this date
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

  // Completed Target Count session aggregates
  const totalCompletedSessions = history.length;

  return (
    <div id="stats_screen_container" className="flex flex-col h-full bg-[#0f172a] text-slate-100">
      
      {/* Header */}
      <div className="px-6 pt-5 pb-3 border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md flex justify-between items-center">
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-50 flex items-center gap-1.5 leading-none select-none">
            <Trophy className="w-5 h-5 text-amber-400" />
            Spiritual Journey
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium select-none">Daily streaks and counting completions</p>
        </div>
      </div>

      {/* Core Stats Overview Cards */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        
        {/* Bento Grid Stats */}
        <div className="grid grid-cols-2 gap-3.5">
          {/* Daily Streak Card */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-md flex flex-col justify-between"
          >
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider select-none">Daily Streak</span>
              <span className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/10">
                <Flame className="w-4 h-4 fill-orange-500 text-orange-400" />
              </span>
            </div>
            <div className="mt-3.5">
              <span className="text-3xl font-black text-slate-100 tracking-tight font-mono">{streak}</span>
              <span className="text-[10px] font-bold text-slate-450 block mt-0.5">Consecutive Days</span>
            </div>
          </motion.div>

          {/* All Time Beads Card */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-md flex flex-col justify-between"
          >
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider select-none">All-Time Beads</span>
              <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/10">
                <CheckCircle2 className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3.5">
              <span className="text-3xl font-black text-slate-100 tracking-tight font-mono">{allTimeCount}</span>
              <span className="text-[10px] font-bold text-slate-450 block mt-0.5">Total Beads Chanted</span>
            </div>
          </motion.div>
        </div>

        {/* 7-Day Activity Chart */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-md"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <BarChart2 className="w-4 h-4 text-amber-400" />
              Weekly Bead Activity
            </h3>
            <span className="text-[10px] font-bold text-slate-450 uppercase">Last 7 Days</span>
          </div>

          {/* Custom SVG Bar Chart */}
          <div className="relative h-32 w-full flex items-end justify-between px-1 pt-3">
            {chartData.map((d, index) => {
              const rectHeight = (d.count / maxCount) * 85; // cap at 85% height
              return (
                <div key={d.date} className="flex flex-col items-center flex-1 h-full justify-end group">
                  
                  {/* Floating tooltip on hover */}
                  <div className="absolute -top-1 font-mono text-[9px] font-bold text-amber-400 bg-slate-870 border border-slate-750 px-1 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    {d.count}
                  </div>

                  {/* Animated rect bar wrapper */}
                  <div className="w-7 bg-slate-950 rounded-lg relative h-[85px] flex items-end overflow-hidden border border-slate-850">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${rectHeight}%` }}
                      transition={{ type: 'spring', stiffness: 50, damping: 10, delay: index * 0.05 }}
                      className={`w-full rounded-t-md ${
                        d.count > 0 
                          ? 'bg-gradient-to-t from-amber-500 to-orange-400' 
                          : 'bg-transparent'
                      }`}
                    />
                  </div>
                  
                  <span className="text-[10px] font-semibold text-slate-400 mt-2 block tracking-tight">
                    {d.date}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* History Log Feed */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="space-y-3"
        >
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <History className="w-4 h-4 text-amber-400" />
              Completion Logs
            </h3>
            {history.length > 0 && (
              <button
                id="btn_clear_history"
                onClick={onClearHistory}
                className="text-[10px] font-bold text-slate-400 hover:text-amber-400 hover:underline uppercase tracking-wider cursor-pointer transition-colors"
              >
                Clear All
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {history.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-slate-900/30 border border-slate-800/80 flex flex-col items-center justify-center">
                <AlertCircle className="w-8 h-8 text-slate-600 mb-2 stroke-[1.5]" />
                <p className="text-xs font-semibold text-slate-400">No prayer completions recorded yet</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Your sessions will appear here as you hit your goals</p>
              </div>
            ) : (
              [...history].reverse().slice(0, 15).map((log) => (
                <div
                  id={`history_item_${log.id}`}
                  key={log.id}
                  className="flex justify-between items-center p-3.5 rounded-xl bg-slate-900/50 border border-slate-800/80 shadow-sm"
                >
                  <div>
                    <h4 className="font-bold text-xs text-slate-100">
                      {log.dhikrName}
                    </h4>
                    <p className="text-[10px] font-semibold text-slate-400 mt-0.5 select-none animate-fade-in animate-none">
                      {new Date(log.timestamp).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-amber-400 font-mono">
                      +{log.count}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 block select-none">beads</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
