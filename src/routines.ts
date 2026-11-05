import type { Routine, SalahLog, SalahName } from './types';
import type { StorageLike } from './salah';

export const AFTER_SALAH_ROUTINE_ID = 'routine-after-salah';

const FARD_PRAYERS: readonly SalahName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

/** The five obligatory prayers each have a dhikr that follows them. */
export const isFardPrayer = (prayer: SalahName): boolean => FARD_PRAYERS.includes(prayer);

/**
 * The routine the counter is walking through: the one the user started, while the current dhikr is still
 * part of it. Nothing is guessed. Several routines share dhikr (SubhanAllah is in Morning and After Salah),
 * so picking "the first routine containing it" sent people through the wrong routine's order.
 */
export const resolveActiveRoutine = (
  routines: readonly Routine[],
  startedRoutineId: string | null,
  currentDhikrId: string,
): Routine | null => {
  const started = startedRoutineId ? routines.find((r) => r.id === startedRoutineId) : undefined;
  return started?.dhikrIds.includes(currentDhikrId) ? started : null;
};

/**
 * Where the counter goes once a routine is finished: back to the routine's first dhikr, at zero, so the next visit
 * to the Tasbih tab does not open on a completed last dhikr. What was done stays in the history.
 */
export const afterFinishingRoutine = (routine: readonly { id: string }[]): { dhikrId: string | null; count: 0 } => ({
  dhikrId: routine[0]?.id ?? null,
  count: 0,
});

/** The ids with repeats removed, keeping the first of each. A routine that lists a dhikr twice must not loop. */
export const uniqueInOrder = (ids: readonly string[]): string[] => [...new Set(ids)];

export const STARTED_ROUTINE_KEY = 'tasbih_started_routine';

/** The routine that was running when the app was last closed, so a restart carries on with it. */
export const readStartedRoutine = (storage: StorageLike | null): string | null => {
  try {
    return storage?.getItem(STARTED_ROUTINE_KEY) || null;
  } catch {
    return null;
  }
};

export const writeStartedRoutine = (storage: StorageLike | null, routineId: string | null): void => {
  try {
    if (routineId) storage?.setItem(STARTED_ROUTINE_KEY, routineId);
    else storage?.removeItem(STARTED_ROUTINE_KEY);
  } catch {
    // Storage is blocked: the routine is simply not remembered.
  }
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
