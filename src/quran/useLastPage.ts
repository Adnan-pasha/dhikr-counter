import React from 'react';
import { clampPage } from './pages';

export const LAST_PAGE_KEY = 'tasbih_quran_last_page';
/** The 15-line IndoPak mushaf has its own page numbers, so it remembers its own place. */
export const LAST_LAYOUT_PAGE_KEY = 'tasbih_quran_last_page_indopak15';

const load = (key: string, clamp: (n: number) => number): number => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? clamp(Number(raw)) : 1;
  } catch {
    return 1;
  }
};

/** The mushaf page the reader was last on, kept on this device, so Pages opens where they left off. */
export const useLastPage = (key: string = LAST_PAGE_KEY, clamp: (n: number) => number = clampPage): readonly [number, (page: number) => void] => {
  const [page, setPage] = React.useState<number>(() => load(key, clamp));
  const save = React.useCallback((next: number) => {
    const clamped = clamp(next);
    setPage(clamped);
    try {
      localStorage.setItem(key, String(clamped));
    } catch {
      // Storage unavailable: the page still works for this visit.
    }
  }, [key, clamp]);
  return [page, save] as const;
};
