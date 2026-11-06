import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useModalDialog } from './useModalDialog';
import {
  Home, CircleDot, BookOpen, Compass,
  RefreshCw, Moon, Trophy, Settings,
  BookMarked, MoreHorizontal, MoonStar, X
} from 'lucide-react';

type Tab = 'home' | 'counter' | 'adhkaar' | 'routine' | 'salah' | 'quran' | 'stats' | 'settings' | 'qibla' | 'prayers';

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  /** Mirrors the bar so the first tab is under the left thumb. */
  leftHanded?: boolean;
}

const PRIMARY_TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'home',    label: 'Home',    icon: <Home className="w-6 h-6 max-w-[26px] max-h-[26px]" /> },
  { id: 'counter', label: 'Tasbih', icon: <CircleDot className="w-6 h-6 max-w-[26px] max-h-[26px]" /> },
  { id: 'adhkaar', label: 'Adhkaar', icon: <BookOpen className="w-6 h-6 max-w-[26px] max-h-[26px]" /> },
  { id: 'quran',   label: 'Quran',  icon: <BookMarked className="w-6 h-6 max-w-[26px] max-h-[26px]" /> },
  { id: 'prayers', label: 'Prayers', icon: <MoonStar className="w-6 h-6 max-w-[26px] max-h-[26px]" /> },
];

const MORE_TABS: { id: Tab; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'routine',  label: 'Routines',  icon: <RefreshCw className="w-5 h-5" />,  desc: 'Build & track daily routines' },
  { id: 'salah',    label: 'Salah',     icon: <Moon className="w-5 h-5" />,       desc: 'Track your 5 daily prayers' },
  { id: 'qibla',    label: 'Qibla',     icon: <Compass className="w-5 h-5" />,    desc: 'Compass to the Kaaba' },
  { id: 'stats',    label: 'Stats',     icon: <Trophy className="w-5 h-5" />,     desc: 'Streaks, levels & achievements' },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" />,   desc: 'Sounds, theme & preferences' },
];

/** The highlight behind the current tab. All tabs share one layoutId, so it glides from tab to tab on a spring. */
function NavPill() {
  return (
    <motion.div
      layoutId="nav-active-pill"
      aria-hidden="true"
      className="absolute top-0 left-1/2 -translate-x-1/2 w-14 h-8 rounded-full"
      style={{ background: 'var(--nav-active-bg)', boxShadow: '0 0 14px var(--color-brand-dim)' }}
      transition={{ type: 'spring', damping: 22, stiffness: 260 }}
    />
  );
}

export default function BottomNav({ activeTab, onTabChange, leftHanded = false }: BottomNavProps) {
  const [showMore, setShowMore] = useState(false);
  const { dialogRef, initialFocusRef, onKeyDown } = useModalDialog(showMore, () => setShowMore(false));
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
            className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            onClick={() => setShowMore(false)}
          />
        )}
      </AnimatePresence>

      {/* More sheet */}
      <AnimatePresence>
        {showMore && (
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="More features"
            onKeyDown={onKeyDown}
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="absolute bottom-[68px] left-0 right-0 z-[70] rounded-t-3xl overflow-hidden flex flex-col"
            style={{
              background: 'var(--color-bg-raised)',
              borderTop: '1px solid var(--color-border)',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full" style={{ background: 'var(--color-border)' }} />
            </div>

            {/* Header */}
            <div className={`flex items-center justify-between px-5 pb-3 ${leftHanded ? 'flex-row-reverse' : ''}`}>
              <h2 className="section-label">More Features</h2>
              <button
                ref={initialFocusRef}
                type="button"
                onClick={() => setShowMore(false)}
                aria-label="Close menu"
                className="p-2 rounded-full cursor-pointer"
                style={{ background: 'var(--color-bg-overlay)', color: 'var(--color-text-muted)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* More tabs grid */}
            {/* Two columns normally, one when large system text makes two too narrow to read. */}
            <div
              className="grid gap-3 px-4 pb-6 overflow-y-auto"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 11rem), 1fr))', maxHeight: 'calc(100dvh - 220px)' }}
            >
              {MORE_TABS.map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <motion.button
                    key={tab.id}
                    aria-current={isActive ? 'page' : undefined}
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
                        background: isActive ? 'var(--nav-active-bg)' : 'var(--color-bg-raised)',
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
      <nav
        aria-label="Main"
        className={`shrink-0 flex items-center justify-around px-1 select-none z-30 relative pb-safe ${leftHanded ? 'flex-row-reverse' : ''}`}
        style={{
          height: '68px',
          background: 'var(--nav-bg)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderTop: '1px solid var(--color-border)',
        }}
      >
        {PRIMARY_TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <motion.button
              key={tab.id}
              id={`tab_trigger_${tab.id}`}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
              whileTap={{ scale: 0.88 }}
              onClick={() => handleTabPress(tab.id)}
              className="flex flex-col items-center gap-0.5 py-1 px-1 cursor-pointer focus:outline-none relative min-w-0 flex-1"
            >
              {isActive && <NavPill />}
              <motion.span
                data-nav-icon
                className="relative z-10 transition-colors duration-150"
                style={{ color: isActive ? 'var(--color-text-brand)' : 'var(--nav-inactive)' }}
                animate={{ y: isActive ? -2 : 0, scale: isActive ? 1.1 : 1 }}
                transition={{ type: 'spring', damping: 14, stiffness: 320 }}
              >
                {React.cloneElement(tab.icon as React.ReactElement<{ strokeWidth?: number }>, { strokeWidth: isActive ? 2.4 : 1.9 })}
              </motion.span>
              {/* 12px minimum for tab labels */}
              <span
                className="relative z-10 transition-colors duration-150 font-semibold max-w-full"
                style={{
                  // A fixed 12px: the bar is a fixed height, and larger system text would make the labels collide.
                  fontSize: '12px',
                  color: isActive ? 'var(--color-text-brand)' : 'var(--nav-inactive)',
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
          className="flex flex-col items-center gap-0.5 py-1 px-1 cursor-pointer focus:outline-none relative min-w-0 flex-1"
          aria-label="More features"
          aria-haspopup="dialog"
          aria-expanded={showMore}
        >
          {(isMoreActive && !showMore) && <NavPill />}
          <motion.span
            data-nav-icon
            className="relative z-10 transition-colors duration-150"
            style={{ color: showMore || isMoreActive ? 'var(--color-text-brand)' : 'var(--nav-inactive)' }}
            animate={{ y: isMoreActive && !showMore ? -2 : 0, scale: isMoreActive && !showMore ? 1.1 : 1 }}
            transition={{ type: 'spring', damping: 14, stiffness: 320 }}
          >
            <MoreHorizontal className="w-6 h-6 max-w-[26px] max-h-[26px]" strokeWidth={isMoreActive ? 2.4 : 1.9} />
          </motion.span>
          <span
            className="relative z-10 font-semibold max-w-full"
            style={{
              fontSize: '12px',
              color: showMore || isMoreActive ? 'var(--color-text-brand)' : 'var(--nav-inactive)',
            }}
          >
            More
          </span>
        </motion.button>
      </nav>
    </>
  );
}
