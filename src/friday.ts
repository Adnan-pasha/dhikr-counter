import type { DhikrHistory } from './types';
import { toLocalDate } from './habits';

export const FRIDAY_KAHF_SURAH = 18;
export const FRIDAY_SALAWAT_ID = 'salawat-friday';

/** Salawat counted for Friday: the Friday-specific dhikr or the standard Salawat Ibrahimiyya. */
const SALAWAT_IDS: readonly string[] = [FRIDAY_SALAWAT_ID, 'darood-ibrahim'];

/** Most Fridays kept for the Al-Kahf marks; older ones are irrelevant to "this Friday". */
const MAX_KAHF_DATES = 60;

export interface FridayItem {
  id: 'kahf' | 'salawat';
  label: string;
  done: boolean;
}

export interface FridayChecklist {
  isFriday: boolean;
  items: FridayItem[];
  doneCount: number;
}

/** Whether a local calendar date (YYYY-MM-DD) falls on a Friday. */
export const isFriday = (date: string): boolean => new Date(`${date}T00:00:00Z`).getUTCDay() === 5;

/** The Jumu'ah sunnah checklist for a day; empty on any other day. */
export const fridayChecklist = (
  history: readonly DhikrHistory[],
  kahfDates: readonly string[],
  today: string,
): FridayChecklist => {
  if (!isFriday(today)) return { isFriday: false, items: [], doneCount: 0 };
  const salawatDone = history.some(
    (h) => h.count > 0 && SALAWAT_IDS.includes(h.dhikrId) && toLocalDate(new Date(h.timestamp)) === today,
  );
  const items: FridayItem[] = [
    { id: 'kahf', label: 'Read Surah Al-Kahf', done: kahfDates.includes(today) },
    { id: 'salawat', label: 'Send abundant salawat', done: salawatDone },
  ];
  return { isFriday: true, items, doneCount: items.filter((i) => i.done).length };
};

/** Adds the date if absent, removes it if present. Returns a new sorted list. */
export const toggleDate = (dates: readonly string[], date: string): string[] => {
  const next = dates.includes(date) ? dates.filter((d) => d !== date) : [...dates, date];
  return [...new Set(next)].sort().slice(-MAX_KAHF_DATES);
};
