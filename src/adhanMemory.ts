const KEY = 'tasbih_adhan_played';
const KEEP = 20;

/** Used where session storage is blocked, so a prayer still sounds once within one run of the app. */
const inMemory = new Set<string>();

const readKeys = (): string[] => {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : [];
  } catch {
    return [];
  }
};

/** Whether this prayer's adhan has already sounded ("2026-03-10-fajr"). Remembered across leaving and re-entering the screen. */
export const hasAdhanPlayed = (key: string): boolean => inMemory.has(key) || readKeys().includes(key);

export const markAdhanPlayed = (key: string): void => {
  inMemory.add(key);
  try {
    sessionStorage.setItem(KEY, JSON.stringify([...readKeys().filter((k) => k !== key), key].slice(-KEEP)));
  } catch {
    // Session storage blocked: the in-memory copy still stops a repeat while the app stays open.
  }
};

/** Forget everything. For tests. */
export const forgetPlayedAdhans = (): void => {
  inMemory.clear();
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // nothing to forget
  }
};
