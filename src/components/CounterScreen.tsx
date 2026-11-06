import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { RotateCcw, Undo2, Volume2, VolumeX, Maximize2, Minimize2, Check, ChevronLeft } from 'lucide-react';
import { Dhikr, DhikrHistory, UserPreferences } from '../types';
import { isTimestampOnLocalDay, shouldCountOnKey, getCounterLiveMessage, dhikrReadingLines } from '../domain';
import { roundInfo, getBeadState, heroFontSize, countDisplay } from '../counter';
import { warmTone } from '../audio';
import BeadString from './BeadString';

// Elements that own Space/Enter themselves; the global counting shortcut must not hijack them.
const INTERACTIVE_SELECTOR = [
  'button', 'a[href]', 'summary', '[tabindex]:not([tabindex="-1"])',
  '[role="button"]', '[role="link"]', '[role="tab"]', '[role="switch"]', '[role="checkbox"]',
  '[role="menuitem"]', '[role="option"]', '[role="menu"]', '[role="dialog"]',
].join(', ');

// ─── Props ────────────────────────────────────────────────────────────────────

interface CounterScreenProps {
  currentDhikr: Dhikr;
  currentCount: number;
  history: DhikrHistory[];
  preferences: UserPreferences;
  onIncrement: () => void;
  onUndo: () => void;
  canUndo: boolean;
  onReset: () => void;
  onToggleSound: () => void;
  onNavigateToLibrary: () => void;
  /** The next phrases in the sequence, shown dimmed under the current one. */
  upcoming: Dhikr[];
  /** Set during the short pause after a round completes, before the counter moves on. */
  pendingNext: Dhikr | null;
  /** True while a confirm dialog is open; the keyboard counting shortcut is paused. */
  modalOpen?: boolean;
  /** The last dhikr of the running routine has reached its target. */
  routineComplete?: boolean;
  /** Ends the routine and leaves the counter. Offered once the routine is complete. */
  onFinishRoutine?: () => void;
}

// ─── Theme config ─────────────────────────────────────────────────────────────

const THEME_CONFIG = {
  amber:    { ring: '#F59E0B', glow: 'rgba(245,158,11,0.18)',  text: '#FCD34D' },
  emerald:  { ring: '#34D3A0', glow: 'rgba(52,211,160,0.18)',  text: '#5EEAB5' },
  indigo:   { ring: '#818CF8', glow: 'rgba(129,140,248,0.18)', text: '#A5B4FC' },
  midnight: { ring: '#F43F5E', glow: 'rgba(244,63,94,0.18)',   text: '#FDA4AF' },
  slate:    { ring: '#94A3B8', glow: 'rgba(148,163,184,0.15)', text: '#CBD5E1' },
} as const;

// ─── SVG ring progress ────────────────────────────────────────────────────────

const RADIUS = 108;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function ProgressRing({ progress, color }: { progress: number; color: string }) {
  const offset = CIRCUMFERENCE * (1 - Math.min(progress, 1));
  return (
    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 256 256" aria-hidden="true" focusable="false">
      <circle cx="128" cy="128" r={RADIUS} fill="none" stroke="var(--color-border)" strokeWidth="5" />
      <motion.circle
        cx="128" cy="128" r={RADIUS}
        fill="none"
        stroke={color}
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        animate={{ strokeDashoffset: offset }}
        transition={{ type: 'spring', stiffness: 90, damping: 16 }}
        style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
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
  onUndo,
  canUndo,
  onReset,
  onToggleSound,
  onNavigateToLibrary,
  upcoming,
  pendingNext,
  modalOpen = false,
  routineComplete = false,
  onFinishRoutine,
}: CounterScreenProps) {
  const [isFocusMode, setIsFocusMode] = useState(false);
  const enterFocusModeRef = useRef<HTMLButtonElement>(null);
  const exitFocusModeRef = useRef<HTMLButtonElement>(null);
  const focusModeSeen = useRef(false);
  useEffect(() => {
    // Entering hides the header the pressed button lives in, so focus goes to Exit; leaving puts it back on Enter.
    if (!focusModeSeen.current) { focusModeSeen.current = true; return; }
    (isFocusMode ? exitFocusModeRef : enterFocusModeRef).current?.focus();
  }, [isFocusMode]);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const [showFlash, setShowFlash] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const rippleId = useRef(0);
  const reduceMotion = useReducedMotion();
  const theme = THEME_CONFIG[preferences.theme] ?? THEME_CONFIG.emerald;

  const target = currentDhikr.targetCount;
  const { inRound, rounds, remaining } = roundInfo(currentCount, target);
  const beads = getBeadState(currentCount, target);
  const progress = target > 0 ? inRound / target : (currentCount % 100) / 100;
  const display = countDisplay(target > 0 ? inRound : currentCount, target);
  const reading = dhikrReadingLines(currentDhikr, preferences);
  const isCompletedToday = history.some(log => log.dhikrId === currentDhikr.id && isTimestampOnLocalDay(log.timestamp));

  // Pre-render this tone so the first taps are as cheap as the rest.
  useEffect(() => { void warmTone(preferences.soundTone); }, [preferences.soundTone]);

  // Previous count drives the live announcement, the completion moment and undo detection.
  const previousCountRef = useRef(currentCount);
  const liveMessage = getCounterLiveMessage({
    count: currentCount,
    previousCount: previousCountRef.current,
    target,
    name: currentDhikr.nameEn,
  });

  useEffect(() => {
    const previous = previousCountRef.current;
    previousCountRef.current = currentCount;
    const completed = target > 0 && currentCount > previous && currentCount % target === 0;
    if (!completed) return undefined;
    setShowFlash(true);
    setJustCompleted(true);
    const flash = setTimeout(() => setShowFlash(false), 600);
    const toast = setTimeout(() => setJustCompleted(false), 2600);
    return () => { clearTimeout(flash); clearTimeout(toast); };
  }, [currentCount, target]);

  // A long text scrolls inside its area; a soft fade at the bottom says there is more to read.
  const textRef = useRef<HTMLDivElement>(null);
  const [moreBelow, setMoreBelow] = useState(false);
  const updateFade = useCallback(() => {
    const el = textRef.current;
    if (!el) return;
    setMoreBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
  }, []);
  useEffect(() => {
    const el = textRef.current;
    if (!el) return undefined;
    el.scrollTop = 0;
    updateFade();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(updateFade);
    observer.observe(el);
    return () => observer.disconnect();
  }, [currentDhikr.id, reading.transliteration, reading.translation, updateFade]);

  const addRipple = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const id = rippleId.current++;
    setRipples(prev => [...prev.slice(-3), { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 600);
  }, []);

  // Pointer path: counts on touch-down, which feels faster than waiting for the click.
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    addRipple(e);
    onIncrement();
  }, [addRipple, onIncrement]);

  // Keyboard and assistive-technology activation arrive as a click with no pointer (detail 0).
  // Pointer-initiated clicks have detail >= 1 and were already counted on pointer down.
  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.detail === 0) onIncrement();
  }, [onIncrement]);

  // Keyboard shortcut. Focused controls (buttons, links, dialogs) keep their native
  // Space/Enter behaviour, otherwise the tap button would count twice per press.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const shouldCount = shouldCountOnKey({
        code: e.code,
        repeat: e.repeat,
        defaultPrevented: e.defaultPrevented,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
        isEditable: target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable,
        insideInteractive: !!target.closest?.(INTERACTIVE_SELECTOR),
        modalOpen,
      });
      if (!shouldCount) return;
      e.preventDefault();
      onIncrement();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onIncrement, modalOpen]);

  const countLabel = target > 0
    ? `${currentDhikr.nameEn}, ${inRound} of ${target}`
    : `${currentDhikr.nameEn}, ${currentCount}`;

  const caption = justCompleted
    ? pendingNext
      ? `Masha'Allah! Next: ${pendingNext.nameEn}`
      : routineComplete
        ? "Masha'Allah! Routine complete"
        : "Masha'Allah! Round complete"
    : pendingNext
      ? `Next: ${pendingNext.nameEn}`
      : routineComplete
        ? 'Routine complete. Barakallahu feek'
        : target <= 0
        ? 'Free count'
        : remaining === 0
          ? 'Round complete'
          : `${remaining} remaining${rounds > 0 ? ` · round ${rounds + 1}` : ''}`;
  const captionIsHighlight = justCompleted || pendingNext !== null || !!routineComplete;

  return (
    <div className="relative flex flex-col h-full overflow-hidden" style={{ background: 'var(--color-bg-base)' }}>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{liveMessage}{routineComplete ? ' Routine complete.' : ''}</div>

      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse 70% 45% at 50% 62%, ${theme.glow}, transparent 70%)` }}
      />

      {/* Completion flash (opacity only, so it is safe with reduced motion) */}
      <AnimatePresence>
        {showFlash && !reduceMotion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.35, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 z-30 pointer-events-none"
            style={{ background: `radial-gradient(circle at 50% 55%, ${theme.glow} 0%, transparent 70%)` }}
          />
        )}
      </AnimatePresence>

      <h1 className="sr-only">Tasbih counter</h1>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <motion.div
        animate={{ opacity: isFocusMode ? 0 : 1, y: isFocusMode ? -16 : 0 }}
        transition={{ duration: 0.25 }}
        className="screen-header z-20"
        style={{ pointerEvents: isFocusMode ? 'none' : 'auto' }}
        aria-hidden={isFocusMode}
        inert={isFocusMode}
      >
        <div className="header-row">
          <button
            id="btn_dhikr_selector"
            aria-label="Browse and change active dhikr"
            onClick={onNavigateToLibrary}
            className="back-btn group"
            tabIndex={isFocusMode ? -1 : 0}
          >
            <ChevronLeft className="w-5 h-5 shrink-0" />
            <div className="flex flex-col items-start min-w-0">
              <span className="caption">Active Dhikr</span>
              <span className="text-sm font-bold truncate max-w-[140px] group-hover:opacity-80 transition-opacity" style={{ color: 'var(--color-text-primary)' }}>
                {currentDhikr.nameEn}
              </span>
            </div>
          </button>

          <div className="flex items-center gap-2">
            {isCompletedToday
              ? <span className="badge badge-emerald"><Check className="w-2.5 h-2.5 stroke-[3]" /> Done</span>
              : <span className="badge badge-slate">Pending</span>}
            <button
              onClick={onToggleSound}
              aria-label={preferences.soundOn ? 'Mute sound' : 'Unmute sound'}
              className="tap-target rounded-xl cursor-pointer transition-all"
              style={{ background: 'var(--color-bg-raised)', border: '1px solid var(--color-border)' }}
              tabIndex={isFocusMode ? -1 : 0}
            >
              {preferences.soundOn
                ? <Volume2 className="w-5 h-5" style={{ color: 'var(--color-text-brand)' }} />
                : <VolumeX className="w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />}
            </button>
            <button
              ref={enterFocusModeRef}
              onClick={() => setIsFocusMode(true)}
              aria-label="Enter focus mode"
              className="tap-target rounded-xl cursor-pointer transition-all"
              style={{ background: 'var(--color-bg-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
              tabIndex={isFocusMode ? -1 : 0}
            >
              <Maximize2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* ── Tap stage: everything between the header and the controls is one big target ── */}
      <div className="relative flex-1 min-h-0 w-full z-10">
        {/* The tap layer: one plain button under everything else. Nothing interactive sits inside it. */}
        <button
          id="tap_bead_clicker"
          type="button"
          aria-label={`Tap anywhere to count ${countLabel}`}
          onPointerDown={handlePointerDown}
          onClick={handleClick}
          className="absolute inset-0 h-full w-full select-none cursor-pointer overflow-hidden touch-manipulation"
          style={{ background: 'transparent', border: 0, padding: 0, WebkitUserSelect: 'none' }}
        >
          {ripples.map(r => (
            <motion.span
              key={r.id}
              className="absolute rounded-full pointer-events-none"
              style={{ left: r.x - 8, top: r.y - 8, width: 16, height: 16, background: theme.ring, opacity: 0.35 }}
              initial={{ scale: 0.5, opacity: 0.4 }}
              animate={{ scale: 12, opacity: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
            />
          ))}
        </button>

        {/* What is shown over the tap layer. Touches fall through to it, except on the text and Finish. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center px-5 pt-3 pb-3">
          {/*
            Phrase and queue. A long dhikr (Darood Ibrahim, Ayatul Kursi) scrolls inside this area, so the count below is
            always on screen. Touching it to scroll must not count a bead; a tap (a click, which a scroll never produces) does.
          */}
          <div
            id="dhikr_text"
            ref={textRef}
            role="region"
            aria-label="Dhikr text"
            tabIndex={0}
            onScroll={updateFade}
            onClick={() => onIncrement()}
            className="pointer-events-auto w-full min-h-0 flex-1 overflow-y-auto text-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            style={{
              opacity: isFocusMode ? 0.9 : 1,
              maskImage: moreBelow ? 'linear-gradient(to bottom, #000 calc(100% - 28px), transparent)' : undefined,
              WebkitMaskImage: moreBelow ? 'linear-gradient(to bottom, #000 calc(100% - 28px), transparent)' : undefined,
              overscrollBehavior: 'contain',
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentDhikr.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <p
                  className="font-arabic text-center"
                  dir="rtl"
                  lang="ar"
                  style={{ fontSize: heroFontSize(currentDhikr.nameAr), lineHeight: 1.7, color: 'var(--color-text-primary)', overflowWrap: 'anywhere' }}
                >
                  {currentDhikr.nameAr}
                </p>
                {reading.transliteration && (
                  <p className="text-sm italic mt-0.5" style={{ color: 'var(--color-text-brand)' }}>
                    {reading.transliteration}
                  </p>
                )}
                {reading.translation && (
                  <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    "{reading.translation}"
                  </p>
                )}
              </motion.div>
            </AnimatePresence>

            {upcoming.length > 0 && !isFocusMode && (
              <div className="mt-2 flex flex-col items-center" aria-label="Up next">
                {upcoming.map((d, i) => (
                  <p
                    key={d.id}
                    className={`font-arabic max-w-full truncate ${i > 0 ? '[@media(max-height:760px)]:hidden' : ''}`}
                    dir="rtl"
                    lang="ar"
                    style={{ fontSize: i === 0 ? 24 : 19, lineHeight: 1.5, color: 'var(--color-text-muted)' }}
                  >
                    {d.nameAr}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* The count, the ring and the line under it: never squeezed out by a long text */}
          <div id="counter_ring_group" className="shrink-0 flex w-full flex-col items-center gap-2 pt-2">
            <div className="relative w-48 h-48 [@media(max-height:760px)]:w-40 [@media(max-height:760px)]:h-40 shrink-0 flex items-center justify-center">
              <ProgressRing progress={progress} color={theme.ring} />
              <div className="flex flex-col items-center text-center">
                <motion.div
                  key={`count-${currentCount}`}
                  initial={{ scale: 0.88, opacity: 0.7 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 20 }}
                  className={`flex justify-center font-display font-black tabular-nums leading-none ${display.stacked ? 'flex-col items-center' : 'items-baseline'}`}
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  <span aria-hidden="true" style={{ fontSize: `min(${display.countSize}px, 8.4vh)` }}>{target > 0 ? inRound : currentCount}</span>
                  {target > 0 && (
                    <span
                      aria-hidden="true"
                      className="font-bold"
                      style={{
                        fontSize: `min(${display.targetSize}px, 3.6vh)`,
                        color: 'var(--color-text-muted)',
                        marginInlineStart: display.stacked ? 0 : 4,
                        marginTop: display.stacked ? 4 : 0,
                      }}
                    >
                      /{target}
                    </span>
                  )}
                </motion.div>
              </div>
            </div>

            <p
              className="section-label max-w-full truncate text-center"
              style={{ color: captionIsHighlight ? 'var(--color-text-brand)' : 'var(--color-text-muted)', minHeight: 20 }}
            >
              {caption}
            </p>

          </div>

          {routineComplete && onFinishRoutine && (
            <button
              id="btn_finish_routine"
              type="button"
              onClick={onFinishRoutine}
              className="pointer-events-auto tap-target mt-2 shrink-0 rounded-xl px-6 text-sm font-black cursor-pointer text-on-brand"
              style={{ background: 'var(--color-brand-500)' }}
            >
              Finish
            </button>
          )}

          {/* Bead string and hint, decoration only. On short screens they give their room to the text. */}
          <div className="shrink-0 w-full flex flex-col items-center gap-2 pt-2 [@media(max-height:700px)]:hidden" aria-hidden="true">
            <BeadString total={beads.total} filled={beads.filled} color={theme.ring} className="w-full max-w-sm h-14" />
            <p className="text-xs shrink-0" style={{ color: 'var(--color-text-muted)', minHeight: 16 }}>
              {currentCount === 0 && !pendingNext ? 'Tap anywhere to count' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* ── Controls ──────────────────────────────────────────────────── */}
      <motion.div
        animate={{ opacity: isFocusMode ? 0 : 1 }}
        transition={{ duration: 0.25 }}
        className={`relative z-20 flex flex-wrap items-center justify-between gap-3 px-5 pb-4 pt-2 shrink-0 ${preferences.leftHanded ? 'flex-row-reverse' : ''}`}
        style={{ pointerEvents: isFocusMode ? 'none' : 'auto' }}
        aria-hidden={isFocusMode}
      >
        <div
          className="shrink-0 px-3 py-2 rounded-xl flex items-center gap-2 text-sm font-bold"
          style={{ background: 'var(--color-brand-dim)', border: '1px solid var(--color-brand-border)', color: 'var(--color-text-brand)' }}
        >
          <span className="section-label max-[400px]:sr-only" style={{ color: 'var(--color-text-brand)' }}>Target</span>
          <span className="font-display font-black truncate">{target > 0 ? `${target}×` : '∞'}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn_undo"
            onClick={onUndo}
            disabled={!canUndo}
            aria-label="Undo last count"
            className="tap-target gap-1.5 px-4 max-[400px]:px-3 rounded-xl font-bold text-sm cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'var(--color-bg-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
            tabIndex={isFocusMode ? -1 : 0}
          >
            <Undo2 className="w-4 h-4" /> Undo
          </button>
          <button
            id="btn_reset_counter"
            onClick={onReset}
            aria-label="Reset counter"
            className="tap-target gap-1.5 px-4 max-[400px]:px-3 rounded-xl font-bold text-sm cursor-pointer transition-all"
            style={{ background: 'var(--color-bg-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
            tabIndex={isFocusMode ? -1 : 0}
          >
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
        </div>
      </motion.div>

      {/* Exit focus mode */}
      <AnimatePresence>
        {isFocusMode && (
          <motion.button
            ref={exitFocusModeRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsFocusMode(false)}
            aria-label="Exit focus mode"
            className="tap-target absolute right-3 top-3 z-30 rounded-xl cursor-pointer"
            style={{ background: 'var(--color-bg-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
          >
            <Minimize2 className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
