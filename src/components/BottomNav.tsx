import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Home, CircleDot, BookOpen, RefreshCw, Moon,
  Compass, Trophy, Settings, BookMarked, MoreHorizontal, X
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'home' | 'counter' | 'adhkaar' | 'routine' | 'salah' | 'quran' | 'stats' | 'settings' | 'qibla';

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

// ─── Primary tabs (always visible) ───────────────────────────────────────────

const PRIMARY_TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'home',    label: 'Home',    icon: <Home className="w-5 h-5" /> },
  { id: 'counter', label: 'Tasbih', icon: <CircleDot className="w-5 h-5" /> },
  { id: 'adhkaar', label: 'Adhkaar', icon: <BookOpen className="w-5 h-5" /> },
  { id: 'quran',   label: 'Quran',  icon: <BookMarked className="w-5 h-5" /> },
  { id: 'qibla',   label: 'Qibla',  icon: <Compass className="w-5 h-5" /> },
];

// ─── More sheet tabs ──────────────────────────────────────────────────────────

const MORE_TABS: { id: Tab; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'routine',  label: 'Routines',    icon: <RefreshCw className="w-5 h-5" />,  desc: 'Build & track daily routines' },
  { id: 'salah',    label: 'Salah',       icon: <Moon className="w-5 h-5" />,       desc: 'Track your 5 daily prayers' },
  { id: 'stats',    label: 'Stats',       icon: <Trophy className="w-5 h-5" />,     desc: 'Streaks, levels & achievements' },
  { id: 'settings', label: 'Settings',   icon: <Settings className="w-5 h-5" />,   desc: 'Sounds, theme & preferences' },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const [showMore, setShowMore] = useState(false);

  // Is the active tab one of the "more" tabs?
  const isMoreActive = MORE_TABS.some(t => t.id === activeTab);

  const handleTabPress = (tab: Tab) => {
    setShowMore(false);
    onTabChange(tab);
  };

  return (
    <>
      {/* ── More sheet backdrop ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showMore && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={() => setShowMore(false)}
          />
        )}
      </AnimatePresence>

      {/* ── More sheet ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showMore && (
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="absolute bottom-[64px] left-0 right-0 z-50 rounded-t-3xl overflow-hidden"
            style={{
              background: 'var(--color-bg-raised)',
              borderTop: '1px solid var(--color-border)',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.4)',
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-slate-700" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">More Features</p>
              <button
                onClick={() => setShowMore(false)}
                className="p-1.5 rounded-full bg-slate-800 text-slate-400 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* More tabs grid */}
            <div className="grid grid-cols-2 gap-2.5 px-4 pb-5">
              {MORE_TABS.map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <motion.button
                    key={tab.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleTabPress(tab.id)}
                    className={`flex items-center gap-3 p-3.5 rounded-2xl border cursor-pointer text-left transition-all ${
                      isActive
                        ? 'border-amber-500/40 bg-amber-500/8'
                        : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isActive
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {tab.icon}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-black leading-tight ${isActive ? 'text-amber-400' : 'text-slate-200'}`}>
                        {tab.label}
                      </p>
                      <p className="text-[9px] text-slate-500 mt-0.5 leading-tight">{tab.desc}</p>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom tab bar ──────────────────────────────────────────────── */}
      <div
        className="h-[64px] shrink-0 flex items-center justify-around px-2 select-none z-30 relative pb-safe"
        style={{
          background: 'rgba(9,14,26,0.95)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {PRIMARY_TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <motion.button
              key={tab.id}
              id={`tab_trigger_${tab.id}`}
              aria-label={tab.label}
              whileTap={{ scale: 0.85 }}
              onClick={() => handleTabPress(tab.id)}
              className="flex flex-col items-center gap-0.5 py-1 px-3 cursor-pointer focus:outline-none relative"
            >
              {/* Active indicator pill behind icon */}
              {isActive && (
                <motion.div
                  layoutId="nav-active-pill"
                  className="absolute top-1 left-1/2 -translate-x-1/2 w-10 h-8 rounded-xl"
                  style={{ background: 'rgba(245,158,11,0.12)' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                />
              )}

              <span className={`relative z-10 transition-colors duration-150 ${
                isActive ? 'text-amber-400' : 'text-slate-500'
              }`}>
                {tab.icon}
              </span>
              <span className={`text-[9px] font-bold tracking-wide relative z-10 transition-colors duration-150 ${
                isActive ? 'text-amber-400' : 'text-slate-600'
              }`}>
                {tab.label}
              </span>
            </motion.button>
          );
        })}

        {/* More button */}
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={() => setShowMore(v => !v)}
          className="flex flex-col items-center gap-0.5 py-1 px-3 cursor-pointer focus:outline-none relative"
          aria-label="More features"
        >
          {isMoreActive && !showMore && (
            <motion.div
              layoutId="nav-active-pill"
              className="absolute top-1 left-1/2 -translate-x-1/2 w-10 h-8 rounded-xl"
              style={{ background: 'rgba(245,158,11,0.12)' }}
            />
          )}
          <span className={`relative z-10 transition-colors duration-150 ${
            showMore || isMoreActive ? 'text-amber-400' : 'text-slate-500'
          }`}>
            <MoreHorizontal className="w-5 h-5" />
          </span>
          <span className={`text-[9px] font-bold tracking-wide relative z-10 ${
            showMore || isMoreActive ? 'text-amber-400' : 'text-slate-600'
          }`}>
            More
          </span>
        </motion.button>
      </div>
    </>
  );
}
