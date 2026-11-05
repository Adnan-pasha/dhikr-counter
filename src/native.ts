import { Capacitor } from '@capacitor/core';
import { getBackStack } from './backStack';

/** True when the page is running inside the Android app, false in a browser or the installed web app. */
export const isNativeApp = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

/**
 * What the phone's back button does inside the app: step back through the screens while one answers to it, and
 * leave the app once none does. (The web app gets the first half from the browser, which supplies its own exit.)
 */
export const androidBackHandler = (
  stack: { hasLiveLayer: () => boolean },
  history: { back: () => void },
  exitApp: () => void,
) => (): void => {
  if (stack.hasLiveLayer()) history.back();
  else exitApp();
};

/** Hooks the Android back button up to the app's screens. A no-op in a browser. */
export const installAndroidBack = async (): Promise<void> => {
  if (!isNativeApp()) return;
  const { App } = await import('@capacitor/app');
  const handle = androidBackHandler(getBackStack(), window.history, () => { void App.exitApp(); });
  await App.addListener('backButton', handle);
};

/** The phone's notification scheduler, or null in a browser. Loaded on demand so the web app never carries it. */
export const getAlarmPort = async (): Promise<import('./alarmSync').AlarmPort | null> => {
  if (!isNativeApp()) return null;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const { toAlarmPort } = await import('./alarmSync');
  // Never return the plugin itself from an async function (see toAlarmPort).
  return toAlarmPort(LocalNotifications as unknown as import('./alarmSync').AlarmPort);
};

/** Calls `handler` with what a notification carried when the person taps it. Returns a function that stops listening. */
export const onNotificationTap = (handler: (extra: unknown) => void): (() => void) => {
  if (!isNativeApp()) return () => {};
  let stopped = false;
  let remove: (() => void) | null = null;
  void import('@capacitor/local-notifications').then(async ({ LocalNotifications }) => {
    const handle = await LocalNotifications.addListener('localNotificationActionPerformed', (event) => handler(event.notification.extra));
    if (stopped) void handle.remove();
    else remove = () => { void handle.remove(); };
  });
  return () => { stopped = true; remove?.(); };
};

/** Calls `handler` each time the app comes back to the front. Returns a function that stops listening. */
export const onAppResume = (handler: () => void): (() => void) => {
  if (!isNativeApp()) return () => {};
  let stopped = false;
  let remove: (() => void) | null = null;
  void import('@capacitor/app').then(async ({ App }) => {
    const handle = await App.addListener('resume', handler);
    if (stopped) void handle.remove();
    else remove = () => { void handle.remove(); };
  });
  return () => { stopped = true; remove?.(); };
};
