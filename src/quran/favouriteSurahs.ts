import React from 'react';
import { safeSetItem } from '../domain';
import { SURAHS } from './surahs';

export const FAVOURITE_SURAHS_KEY = 'tasbih_quran_favourite_surahs';

/** The surahs many people read every day: Yaseen, Al-Mulk, Al-Kahf, Ar-Rahmaan, Al-Waaqia. Offered when nothing is saved yet. */
export const SUGGESTED_SURAHS: readonly number[] = [36, 67, 18, 55, 56];

const isSurahNumber = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= SURAHS.length;

/** Real surah numbers only, each once, in the order they were saved. */
export const sanitizeFavouriteSurahs = (value: unknown): number[] =>
  Array.isArray(value) ? [...new Set(value.filter(isSurahNumber))] : [];

const parse = (raw: string | null): number[] => {
  if (!raw) return [];
  try {
    return sanitizeFavouriteSurahs(JSON.parse(raw));
  } catch {
    return [];
  }
};

const rawFromStorage = (): string | null => {
  try {
    return localStorage.getItem(FAVOURITE_SURAHS_KEY);
  } catch {
    return null;
  }
};

// The list is shared by every screen that shows it. `cached` is what storage held (as `cachedRaw`) when it was
// last read; the same array is handed back until storage changes, which is what keeps screens from redrawing for nothing.
let cachedRaw: string | null | undefined;
let cached: number[] = [];
const listeners = new Set<() => void>();

const snapshot = (): number[] => {
  const raw = rawFromStorage();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parse(raw);
  }
  return cached;
};

export const readFavouriteSurahs = (): number[] => snapshot();

/** Adds the surah to the end of the list, or takes it off if it is there. Returns the new list. */
export const toggleFavouriteSurah = (surah: number): number[] => {
  const current = snapshot();
  if (!isSurahNumber(surah)) return current;
  const next = current.includes(surah) ? current.filter((n) => n !== surah) : [...current, surah];
  const raw = JSON.stringify(next);
  // If the phone cannot save it, the choice still shows for this visit.
  if (safeSetItem(FAVOURITE_SURAHS_KEY, raw)) cachedRaw = raw;
  cached = next;
  listeners.forEach((listener) => listener());
  return next;
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

const NONE: number[] = [];

/** The favourite surahs, kept in step across the Read tab and the Pages sheet. */
export const useFavouriteSurahs = () => {
  const favourites = React.useSyncExternalStore(subscribe, snapshot, () => NONE);
  const isFavourite = React.useCallback((surah: number) => favourites.includes(surah), [favourites]);
  return { favourites, isFavourite, toggle: toggleFavouriteSurah };
};
