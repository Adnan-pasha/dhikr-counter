import React from 'react';
import { useEffect } from 'react';
import { DhikrReminder, UserPreferences, Routine, SalahLog, ConfirmModalState } from './types';
import { DEFAULT_ROUTINES } from './adhkaar-data';
import { normalizeRoutine } from './icons';
import { findDueReminders, shouldTriggerReminderOccurrence, findCatchUpReminderCandidates, findMissedReminderCandidates, parseStoredArray } from './domain';
import { playBeadSound, playCompletionSound } from './audio';
import { tapCount, undoCount, findNextDhikrId, getUpcoming, getHapticPattern } from './counter';
import { trackEvent } from './telemetry';

export const useConnectivityStatus = (setIsOnline: (value: boolean) => void) => {
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [setIsOnline]);
};

export const useReminderScheduler = (
  reminders: DhikrReminder[],
  preferences: UserPreferences,
  setActiveReminderTriggered: React.Dispatch<React.SetStateAction<DhikrReminder | null>>,
) => {
  const reminderQueueRef = React.useRef<DhikrReminder[]>([]);

  useEffect(() => {
    let lastActiveAt: Date | null = null;

    const processReminderTick = (reason: 'interval' | 'visible' = 'interval') => {
      const now = new Date();
      const dueReminders = findDueReminders(reminders, now);
      const catchUpReminders = findCatchUpReminderCandidates(reminders, now);
      const missedReminders = findMissedReminderCandidates(reminders, now, lastActiveAt);
      const candidates = [...dueReminders, ...catchUpReminders, ...missedReminders];
      if (candidates.length === 0) return;

      const uniqueCandidates = candidates.filter((rem, idx, arr) => arr.findIndex((x) => x.id === rem.id) === idx);
      const newlyTriggered = uniqueCandidates.filter((rem) => shouldTriggerReminderOccurrence(rem.id, rem.timeString, now));
      if (newlyTriggered.length === 0) return;

      reminderQueueRef.current = [...reminderQueueRef.current, ...newlyTriggered];
      setActiveReminderTriggered((current) => current ?? reminderQueueRef.current.shift() ?? null);

      trackEvent('reminder_triggered', { count: newlyTriggered.length, reason, reminderId: newlyTriggered[0].id });
      if (preferences.soundOn) {
        playCompletionSound(preferences.volume);
      }
    };

    processReminderTick();
    const timer = setInterval(processReminderTick, 5000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        processReminderTick('visible');
      } else {
        lastActiveAt = new Date();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [reminders, preferences, setActiveReminderTriggered]);

  const dismissReminder = React.useCallback(() => {
    const next = reminderQueueRef.current.shift() ?? null;
    setActiveReminderTriggered(next);
  }, [setActiveReminderTriggered]);

  return { dismissReminder };
};


import { Dhikr, DhikrHistory } from './types';
import { migrateAndHydrateStorage, isTimestampOnLocalDay } from './domain';
import { sanitizePauses, sanitizeActiveDays, type StreakPause } from './habits';

interface PersistenceDefaults {
  defaultDhikrs: Dhikr[];
  defaultPreferences: UserPreferences;
  defaultReminders: DhikrReminder[];
}

interface PersistenceSetters {
  setDhikrs: (value: Dhikr[]) => void;
  setCurrentDhikrId: (value: string) => void;
  setCurrentCount: (value: number) => void;
  setHistory: (value: DhikrHistory[]) => void;
  setPreferences: (value: UserPreferences) => void;
  setReminders: (value: DhikrReminder[]) => void;
  setStreakPauses: (value: StreakPause[]) => void;
  setActiveDays: (value: string[]) => void;
  setFavouriteIds: (value: string[]) => void;
  setRoutines: (value: Routine[]) => void;
  setSalahLogs: (value: SalahLog[]) => void;
}

/** How long after the last tap the running count is written to storage. */
const COUNT_PERSIST_DELAY_MS = 300;

export const usePersistentAppState = (
  defaults: PersistenceDefaults,
  setters: PersistenceSetters,
  state: {
    dhikrs: Dhikr[];
    currentDhikrId: string;
    currentCount: number;
    history: DhikrHistory[];
    preferences: UserPreferences;
    reminders: DhikrReminder[];
    favouriteIds: string[];
    routines: Routine[];
    salahLogs: SalahLog[];
    streakPauses: StreakPause[];
    activeDays: string[];
  },
) => {
  const [hydrated, setHydrated] = React.useState(false);

  useEffect(() => {
    const stored = migrateAndHydrateStorage({
      defaultDhikrs: defaults.defaultDhikrs,
      defaultPreferences: defaults.defaultPreferences,
      defaultReminders: defaults.defaultReminders,
    });

    setters.setDhikrs(stored.dhikrs);
    setters.setCurrentDhikrId(stored.currentDhikrId);
    setters.setCurrentCount(stored.currentCount);
    setters.setHistory(stored.history);
    setters.setPreferences(stored.preferences);
    setters.setReminders(stored.reminders);
    const isId = (v: unknown): v is string => typeof v === 'string';
    const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
    setters.setFavouriteIds(parseStoredArray(localStorage.getItem('tasbih_favourites'), [], isId));
    const rawRoutines = localStorage.getItem('tasbih_routines');
    const savedRoutines = parseStoredArray<Routine>(
      rawRoutines,
      DEFAULT_ROUTINES,
      (v): v is Routine => isRecord(v) && typeof v.id === 'string' && typeof v.name === 'string' && Array.isArray(v.dhikrIds),
    );
    setters.setRoutines(savedRoutines.map(normalizeRoutine));
    setters.setSalahLogs(
      parseStoredArray<SalahLog>(localStorage.getItem('tasbih_salah_logs'), [], (v): v is SalahLog => isRecord(v)),
    );
    setters.setStreakPauses(sanitizePauses(parseStoredArray(localStorage.getItem('tasbih_streak_pauses'), [], isRecord)));
    setters.setActiveDays(sanitizeActiveDays(parseStoredArray(localStorage.getItem('tasbih_active_days'), [], (v): v is string => typeof v === 'string')));
    setHydrated(true);
  }, []);

  // Persist only after hydration. Before it, `state` holds the empty initial values; writing
  // them would overwrite saved data (React StrictMode re-runs the load effect in development
  // and would then read back the overwritten values).
  useEffect(() => {
    if (hydrated && state.dhikrs.length > 0) localStorage.setItem('tasbih_dhikrs', JSON.stringify(state.dhikrs));
  }, [hydrated, state.dhikrs]);
  useEffect(() => { if (hydrated) localStorage.setItem('tasbih_current_id', state.currentDhikrId); }, [hydrated, state.currentDhikrId]);
  // The count changes on every tap, so it is written once shortly after the last tap rather than
  // on each one, and flushed straight away when the page is hidden or closed.
  const latestCountRef = React.useRef(state.currentCount);
  latestCountRef.current = state.currentCount;
  useEffect(() => {
    if (!hydrated) return undefined;
    const timer = setTimeout(() => localStorage.setItem('tasbih_current_count', String(state.currentCount)), COUNT_PERSIST_DELAY_MS);
    return () => clearTimeout(timer);
  }, [hydrated, state.currentCount]);
  useEffect(() => {
    if (!hydrated) return undefined;
    const flush = () => localStorage.setItem('tasbih_current_count', String(latestCountRef.current));
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem('tasbih_history', JSON.stringify(state.history));
  }, [hydrated, state.history]);
  useEffect(() => { if (hydrated) localStorage.setItem('tasbih_preferences', JSON.stringify(state.preferences)); }, [hydrated, state.preferences]);
  useEffect(() => { if (hydrated) localStorage.setItem('tasbih_reminders', JSON.stringify(state.reminders)); }, [hydrated, state.reminders]);
  useEffect(() => { if (hydrated) localStorage.setItem('tasbih_favourites', JSON.stringify(state.favouriteIds)); }, [hydrated, state.favouriteIds]);
  useEffect(() => { if (hydrated) localStorage.setItem('tasbih_routines', JSON.stringify(state.routines)); }, [hydrated, state.routines]);
  useEffect(() => { if (hydrated) localStorage.setItem('tasbih_salah_logs', JSON.stringify(state.salahLogs)); }, [hydrated, state.salahLogs]);
  useEffect(() => { if (hydrated) localStorage.setItem('tasbih_streak_pauses', JSON.stringify(state.streakPauses)); }, [hydrated, state.streakPauses]);
  useEffect(() => { if (hydrated) localStorage.setItem('tasbih_active_days', JSON.stringify(state.activeDays)); }, [hydrated, state.activeDays]);
};


interface DhikrActionDeps {
  dhikrs: Dhikr[];
  currentDhikrId: string;
  history: DhikrHistory[];
  preferences: UserPreferences;
  systemDhikrs: Dhikr[];
  setDhikrs: React.Dispatch<React.SetStateAction<Dhikr[]>>;
  setCurrentDhikrId: React.Dispatch<React.SetStateAction<string>>;
  setCurrentCount: React.Dispatch<React.SetStateAction<number>>;
  setActiveTab: React.Dispatch<React.SetStateAction<'home' | 'counter' | 'adhkaar' | 'routine' | 'salah' | 'quran' | 'stats' | 'settings' | 'qibla'>>;
  setHistory: React.Dispatch<React.SetStateAction<DhikrHistory[]>>;
  setConfirmModal: React.Dispatch<React.SetStateAction<ConfirmModalState | null>>;
}

export const useDhikrActions = (deps: DhikrActionDeps) => {
  const handleAddDhikr = (newDhikr: Omit<Dhikr, 'id' | 'isSystem'>) => {
    const fresh: Dhikr = {
      ...newDhikr,
      id: 'custom_' + Math.random().toString(36).substring(2, 9),
    };
    deps.setDhikrs((prev) => [...prev, fresh]);
    deps.setCurrentDhikrId(fresh.id);
    deps.setCurrentCount(0);
    deps.setActiveTab('counter');
  };

  const handleDeleteDhikr = (id: string) => {
    if (id === deps.currentDhikrId) {
      deps.setCurrentDhikrId('subhanallah');
      deps.setCurrentCount(0);
    }
    deps.setDhikrs((prev) => prev.filter((d) => d.id !== id));
  };

  const handleToggleCompleteToday = (dhikrId: string) => {
    const todayLogIndex = deps.history.findIndex((log) => {
      return log.dhikrId === dhikrId && isTimestampOnLocalDay(log.timestamp);
    });

    if (todayLogIndex !== -1) {
      deps.setConfirmModal({
        title: 'Mark as Pending?',
        message: 'This prayer was previously marked as completed today. Do you wish to change its status back to pending?',
        onConfirm: () => {
          deps.setHistory((prev) => prev.filter((_, idx) => idx !== todayLogIndex));
          deps.setConfirmModal(null);
        }
      });
      return;
    }

    const dhikrObj = deps.dhikrs.find((d) => d.id === dhikrId) || deps.systemDhikrs.find((d) => d.id === dhikrId);
    if (!dhikrObj) return;

    const targetOfDhikr = dhikrObj.targetCount > 0 ? dhikrObj.targetCount : 100;
    const newLog: DhikrHistory = {
      id: 'toggle_' + Math.random().toString(36).substring(2, 9),
      dhikrId,
      dhikrName: dhikrObj.nameEn,
      count: targetOfDhikr,
      timestamp: new Date().toISOString(),
    };

    deps.setHistory((prev) => [...prev, newLog]);
    if (deps.preferences.soundOn) {
      playCompletionSound(deps.preferences.volume);
    }
  };

  return { handleAddDhikr, handleDeleteDhikr, handleToggleCompleteToday };
};


interface CounterFlowDeps {
  activeDhikr: Dhikr;
  currentCount: number;
  preferences: UserPreferences;
  dhikrs: Dhikr[];
  currentDhikrId: string;
  activeRoutine: Dhikr[] | null;
  history: DhikrHistory[];
  setCurrentCount: React.Dispatch<React.SetStateAction<number>>;
  setCurrentDhikrId: React.Dispatch<React.SetStateAction<string>>;
  setHistory: React.Dispatch<React.SetStateAction<DhikrHistory[]>>;
  setConfirmModal: React.Dispatch<React.SetStateAction<ConfirmModalState | null>>;
  /** Called on every counted tap, so the app can log the day as practised. */
  onActivity?: () => void;
}

/** Pause after a round completes before the counter moves on; undo or a tap inside it. */
export const ADVANCE_DELAY_MS = 1100;

interface PendingAdvance {
  timer: ReturnType<typeof setTimeout>;
  from: string;
  to: Dhikr;
}

export const useCounterFlow = (deps: CounterFlowDeps) => {
  // Refs mirror the latest props and counts so rapid taps inside one render batch all count,
  // and timers read current values instead of stale closures.
  const depsRef = React.useRef(deps);
  depsRef.current = deps;
  const countRef = React.useRef(deps.currentCount);
  countRef.current = deps.currentCount;
  const dhikrRef = React.useRef(deps.activeDhikr);
  dhikrRef.current = deps.activeDhikr;
  const pendingRef = React.useRef<PendingAdvance | null>(null);
  const lastLogRef = React.useRef<{ id: string; dhikrId: string } | null>(null);
  // The dhikr the counter is about to move to, for the "next" hint during the pause.
  const [pendingNext, setPendingNext] = React.useState<Dhikr | null>(null);

  const clearPending = () => {
    if (pendingRef.current) {
      clearTimeout(pendingRef.current.timer);
      pendingRef.current = null;
    }
    setPendingNext(null);
  };

  /** Move to the pending next dhikr now. Returns it, or null if the advance no longer applies. */
  const advanceNow = (): Dhikr | null => {
    const pending = pendingRef.current;
    if (!pending) return null;
    clearTimeout(pending.timer);
    pendingRef.current = null;
    setPendingNext(null);
    if (dhikrRef.current.id !== pending.from) return null;
    depsRef.current.setCurrentDhikrId(pending.to.id);
    depsRef.current.setCurrentCount(0);
    countRef.current = 0;
    dhikrRef.current = pending.to;
    return pending.to;
  };

  // Choosing a different dhikr by hand, or leaving the screen tree, cancels a pending advance.
  React.useEffect(() => {
    const pending = pendingRef.current;
    if (pending && deps.currentDhikrId !== pending.from && deps.currentDhikrId !== pending.to.id) clearPending();
  }, [deps.currentDhikrId]);
  React.useEffect(() => clearPending, []);

  const sequence = deps.activeRoutine ?? deps.dhikrs;
  const mode = deps.activeRoutine ? 'routine' : 'free';
  const completedTodayIds = React.useMemo(
    () => new Set<string>(deps.history.filter((h) => isTimestampOnLocalDay(h.timestamp)).map((h) => h.dhikrId)),
    [deps.history],
  );
  const upcoming = React.useMemo(
    () => getUpcoming(sequence, deps.currentDhikrId, completedTodayIds, mode, 2),
    [sequence, deps.currentDhikrId, completedTodayIds, mode],
  );

  const handleIncrement = () => {
    // A tap during the pause moves on immediately and counts for the next dhikr.
    if (pendingRef.current) advanceNow();

    const d = depsRef.current;
    const dhikr = dhikrRef.current;
    const prefs = d.preferences;
    const result = tapCount(countRef.current, dhikr.targetCount);
    countRef.current = result.count;
    d.setCurrentCount(result.count);
    d.onActivity?.();

    if (prefs.soundOn) playBeadSound(prefs.soundTone, prefs.volume);
    if (result.roundCompleted && prefs.soundOn && prefs.completionSoundOn) playCompletionSound(prefs.volume);
    if (prefs.vibrateOn && typeof navigator !== 'undefined' && navigator.vibrate) {
      const kind = result.roundCompleted ? 'complete' : result.milestone ? 'milestone' : 'tap';
      navigator.vibrate(getHapticPattern(kind, prefs.hapticStrength));
    }

    if (!result.roundCompleted) return;

    const newLog: DhikrHistory = {
      id: Math.random().toString(36).substring(2, 9),
      dhikrId: dhikr.id,
      dhikrName: dhikr.nameEn,
      count: dhikr.targetCount,
      timestamp: new Date().toISOString(),
    };
    lastLogRef.current = { id: newLog.id, dhikrId: dhikr.id };
    d.setHistory((prev) => [...prev, newLog]);

    if (!prefs.autoAdvance) return;
    const completedIds = new Set<string>(completedTodayIds);
    completedIds.add(dhikr.id);
    const seq = d.activeRoutine ?? d.dhikrs;
    const nextId = findNextDhikrId(seq, dhikr.id, completedIds, d.activeRoutine ? 'routine' : 'free');
    const next = nextId ? seq.find((x) => x.id === nextId) : undefined;
    if (!next) return;

    clearPending();
    pendingRef.current = {
      from: dhikr.id,
      to: next,
      timer: setTimeout(() => { advanceNow(); }, ADVANCE_DELAY_MS),
    };
    setPendingNext(next);
  };

  const handleUndo = () => {
    const d = depsRef.current;
    const dhikr = dhikrRef.current;
    clearPending();
    const result = undoCount(countRef.current, dhikr.targetCount);
    if (result.count === countRef.current) return;
    countRef.current = result.count;
    d.setCurrentCount(result.count);
    const log = lastLogRef.current;
    if (result.undidCompletion && log && log.dhikrId === dhikr.id) {
      d.setHistory((prev) => prev.filter((entry) => entry.id !== log.id));
      lastLogRef.current = null;
    }
  };

  const handleReset = () => {
    deps.setConfirmModal({
      title: 'Reset Counter',
      message: 'Reset this prayer counter back to zero? This will clear active progress, but keeps your history logs.',
      onConfirm: () => {
        clearPending();
        countRef.current = 0;
        deps.setCurrentCount(0);
        deps.setConfirmModal(null);
      },
    });
  };

  return { handleIncrement, handleUndo, handleReset, canUndo: deps.currentCount > 0, upcoming, pendingNext };
};


interface HistoryFlowDeps {
  setHistory: React.Dispatch<React.SetStateAction<DhikrHistory[]>>;
  setStreakPauses: React.Dispatch<React.SetStateAction<StreakPause[]>>;
  setActiveDays: React.Dispatch<React.SetStateAction<string[]>>;
  setDhikrs: React.Dispatch<React.SetStateAction<Dhikr[]>>;
  setCurrentDhikrId: React.Dispatch<React.SetStateAction<string>>;
  setCurrentCount: React.Dispatch<React.SetStateAction<number>>;
  setPreferences: React.Dispatch<React.SetStateAction<UserPreferences>>;
  setReminders: React.Dispatch<React.SetStateAction<DhikrReminder[]>>;
  setFavouriteIds: React.Dispatch<React.SetStateAction<string[]>>;
  setRoutines: React.Dispatch<React.SetStateAction<Routine[]>>;
  setSalahLogs: React.Dispatch<React.SetStateAction<SalahLog[]>>;
  setActiveTab: React.Dispatch<React.SetStateAction<'home' | 'counter' | 'adhkaar' | 'routine' | 'salah' | 'quran' | 'stats' | 'settings' | 'qibla'>>;
  setConfirmModal: React.Dispatch<React.SetStateAction<ConfirmModalState | null>>;
  systemDhikrs: Dhikr[];
  defaultPreferences: UserPreferences;
  defaultReminders: DhikrReminder[];
  onResetOnboarding?: () => void;
}

export const useHistoryActions = (deps: HistoryFlowDeps) => {
  const handleClearHistory = () => {
    deps.setConfirmModal({
      destructive: true,
      title: 'Erase Completion Logs',
      message: 'Are you sure you want to securely erase all completion log histories? Daily streaks will reset to zero.',
      onConfirm: () => {
        deps.setHistory([]);
        deps.setStreakPauses([]);
        deps.setActiveDays([]);
        deps.setConfirmModal(null);
      }
    });
  };

  const handleResetAllData = () => {
    deps.setConfirmModal({
      destructive: true,
      title: 'Erase All App Data',
      message: 'Are you absolutely sure? This will delete all custom chants, history, preferences and reset the database.',
      onConfirm: () => {
        deps.setDhikrs(deps.systemDhikrs);
        deps.setCurrentDhikrId('subhanallah');
        deps.setCurrentCount(0);
        deps.setHistory([]);
        deps.setPreferences(deps.defaultPreferences);
        deps.setReminders(deps.defaultReminders);
        deps.setStreakPauses([]);
        deps.setActiveDays([]);
        deps.setFavouriteIds([]);
        deps.setRoutines(DEFAULT_ROUTINES);
        deps.setSalahLogs([]);
        deps.setActiveTab('counter');
        localStorage.clear();
        deps.onResetOnboarding?.();
        deps.setConfirmModal(null);
      }
    });
  };

  return { handleClearHistory, handleResetAllData };
};
