import { addDays } from '../habits';

/** Total ayat in the Quran, used for the khatam arithmetic. */
export const AYAT_IN_QURAN = 6236;
/** An average reading pace. Used only to turn a daily goal into a rough finishing time. */
export const AYAT_PER_MINUTE = 6;
export const GOAL_CHOICES = [5, 10, 15] as const;
/** Reading stops counting after this long without a touch, scroll or key press. */
export const IDLE_MS = 30_000;
/** A day counts as practised, for the streak, after a minute of reading. */
export const PRACTISED_SECONDS = 60;
export const MAX_LOG_DAYS = 400;

/**
 * Ayat in each surah, in order. Used to turn a surah and ayah into a number from 1 to 6236 and to
 * reject positions that cannot exist. The sum is checked against AYAT_IN_QURAN in the tests.
 */
export const SURAH_AYAT: readonly number[] = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
  112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85,
  54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
  14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42,
  29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11,
  11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];

/** Number of the ayah counted from the start of the Quran, or null if the surah and ayah do not exist. */
export const globalAyah = (surah: number, ayah: number): number | null => {
  if (!Number.isInteger(surah) || !Number.isInteger(ayah) || surah < 1 || surah > SURAHS) return null;
  if (ayah < 1 || ayah > SURAH_AYAT[surah - 1]) return null;
  let before = 0;
  for (let i = 0; i < surah - 1; i++) before += SURAH_AYAT[i];
  return before + ayah;
};

/**
 * Two saved positions closer than this are treated as continuous reading, so the ayat between them
 * count as read. A bigger gap is a jump (opening a faraway surah), which counts only what was on screen.
 */
export const MAX_STEP_AYAT = 60;

const MAX_SECONDS_PER_UPDATE = 3600;
const MAX_SECONDS_PER_DAY = 86_400;
const SURAHS = 114;
export type ReadRange = [number, number];
const MIN_PLAN_DAYS = 7;
const MAX_PLAN_DAYS = 365;
const DEFAULT_PLAN_DAYS = 30;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
const WEEK_LENGTH = 7;
const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

export interface DayReading {
  date: string;
  seconds: number;
}

export interface ReadingPosition {
  surah: number;
  ayah: number;
  /** Ayah number counted from the start of the Quran (1 to 6236). */
  global: number;
}

export interface KhatamPlan {
  startDate: string;
  days: number;
}

export interface QuranProgress {
  goalMinutes: number | null;
  log: DayReading[];
  position: ReadingPosition | null;
  /** Ayat read, as sorted, non-touching inclusive ranges of ayah numbers counted from the start. */
  read: ReadRange[];
  khatam: KhatamPlan | null;
}

export const EMPTY_PROGRESS: QuranProgress = { goalMinutes: null, log: [], position: null, read: [], khatam: null };

const isDate = (v: unknown): v is string => {
  if (typeof v !== 'string' || !DATE_PATTERN.test(v)) return false;
  const parsed = new Date(`${v}T00:00:00Z`);
  // A date that rolls over (2026-02-31) does not survive the round trip.
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === v;
};

const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

// ── goals and reading time ────────────────────────────────────────────────────

export const ayatPerDay = (minutes: number): number => minutes * AYAT_PER_MINUTE;

/** Rough days to finish the Quran at a daily goal. */
export const daysToKhatam = (minutes: number): number => Math.ceil(AYAT_IN_QURAN / ayatPerDay(minutes));

export const isReading = ({ active, visible, msSinceActivity }: { active: boolean; visible: boolean; msSinceActivity: number }): boolean =>
  active && visible && msSinceActivity <= IDLE_MS;

export const setGoal = (progress: QuranProgress, minutes: number | null): QuranProgress => {
  if (minutes === null) return { ...progress, goalMinutes: null };
  return (GOAL_CHOICES as readonly number[]).includes(minutes) ? { ...progress, goalMinutes: minutes } : progress;
};

export const secondsOn = (progress: QuranProgress, date: string): number =>
  progress.log.find((d) => d.date === date)?.seconds ?? 0;

export const minutesOn = (progress: QuranProgress, date: string): number => Math.floor(secondsOn(progress, date) / 60);

export const practisedDay = (progress: QuranProgress, date: string): boolean => secondsOn(progress, date) >= PRACTISED_SECONDS;

const trimLog = (log: DayReading[]): DayReading[] => [...log].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).slice(-MAX_LOG_DAYS);

/** Adds reading time to a day. Returns a new state; bad or empty increments change nothing. */
export const addReadingSeconds = (progress: QuranProgress, date: string, seconds: number): QuranProgress => {
  if (!isDate(date) || !Number.isFinite(seconds) || seconds <= 0) return progress;
  const add = Math.min(MAX_SECONDS_PER_UPDATE, seconds);
  const existing = progress.log.find((d) => d.date === date);
  const log = existing
    ? progress.log.map((d) => (d.date === date ? { ...d, seconds: Math.min(MAX_SECONDS_PER_DAY, d.seconds + add) } : d))
    : [...progress.log, { date, seconds: add }];
  return { ...progress, log: trimLog(log) };
};

export const goalRatio = (progress: QuranProgress, date: string): number => {
  if (!progress.goalMinutes) return 0;
  return Math.min(1, secondsOn(progress, date) / (progress.goalMinutes * 60));
};

export const goalReached = (progress: QuranProgress, date: string): boolean => goalRatio(progress, date) >= 1;

export interface WeekDay {
  date: string;
  label: string;
  ratio: number;
  reached: boolean;
  isToday: boolean;
}

/** The last seven days, oldest first, each with how much of the goal was read. */
export const weekStrip = (progress: QuranProgress, today: string): WeekDay[] =>
  Array.from({ length: WEEK_LENGTH }, (_, i) => {
    const date = addDays(today, i - (WEEK_LENGTH - 1));
    const ratio = goalRatio(progress, date);
    return {
      date,
      label: WEEKDAY_INITIALS[new Date(`${date}T00:00:00Z`).getUTCDay()],
      ratio,
      reached: ratio >= 1,
      isToday: date === today,
    };
  });

// ── position and khatam ───────────────────────────────────────────────────────

/** Adds an inclusive range of ayat to a set of read ranges, merging any that overlap or touch. */
export const addReadRange = (ranges: readonly ReadRange[], from: number, to: number): ReadRange[] => {
  const lo = Math.max(1, Math.min(from, to));
  const hi = Math.min(AYAT_IN_QURAN, Math.max(from, to));
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo > hi) return [...ranges];
  const merged: ReadRange[] = [];
  let [start, end] = [lo, hi];
  for (const [rs, re] of [...ranges].sort((x, y) => x[0] - y[0])) {
    if (re + 1 < start) merged.push([rs, re]);
    else if (rs - 1 > end) { merged.push([start, end]); [start, end] = [rs, re]; }
    else { start = Math.min(start, rs); end = Math.max(end, re); }
  }
  merged.push([start, end]);
  return merged;
};

export const readCount = (progress: QuranProgress): number =>
  progress.read.reduce((sum, [from, to]) => sum + (to - from + 1), 0);

/**
 * Saves where the reader is and marks what they have read. `seen` is the span of ayat that were on
 * screen. If this save follows the previous one closely, everything between them counts as read too.
 * Opening a surah far away only moves the bookmark and counts what is on screen.
 */
export const recordPosition = (progress: QuranProgress, position: ReadingPosition, seen?: { from: number; to: number }): QuranProgress => {
  let read = addReadRange(progress.read, seen?.from ?? position.global, seen?.to ?? position.global);
  const previous = progress.position;
  if (previous) {
    const step = position.global - previous.global;
    if (step > 0 && step <= MAX_STEP_AYAT) read = addReadRange(read, previous.global, position.global);
  }
  const samePlace = previous && previous.surah === position.surah && previous.ayah === position.ayah;
  const sameRead = read.length === progress.read.length && read.every((r, i) => r[0] === progress.read[i][0] && r[1] === progress.read[i][1]);
  if (samePlace && sameRead) return progress;
  return { ...progress, position, read };
};

export const startKhatam = (progress: QuranProgress, startDate: string, days: number): QuranProgress => {
  const length = Number.isFinite(days) ? Math.min(MAX_PLAN_DAYS, Math.max(MIN_PLAN_DAYS, Math.round(days))) : DEFAULT_PLAN_DAYS;
  return isDate(startDate) ? { ...progress, khatam: { startDate, days: length } } : progress;
};

export const endKhatam = (progress: QuranProgress): QuranProgress => ({ ...progress, khatam: null });

export interface KhatamStatus {
  dayNumber: number;
  days: number;
  perDay: number;
  /** The ayah, counted from the start, that today's portion ends at. */
  targetToday: number;
  /** Ayat read so far, anywhere in the Quran. */
  read: number;
  remainingToday: number;
  /** Positive when ahead of today's portion, negative when behind. */
  aheadBy: number;
  percent: number;
  finished: boolean;
}

export const khatamStatus = (progress: QuranProgress, today: string): KhatamStatus | null => {
  const plan = progress.khatam;
  if (!plan) return null;
  const elapsed = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${plan.startDate}T00:00:00Z`)) / DAY_MS);
  const dayNumber = Math.min(plan.days, Math.max(1, elapsed + 1));
  const perDay = Math.ceil(AYAT_IN_QURAN / plan.days);
  const targetToday = Math.min(AYAT_IN_QURAN, dayNumber * perDay);
  const read = readCount(progress);
  const finished = read >= AYAT_IN_QURAN;
  return {
    dayNumber,
    days: plan.days,
    perDay,
    targetToday,
    read,
    remainingToday: Math.max(0, targetToday - read),
    aheadBy: read - targetToday,
    percent: finished ? 100 : Math.floor((read / AYAT_IN_QURAN) * 100),
    finished,
  };
};

// ── stored data ───────────────────────────────────────────────────────────────

/** Validates stored progress field by field, so one bad value never discards the rest. */
export const sanitizeProgress = (value: unknown): QuranProgress => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return EMPTY_PROGRESS;
  const v = value as Record<string, unknown>;

  const merged = new Map<string, number>();
  if (Array.isArray(v.log)) {
    for (const row of v.log) {
      if (typeof row !== 'object' || row === null) continue;
      const { date, seconds } = row as Record<string, unknown>;
      if (!isDate(date) || typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) continue;
      merged.set(date, Math.min(MAX_SECONDS_PER_DAY, (merged.get(date) ?? 0) + seconds));
    }
  }

  const pos = v.position as Record<string, unknown> | null | undefined;
  const expected = pos && isInt(pos.surah, 1, SURAHS) && isInt(pos.ayah, 1, 286) ? globalAyah(pos.surah, pos.ayah) : null;
  const position: ReadingPosition | null = pos && expected !== null && pos.global === expected
    ? { surah: pos.surah as number, ayah: pos.ayah as number, global: expected }
    : null;

  let read: ReadRange[] = [];
  if (Array.isArray(v.read)) {
    for (const range of v.read) {
      if (Array.isArray(range) && isInt(range[0], 1, AYAT_IN_QURAN) && isInt(range[1], 1, AYAT_IN_QURAN) && range[0] <= range[1]) {
        read = addReadRange(read, range[0], range[1]);
      }
    }
  }

  const plan = v.khatam as Record<string, unknown> | null | undefined;
  const khatam: KhatamPlan | null = plan && isDate(plan.startDate) && isInt(plan.days, MIN_PLAN_DAYS, MAX_PLAN_DAYS)
    ? { startDate: plan.startDate, days: plan.days }
    : null;

  return {
    goalMinutes: (GOAL_CHOICES as readonly unknown[]).includes(v.goalMinutes) ? (v.goalMinutes as number) : null,
    log: trimLog([...merged].map(([date, seconds]) => ({ date, seconds }))),
    position,
    read,
    khatam,
  };
};
