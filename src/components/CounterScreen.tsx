import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw, Volume2, VolumeX, Maximize2, Minimize2, Check, ChevronLeft, Sparkles } from 'lucide-react';
import { Dhikr, DhikrHistory, UserPreferences } from '../types';

// ─── Props ────────────────────────────────────────────────────────────────────

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

// ─── Theme config ─────────────────────────────────────────────────────────────

const THEME_CONFIG = {
  amber:    { ring: '#F59E0B', glow: 'rgba(245,158,11,0.18)',  text: '#FCD34D', bg: 'rgba(245,158,11,0.08)'  },
  emerald:  { ring: '#10B981', glow: 'rgba(16,185,129,0.18)',  text: '#6EE7B7', bg: 'rgba(16,185,129,0.08)'  },
  indigo:   { ring: '#818CF8', glow: 'rgba(129,140,248,0.18)', text: '#A5B4FC', bg: 'rgba(129,140,248,0.08)' },
  midnight: { ring: '#F43F5E', glow: 'rgba(244,63,94,0.18)',   text: '#FDA4AF', bg: 'rgba(244,63,94,0.08)'   },
  slate:    { ring: '#94A3B8', glow: 'rgba(148,163,184,0.15)', text: '#CBD5E1', bg: 'rgba(148,163,184,0.08)' },
} as const;

// ─── SVG ring progress ────────────────────────────────────────────────────────

const RADIUS = 108;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function ProgressRing({ progress, color }: { progress: number; color: string }) {
  const offset = CIRCUMFERENCE * (1 - Math.min(progress, 1));
  return (
    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 256 256">
      {/* Track */}
      <circle cx="128" cy="128" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
      {/* Progress */}
      <motion.circle
        cx="128" cy="128" r={RADIUS}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        animate={{ strokeDashoffset: offset }}
        transition={{ type: 'spring', stiffness: 60, damping: 14 }}
        style={{ filter: `drop-shadow(0 0 6px ${color}60)` }}
      />
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

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
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const [showFlash, setShowFlash] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const tapAreaRef = useRef<HTMLButtonElement>(null);
  const rippleId = useRef(0);
  const theme = THEME_CONFIG[preferences.theme] ?? THEME_CONFIG.amber;

  const isCompletedToday = history.some(log => {
    if (log.dhikrId !== currentDhikr.id) return false;
    const d = new Date(log.timestamp), t = new Date();
    return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
  });

  const progress = currentDhikr.targetCount > 0
    ? Math.min(currentCount / currentDhikr.targetCount, 1)
    : (currentCount % 100) / 100;

  // Completion flash
  useEffect(() => {
    if (currentDhikr.targetCount > 0 && currentCount === currentDhikr.targetCount) {
      setShowFlash(true);
      setJustCompleted(true);
      setTimeout(() => setShowFlash(false), 600);
      setTimeout(() => setJustCompleted(false), 3000);
    }
  }, [currentCount, currentDhikr.targetCount]);

  // Add ripple on tap
  const addRipple = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = rippleId.current++;
    setRipples(prev => [...prev, { id, x, y }]);
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 600);
  }, []);

  const handleTap = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    addRipple(e);
    onIncrement();
  }, [addRipple, onIncrement]);

  // Keyboard shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTypingContext = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (isTypingContext) return;
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); onIncrement(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onIncrement]);

  const roundsComplete = currentDhikr.targetCount > 0
    ? Math.floor(currentCount / currentDhikr.targetCount)
    : 0;

  return (
    <div
      className="relative flex flex-col h-full overflow-hidden"
      style={{ background: 'var(--color-bg-base)' }}
    >
      {/* Ambient background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 60% 40% at 50% 70%, ${theme.glow}, transparent 70%)`,
        }}
      />

      {/* Completion flash */}
      <AnimatePresence>
        {showFlash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.3, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 z-50 pointer-events-none"
            style={{ background: `radial-gradient(circle, ${theme.glow} 0%, transparent 70%)` }}
          />
        )}
      </AnimatePresence>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <motion.div
        animate={{ opacity: isFocusMode ? 0 : 1, y: isFocusMode ? -16 : 0 }}
        transition={{ duration: 0.25 }}
        className="screen-header z-10"
        style={{ pointerEvents: isFocusMode ? 'none' : 'auto' }}
      >
        <div className="header-row">
          {/* Back / Dhikr selector */}
          <button
            id="btn_dhikr_selector"
            aria-label="Browse and change active dhikr"
            onClick={onNavigateToLibrary}
            className="back-btn group"
          >
            <ChevronLeft className="w-5 h-5 shrink-0" />
            <div className="flex flex-col items-start min-w-0">
              <span className="caption">Active Dhikr</span>
              <span className="text-sm font-bold truncate max-w-[140px] group-hover:opacity-80 transition-opacity" style={{ color: 'var(--color-text-primary)' }}>
                {currentDhikr.nameEn}
              </span>
            </div>
          </button>

          {/* Status + controls */}
          <div className="flex items-center gap-2">
            {isCompletedToday
              ? <span className="badge badge-emerald"><Check className="w-2.5 h-2.5 stroke-[3]" /> Done</span>
              : <span className="badge badge-slate">Pending</span>
            }
            <button
              onClick={onToggleSound}
              aria-label={preferences.soundOn ? 'Mute sound' : 'Unmute sound'}
              className="w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-all"
              style={{ background: 'var(--color-bg-raised)', border: '1px solid var(--color-border)' }}
            >
              {preferences.soundOn
                ? <Volume2 className="w-4.5 h-4.5" style={{ color: theme.text }} />
                : <VolumeX className="w-4.5 h-4.5 text-slate-500" />}
            </button>
            <button
              onClick={() => setIsFocusMode(true)}
              aria-label="Enter focus mode"
              className="w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-all"
              style={{ background: 'var(--color-bg-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
            >
              <Maximize2 className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* ── Arabic text ────────────────────────────────────────────────── */}
      <motion.div
        animate={{ opacity: isFocusMode ? 0 : 1 }}
        transition={{ duration: 0.25 }}
        className="px-6 pb-2 z-10 text-center shrink-0"
        style={{ pointerEvents: isFocusMode ? 'none' : 'auto' }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentDhikr.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            {/* Arabic — 36px minimum for comfortable reading */}
            <p
              className="font-arabic text-center select-none"
              style={{ fontSize: '2.25rem', lineHeight: '2.2', color: 'var(--color-text-primary)' }}
            >
              {currentDhikr.nameAr}
            </p>
            {currentDhikr.transliteration && (
              <p className="text-sm italic mt-1 select-none" style={{ color: theme.text, opacity: 0.75 }}>
                {currentDhikr.transliteration}
              </p>
            )}
            <p className="text-sm mt-1 select-none" style={{ color: 'var(--color-text-muted)' }}>
              "{currentDhikr.meaning}"
            </p>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* ── Main tap area ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 z-10">

        {/* Progress ring + counter */}
        <div className="relative w-64 h-64 flex items-center justify-center">

          {/* Outer glow ring */}
          <div
            className="absolute inset-[-2px] rounded-full pointer-events-none"
            style={{ boxShadow: `0 0 40px ${theme.glow}, 0 0 80px ${theme.glow.replace('0.18', '0.06')}` }}
          />

          {/* SVG progress ring */}
          <ProgressRing progress={progress} color={theme.ring} />

          {/* Tap button */}
          <button
            id="tap_bead_clicker"
            aria-label="Tap to count dhikr"
            ref={tapAreaRef}
            onClick={handleTap}
            className="relative w-52 h-52 rounded-full flex flex-col items-center justify-center select-none cursor-pointer focus:outline-none overflow-hidden ripple-container"
            style={{
              background: `radial-gradient(circle at 40% 35%, var(--color-bg-raised), var(--color-bg-surface))`,
              border: `1px solid ${theme.ring}25`,
              boxShadow: `0 20px 60px -12px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.05), 0 0 0 1px ${theme.ring}10`,
            }}
          >
            {/* Ripples */}
            {ripples.map(r => (
              <motion.span
                key={r.id}
                className="absolute rounded-full pointer-events-none"
                style={{
                  left: r.x - 8,
                  top: r.y - 8,
                  width: 16,
                  height: 16,
                  background: `${theme.ring}40`,
                }}
                initial={{ scale: 1, opacity: 0.8 }}
                animate={{ scale: 14, opacity: 0 }}
                transition={{ duration: 0.55, ease: 'easeOut' }}
              />
            ))}

            {/* Count */}
            <motion.span
              key={`count-${currentCount}`}
              initial={{ scale: 0.85, opacity: 0.6 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="font-display font-black tabular-nums select-none leading-none"
              style={{
                fontSize: currentCount >= 1000 ? '3.5rem' : '5rem',
                color: 'var(--color-text-primary)',
              }}
            >
              {currentCount}
            </motion.span>

            {/* Progress label */}
            <span className="section-label mt-2 select-none" style={{ color: 'var(--color-text-muted)' }}>
              {currentDhikr.targetCount > 0
                ? currentCount >= currentDhikr.targetCount
                  ? '✓ Complete'
                  : `${currentDhikr.targetCount - currentCount} remaining`
                : 'tap to count'}
            </span>

            {/* Rounds indicator */}
            {roundsComplete > 0 && (
              <div className="mt-1.5 flex items-center gap-1">
                {Array.from({ length: Math.min(roundsComplete, 5) }, (_, i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: theme.ring }} />
                ))}
                {roundsComplete > 5 && (
                  <span className="text-xs font-bold" style={{ color: theme.text }}>×{roundsComplete}</span>
                )}
              </div>
            )}
          </button>
        </div>

        {/* Completion card */}
        <AnimatePresence>
          {justCompleted && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="mt-4 flex items-center gap-2.5 px-5 py-3 rounded-2xl"
              style={{
                background: 'rgba(16,185,129,0.12)',
                border: '1px solid rgba(16,185,129,0.3)',
              }}
            >
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <div>
                <p className="text-sm font-black text-emerald-400">Masha'Allah! 🎉</p>
                <p className="text-sm text-slate-400">Target complete — keep going or reset</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Footer actions ─────────────────────────────────────────────── */}
      <motion.div
        animate={{ opacity: isFocusMode ? 0 : 1, y: isFocusMode ? 16 : 0 }}
        transition={{ duration: 0.25 }}
        className="px-6 pb-5 pt-2 flex items-center justify-between z-10 shrink-0"
        style={{ pointerEvents: isFocusMode ? 'none' : 'auto' }}
      >
        {/* Target badge */}
        <div
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl"
          style={{ background: theme.bg, border: `1px solid ${theme.ring}30` }}
        >
          <span className="caption uppercase tracking-widest" style={{ color: theme.text, opacity: 0.8 }}>Target</span>
          <span className="text-sm font-black" style={{ color: theme.text }}>
            {currentDhikr.targetCount > 0 ? `${currentDhikr.targetCount}×` : '∞'}
          </span>
        </div>

        {/* Reset button */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          id="btn_reset_counter"
          onClick={onReset}
          className="flex items-center gap-2 px-4 py-2 rounded-xl cursor-pointer transition-all"
          style={{
            background: 'var(--color-bg-raised)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="text-sm font-semibold">Reset</span>
        </motion.button>
      </motion.div>

      {/* ── Focus mode overlay ─────────────────────────────────────────── */}
      <AnimatePresence>
        {isFocusMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-40 flex flex-col"
            style={{ background: '#070B14' }}
          >
            {/* Ambient glow */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: `radial-gradient(ellipse 70% 50% at 50% 60%, ${theme.glow.replace('0.18', '0.25')}, transparent 70%)` }}
            />

            {/* Dhikr info */}
            <div className="text-center pt-12 px-6 z-10">
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-arabic text-5xl leading-loose select-none"
                style={{ color: theme.text }}
              >
                {currentDhikr.nameAr}
              </motion.p>
              <p className="text-sm font-medium mt-1 select-none" style={{ color: 'var(--color-text-muted)' }}>
                {currentDhikr.nameEn}
              </p>
            </div>

            {/* Fullscreen tap target */}
            <button
              className="flex-1 flex flex-col items-center justify-center cursor-pointer select-none focus:outline-none"
              onClick={onIncrement}
            >
              {/* Pulse rings */}
              {[1, 2, 3].map(i => (
                <motion.div
                  key={i}
                  className="absolute rounded-full border"
                  style={{
                    width: 160 + i * 48,
                    height: 160 + i * 48,
                    borderColor: `${theme.ring}${20 - i * 4}`,
                  }}
                  animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0.1, 0.4] }}
                  transition={{ repeat: Infinity, duration: 2.5 + i * 0.5, ease: 'easeInOut', delay: i * 0.4 }}
                />
              ))}

              {/* Count */}
              <motion.span
                key={`focus-${currentCount}`}
                initial={{ scale: 0.88 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="font-display font-black tabular-nums select-none relative z-10"
                style={{ fontSize: '6rem', color: 'var(--color-text-primary)', lineHeight: 1 }}
              >
                {currentCount}
              </motion.span>

              {currentDhikr.targetCount > 0 && (
                <p className="text-sm mt-3 select-none z-10" style={{ color: theme.text, opacity: 0.6 }}>
                  {currentCount} / {currentDhikr.targetCount}
                </p>
              )}

              <p className="text-xs font-bold uppercase tracking-widest mt-6 select-none z-10" style={{ color: 'var(--color-text-muted)' }}>
                tap anywhere to count
              </p>
            </button>

            {/* Exit */}
            <div className="pb-10 flex justify-center z-10">
              <motion.button
                whileTap={{ scale: 0.93 }}
                id="btn_focus_exit"
                aria-label="Exit focus mode"
                onClick={() => setIsFocusMode(false)}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl cursor-pointer"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                <Minimize2 className="w-4 h-4" />
                <span className="text-sm font-semibold">Exit Focus</span>
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
