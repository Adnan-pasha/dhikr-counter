import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const { isNativeApp } = await import('../src/native.ts');
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('in a browser the page is not the Android app', () => {
  assert.equal(isNativeApp(), false);
});

test('the service worker is not registered inside the Android app', () => {
  assert.match(read('src/main.tsx'), /import\.meta\.env\.PROD && !isNativeApp\(\)/);
});

test('the Android manifest asks for the permissions the web features need', () => {
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  for (const permission of ['INTERNET', 'ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION', 'VIBRATE']) {
    assert.match(manifest, new RegExp(`android.permission.${permission}`), permission);
  }
});

test('the app has an id and name for test builds, and loads the web build', () => {
  const config = read('capacitor.config.ts');
  assert.match(config, /appId: 'com\.cognitrixlabs\.dhikr'/);
  assert.match(config, /webDir: 'dist'/);
});

test('the app frame leaves room for the status bar and display cutouts, as the Android app draws edge to edge', () => {
  const css = read('src/index.css');
  const rule = css.match(/#phone_simulator_frame\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.match(rule, /env\(safe-area-inset-top/, 'top');
  assert.match(rule, /env\(safe-area-inset-left/, 'left');
  assert.match(rule, /env\(safe-area-inset-right/, 'right');
  assert.match(read('index.html'), /viewport-fit=cover/);
});

const { androidBackHandler } = await import('../src/native.ts');

test('the Android back button steps back while a screen answers to it, and leaves the app when none does', () => {
  const calls = [];
  const history = { back: () => calls.push('history.back') };
  const exit = () => calls.push('exit');
  let live = true;
  const handle = androidBackHandler({ hasLiveLayer: () => live }, history, exit);
  handle();
  assert.deepEqual(calls, ['history.back']);
  live = false;
  handle();
  assert.deepEqual(calls, ['history.back', 'exit']);
});

test('inside the Android app the frame fills the screen instead of the 390px desktop preview', () => {
  assert.match(read('src/App.tsx'), /data-native=\{isNativeApp\(\)/);
  const css = read('src/index.css');
  const frame = css.match(/#app_root_viewport\[data-native\] #phone_simulator_frame\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.match(frame, /max-width:\s*none/);
  assert.match(frame, /border-radius:\s*0/);
});

test('the Android app stays upright, and never shows the desktop preview\'s pretend status bar', () => {
  assert.match(read('android/app/src/main/AndroidManifest.xml'), /android:screenOrientation="portrait"/);
  assert.match(read('src/App.tsx'), /id="desktop_status_bar"/);
  assert.match(read('src/index.css'), /#app_root_viewport\[data-native\] #desktop_status_bar\s*\{[^}]*display:\s*none/);
});
