import type { DhikrHistory } from './types';

/** A full week of practice earns one streak freeze. */
export const FREEZE_EVERY = 7;
/** Freezes are capped so a long streak is forgiving without being unbreakable. */
export const MAX_FREEZES = 2;
/** Longest single pause, so a forgotten pause cannot hide a lapse forever. */
export const MAX_PAUSE_DAYS = 30;

export const DEFAULT_DAILY_GOAL = 100;
export interface GoalTemplate {
  id: string;
  name: string;
  goal: number;
  blurb: string;
}

/** Starting points offered in onboarding and Settings. Any value in range is still accepted from storage. */
export const GOAL_TEMPLATES: readonly GoalTemplate[] = [
  { id: 'gentle', name: 'Gentle', goal: 33, blurb: 'One round a day' },
  { id: 'steady', name: 'Steady', goal: 100, blurb: 'A small daily habit' },
  { id: 'devoted', name: 'Devoted', goal: 300, blurb: 'About three rounds' },
  { id: 'dedicated', name: 'Dedicated', goal: 1000, blurb: 'A full daily wird' },
];
const MIN_DAILY_GOAL = 10;
const MAX_DAILY_GOAL = 100000;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Inclusive range of local dates (YYYY-MM-DD) during which the streak is on hold. */
export interface StreakPause {
  from: string;
  until: string;
}

export interface StreakInfo {
  streak: number;
  /** Freezes currently banked and available. */
  freezes: number;
  /** Missed days a freeze was spent on. */
  freezeDates: string[];
  /** True when today has no practice yet, so today's streak is not secured. */
  atRisk: boolean;
  paused: boolean;
}

export interface DailyProgress {
  beads: number;
  goal: number;
  ratio: number;
  done: boolean;
}

const isDateString = (value: unknown): value is string =>
  typeof value === 'string' && DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

const toLocalDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** Calendar arithmetic on YYYY-MM-DD strings, done in UTC so daylight saving never shifts a day. */
export const addDays = (date: string, delta: number): string => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
};

export const isPaused = (date: string, pauses: readonly StreakPause[]): boolean =>
  pauses.some((p) => date >= p.from && date <= p.until);

const activeDates = (history: readonly DhikrHistory[], extraDays: readonly string[]): Set<string> => {
  const dates = new Set<string>(extraDays);
  for (const entry of history) {
    if (entry.count > 0) dates.add(toLocalDate(new Date(entry.timestamp)));
  }
  return dates;
};

/** Most days of tap activity kept; older ones are already reflected in history or past streaks. */
const MAX_ACTIVE_DAYS = 400;

/** Records a day with at least one tap, so a day of unfinished rounds still counts as practice. */
export const addActiveDay = (days: readonly string[], date: string): string[] => {
  if (days.includes(date)) return days as string[];
  return [...days, date].slice(-MAX_ACTIVE_DAYS);
};

export const sanitizeActiveDays = (value: unknown): string[] =>
  Array.isArray(value) ? [...new Set(value.filter(isDateString))].sort() : [];

/**
 * Walks every day from the first practice to today. Practice extends the streak, a full week earns
 * a freeze, a missed day spends a freeze (or ends the streak if none), and paused days are skipped.
 * Derived from history plus the logged tap days, so there is no streak counter to fall out of sync.
 */
export const computeStreakInfo = (
  history: readonly DhikrHistory[],
  pauses: readonly StreakPause[],
  today: string,
  extraActiveDays: readonly string[] = [],
): StreakInfo => {
  const active = activeDates(history, extraActiveDays);
  const first = [...active].filter((d) => d <= today).sort()[0];
  const paused = isPaused(today, pauses);
  if (!first) return { streak: 0, freezes: 0, freezeDates: [], atRisk: false, paused };

  let streak = 0;
  let freezes = 0;
  let freezeDates: string[] = [];

  for (let day = first; day <= today; day = addDays(day, 1)) {
    if (active.has(day)) {
      streak += 1;
      if (streak % FREEZE_EVERY === 0) freezes = Math.min(MAX_FREEZES, freezes + 1);
    } else if (day === today || isPaused(day, pauses)) {
      continue;
    } else if (freezes > 0) {
      freezes -= 1;
      freezeDates = [...freezeDates, day];
    } else {
      streak = 0;
      freezeDates = [];
    }
  }

  return { streak, freezes, freezeDates, atRisk: streak > 0 && !active.has(today) && !paused, paused };
};

/** Starts a pause today for `days` days (1 to MAX_PAUSE_DAYS). Returns a new list. */
export const startPause = (pauses: readonly StreakPause[], from: string, days: number): StreakPause[] => {
  const length = Number.isFinite(days) ? Math.min(MAX_PAUSE_DAYS, Math.max(1, Math.round(days))) : 1;
  return [...pauses, { from, until: addDays(from, length - 1) }];
};

/** Ends any pause that is running today: it stops yesterday, or is dropped if it began today. */
export const endPause = (pauses: readonly StreakPause[], today: string): StreakPause[] => {
  const yesterday = addDays(today, -1);
  return pauses.flatMap((p) => {
    if (today < p.from || today > p.until) return [p];
    return p.from > yesterday ? [] : [{ from: p.from, until: yesterday }];
  });
};

export const sanitizePauses = (value: unknown): StreakPause[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((p): p is StreakPause => {
    if (typeof p !== 'object' || p === null) return false;
    const { from, until } = p as Record<string, unknown>;
    return isDateString(from) && isDateString(until) && from <= until && until <= addDays(from, MAX_PAUSE_DAYS - 1);
  }).map(({ from, until }) => ({ from, until }));
};

export const sanitizeDailyGoal = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_DAILY_GOAL;
  return Math.min(MAX_DAILY_GOAL, Math.max(MIN_DAILY_GOAL, Math.round(value)));
};

/** Beads in finished rounds on one local day. Memoise on history; it scans every entry. */
export const beadsOnDay = (history: readonly DhikrHistory[], day: string): number =>
  history.reduce((sum, h) => (toLocalDate(new Date(h.timestamp)) === day ? sum + h.count : sum), 0);

/** Beads counted today (finished rounds plus the one in progress) against the daily goal. */
export const dailyProgress = (finished: number, currentCount: number, goal: number): DailyProgress => {
  const beads = finished + Math.max(0, currentCount);
  const ratio = goal > 0 ? Math.min(1, beads / goal) : 0;
  return { beads, goal, ratio, done: goal > 0 && beads >= goal };
};

/** One calm line about the streak. Never guilt: an unsecured day is an invitation, not a threat. */
export const streakMessage = (info: StreakInfo): string => {
  if (info.paused) return 'Streak on hold. It will be here when you are back.';
  if (info.streak === 0) return 'Start today. One bead is enough.';
  const base = `${info.streak}-day streak`;
  const freeze = info.freezes > 0 ? ` · ${info.freezes} ${info.freezes === 1 ? 'freeze' : 'freezes'} in reserve` : '';
  return info.atRisk ? `${base}. One bead today keeps it going.${freeze}` : `${base}${freeze}`;
};

/** "40 / 100 beads" while working towards the goal, then a plain statement once it is met. */
export const progressLabel = (progress: DailyProgress): string =>
  progress.done ? `Goal reached · ${progress.beads} beads` : `${progress.beads} / ${progress.goal} beads`;
