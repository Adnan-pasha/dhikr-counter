import type { SalahLog, SalahName } from './types';

/** The five daily prayers. Sunrise is not one of them and is no longer tracked. */
export const FARD_PRAYERS: readonly SalahName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const INSTALL_KEY = 'tasbih_installed_on';

export const toDateString = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseDate = (value: string): Date => {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (value: string, days: number): string => {
  const date = parseDate(value);
  date.setDate(date.getDate() + days);
  return toDateString(date);
};

/** How many of the five prayers a day has marked done. */
export const prayerCount = (log: SalahLog | undefined): number =>
  log ? FARD_PRAYERS.filter((p) => log.prayers?.[p] === true).length : 0;

/** Stored logs with the old Sunrise ticks removed, and days with nothing left on them dropped. */
export const cleanSalahLogs = (raw: readonly unknown[]): SalahLog[] => {
  const cleaned: SalahLog[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const { date, prayers } = item as { date?: unknown; prayers?: unknown };
    if (typeof date !== 'string' || !DATE_PATTERN.test(date)) continue;
    if (typeof prayers !== 'object' || prayers === null) continue;
    const kept: Partial<Record<SalahName, boolean>> = {};
    for (const p of FARD_PRAYERS) if ((prayers as Record<string, unknown>)[p] === true) kept[p] = true;
    if (Object.keys(kept).length > 0) cleaned.push({ date, prayers: kept });
  }
  return cleaned;
};

/** Marks all five prayers done for a day, or clears the day. Returns a new array. */
export const setDay = (logs: readonly SalahLog[], date: string, done: boolean): SalahLog[] => {
  const others = logs.filter((l) => l.date !== date);
  if (!done) return others;
  return [...others, { date, prayers: Object.fromEntries(FARD_PRAYERS.map((p) => [p, true])) }];
};

/** Days in a row with all five prayers, counting back from today. A day still in progress does not break it. */
export const salahStreak = (logs: readonly SalahLog[], today: string): number => {
  const complete = new Set(logs.filter((l) => prayerCount(l) === FARD_PRAYERS.length).map((l) => l.date));
  let streak = 0;
  for (let day = today, first = true; ; day = addDays(day, -1), first = false) {
    if (complete.has(day)) streak += 1;
    else if (!first) break;
    if (streak > complete.size) break;
  }
  return streak;
};

export interface MonthDay { date: string; day: number; count: number; future: boolean }

/** A month as a calendar grid: blank cells before the 1st, then each day with its count. */
export const monthCells = (
  year: number,
  month: number,
  today: string,
  logs: readonly SalahLog[],
): { blanks: number; days: MonthDay[] } => {
  const byDate = new Map(logs.map((l) => [l.date, l]));
  const total = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: total }, (_, i) => {
    const date = toDateString(new Date(year, month, i + 1));
    return { date, day: i + 1, count: prayerCount(byDate.get(date)), future: date > today };
  });
  return { blanks: new Date(year, month, 1).getDay(), days };
};

export interface YearMonth { year: number; month: number }

export const shiftMonth = ({ year, month }: YearMonth, delta: number): YearMonth => {
  const date = new Date(year, month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
};

const monthKey = ({ year, month }: YearMonth): string => `${year}-${String(month + 1).padStart(2, '0')}`;

/** A month can be shown if it holds any day between the earliest date and today. */
export const canShowMonth = (ym: YearMonth, earliest: string, today: string): boolean =>
  monthKey(ym) >= earliest.slice(0, 7) && monthKey(ym) <= today.slice(0, 7);

/** How many days before the install date can still be filled in: people start using the app having already prayed. */
export const BACKFILL_DAYS = 60;

/**
 * The oldest day the calendar goes back to: BACKFILL_DAYS before the install date or the oldest saved day,
 * whichever is older, counted from today at the latest.
 */
export const earliestDate = (logs: readonly SalahLog[], installed: string | null, today: string): string => {
  const dates = logs.map((l) => l.date);
  if (installed && DATE_PATTERN.test(installed)) dates.push(installed);
  const oldest = dates.sort()[0];
  return addDays(oldest && oldest < today ? oldest : today, -BACKFILL_DAYS);
};

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The browser's storage, or null where it is missing or blocked. */
export const browserStorage = (): StorageLike | null => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
};

/** The day the app was first opened, as saved by seedInstallDate. Today when nothing valid is saved. */
export const readInstallDate = (storage: StorageLike | null, today: string): string => {
  try {
    const saved = storage?.getItem(INSTALL_KEY);
    if (saved && DATE_PATTERN.test(saved)) return saved;
  } catch {
    // Storage can be blocked; the calendar then starts today and older saved days still show.
  }
  return today;
};

/**
 * Writes down the install date the first time, at app start. People who were already using the app have
 * no record of it, so the oldest day anything was saved on stands in for it. Never moves once written.
 */
export const seedInstallDate = (storage: StorageLike | null, today: string, knownDays: readonly string[]): string => {
  const saved = readInstallDate(storage, '');
  if (saved) return saved;
  const oldest = knownDays.filter((d) => DATE_PATTERN.test(d) && d < today).sort()[0] ?? today;
  try {
    storage?.setItem(INSTALL_KEY, oldest);
  } catch {
    // Blocked storage: nothing to remember it in.
  }
  return oldest;
};

const SPOKEN = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

/** What a screen reader says for a calendar day. */
export const dayLabel = (date: string, count: number): string => {
  const spoken = SPOKEN.format(parseDate(date)).replace(/^(\w+),? /, '$1 ');
  if (count === 0) return `${spoken}, no prayers`;
  if (count === FARD_PRAYERS.length) return `${spoken}, all 5 prayers`;
  return `${spoken}, ${count} of 5 prayers`;
};
