import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('reminders also raise a system notification when the app is in the background', () => {
  const hooks = read('src/hooks.ts');
  assert.ok(hooks.includes("import { showReminderNotification } from './notifications'"));
  const scheduler = hooks.slice(hooks.indexOf('export const useReminderScheduler'), hooks.indexOf('const dismissReminder'));
  assert.ok(scheduler.includes("document.visibilityState === 'hidden'"), 'only when the in-app banner cannot be seen');
  assert.ok(scheduler.includes('showReminderNotification('));
});

test('the app opens the dhikr a notification asked for, from the launch URL and from the service worker', () => {
  const app = read('src/App.tsx');
  assert.ok(app.includes('dhikrIdFromSearch(window.location.search)'));
  assert.ok(app.includes("'OPEN_DHIKR'"));
  assert.ok(app.includes("navigator.serviceWorker.addEventListener('message'"));
  assert.ok(app.includes('window.history.replaceState'), 'the launch parameter is removed after use');
  assert.ok(app.includes('startMessages'), 'queued worker messages are delivered to a listener added with addEventListener');
});

test('friday progress is persisted, reset with the data, and shown on Home', () => {
  const hooks = read('src/hooks.ts');
  assert.ok(hooks.includes("'tasbih_friday_kahf'"));
  assert.equal(hooks.split('deps.setFridayKahf([])').length - 1, 2, 'clearing history and reset-all both clear it');
  const home = read('src/components/HomeScreen.tsx');
  assert.ok(home.includes('<FridayCard'));
  assert.ok(read('src/App.tsx').includes('fridayChecklist('));
});

test('the Quran reader can be opened straight onto a surah', () => {
  const quran = read('src/components/QuranReader.tsx');
  assert.ok(quran.includes('openSurah'));
  assert.ok(read('src/App.tsx').includes('openSurah={'));
});

test('settings shows the notification card', () => {
  assert.ok(read('src/components/SettingsScreen.tsx').includes('<NotificationSettings />'));
});
