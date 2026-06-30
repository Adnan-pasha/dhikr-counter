import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Home, CircleDot, BookOpen, Compass,
  RefreshCw, Moon, Trophy, Settings,
  BookMarked, MoreHorizontal, X
} from 'lucide-react';

type Tab = 'home' | 'counter' | 'adhkaar' | 'routine' | 'salah' | 'quran' | 'stats' | 'settings' | 'qibla';

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const PRIMARY_TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'home',    label: 'Home',    icon: <Home className="w-6 h-6" /> },
  { id: 'counter', label: 'Tasbih', icon: <CircleDot className="w-6 h-6" /> },
  { id: 'adhkaar', label: 'Adhkaar', icon: <BookOpen className="w-6 h-6" /> },
  { id: 'quran',   label: 'Quran',  icon: <BookMarked className="w-6 h-6" /> },
  { id: 'qibla',   label: 'Qibla',  icon: <Compass className="w-6 h-6" /> },
];

const MORE_TABS: { id: Tab; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'routine',  label: 'Routines',  icon: <RefreshCw className="w-5 h-5" />,  desc: 'Build & track daily routines' },
  { id: 'salah',    label: 'Salah',     icon: <Moon className="w-5 h-5" />,       desc: 'Track your 5 daily prayers' },
  { id: 'stats',    label: 'Stats',     icon: <Trophy className="w-5 h-5" />,     desc: 'Streaks, levels & achievements' },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" />,   desc: 'Sounds, theme & preferences' },
];

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const [showMore, setShowMore] = useState(false);
  const isMoreActive = MORE_TABS.some(t => t.id === activeTab);

  const handleTabPress = (tab: Tab) => {
    setShowMore(false);
    onTabChange(tab);
  };

  return (
    <>
      {/* More sheet backdrop */}
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

      {/* More sheet */}
      <AnimatePresence>
        {showMore && (
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="absolute bottom-[68px] left-0 right-0 z-50 rounded-t-3xl overflow-hidden"
            style={{
              background: 'var(--color-bg-raised)',
              borderTop: '1px solid var(--color-border)',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-slate-700" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3">
              <p className="section-label">More Features</p>
              <button
                onClick={() => setShowMore(false)}
                aria-label="Close menu"
                className="p-2 rounded-full cursor-pointer"
                style={{ background: 'var(--color-bg-overlay)', color: 'var(--color-text-muted)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* More tabs grid */}
            <div className="grid grid-cols-2 gap-3 px-4 pb-6">
              {MORE_TABS.map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <motion.button
                    key={tab.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleTabPress(tab.id)}
                    className="flex items-center gap-3 p-4 rounded-2xl border cursor-pointer text-left"
                    style={{
                      background: isActive ? 'var(--color-brand-dim)' : 'var(--color-bg-surface)',
                      borderColor: isActive ? 'var(--color-brand-border)' : 'var(--color-border)',
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: isActive ? 'rgba(251,191,36,0.20)' : 'var(--color-bg-raised)',
                        color: isActive ? 'var(--color-text-brand)' : 'var(--color-text-muted)',
                      }}
                    >
                      {tab.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold leading-tight" style={{ color: isActive ? 'var(--color-text-brand)' : 'var(--color-text-primary)' }}>
                        {tab.label}
                      </p>
                      <p className="caption mt-0.5 leading-tight">{tab.desc}</p>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom tab bar — 68px height for comfortable tap targets */}
      <div
        className="shrink-0 flex items-center justify-around px-1 select-none z-30 relative pb-safe"
        style={{
          height: '68px',
          background: 'rgba(9,14,26,0.96)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderTop: '1px solid rgba(255,255,255,0.07)',
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
              className="flex flex-col items-center gap-0.5 py-1 px-3 cursor-pointer focus:outline-none relative min-w-[52px]"
            >
              {isActive && (
                <motion.div
                  layoutId="nav-active-pill"
                  className="absolute top-1 left-1/2 -translate-x-1/2 w-12 h-9 rounded-xl"
                  style={{ background: 'rgba(251,191,36,0.12)' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                />
              )}
              <span className="relative z-10 transition-colors duration-150" style={{ color: isActive ? 'var(--color-text-brand)' : '#64748B' }}>
                {tab.icon}
              </span>
              {/* 12px minimum for tab labels */}
              <span
                className="relative z-10 transition-colors duration-150 font-semibold"
                style={{
                  fontSize: '0.6875rem', /* 11px — nav label exception, smaller due to 5 tabs */
                  color: isActive ? 'var(--color-text-brand)' : '#64748B',
                  letterSpacing: '0.02em',
                }}
              >
                {tab.label}
              </span>
            </motion.button>
          );
        })}

        {/* More button */}
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={() => setShowMore(v => !v)}
          className="flex flex-col items-center gap-0.5 py-1 px-3 cursor-pointer focus:outline-none relative min-w-[52px]"
          aria-label="More features"
        >
          {(isMoreActive && !showMore) && (
            <motion.div
              layoutId="nav-active-pill"
              className="absolute top-1 left-1/2 -translate-x-1/2 w-12 h-9 rounded-xl"
              style={{ background: 'rgba(251,191,36,0.12)' }}
            />
          )}
          <span className="relative z-10 transition-colors duration-150" style={{ color: showMore || isMoreActive ? 'var(--color-text-brand)' : '#64748B' }}>
            <MoreHorizontal className="w-6 h-6" />
          </span>
          <span
            className="relative z-10 font-semibold"
            style={{
              fontSize: '0.6875rem',
              color: showMore || isMoreActive ? 'var(--color-text-brand)' : '#64748B',
            }}
          >
            More
          </span>
        </motion.button>
      </div>
    </>
  );
}
