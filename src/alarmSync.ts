import { ADHAN_CHANNEL, REMINDER_CHANNEL, TEST_ALARM_ID, type AlarmExtra, type PlannedAlarm } from './nativeAlarms';

export { TEST_ALARM_ID };

/** The sounds live in android/app/src/main/res/raw. */
export const ADHAN_SOUND = 'azan_hayya.mp3';
export const REMINDER_SOUND = 'reminder_chime.ogg';
/** A white silhouette in android/app/src/main/res/drawable-*: the small icon in the status bar. */
export const SMALL_ICON = 'ic_stat_muneeb';

export const TEST_DELAY_MS = 10_000;

export type PermissionState = 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied';

export interface ScheduledNotification {
  id: number;
  title: string;
  body: string;
  channelId: string;
  schedule: { at: Date; allowWhileIdle: boolean };
  extra: AlarmExtra | { kind: 'test' };
  smallIcon: string;
  /**
   * Tells the plugin whether to use an exact alarm. It must be false when exact alarms are not allowed: left at its
   * default (true) the plugin opens the system "Alarms & reminders" screen on every schedule call.
   */
  isExactNotification: boolean;
}

export interface ChannelSpec {
  id: string;
  name: string;
  description: string;
  sound: string;
  importance: 1 | 2 | 3 | 4 | 5;
  visibility: -1 | 0 | 1;
  vibration: boolean;
}

/** The part of the Capacitor local-notifications plugin this app uses, so tests can stand in for the phone. */
export interface AlarmPort {
  checkPermissions(): Promise<{ display: PermissionState }>;
  requestPermissions(): Promise<{ display: PermissionState }>;
  checkExactNotificationSetting(): Promise<{ exact_alarm: PermissionState }>;
  changeExactNotificationSetting(): Promise<{ exact_alarm: PermissionState }>;
  createChannel(channel: ChannelSpec): Promise<void>;
  getPending(): Promise<{ notifications: Array<{ id: number }> }>;
  cancel(options: { notifications: Array<{ id: number }> }): Promise<void>;
  schedule(options: { notifications: ScheduledNotification[] }): Promise<unknown>;
}

export type SyncResult =
  | { status: 'scheduled'; scheduled: number; exact: boolean }
  | { status: 'no-permission'; scheduled: 0 }
  | { status: 'error'; scheduled: 0; error: string };

export interface AlarmStatus {
  notifications: PermissionState;
  exactAlarms: PermissionState;
}

const CHANNELS: readonly ChannelSpec[] = [
  {
    id: ADHAN_CHANNEL,
    name: 'Prayer times',
    description: 'The call to prayer at each prayer time',
    sound: ADHAN_SOUND,
    importance: 5,
    visibility: 1,
    vibration: true,
  },
  {
    id: REMINDER_CHANNEL,
    name: 'Dhikr reminders',
    description: 'Your reminders to remember Allah',
    sound: REMINDER_SOUND,
    importance: 4,
    visibility: 1,
    vibration: true,
  },
];

const toNotification = (alarm: PlannedAlarm, exact: boolean): ScheduledNotification => ({
  id: alarm.id,
  title: alarm.title,
  body: alarm.body,
  channelId: alarm.channelId,
  schedule: { at: alarm.at, allowWhileIdle: true },
  extra: alarm.extra,
  smallIcon: SMALL_ICON,
  isExactNotification: exact,
});

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * Keeps Android's schedule equal to the plan. Calls run one at a time, in the order they were made, so two
 * quick changes can never leave a half-cancelled, half-scheduled phone. Nothing here throws: a problem comes
 * back as a result the screen can show.
 */
export const createAlarmSync = (port: AlarmPort) => {
  let queue: Promise<unknown> = Promise.resolve();
  /** What was last handed to the phone in full, or null when that is unknown (a fresh start, or a failed attempt). */
  let lastPlanKey: string | null = null;
  const inOrder = <T>(job: () => Promise<T>): Promise<T> => {
    const run = queue.then(job, job);
    queue = run.catch(() => undefined);
    return run;
  };

  const canShow = async (): Promise<boolean> => (await port.checkPermissions()).display === 'granted';

  /** Whether Android will let this app set exact alarms. Anything unreadable counts as not allowed. */
  const exactAllowed = async (): Promise<boolean> => {
    try {
      return (await port.checkExactNotificationSetting()).exact_alarm === 'granted';
    } catch {
      return false;
    }
  };

  const sync = (plan: readonly PlannedAlarm[]): Promise<SyncResult> =>
    inOrder(async (): Promise<SyncResult> => {
      try {
        if (!(await canShow())) return { status: 'no-permission', scheduled: 0 };
        for (const channel of CHANNELS) await port.createChannel(channel);
        const { notifications: pending } = await port.getPending();
        // A test alert still waiting for its ten seconds is not part of the schedule, so it is left alone.
        const stale = pending.filter(({ id }) => id !== TEST_ALARM_ID);
        // Read before scheduling, so alarms are never asked to be exact when they may not be (see isExactNotification).
        const exact = await exactAllowed();
        const notifications = plan.map((alarm) => toNotification(alarm, exact));
        const planKey = JSON.stringify(notifications);
        // Opening the app tops the plan up every time; when the phone already holds exactly what was set last time,
        // cancelling and setting up to 300 alarms again is wasted work across the bridge.
        const wanted = new Set(notifications.map(({ id }) => id));
        const phoneHoldsPlan = planKey === lastPlanKey && stale.length === wanted.size && stale.every(({ id }) => wanted.has(id));
        if (phoneHoldsPlan) return { status: 'scheduled', scheduled: plan.length, exact };
        lastPlanKey = null;
        if (stale.length > 0) await port.cancel({ notifications: stale.map(({ id }) => ({ id })) });
        if (notifications.length > 0) await port.schedule({ notifications });
        lastPlanKey = planKey;
        return { status: 'scheduled', scheduled: plan.length, exact };
      } catch (error) {
        return { status: 'error', scheduled: 0, error: message(error) };
      }
    });

  /** A notification ten seconds from now, so the person can hear the real alert with the app closed. */
  const scheduleTest = (now: Date = new Date()): Promise<SyncResult> =>
    inOrder(async (): Promise<SyncResult> => {
      try {
        if (!(await canShow())) return { status: 'no-permission', scheduled: 0 };
        for (const channel of CHANNELS) await port.createChannel(channel);
        const exact = await exactAllowed();
        await port.schedule({
          notifications: [{
            id: TEST_ALARM_ID,
            title: 'Test: Muneeb prayer alert',
            body: 'If you can hear the call to prayer, your alerts are working.',
            channelId: ADHAN_CHANNEL,
            schedule: { at: new Date(now.getTime() + TEST_DELAY_MS), allowWhileIdle: true },
            extra: { kind: 'test' },
            smallIcon: SMALL_ICON,
            isExactNotification: exact,
          }],
        });
        return { status: 'scheduled', scheduled: 1, exact };
      } catch (error) {
        return { status: 'error', scheduled: 0, error: message(error) };
      }
    });

  const status = async (): Promise<AlarmStatus> => {
    const read = async <T extends { display?: PermissionState; exact_alarm?: PermissionState }>(job: () => Promise<T>, key: 'display' | 'exact_alarm'): Promise<PermissionState> => {
      try {
        return (await job())[key] ?? 'prompt';
      } catch {
        return 'prompt';
      }
    };
    return {
      notifications: await read(() => port.checkPermissions(), 'display'),
      exactAlarms: await read(() => port.checkExactNotificationSetting(), 'exact_alarm'),
    };
  };

  const requestNotifications = async (): Promise<PermissionState> => {
    try {
      return (await port.requestPermissions()).display;
    } catch {
      return 'denied';
    }
  };

  const openExactAlarmSettings = async (): Promise<PermissionState> => {
    try {
      return (await port.changeExactNotificationSetting()).exact_alarm;
    } catch {
      return 'denied';
    }
  };

  return { sync, scheduleTest, status, requestNotifications, openExactAlarmSettings };
};

/**
 * Wraps a Capacitor plugin as a plain object with just the calls this app uses. A plugin object cannot be returned
 * from an async function or resolved through a promise as it is: it answers every property name, `then` included,
 * with a method, so JavaScript treats it as a promise and the call fails with "then() is not implemented".
 */
export const toAlarmPort = (plugin: AlarmPort): AlarmPort => ({
  checkPermissions: () => plugin.checkPermissions(),
  requestPermissions: () => plugin.requestPermissions(),
  checkExactNotificationSetting: () => plugin.checkExactNotificationSetting(),
  changeExactNotificationSetting: () => plugin.changeExactNotificationSetting(),
  createChannel: (channel) => plugin.createChannel(channel),
  getPending: () => plugin.getPending(),
  cancel: (options) => plugin.cancel(options),
  schedule: (options) => plugin.schedule(options),
});
