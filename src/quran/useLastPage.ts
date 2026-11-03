import React from 'react';
import { clampPage } from './pages';

export const LAST_PAGE_KEY = 'tasbih_quran_last_page';

const load = (): number => {
  try {
    const raw = localStorage.getItem(LAST_PAGE_KEY);
    return raw ? clampPage(Number(raw)) : 1;
  } catch {
    return 1;
  }
};

/** The mushaf page the reader was last on, kept on this device, so Pages opens where they left off. */
export const useLastPage = (): readonly [number, (page: number) => void] => {
  const [page, setPage] = React.useState<number>(load);
  const save = React.useCallback((next: number) => {
    const clamped = clampPage(next);
    setPage(clamped);
    try {
      localStorage.setItem(LAST_PAGE_KEY, String(clamped));
    } catch {
      // Storage unavailable: the page still works for this visit.
    }
  }, []);
  return [page, save] as const;
};
