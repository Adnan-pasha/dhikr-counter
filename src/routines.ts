import type { Routine, SalahLog, SalahName } from './types';

export const AFTER_SALAH_ROUTINE_ID = 'routine-after-salah';

const FARD_PRAYERS: readonly SalahName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

/** Sunrise is tracked but is not a prayer with a dhikr to follow it. */
export const isFardPrayer = (prayer: SalahName): boolean => FARD_PRAYERS.includes(prayer);

/**
 * The routine the counter is walking through. The one the user started wins, because several
 * routines share dhikr (SubhanAllah is in Morning and After Salah); otherwise the first routine
 * containing the current dhikr is used, as before.
 */
export const resolveActiveRoutine = (
  routines: readonly Routine[],
  startedRoutineId: string | null,
  currentDhikrId: string,
): Routine | null => {
  const started = startedRoutineId ? routines.find((r) => r.id === startedRoutineId) : undefined;
  if (started?.dhikrIds.includes(currentDhikrId)) return started;
  return routines.find((r) => r.dhikrIds.includes(currentDhikrId)) ?? null;
};

/** Flips one prayer for a day and reports whether it is now marked done. Returns new arrays. */
export const togglePrayerLog = (
  logs: readonly SalahLog[],
  date: string,
  prayer: SalahName,
): { logs: SalahLog[]; nowDone: boolean } => {
  const existing = logs.find((l) => l.date === date);
  const nowDone = !existing?.prayers[prayer];
  if (!existing) return { logs: [...logs, { date, prayers: { [prayer]: true } }], nowDone };
  return {
    logs: logs.map((l) => (l.date === date ? { ...l, prayers: { ...l.prayers, [prayer]: nowDone } } : l)),
    nowDone,
  };
};

/** The After Salah routine, or null if the user deleted or emptied it. */
export const afterSalahRoutine = (routines: readonly Routine[]): Routine | null => {
  const routine = routines.find((r) => r.id === AFTER_SALAH_ROUTINE_ID);
  return routine && routine.dhikrIds.length > 0 ? routine : null;
};
