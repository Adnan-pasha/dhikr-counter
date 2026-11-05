import React from 'react';
import type { DhikrReminder, PrayerSettings } from './types';
import type { PrayerLocation } from './prayerTimes';
import { planAlarms, nextAlarmAfter, type PlannedAlarm } from './nativeAlarms';
import { createAlarmSync, type AlarmPort, type AlarmStatus, type PermissionState, type SyncResult } from './alarmSync';
import { getAlarmPort, onAppResume } from './native';
import { readPrayerPlace } from './places';
import { readPrayerSettings } from './domain';
import { onPrayerConfigChange } from './prayerConfigEvents';

/** Changes come in bursts (typing a time, flipping several switches); Android is only told once they settle. */
export const SYNC_DEBOUNCE_MS = 800;

export interface NativeAlarmDeps {
  /** The phone's scheduler. `null` means there is no phone behind the page (a browser). Left out, it is looked up. */
  port?: AlarmPort | null;
  now: () => Date;
  readPlace: () => PrayerLocation | null;
  readSettings: () => PrayerSettings;
  subscribeResume: (handler: () => void) => () => void;
}

const defaultDeps: NativeAlarmDeps = {
  now: () => new Date(),
  readPlace: readPrayerPlace,
  readSettings: () => readPrayerSettings(),
  subscribeResume: onAppResume,
};

export interface NativeAlarms {
  /** False in a browser, where the page cannot ring when it is closed. */
  supported: boolean;
  status: AlarmStatus | null;
  lastSync: SyncResult | null;
  /** The soonest alarm now set, for the card to show. */
  next: PlannedAlarm | null;
  requestNotifications: () => Promise<PermissionState>;
  openExactSettings: () => Promise<PermissionState>;
  sendTest: () => Promise<SyncResult | null>;
  /** Set the alarms again now (the "Try again" button). */
  resync: () => Promise<void>;
}

/**
 * Keeps the phone's alarms equal to what the app says should ring: each prayer's adhan for the saved place and
 * each reminder. It runs when the app opens, when it comes back to the front, and (once things settle) when the
 * reminders change, and when the place or a prayer setting is changed anywhere in the app.
 */
export const useNativeAlarms = (
  reminders: readonly DhikrReminder[],
  overrides: Partial<NativeAlarmDeps> = {},
): NativeAlarms => {
  const depsRef = React.useRef<NativeAlarmDeps>({ ...defaultDeps, ...overrides });
  depsRef.current = { ...defaultDeps, ...overrides };

  const [port, setPort] = React.useState<AlarmPort | null | undefined>(overrides.port);
  React.useEffect(() => {
    if (overrides.port !== undefined) { setPort(overrides.port); return undefined; }
    let alive = true;
    void getAlarmPort().then((found) => { if (alive) setPort(found); }, () => { if (alive) setPort(null); });
    return () => { alive = false; };
  }, [overrides.port]);

  const alarms = React.useMemo(() => (port ? createAlarmSync(port) : null), [port]);
  const [status, setStatus] = React.useState<AlarmStatus | null>(null);
  const [lastSync, setLastSync] = React.useState<SyncResult | null>(null);
  const [next, setNext] = React.useState<PlannedAlarm | null>(null);

  const remindersRef = React.useRef(reminders);
  remindersRef.current = reminders;
  const alive = React.useRef(true);
  React.useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const run = React.useCallback(async (): Promise<void> => {
    if (!alarms) return;
    const d = depsRef.current;
    const now = d.now();
    const settings = d.readSettings();
    const plan = planAlarms({
      place: d.readPlace(),
      options: { method: settings.calculationMethod, madhab: settings.madhab },
      adhanEnabled: settings.azanEnabled,
      reminders: remindersRef.current,
      now,
    });
    const result = await alarms.sync(plan);
    const latest = await alarms.status();
    if (!alive.current) return;
    setLastSync(result);
    setStatus(latest);
    setNext(result.status === 'scheduled' ? nextAlarmAfter(plan, now) : null);
  }, [alarms]);

  // One timer for every trigger, so a burst of changes becomes a single sync.
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const trigger = React.useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; void run(); }, SYNC_DEBOUNCE_MS);
  }, [run]);

  // Compared by content: a list rebuilt with the same reminders is not a change.
  const remindersKey = JSON.stringify(reminders);
  React.useEffect(() => {
    if (!alarms) return undefined;
    trigger();
    return () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  }, [alarms, trigger, remindersKey]);

  // The place or a prayer setting changed somewhere else in the app.
  React.useEffect(() => {
    if (!alarms) return undefined;
    return onPrayerConfigChange(trigger);
  }, [alarms, trigger]);

  React.useEffect(() => {
    if (!alarms) return undefined;
    return depsRef.current.subscribeResume(trigger);
  }, [alarms, trigger]);

  const requestNotifications = React.useCallback(async (): Promise<PermissionState> => {
    if (!alarms) return 'denied';
    const answer = await alarms.requestNotifications();
    await run();
    return answer;
  }, [alarms, run]);

  const openExactSettings = React.useCallback(async (): Promise<PermissionState> => {
    if (!alarms) return 'denied';
    const answer = await alarms.openExactAlarmSettings();
    await run();
    return answer;
  }, [alarms, run]);

  const sendTest = React.useCallback(async (): Promise<SyncResult | null> => {
    if (!alarms) return null;
    return alarms.scheduleTest(depsRef.current.now());
  }, [alarms]);

  return { supported: port != null, status, lastSync, next, requestNotifications, openExactSettings, sendTest, resync: run };
};
