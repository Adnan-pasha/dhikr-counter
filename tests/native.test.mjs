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

test('the app is Muneeb, and its id is the same everywhere (it is permanent once published)', () => {
  const APP_ID = 'com.cognitrixlabs.muneeb';
  const config = read('capacitor.config.ts');
  assert.match(config, new RegExp(`appId: '${APP_ID.replaceAll('.', '\\.')}'`));
  assert.match(config, /appName: 'Muneeb'/);
  assert.match(config, /webDir: 'dist'/);
  assert.match(read('android/app/build.gradle'), new RegExp(`namespace = "${APP_ID}"[\\s\\S]*applicationId "${APP_ID}"`));
  const strings = read('android/app/src/main/res/values/strings.xml');
  assert.match(strings, /<string name="app_name">Muneeb<\/string>/);
  assert.match(strings, new RegExp(`<string name="package_name">${APP_ID}</string>`));
  assert.match(read('android/app/src/main/java/com/cognitrixlabs/muneeb/MainActivity.java'), /^package com\.cognitrixlabs\.muneeb;/);
  assert.equal(fs.existsSync(new URL('../android/app/src/main/java/com/cognitrixlabs/dhikr', import.meta.url)), false, 'old package folder is gone');
});

test('the launcher icon is adaptive with a themed layer, and every density has its image', () => {
  const res = 'android/app/src/main/res';
  for (const file of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
    const xml = read(`${res}/mipmap-anydpi-v26/${file}`);
    assert.match(xml, /<background android:drawable="@mipmap\/ic_launcher_bg"/);
    assert.match(xml, /<foreground android:drawable="@mipmap\/ic_launcher_foreground"/);
    assert.match(xml, /<monochrome android:drawable="@drawable\/ic_launcher_monochrome"/);
  }
  for (const density of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
    for (const image of ['ic_launcher', 'ic_launcher_round', 'ic_launcher_foreground', 'ic_launcher_bg']) {
      assert.ok(fs.existsSync(new URL(`../${res}/mipmap-${density}/${image}.png`, import.meta.url)), `${density}/${image}`);
    }
  }
  assert.ok(fs.existsSync(new URL(`../${res}/drawable-nodpi/ic_launcher_monochrome.png`, import.meta.url)));
});

test('the Play Store icon is a 512 by 512 PNG', () => {
  const bytes = fs.readFileSync(new URL('../android/store-listing/play-store-icon-512.png', import.meta.url));
  assert.equal(bytes.subarray(1, 4).toString('latin1'), 'PNG');
  assert.equal(bytes.readUInt32BE(16), 512);
  assert.equal(bytes.readUInt32BE(20), 512);
  assert.ok(bytes.length < 1_000_000, 'Play limits the icon to 1 MB');
});

test('the launch screen is the brand green, not the default Capacitor splash', () => {
  const styles = read('android/app/src/main/res/values/styles.xml');
  assert.match(styles, /windowSplashScreenBackground">@color\/splash_background/);
  assert.match(styles, /windowSplashScreenAnimatedIcon">@mipmap\/ic_launcher_foreground/);
  assert.doesNotMatch(styles, /@drawable\/splash/);
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
