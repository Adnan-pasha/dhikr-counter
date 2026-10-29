import React from 'react';
import { toLocalDate } from '../habits';
import { isReading } from './progress';

/** Seconds counted before they are reported, so storage is written every few seconds, not every second. */
export const FLUSH_SECONDS = 15;

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'touchstart', 'keydown', 'wheel', 'scroll'] as const;

interface ReadingClockOptions {
  /** True while the reader is open. */
  active: boolean;
  /** Receives whole seconds read and the local date they belong to. */
  onCredit: (seconds: number, date: string) => void;
}

/**
 * Counts time spent actually reading: the reader is open, the page is visible, and there was a touch,
 * scroll or key press in the last half minute. Reports in small batches and again when the reader
 * closes or the page is hidden, so no seconds are lost.
 */
export const useReadingClock = ({ active, onCredit }: ReadingClockOptions) => {
  const creditRef = React.useRef(onCredit);
  creditRef.current = onCredit;

  React.useEffect(() => {
    if (!active) return;

    let lastActivity = Date.now();
    let pending = 0;

    const flush = () => {
      if (pending <= 0) return;
      const seconds = pending;
      pending = 0;
      creditRef.current(seconds, toLocalDate(new Date()));
    };

    const touch = () => { lastActivity = Date.now(); };
    const visible = () => document.visibilityState === 'visible';

    const tick = () => {
      if (isReading({ active: true, visible: visible(), msSinceActivity: Date.now() - lastActivity })) {
        pending += 1;
        if (pending >= FLUSH_SECONDS) flush();
      }
    };

    // Hiding the page reports what is pending. Coming back is not reading: the clock waits for a real touch.
    const onVisibility = () => { if (!visible()) flush(); };

    for (const type of ACTIVITY_EVENTS) document.addEventListener(type, touch, { capture: true, passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    const timer = setInterval(tick, 1000);

    return () => {
      clearInterval(timer);
      for (const type of ACTIVITY_EVENTS) document.removeEventListener(type, touch, { capture: true });
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [active]);
};
