import React from 'react';
import { useEffect } from 'react';
import { DhikrReminder, UserPreferences, Routine, SalahLog, ConfirmModalState } from './types';
import { DEFAULT_ROUTINES } from './adhkaar-data';
import { normalizeRoutine } from './icons';
import { findDueReminders, shouldTriggerReminderOccurrence, findCatchUpReminderCandidates, findMissedReminderCandidates, parseStoredArray } from './domain';
import { playBeadSound, playCompletionSound } from './audio';
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
import { migrateAndHydrateStorage, computeStreak, isTimestampOnLocalDay } from './domain';

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
  setStreak: (value: number) => void;
  setFavouriteIds: (value: string[]) => void;
  setRoutines: (value: Routine[]) => void;
  setSalahLogs: (value: SalahLog[]) => void;
}

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
    setHydrated(true);
  }, []);

  // Persist only after hydration. Before it, `state` holds the empty initial values; writing
  // them would overwrite saved data (React StrictMode re-runs the load effect in development
  // and would then read back the overwritten values).
  useEffect(() => {
    if (hydrated && state.dhikrs.length > 0) localStorage.setItem('tasbih_dhikrs', JSON.stringify(state.dhikrs));
  }, [hydrated, state.dhikrs]);
  useEffect(() => { if (hydrated) localStorage.setItem('tasbih_current_id', state.currentDhikrId); }, [hydrated, state.currentDhikrId]);
  useEffect(() => { if (hydrated) localStorage.setItem('tasbih_current_count', String(state.currentCount)); }, [hydrated, state.currentCount]);
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem('tasbih_history', JSON.stringify(state.history));
    setters.setStreak(computeStreak(state.history));
  }, [hydrated, state.history]);
  useEffect(() => { if (hydrated) localStorage.setItem('tasbih_preferences', JSON.stringify(state.preferences)); }, [hydrated, state.preferences]);
  useEffect(() => { if (hydrated) localStorage.setItem('tasbih_reminders', JSON.stringify(state.reminders)); }, [hydrated, state.reminders]);
  useEffect(() => { if (hydrated) localStorage.setItem('tasbih_favourites', JSON.stringify(state.favouriteIds)); }, [hydrated, state.favouriteIds]);
  useEffect(() => { if (hydrated) localStorage.setItem('tasbih_routines', JSON.stringify(state.routines)); }, [hydrated, state.routines]);
  useEffect(() => { if (hydrated) localStorage.setItem('tasbih_salah_logs', JSON.stringify(state.salahLogs)); }, [hydrated, state.salahLogs]);
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
}

export const useCounterFlow = (deps: CounterFlowDeps) => {
  const handleIncrement = () => {
    const nextCount = deps.currentCount + 1;
    deps.setCurrentCount(nextCount);

    if (deps.preferences.soundOn) {
      playBeadSound(deps.preferences.soundTone, deps.preferences.volume);
    }

    if (deps.preferences.vibrateOn && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(40);
    }

    const goal = deps.activeDhikr.targetCount;

    if (goal > 0 && nextCount === goal) {
      if (deps.preferences.vibrateOn && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate([100, 60, 100]);
      }

      playCompletionSound(deps.preferences.volume);

      const newLog: DhikrHistory = {
        id: Math.random().toString(36).substring(2, 9),
        dhikrId: deps.activeDhikr.id,
        dhikrName: deps.activeDhikr.nameEn,
        count: goal,
        timestamp: new Date().toISOString(),
      };
      deps.setHistory((prev) => [...prev, newLog]);

      if (deps.preferences.autoAdvance) {
        const sequence = deps.activeRoutine ?? deps.dhikrs;
        const currentIndex = sequence.findIndex((d) => d.id === deps.currentDhikrId);

        if (currentIndex !== -1) {
          // Build today's completed set BEFORE this completion (newLog not yet in state)
          const completedTodayIds = new Set(
            deps.history
              .filter(h => isTimestampOnLocalDay(h.timestamp))
              .map(h => h.dhikrId)
          );
          // Current dhikr just completed — add it to the set
          completedTodayIds.add(deps.currentDhikrId);

          if (deps.activeRoutine) {
            // Find the next PENDING dhikr after the current position
            const nextPending = sequence
              .slice(currentIndex + 1)
              .find(d => !completedTodayIds.has(d.id));

            if (nextPending) {
              setTimeout(() => {
                deps.setCurrentDhikrId(nextPending.id);
                deps.setCurrentCount(0);
              }, 1200);
            }
            // All done in routine — stay on last, don't loop
          } else {
            // Free counter mode — just advance to next in library
            const nextIndex = (currentIndex + 1) % sequence.length;
            const nextDhikr = sequence[nextIndex];
            setTimeout(() => {
              deps.setCurrentDhikrId(nextDhikr.id);
              deps.setCurrentCount(0);
            }, 1200);
          }
        }
      }
    }
  };

  const handleReset = () => {
    deps.setConfirmModal({
      title: 'Reset Counter',
      message: 'Reset this prayer counter back to zero? This will clear active progress, but keeps your history logs.',
      onConfirm: () => {
        deps.setCurrentCount(0);
        deps.setConfirmModal(null);
      }
    });
  };

  return { handleIncrement, handleReset };
};


interface HistoryFlowDeps {
  setHistory: React.Dispatch<React.SetStateAction<DhikrHistory[]>>;
  setStreak: React.Dispatch<React.SetStateAction<number>>;
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
        deps.setStreak(0);
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
        deps.setStreak(0);
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
