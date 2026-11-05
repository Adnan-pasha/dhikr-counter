const EVENT = 'tasbih:prayer-config';

/** Says the place or a prayer setting was changed, so whatever depends on it (the phone's alarms) can catch up. */
export const announcePrayerConfigChange = (): void => {
  try {
    window.dispatchEvent(new window.Event(EVENT));
  } catch {
    // No window (a test without a page): nothing is listening anyway.
  }
};

/** Calls `handler` after each announced change. Returns a function that stops listening. */
export const onPrayerConfigChange = (handler: () => void): (() => void) => {
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
};
