import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

process.env.NODE_ENV = 'development';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://app.test/', pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.localStorage = dom.window.localStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import('react')).default;
const { renderHook, cleanup } = await import('@testing-library/react');
const { routeNotificationTap } = await import('../src/nativeAlarms.ts');
const { useReminderScheduler } = await import('../src/hooks.ts');

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test.afterEach(() => cleanup());
test.after(() => { dom.window.close(); });

// ── what tapping a notification does ──────────────────────────────────────────

test('tapping a reminder opens its dhikr', () => {
  assert.deepEqual(routeNotificationTap({ kind: 'reminder', dhikrId: 'subhanallah', reminderId: 'r1' }), { action: 'open-dhikr', dhikrId: 'subhanallah' });
});

test('tapping a prayer alert opens Prayers and plays that prayer\'s adhan', () => {
  for (const prayer of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) {
    assert.deepEqual(routeNotificationTap({ kind: 'adhan', prayer, dateKey: '2026-03-10' }), { action: 'play-adhan', prayer }, prayer);
  }
});

test('tapping the test alert just opens Prayers', () => {
  assert.deepEqual(routeNotificationTap({ kind: 'test' }), { action: 'open-prayers' });
});

test('anything else a notification might carry is ignored, because it comes from outside the app', () => {
  for (const bad of [null, undefined, 'text', 7, [], {}, { kind: 'adhan' }, { kind: 'adhan', prayer: 'sunrise' }, { kind: 'adhan', prayer: 'nope' },
    { kind: 'reminder' }, { kind: 'reminder', dhikrId: '' }, { kind: 'reminder', dhikrId: 5 }, { kind: 'reminder', dhikrId: 'x'.repeat(500) },
    { kind: 'launch-missiles' }]) {
    assert.equal(routeNotificationTap(bad), null, JSON.stringify(bad));
  }
});

// ── the in-app reminder alert stands down when the phone does the ringing ─────

const dueNow = () => {
  const now = new Date();
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return {
    id: 'due', dhikrId: 'subhanallah', dhikrName: 'SubhanAllah', label: 'Due now', isEnabled: true,
    timeString: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    days: [days[now.getDay()]],
  };
};
const PREFS = { soundOn: false, volume: 0.5 };

test('the in-app reminder banner appears when this screen is doing the reminding', () => {
  const shown = [];
  localStorage.clear();
  renderHook(() => useReminderScheduler([dueNow()], PREFS, (update) => shown.push(typeof update === 'function' ? update(null) : update)));
  assert.ok(shown.some((r) => r && r.id === 'due'), 'the banner is raised');
});

test('and it stays quiet when the phone\'s own alerts are doing the reminding, so there is never a double alert', () => {
  const shown = [];
  localStorage.clear();
  renderHook(() => useReminderScheduler([dueNow()], PREFS, (update) => shown.push(typeof update === 'function' ? update(null) : update), false));
  assert.equal(shown.length, 0);
});

// ── the pieces are connected ─────────────────────────────────────────────────

test('App keeps the phone\'s alarms in step, and hands the alerts to the phone only while notifications are allowed', () => {
  const app = read('src/App.tsx');
  assert.match(app, /useNativeAlarms\(reminders\)/);
  assert.match(app, /const phoneRings = nativeAlarms\.supported && nativeAlarms\.lastSync\?\.status === 'scheduled'/);
  assert.match(app, /useReminderScheduler\(reminders, preferences, setActiveReminderTriggered, !phoneRings\)/);
  assert.match(app, /autoPlayAdhan=\{!phoneRings\}/);
  assert.doesNotMatch(app, /phoneAlarmsActive/, 'the Qibla screen no longer plays the adhan, so it is not told');
});

test('App turns a tap on a notification into the right action', () => {
  const app = read('src/App.tsx');
  assert.match(app, /onNotificationTap\(/);
  assert.match(app, /routeNotificationTap\(extra\)/);
  assert.match(app, /setLaunchDhikrId\(route\.dhikrId\)/);
  assert.match(app, /setActiveTab\('prayers'\)/);
  assert.match(app, /playRequest=\{playRequest\}/);
  assert.match(app, /alarms=\{nativeAlarms\}/);
});

test('the Qibla screen is only a compass: it has no adhan player of its own to overlap the phone\'s alarms', () => {
  const qibla = read('src/components/QiblaScreen.tsx');
  assert.doesNotMatch(qibla, /new Audio\(|AudioContext|computePrayerDay|azanSourceFor/);
});

test('a tap on the "keep your alerts going" nudge just opens Prayers', () => {
  assert.deepEqual(routeNotificationTap({ kind: 'refresh' }), { action: 'open-prayers' });
});

// ── Settings shows the phone's alerts inside the app, and the web wording only in a browser ──

const { render, screen } = await import('@testing-library/react');
const { default: NotificationSettings } = await import('../src/components/NotificationSettings.tsx');

const phoneAlarms = () => ({
  supported: true,
  status: { notifications: 'granted', exactAlarms: 'granted' },
  lastSync: { status: 'scheduled', scheduled: 10, exact: true },
  next: null,
  requestNotifications: async () => 'granted',
  openExactSettings: async () => 'granted',
  sendTest: async () => ({ status: 'scheduled', scheduled: 1, exact: true }),
});

test('in the phone app Settings shows the alerts card, not the browser wording', () => {
  render(React.createElement(NotificationSettings, { alarms: phoneAlarms() }));
  assert.ok(screen.getByRole('region', { name: 'Prayer alerts' }));
  assert.equal(document.getElementById('notification_settings'), null);
  assert.equal(screen.queryByText(/not supported in this browser/i), null);
  assert.equal(screen.queryByText(/need the Android app/i), null);
});

test('in a browser Settings keeps its own notification section', () => {
  cleanup();
  render(React.createElement(NotificationSettings, {}));
  assert.ok(document.getElementById('notification_settings'));
  assert.equal(screen.queryByRole('region', { name: 'Prayer alerts' }), null);
});

test('the app hands the phone alarms to Settings', () => {
  assert.match(read('src/App.tsx'), /<SettingsScreen[\s\S]*?alarms=\{nativeAlarms\}/);
  assert.match(read('src/components/SettingsScreen.tsx'), /<NotificationSettings alarms=\{alarms\} \/>/);
});
