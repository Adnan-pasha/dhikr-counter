import type { DhikrHistory } from './types';
import { addDays, toLocalDate } from './habits';

export type StatsRange = 'day' | 'week' | 'month' | 'year';

export const STATS_RANGES: ReadonlyArray<{ id: StatsRange; label: string; compareLabel: string }> = [
  { id: 'day', label: 'Day', compareLabel: 'yesterday at this time' },
  { id: 'week', label: 'Week', compareLabel: 'the week before' },
  { id: 'month', label: 'Month', compareLabel: 'the 30 days before' },
  { id: 'year', label: 'Year', compareLabel: 'the year before' },
];

export interface StatsBucket {
  key: string;
  label: string;
  beads: number;
}

export interface RangeStats {
  buckets: StatsBucket[];
  total: number;
  /** Buckets with any practice (days, or months for the year view, or hours for the day view). */
  activeBuckets: number;
  best: StatsBucket | null;
  previousTotal: number;
  /** Whole-number percent change against the previous period, or null when there is nothing to compare. */
  changePct: number | null;
}

const WEEK_DAYS = 7;
const MONTH_DAYS = 30;
const YEAR_MONTHS = 12;
const HOURS = 24;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const weekdayOf = (date: string) => WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];

/** Shifts a YYYY-MM key by a number of months. */
const addMonths = (ym: string, delta: number): string => {
  const [y, m] = ym.split('-').map(Number);
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
};

const sum = (values: Iterable<number>): number => {
  let total = 0;
  for (const v of values) total += v;
  return total;
};

const sumDays = (byDay: ReadonlyMap<string, number>, from: string, days: number): number =>
  sum(Array.from({ length: days }, (_, i) => byDay.get(addDays(from, i)) ?? 0));

const sumMonths = (byMonth: ReadonlyMap<string, number>, from: string, months: number): number =>
  sum(Array.from({ length: months }, (_, i) => byMonth.get(addMonths(from, i)) ?? 0));

const finish = (buckets: StatsBucket[], previousTotal: number): RangeStats => {
  const total = sum(buckets.map((b) => b.beads));
  const best = buckets.reduce<StatsBucket | null>((top, b) => (b.beads > (top?.beads ?? 0) ? b : top), null);
  return {
    buckets,
    total,
    activeBuckets: buckets.filter((b) => b.beads > 0).length,
    best,
    previousTotal,
    changePct: previousTotal > 0 ? Math.round(((total - previousTotal) / previousTotal) * 100) : null,
  };
};

/**
 * Beads from finished rounds, grouped for the chosen range and compared with the period before it.
 * Windows end today: 24 hours of today, the last 7 or 30 days, or the last 12 calendar months.
 */
export const bucketStats = (
  history: readonly DhikrHistory[],
  range: StatsRange,
  today: string,
  /** Hour of day now (0..23). The day view compares with yesterday only up to this hour. */
  nowHour = HOURS - 1,
): RangeStats => {
  const byDay = new Map<string, number>();
  const byMonth = new Map<string, number>();
  const byHourToday = new Array<number>(HOURS).fill(0);
  const byHourYesterday = new Array<number>(HOURS).fill(0);
  const yesterday = addDays(today, -1);

  for (const entry of history) {
    if (!(entry.count > 0)) continue;
    const at = new Date(entry.timestamp);
    const day = toLocalDate(at);
    if (day > today) continue;
    byDay.set(day, (byDay.get(day) ?? 0) + entry.count);
    const month = day.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + entry.count);
    if (day === today) byHourToday[at.getHours()] += entry.count;
    else if (day === yesterday) byHourYesterday[at.getHours()] += entry.count;
  }

  if (range === 'day') {
    const buckets = byHourToday.map((beads, hour) => ({ key: String(hour), label: String(hour), beads }));
    return finish(buckets, sum(byHourYesterday.slice(0, Math.min(HOURS, Math.max(0, nowHour) + 1))));
  }

  if (range === 'week' || range === 'month') {
    const length = range === 'week' ? WEEK_DAYS : MONTH_DAYS;
    const first = addDays(today, -(length - 1));
    const buckets = Array.from({ length }, (_, i) => {
      const key = addDays(first, i);
      return { key, label: range === 'week' ? weekdayOf(key) : String(Number(key.slice(8))), beads: byDay.get(key) ?? 0 };
    });
    return finish(buckets, sumDays(byDay, addDays(first, -length), length));
  }

  const firstMonth = addMonths(today.slice(0, 7), -(YEAR_MONTHS - 1));
  const buckets = Array.from({ length: YEAR_MONTHS }, (_, i) => {
    const key = addMonths(firstMonth, i);
    return { key, label: MONTHS[Number(key.slice(5)) - 1], beads: byMonth.get(key) ?? 0 };
  });
  return finish(buckets, sumMonths(byMonth, addMonths(firstMonth, -YEAR_MONTHS), YEAR_MONTHS));
};

/** Axis labels worth printing so a 24 or 30 bar chart stays readable. */
export const shouldLabelBucket = (range: StatsRange, index: number, length: number): boolean => {
  if (range === 'week' || range === 'year') return true;
  if (range === 'day') return index % 6 === 0;
  return index % 5 === 0 || index === length - 1;
};

/** Hour 0..23 as a short clock label for the day view. */
export const hourLabel = (hour: number): string => {
  const suffix = hour < 12 ? 'a' : 'p';
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}${suffix}`;
};
