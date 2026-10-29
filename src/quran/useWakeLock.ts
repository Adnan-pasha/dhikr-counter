import React from 'react';

interface WakeLockSentinelLike {
  release: () => Promise<void>;
  addEventListener?: (type: 'release', listener: () => void) => void;
}

/** Keeps the screen on while `active`. Silently does nothing where the browser has no wake lock. */
export const useWakeLock = (active: boolean) => {
  React.useEffect(() => {
    const api = (navigator as unknown as { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } }).wakeLock;
    if (!active || !api) return;

    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const acquire = async () => {
      // Never hold two: give back the earlier lock before taking a new one.
      const previous = sentinel;
      sentinel = null;
      try { await previous?.release(); } catch { /* already released */ }
      try {
        const lock = await api.request('screen');
        if (cancelled) {
          await lock.release();
          return;
        }
        sentinel = lock;
        // The system can drop the lock while the page is still showing (battery saver). Take it again.
        lock.addEventListener?.('release', () => {
          if (sentinel === lock) sentinel = null;
          if (!cancelled && document.visibilityState === 'visible') void acquire();
        });
      } catch {
        // Refused (low battery, hidden page): reading still works, the screen just may dim.
      }
    };

    // The lock is dropped when the page is hidden, so take it again on return.
    const onVisible = () => { if (document.visibilityState === 'visible') void acquire(); };
    void acquire();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release().catch(() => {});
    };
  }, [active]);
};
