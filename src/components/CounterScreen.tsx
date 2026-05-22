import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, RotateCcw, Volume2, VolumeX, Eye, EyeOff, Sparkles, ChevronRight, Check } from 'lucide-react';
import { Dhikr, DhikrHistory, UserPreferences } from '../types';
import { playBeadSound, playCompletionSound } from '../audio';

interface CounterScreenProps {
  currentDhikr: Dhikr;
  currentCount: number;
  history: DhikrHistory[];
  preferences: UserPreferences;
  onIncrement: () => void;
  onReset: () => void;
  onToggleSound: () => void;
  onNavigateToLibrary: () => void;
}

export default function CounterScreen({
  currentDhikr,
  currentCount,
  history,
  preferences,
  onIncrement,
  onReset,
  onToggleSound,
  onNavigateToLibrary,
}: CounterScreenProps) {
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [beadOffset, setBeadOffset] = useState(0);
  const [showFlash, setShowFlash] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isCompletedToday = history.some((log) => {
    if (log.dhikrId !== currentDhikr.id) return false;
    const logDate = new Date(log.timestamp);
    const today = new Date();
    return (
      logDate.getFullYear() === today.getFullYear() &&
      logDate.getMonth() === today.getMonth() &&
      logDate.getDate() === today.getDate()
    );
  });

  // Trigger brief visual flash on target complete
  useEffect(() => {
    if (currentDhikr.targetCount > 0 && currentCount === currentDhikr.targetCount) {
      setShowFlash(true);
      const timer = setTimeout(() => setShowFlash(false), 500);
      return () => clearTimeout(timer);
    }
  }, [currentCount, currentDhikr.targetCount]);

  // Handle tap
  const handleTap = () => {
    onIncrement();
    // Slide beads effect
    setBeadOffset((prev) => prev + 1);
  };

  // Keyboard shortcut for counting (Space/Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTypingContext = !!target && (
        target.tagName === 'INPUT'
        || target.tagName === 'TEXTAREA'
        || target.isContentEditable
      );
      if (isTypingContext) return;

      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        handleTap();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onIncrement]);

  const target = currentDhikr.targetCount || 100; // default for infinity progress view
  const progressRatio = currentDhikr.targetCount > 0 
    ? Math.min(currentCount / currentDhikr.targetCount, 1) 
    : (currentCount % 100) / 100;

  const strokeDashoffset = 2 * Math.PI * 110 * (1 - progressRatio);

  // Theme-specific color classes
  const getThemeClasses = () => {
    switch (preferences.theme) {
      case 'emerald':
        return {
          bg: 'bg-[#0f172a]',
          text: 'text-slate-100',
          accent: 'text-emerald-400',
          ring: 'stroke-emerald-500',
          ringBg: 'stroke-slate-800/60',
          primaryBtn: 'bg-linear-to-r from-emerald-500 to-teal-400 hover:opacity-90 text-slate-950 shadow-[0_4px_20px_rgba(16,185,129,0.3)]',
          accentBg: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
          beadColor: 'bg-emerald-950/60 border-emerald-500/50',
          beadLine: 'bg-emerald-500/15',
        };
      case 'amber':
        return {
          bg: 'bg-[#0f172a]',
          text: 'text-slate-100',
          accent: 'text-amber-400',
          ring: 'stroke-amber-500',
          ringBg: 'stroke-slate-800/60',
          primaryBtn: 'bg-gradient-to-tr from-amber-500 to-orange-400 hover:opacity-95 text-slate-950 shadow-[0_4px_20px_rgba(245,158,11,0.3)]',
          accentBg: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
          beadColor: 'bg-amber-950/60 border-amber-500/50',
          beadLine: 'bg-amber-500/15',
        };
      case 'indigo':
        return {
          bg: 'bg-[#0f172a]',
          text: 'text-slate-100',
          accent: 'text-indigo-400',
          ring: 'stroke-indigo-500',
          ringBg: 'stroke-slate-800/60',
          primaryBtn: 'bg-linear-to-r from-indigo-505 to-purple-400 hover:opacity-90 text-slate-950 shadow-[0_4px_20px_rgba(99,102,241,0.3)]',
          accentBg: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20',
          beadColor: 'bg-indigo-950/60 border-indigo-500/50',
          beadLine: 'bg-indigo-500/15',
        };
      case 'midnight':
        return {
          bg: 'bg-[#030712]',
          text: 'text-neutral-50',
          accent: 'text-red-400',
          ring: 'stroke-red-500',
          ringBg: 'stroke-neutral-900',
          primaryBtn: 'bg-linear-to-r from-red-600 to-rose-500 hover:opacity-90 text-white shadow-[0_4px_20px_rgba(239,68,68,0.3)]',
          accentBg: 'bg-red-500/15 text-red-500 border border-red-500/20',
          beadColor: 'bg-red-950/60 border-red-500/50',
          beadLine: 'bg-red-500/15',
        };
      case 'slate':
      default:
        return {
          bg: 'bg-[#0f172a]',
          text: 'text-slate-100',
          accent: 'text-slate-200',
          ring: 'stroke-slate-300',
          ringBg: 'stroke-slate-800/60',
          primaryBtn: 'bg-linear-to-r from-slate-200 to-slate-400 hover:opacity-90 text-slate-950 shadow-[0_4px_20px_rgba(255,255,255,0.15)]',
          accentBg: 'bg-slate-800/60 text-slate-200 border border-slate-700/50',
          beadColor: 'bg-slate-900 border-slate-700',
          beadLine: 'bg-slate-800',
        };
    }
  };

  const c = getThemeClasses();

  // Dynamic glow style based on theme
  const getGlowBg = () => {
    switch (preferences.theme) {
      case 'emerald': return 'from-emerald-500/10 to-teal-500/2';
      case 'amber': return 'from-amber-500/12 to-orange-500/3';
      case 'indigo': return 'from-indigo-500/10 to-purple-500/2';
      case 'midnight': return 'from-red-500/10 to-rose-500/2';
      case 'slate':
      default: return 'from-slate-400/8 to-slate-200/1';
    }
  };

  return (
    <div id="counter_container" className={`relative flex flex-col h-full flex-1 overflow-hidden transition-colors duration-500 ${c.bg}`}>
      
      {/* Visual Flash Effect on completion */}
      <AnimatePresence>
        {showFlash && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.25, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 bg-white dark:bg-yellow-400/20 pointer-events-none z-50"
          />
        )}
      </AnimatePresence>

      {/* HEADER SECTION (Fades out in focus mode) */}
      <motion.div 
        animate={{ opacity: isFocusMode ? 0 : 1, y: isFocusMode ? -20 : 0 }}
        transition={{ duration: 0.3 }}
        className="px-6 pt-5 pb-3 flex justify-between items-center z-20 pointer-events-auto"
        style={{ pointerEvents: isFocusMode ? 'none' : 'auto' }}
      >
        <button
  id="btn_dhikr_selector"
  aria-label="Change active dhikr"
  onClick={onNavigateToLibrary}
  className="flex flex-col items-start focus:outline-none text-left group max-w-[70%]"
>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Active Chant</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-lg text-slate-100 truncate group-hover:text-amber-400 transition-colors">
              {currentDhikr.nameEn}
            </span>
            {isCompletedToday ? (
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-0.5">
                <Check className="w-2.5 h-2.5 stroke-[2.5]" /> Done
              </span>
            ) : (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/50">
                Pending
              </span>
            )}
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </button>

        <div className="flex items-center gap-3">
          <button
            id="btn_mute_toggle"
            onClick={onToggleSound}
            aria-label={preferences.soundOn ? "Mute audio" : "Unmute audio"}
            className="p-2.5 rounded-full bg-slate-900/60 shadow-md border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            {preferences.soundOn ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            id="btn_focus_toggle_header"
            onClick={() => setIsFocusMode(true)}
            aria-label="Enter focus mode"
            className="p-2.5 rounded-full bg-slate-900/60 shadow-md border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </motion.div>

      {/* CORE DISPLAY & BEADS SIMULATION AREA */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 relative">
        
        {/* PHYSICAL-LIKE BEADS COLUMN (SLIDER) */}
        {!isFocusMode && (
          <div className="absolute right-6 top-1/2 -translate-y-1/2 w-6 h-48 flex flex-col items-center justify-center opacity-70 pointer-events-none hidden md:flex">
            {/* Thread Line */}
            <div className={`absolute w-0.5 h-full ${c.beadLine} rounded-full`} />
            
            {/* Animated Beads Column */}
            <div className="relative w-full h-full overflow-hidden">
              <motion.div 
                animate={{ y: (currentCount % 10) * -22 }} 
                transition={{ type: 'spring', stiffness: 220, damping: 20 }}
                className="absolute inset-0 flex flex-col gap-1.5 items-center"
              >
                {[...Array(20)].map((_, i) => (
                  <div 
                    key={i} 
                    className={`w-5 h-5 rounded-full border shadow-sm ${c.beadColor} transition-transform duration-300`} 
                    style={{
                      transform: (currentCount % 10) === (i % 10) ? 'scale(1.2)' : 'scale(1)',
                    }}
                  />
                ))}
              </motion.div>
            </div>
            
            <div className="absolute -bottom-6 text-[10px] font-semibold text-slate-400 uppercase tracking-widest text-center">
              Thread
            </div>
          </div>
        )}

        {/* Primary Arabic calligraphy preview */}
        <AnimatePresence mode="wait">
          <motion.div 
            key={currentDhikr.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.4 }}
            className={`text-center max-w-sm flex flex-col items-center mb-6`}
          >
            <span className="text-4xl md:text-5xl font-arabic font-semibold text-slate-100 leading-normal tracking-wide min-h-[50px] mb-2 px-4 select-none">
              {currentDhikr.nameAr}
            </span>
            <span className="text-xs text-slate-500 font-medium italic dark:text-neutral-400 text-center max-w-[85%] leading-relaxed select-none">
              "{currentDhikr.meaning}"
            </span>
          </motion.div>
        </AnimatePresence>

        {/* Target Milestone Indicator */}
        {currentDhikr.targetCount > 0 && (
          <div className="px-3 py-1 mb-3.5 rounded-full text-[10px] font-bold tracking-widest bg-slate-900/90 border border-slate-800/80 text-amber-400 uppercase flex items-center gap-1 z-10 shadow-md">
            <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
            Target: {currentDhikr.targetCount}
          </div>
        )}

        {/* SATISFYING INTERACTIVE COUNT CIRCLE */}
        <div className="relative flex items-center justify-center">
          
          {/* Ambient dynamic glowing halo blur behind circle */}
          <div className={`absolute w-60 h-60 bg-gradient-to-tr ${getGlowBg()} rounded-full blur-3xl opacity-60 pointer-events-none z-0`} style={{ mixBlendMode: 'screen' }} />

          {/* Dynamic Circular SVG Progress */}
          <svg className="w-64 h-64 md:w-72 md:h-72 transform -rotate-90 select-none z-10">
            {/* Background Circle */}
            <circle
              cx="50%"
              cy="50%"
              r="110"
              className={`fill-none ${c.ringBg}`}
              strokeWidth="6"
            />
            {/* Glowing Active Progress Ring */}
            <motion.circle
              cx="50%"
              cy="50%"
              r="110"
              className={`fill-none ${c.ring}`}
              strokeWidth="10"
              strokeDasharray={2 * Math.PI * 110}
              animate={{ strokeDashoffset }}
              transition={{ type: 'spring', stiffness: 80, damping: 15 }}
              strokeLinecap="round"
            />
          </svg>

          {/* Giant Click Target button inside Circle */}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 z-20">
            <button
  id="tap_bead_clicker"
  aria-label="Tap to count dhikr"
  ref={buttonRef}
  onClick={handleTap}
  className={`relative w-48 h-48 rounded-full flex flex-col items-center justify-center bg-slate-900/60 border border-slate-800/80 backdrop-blur-md shadow-2xl hover:scale-103 cursor-pointer select-none transition-transform duration-100 focus:outline-none`}        style={{
                boxShadow: preferences.theme === 'midnight' 
                  ? '0 20px 45px -15px rgba(239, 68, 68, 0.15), inset 0 2px 4px rgba(255,255,255,0.02)'
                  : '0 20px 45px -15px rgba(0,0,0,0.5), inset 0 2.5px 4px rgba(255,255,255,0.03)'
              }}
            >
              {/* Tap Effect Ring */}
              <motion.span 
                key={currentCount}
                initial={{ scale: 0.85, opacity: 0.6 }}
                animate={{ scale: 1.25, opacity: 0 }}
                transition={{ duration: 0.4 }}
                className={`absolute inset-0 rounded-full border-4 ${
                  preferences.theme === 'emerald' ? 'border-emerald-500' :
                  preferences.theme === 'amber' ? 'border-amber-500' :
                  preferences.theme === 'indigo' ? 'border-indigo-500' :
                  preferences.theme === 'midnight' ? 'border-red-500' :
                  'border-slate-500'
                } pointer-events-none`}
              />

              {/* Numerical Beads Completed value */}
              <motion.span 
                key={`count-${currentCount}`}
                initial={{ scale: 0.9, y: 5 }}
                animate={{ scale: 1, y: 0 }}
                className="text-6xl font-black text-slate-800 dark:text-neutral-50 tracking-tight font-mono select-none"
              >
                {currentCount}
              </motion.span>

              {/* Bottom guide instructions */}
              <span className="text-xs font-bold text-slate-400 dark:text-neutral-500 tracking-widest uppercase mt-1 select-none flex items-center gap-1">
                TAP AREA
              </span>

              {/* Mini Target Tracker */}
              {currentDhikr.targetCount > 0 && (
                <div className="mt-2 text-xs font-semibold text-slate-500 flex items-center gap-1 select-none">
                  {currentCount >= currentDhikr.targetCount ? (
                    <span className="text-emerald-500 flex items-center gap-0.5">
                      Completed <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </span>
                  ) : (
                    <span>
                      {Math.round(progressRatio * 100)}% of goal
                    </span>
                  )}
                </div>
              )}
            </button>
          </div>
        </div>

        {/* AUXILIARY ACTION BAR */}
        <motion.div 
          animate={{ opacity: isFocusMode ? 0 : 1, y: isFocusMode ? 25 : 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-6 mt-8 z-20 pointer-events-auto"
          style={{ pointerEvents: isFocusMode ? 'none' : 'auto' }}
        >
          <button
            id="btn_reset_counter"
            onClick={onReset}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900/60 border border-slate-800 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-850 shadow-md cursor-pointer transition-all select-none focus:outline-none"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </motion.div>
      </div>

      {/* IMMERSIVE FOCUS OVERLAY MODE */}
      <AnimatePresence>
        {isFocusMode && (
          <motion.div
            id="focus_overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-neutral-950/98 flex flex-col items-center justify-between p-6 z-40 text-neutral-100"
          >
            {/* Top Indicator */}
            <div className="text-center pt-8">
              <p className="text-2xl font-arabic text-emerald-400">{currentDhikr.nameAr}</p>
              <p className="text-xs text-neutral-500 uppercase tracking-widest mt-1">{currentDhikr.nameEn}</p>
              {isCompletedToday ? (
                <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-extrabold flex items-center justify-center gap-1 mt-1.5 leading-none">
                  <Check className="w-3.5 h-3.5 stroke-[3]" /> Completed Today
                </span>
              ) : (
                <span className="text-[10px] uppercase tracking-widest text-neutral-550 font-semibold block mt-1.5 leading-none">
                  Pending Today
                </span>
              )}
            </div>

            {/* Giant Fullscreen Interactive Tap Target */}
            <div 
              onClick={handleTap} 
              className="flex-1 w-full flex flex-col items-center justify-center cursor-pointer select-none"
            >
              <div className="relative flex items-center justify-center">
                {/* Visual pulsating ripple */}
                <motion.div 
                  className="absolute w-44 h-44 rounded-full border-2 border-emerald-500/20"
                  animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0.1, 0.6] }}
                  transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                />

                <div className="text-center flex flex-col items-center z-10">
                  <motion.span 
                    key={`focus-count-${currentCount}`}
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-8xl font-black text-neutral-50 font-mono"
                  >
                    {currentCount}
                  </motion.span>
                  <span className="text-xs text-neutral-500 font-bold tracking-widest uppercase mt-4 block">
                    TAP ANYWHERE TO COUNT
                  </span>
                  {currentDhikr.targetCount > 0 && (
                    <span className="text-xs font-semibold text-emerald-400/80 mt-1">
                      Target: {currentCount}/{currentDhikr.targetCount}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Tap to Exit buttons */}
            <div className="pb-8">
              <button
  id="btn_focus_exit"
  aria-label="Exit focus mode"
  onClick={() => setIsFocusMode(false)}
  className="px-6 py-2.5 rounded-full bg-neutral-900 border border-neutral-850 hover:bg-neutral-800 text-neutral-300 text-xs font-bold tracking-widest uppercase cursor-pointer select-none"
>
  Exit Focus
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
