import type { DhikrReminder } from './types';

export type NotificationStatus = 'unsupported' | 'granted' | 'denied' | 'default';

interface ServiceWorkerLike {
  getRegistration: () => Promise<{ showNotification: (title: string, options?: NotificationOptions) => Promise<void> } | undefined>;
}

/** The browser objects used here, injectable so the logic can be tested without a browser. */
export interface NotificationEnv {
  Notification?: {
    permission: NotificationPermission;
    requestPermission: () => Promise<NotificationPermission>;
    new (title: string, options?: NotificationOptions): unknown;
  };
  navigator?: { serviceWorker?: ServiceWorkerLike };
}

const MAX_DHIKR_ID_LENGTH = 80;
const DEFAULT_TITLE = 'Time for dhikr';

const browserEnv = (): NotificationEnv => globalThis as unknown as NotificationEnv;

export const getNotificationStatus = (env: NotificationEnv = browserEnv()): NotificationStatus =>
  env.Notification ? env.Notification.permission : 'unsupported';

export const buildReminderNotification = (reminder: DhikrReminder): { title: string; options: NotificationOptions } => ({
  title: reminder.label.trim() || DEFAULT_TITLE,
  options: {
    body: `${reminder.dhikrName}. Tap to begin.`,
    tag: `reminder-${reminder.id}`,
    icon: 'icon-192.png',
    data: { dhikrId: reminder.dhikrId },
  },
});

/**
 * Shows a system notification for a reminder. Prefers the service worker (required on Android
 * Chrome and lets a tap open the app), falls back to the page API. Returns whether one was shown.
 * Only works while the page or its service worker is alive; closed-app delivery needs a push
 * service or the native wrapper.
 */
export const showReminderNotification = async (
  reminder: DhikrReminder,
  env: NotificationEnv = browserEnv(),
): Promise<boolean> => {
  if (getNotificationStatus(env) !== 'granted') return false;
  const { title, options } = buildReminderNotification(reminder);

  try {
    // Not `.ready`: that never settles when no worker is registered (dev builds, failed registration).
    const registration = await env.navigator?.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification(title, options);
      return true;
    }
  } catch {
    // Fall through to the page notification.
  }

  try {
    if (env.Notification) {
      new env.Notification(title, options);
      return true;
    }
  } catch {
    // Some mobile browsers forbid the constructor; nothing more to try.
  }
  return false;
};

export const requestNotificationPermission = async (env: NotificationEnv = browserEnv()): Promise<NotificationStatus> => {
  if (!env.Notification) return 'unsupported';
  try {
    return await env.Notification.requestPermission();
  } catch {
    return getNotificationStatus(env);
  }
};

/** The dhikr a notification tap asked to open, read from the launch URL (`?dhikr=<id>`). */
export const dhikrIdFromSearch = (search: string): string | null => {
  const id = new URLSearchParams(search).get('dhikr');
  return id && id.length <= MAX_DHIKR_ID_LENGTH ? id : null;
};
