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
