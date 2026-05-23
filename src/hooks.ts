import React from 'react';
import { useEffect } from 'react';
import { DhikrReminder, UserPreferences } from './types';
import { findDueReminders, shouldTriggerReminderOccurrence, findCatchUpReminderCandidates, findMissedReminderCandidates } from './domain';
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
import { migrateAndHydrateStorage, computeStreak } from './domain';

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
  },
) => {
  useEffect(() => {
    const hydrated = migrateAndHydrateStorage({
      defaultDhikrs: defaults.defaultDhikrs,
      defaultPreferences: defaults.defaultPreferences,
      defaultReminders: defaults.defaultReminders,
    });

    setters.setDhikrs(hydrated.dhikrs);
    setters.setCurrentDhikrId(hydrated.currentDhikrId);
    setters.setCurrentCount(hydrated.currentCount);
    setters.setHistory(hydrated.history);
    setters.setPreferences(hydrated.preferences);
    setters.setReminders(hydrated.reminders);
    const savedFavs = localStorage.getItem('tasbih_favourites');
    setters.setFavouriteIds(savedFavs ? JSON.parse(savedFavs) : []);
  }, []);

  useEffect(() => {
    if (state.dhikrs.length > 0) localStorage.setItem('tasbih_dhikrs', JSON.stringify(state.dhikrs));
  }, [state.dhikrs]);
  useEffect(() => { localStorage.setItem('tasbih_current_id', state.currentDhikrId); }, [state.currentDhikrId]);
  useEffect(() => { localStorage.setItem('tasbih_current_count', String(state.currentCount)); }, [state.currentCount]);
  useEffect(() => {
    localStorage.setItem('tasbih_history', JSON.stringify(state.history));
    setters.setStreak(computeStreak(state.history));
  }, [state.history]);
  useEffect(() => { localStorage.setItem('tasbih_preferences', JSON.stringify(state.preferences)); }, [state.preferences]);
  useEffect(() => { localStorage.setItem('tasbih_reminders', JSON.stringify(state.reminders)); }, [state.reminders]);
  useEffect(() => { localStorage.setItem('tasbih_favourites', JSON.stringify(state.favouriteIds)); }, [state.favouriteIds]);
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
  setActiveTab: React.Dispatch<React.SetStateAction<'counter' | 'library' | 'adhkaar' | 'stats' | 'settings' | 'qibla'>>;
  setHistory: React.Dispatch<React.SetStateAction<DhikrHistory[]>>;
  setConfirmModal: React.Dispatch<React.SetStateAction<{ title: string; message: string; onConfirm: () => void; } | null>>;
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
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000;

    const todayLogIndex = deps.history.findIndex((log) => {
      if (log.dhikrId !== dhikrId) return false;
      const logTime = new Date(log.timestamp).getTime();
      return logTime >= todayStart && logTime < todayEnd;
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
  setCurrentCount: React.Dispatch<React.SetStateAction<number>>;
  setCurrentDhikrId: React.Dispatch<React.SetStateAction<string>>;
  setHistory: React.Dispatch<React.SetStateAction<DhikrHistory[]>>;
  setConfirmModal: React.Dispatch<React.SetStateAction<{ title: string; message: string; onConfirm: () => void; } | null>>;
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
        const currentIndex = deps.dhikrs.findIndex((d) => d.id === deps.currentDhikrId);
        if (currentIndex !== -1) {
          const nextIndex = (currentIndex + 1) % deps.dhikrs.length;
          const nextDhikr = deps.dhikrs[nextIndex];

          setTimeout(() => {
            deps.setCurrentDhikrId(nextDhikr.id);
            deps.setCurrentCount(0);
          }, 1200);
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
  setActiveTab: React.Dispatch<React.SetStateAction<'counter' | 'library' | 'adhkaar' | 'stats' | 'settings' | 'qibla'>>;
  setConfirmModal: React.Dispatch<React.SetStateAction<{ title: string; message: string; onConfirm: () => void; } | null>>;
  systemDhikrs: Dhikr[];
  defaultPreferences: UserPreferences;
  defaultReminders: DhikrReminder[];
}

export const useHistoryActions = (deps: HistoryFlowDeps) => {
  const handleClearHistory = () => {
    deps.setConfirmModal({
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
        deps.setActiveTab('counter');
        localStorage.clear();
        deps.setConfirmModal(null);
      }
    });
  };

  return { handleClearHistory, handleResetAllData };
};
