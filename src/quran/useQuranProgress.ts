import React from 'react';
import {
  EMPTY_PROGRESS, addReadingSeconds, endKhatam, recordPosition, sanitizeProgress, setGoal, startKhatam,
  type QuranProgress, type ReadingPosition,
} from './progress';

export const PROGRESS_KEY = 'tasbih_quran_progress';

const load = (): QuranProgress => {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? sanitizeProgress(JSON.parse(raw)) : EMPTY_PROGRESS;
  } catch {
    return EMPTY_PROGRESS;
  }
};

/** Quran reading progress, kept on this device. Read at start, so there is no moment of showing it empty. */
export const useQuranProgress = () => {
  const [progress, setProgress] = React.useState<QuranProgress>(load);

  React.useEffect(() => {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    } catch {
      // Storage unavailable: progress still works for this visit.
    }
  }, [progress]);

  const actions = React.useMemo(() => ({
    addSeconds: (date: string, seconds: number) => setProgress((p) => addReadingSeconds(p, date, seconds)),
    setGoal: (minutes: number | null) => setProgress((p) => setGoal(p, minutes)),
    recordPosition: (position: ReadingPosition, seen?: { from: number; to: number }) => setProgress((p) => recordPosition(p, position, seen)),
    startKhatam: (startDate: string, days: number) => setProgress((p) => startKhatam(p, startDate, days)),
    endKhatam: () => setProgress((p) => endKhatam(p)),
    reset: () => setProgress(EMPTY_PROGRESS),
  }), []);

  return { progress, actions } as const;
};
