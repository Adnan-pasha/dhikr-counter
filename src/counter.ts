/**
 * Pure counting rules. No React, no storage, no timers: the UI and hooks call these and
 * apply the result, which keeps every rule unit-testable.
 */

export type HapticStrength = 'light' | 'medium' | 'strong';
export type HapticKind = 'tap' | 'milestone' | 'complete';
export type AdvanceMode = 'routine' | 'free';

export interface TapResult {
  count: number;
  /** This tap finished a round (count is a positive multiple of the target). */
  roundCompleted: boolean;
  /** Every tenth tap, unless the tap also completed a round. */
  milestone: boolean;
  /** Rounds finished after this tap. Always 0 for a free counter. */
  round: number;
}

export const tapCount = (count: number, target: number): TapResult => {
  const next = count + 1;
  const roundCompleted = target > 0 && next % target === 0;
  return {
    count: next,
    roundCompleted,
    milestone: !roundCompleted && next % 10 === 0,
    round: target > 0 ? Math.floor(next / target) : 0,
  };
};

export interface UndoResult {
  count: number;
  /** The undone tap had completed a round, so its history entry should be removed. */
  undidCompletion: boolean;
}

export const undoCount = (count: number, target: number): UndoResult => {
  if (count <= 0) return { count: 0, undidCompletion: false };
  return { count: count - 1, undidCompletion: target > 0 && count % target === 0 };
};

export interface RoundInfo {
  /** Position inside the current round; equals the target right after a round completes. */
  inRound: number;
  rounds: number;
  remaining: number;
}

export const roundInfo = (count: number, target: number): RoundInfo => {
  if (target <= 0) return { inRound: count, rounds: 0, remaining: 0 };
  const rounds = Math.floor(count / target);
  const rest = count % target;
  if (count > 0 && rest === 0) return { inRound: target, rounds, remaining: 0 };
  return { inRound: rest, rounds, remaining: target - rest };
};

export const MAX_BEADS = 33;

export interface BeadState {
  total: number;
  filled: number;
}

/** How many beads the on-screen string shows and how many are lit. */
export const getBeadState = (count: number, target: number, cap: number = MAX_BEADS): BeadState => {
  if (target <= 0) {
    return { total: cap, filled: count === 0 ? 0 : ((count - 1) % cap) + 1 };
  }
  const { inRound } = roundInfo(count, target);
  if (target <= cap) return { total: target, filled: inRound };
  if (inRound === 0) return { total: cap, filled: 0 };
  return { total: cap, filled: Math.max(1, Math.round((inRound / target) * cap)) };
};

interface HasId {
  id: string;
}

/** The dhikr to move to once the current one completes, or null to stay. */
export const findNextDhikrId = (
  sequence: HasId[],
  currentId: string,
  completedIds: ReadonlySet<string>,
  mode: AdvanceMode,
): string | null => {
  const index = sequence.findIndex((d) => d.id === currentId);
  if (index === -1) return null;
  if (mode === 'routine') {
    const next = sequence.slice(index + 1).find((d) => !completedIds.has(d.id));
    return next ? next.id : null;
  }
  if (sequence.length < 2) return null;
  return sequence[(index + 1) % sequence.length].id;
};

/** The next few items shown dimmed under the current phrase. */
export const getUpcoming = <T extends HasId>(
  sequence: T[],
  currentId: string,
  completedIds: ReadonlySet<string>,
  mode: AdvanceMode,
  limit: number,
): T[] => {
  const index = sequence.findIndex((d) => d.id === currentId);
  if (index === -1) return [];
  if (mode === 'routine') {
    return sequence.slice(index + 1).filter((d) => !completedIds.has(d.id)).slice(0, limit);
  }
  const out: T[] = [];
  for (let step = 1; step < sequence.length && out.length < limit; step += 1) {
    out.push(sequence[(index + step) % sequence.length]);
  }
  return out;
};

const STRENGTH_SCALE: Record<HapticStrength, number> = { light: 0.6, medium: 1, strong: 1.5 };

export const hapticScale = (strength: HapticStrength): number => STRENGTH_SCALE[strength];

/** Vibration milliseconds (or a pattern) for each kind of feedback, scaled by strength. */
export const getHapticPattern = (kind: HapticKind, strength: HapticStrength): number | number[] => {
  const scale = hapticScale(strength);
  const ms = (n: number) => Math.round(n * scale);
  if (kind === 'tap') return ms(14);
  if (kind === 'milestone') return ms(26);
  return [ms(30), ms(40), ms(60)];
};

export interface BeadPlacement {
  x: number;
  y: number;
  r: number;
}

const BEAD_MARGIN = 14;
const BEAD_TOP = 12;
const BEAD_MIN_RADIUS = 3.5;
const BEAD_MAX_RADIUS = 11;

/**
 * Positions for a hanging string of beads in a `width` wide box: level ends, the middle
 * sagging by `sag`. Bead size follows the room each bead has.
 */
export const beadLayout = (total: number, width: number, sag: number): BeadPlacement[] => {
  if (total <= 0) return [];
  if (total === 1) return [{ x: width / 2, y: BEAD_TOP + sag, r: BEAD_MAX_RADIUS }];
  const usable = width - BEAD_MARGIN * 2;
  const spacing = usable / (total - 1);
  const r = Math.min(BEAD_MAX_RADIUS, Math.max(BEAD_MIN_RADIUS, spacing * 0.38));
  return Array.from({ length: total }, (_, i) => {
    const t = i / (total - 1);
    return { x: BEAD_MARGIN + t * usable, y: BEAD_TOP + sag * Math.sin(Math.PI * t), r };
  });
};

// Harakat, Quranic marks and tatweel carry no width of their own; only base letters count.
const ARABIC_NON_BASE = /[ً-ٰٟۖ-ۭـ\s]/g;

/** Font size in px for the Arabic phrase on the counter: long phrases shrink to fit. */
export const heroFontSize = (arabic: string): number => {
  const letters = arabic.replace(ARABIC_NON_BASE, '').length;
  if (letters <= 10) return 60;
  if (letters <= 22) return 50;
  if (letters <= 44) return 40;
  if (letters <= 80) return 34;
  return 30;
};
