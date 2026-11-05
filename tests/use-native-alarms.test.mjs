import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

process.env.NODE_ENV = 'development';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://app.test/', pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.localStorage = dom.window.localStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import('react')).default;
const { renderHook, act, cleanup } = await import('@testing-library/react');
const { useNativeAlarms, SYNC_DEBOUNCE_MS } = await import('../src/useNativeAlarms.ts');
const { announcePrayerConfigChange } = await import('../src/prayerConfigEvents.ts');
const { TEST_ALARM_ID } = await import('../src/nativeAlarms.ts');

const MECCA = { lat: 21.4225, lng: 39.8262, timeZone: 'Asia/Riyadh', label: 'Mecca' };
const SETTINGS = { madhab: 'shafi', calculationMethod: 'Karachi', azanSound: 'makkah', azanEnabled: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true } };
const NOW = new Date('2026-03-10T21:30:00Z');
const reminder = (over = {}) => ({
  id: 'r1', dhikrId: 'subhanallah', dhikrName: 'SubhanAllah', timeString: '05:30',
  days: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'], label: 'Morning dhikr', isEnabled: true, ...over,
});

const fakePhone = ({ display = 'granted', exact = 'granted' } = {}) => {
  const state = { display, exact, scheduled: [], cancelled: 0, changeExact: 0, schedules: 0 };
  return {
    state,
    checkPermissions: async () => ({ display: state.display }),
    requestPermissions: async () => { state.display = 'granted'; return { display: state.display }; },
    checkExactNotificationSetting: async () => ({ exact_alarm: state.exact }),
    changeExactNotificationSetting: async () => { state.changeExact += 1; return { exact_alarm: state.exact }; },
    createChannel: async () => {},
    getPending: async () => ({ notifications: state.scheduled.map((n) => ({ id: n.id })) }),
    cancel: async () => { state.cancelled += 1; state.scheduled = []; },
    schedule: async ({ notifications }) => { state.schedules += 1; state.scheduled.push(...notifications); },
  };
};

let resumeHandlers = [];
const deps = (phone, over = {}) => ({
  port: phone,
  now: () => NOW,
  readPlace: () => MECCA,
  readSettings: () => SETTINGS,
  subscribeResume: (handler) => { resumeHandlers.push(handler); return () => { resumeHandlers = resumeHandlers.filter((h) => h !== handler); }; },
  ...over,
});

test.beforeEach(() => { resumeHandlers = []; mock.timers.enable({ apis: ['setTimeout'] }); });
test.afterEach(() => { cleanup(); mock.timers.reset(); });
test.after(() => { dom.window.close(); });

const settle = async () => { await act(async () => { mock.timers.tick(SYNC_DEBOUNCE_MS + 1); }); await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }); };

test('in a browser (no phone behind it) nothing happens and the app is told so', async () => {
  const { result } = renderHook(() => useNativeAlarms([reminder()], deps(null)));
  await settle();
  assert.equal(result.current.supported, false);
  assert.equal(result.current.status, null);
});

test('on a phone, the alarms for the saved place and the reminders are scheduled once the app has settled', async () => {
  const phone = fakePhone();
  const { result } = renderHook(() => useNativeAlarms([reminder()], deps(phone)));
  assert.equal(result.current.supported, true);
  assert.equal(phone.state.schedules, 0, 'not on the very first render: it waits to see if more changes come');
  await settle();
  assert.equal(phone.state.schedules, 1);
  const kinds = new Set(phone.state.scheduled.map((n) => n.extra.kind));
  assert.deepEqual([...kinds].sort(), ['adhan', 'refresh', 'reminder'], 'prayers, reminders, and the nudge before the schedule runs out');
  assert.equal(result.current.lastSync.status, 'scheduled');
  assert.equal(result.current.lastSync.scheduled, phone.state.scheduled.length);
});

test('with no place only the reminders are scheduled', async () => {
  const phone = fakePhone();
  renderHook(() => useNativeAlarms([reminder()], deps(phone, { readPlace: () => null })));
  await settle();
  assert.ok(phone.state.scheduled.length > 0);
  assert.ok(phone.state.scheduled.every((n) => n.extra.kind === 'reminder' || n.extra.kind === 'refresh'), 'no prayer alert without a place');
  assert.ok(phone.state.scheduled.some((n) => n.extra.kind === 'reminder'));
});

test('an adhan switched off in the prayer settings is left out', async () => {
  const phone = fakePhone();
  const settings = { ...SETTINGS, azanEnabled: { ...SETTINGS.azanEnabled, fajr: false } };
  renderHook(() => useNativeAlarms([], deps(phone, { readSettings: () => settings })));
  await settle();
  assert.ok(phone.state.scheduled.every((n) => n.extra.prayer !== 'fajr'));
  assert.ok(phone.state.scheduled.some((n) => n.extra.prayer === 'dhuhr'));
});

test('the next alarm is reported, for the card to show', async () => {
  const phone = fakePhone();
  const { result } = renderHook(() => useNativeAlarms([], deps(phone)));
  await settle();
  assert.equal(result.current.next.kind, 'adhan');
  assert.ok(result.current.next.at.getTime() > NOW.getTime());
});

test('a change to the reminders schedules again, and a burst of changes becomes one sync', async () => {
  const phone = fakePhone();
  const { rerender } = renderHook(({ reminders }) => useNativeAlarms(reminders, deps(phone)), { initialProps: { reminders: [reminder()] } });
  await settle();
  assert.equal(phone.state.schedules, 1);
  rerender({ reminders: [reminder({ timeString: '06:00' })] });
  rerender({ reminders: [reminder({ timeString: '06:30' })] });
  rerender({ reminders: [reminder({ timeString: '07:00' })] });
  await settle();
  assert.equal(phone.state.schedules, 2, 'three quick edits, one sync');
  const times = phone.state.scheduled.filter((n) => n.extra.kind === 'reminder').map((n) => n.schedule.at.getHours());
  assert.ok(times.every((h) => h === 7), 'it used the last edit');
});

test('a change to the place or a prayer setting, made anywhere, schedules again without needing a tab change', async () => {
  const phone = fakePhone();
  renderHook(() => useNativeAlarms([], deps(phone)));
  await settle();
  assert.equal(phone.state.schedules, 1);
  announcePrayerConfigChange();
  await settle();
  assert.equal(phone.state.schedules, 2);
});

test('several such changes in a row become one sync', async () => {
  const phone = fakePhone();
  renderHook(() => useNativeAlarms([], deps(phone)));
  await settle();
  announcePrayerConfigChange(); announcePrayerConfigChange(); announcePrayerConfigChange();
  await settle();
  assert.equal(phone.state.schedules, 2);
});

test('after leaving, a change is no longer listened for', async () => {
  const phone = fakePhone();
  const { unmount } = renderHook(() => useNativeAlarms([], deps(phone)));
  await settle();
  unmount();
  announcePrayerConfigChange();
  await settle();
  assert.equal(phone.state.schedules, 1);
});

test('coming back to the app from the background tops the alarms up', async () => {
  const phone = fakePhone();
  renderHook(() => useNativeAlarms([], deps(phone)));
  await settle();
  assert.equal(resumeHandlers.length, 1, 'it listens for the app coming back');
  resumeHandlers[0]();
  await settle();
  assert.equal(phone.state.schedules, 2);
});

test('leaving stops listening and stops any sync that was waiting', async () => {
  const phone = fakePhone();
  const { unmount } = renderHook(() => useNativeAlarms([reminder()], deps(phone)));
  unmount();
  assert.equal(resumeHandlers.length, 0);
  await settle();
  assert.equal(phone.state.schedules, 0);
});

// ── permissions ──────────────────────────────────────────────────────────────

test('without permission nothing is scheduled and the status says so', async () => {
  const phone = fakePhone({ display: 'denied', exact: 'denied' });
  const { result } = renderHook(() => useNativeAlarms([reminder()], deps(phone)));
  await settle();
  assert.equal(phone.state.schedules, 0);
  assert.equal(result.current.lastSync.status, 'no-permission');
  assert.deepEqual(result.current.status, { notifications: 'denied', exactAlarms: 'denied' });
});

test('allowing notifications schedules everything straight away and updates the status', async () => {
  const phone = fakePhone({ display: 'prompt' });
  const { result } = renderHook(() => useNativeAlarms([reminder()], deps(phone)));
  await settle();
  assert.equal(phone.state.schedules, 0);
  await act(async () => { await result.current.requestNotifications(); });
  await settle();
  assert.equal(result.current.status.notifications, 'granted');
  assert.equal(phone.state.schedules, 1);
});

test('opening the exact-alarm settings asks the phone, then rereads the status', async () => {
  const phone = fakePhone({ exact: 'denied' });
  const { result } = renderHook(() => useNativeAlarms([], deps(phone)));
  await settle();
  phone.state.exact = 'granted'; // the person allowed it in the system screen
  await act(async () => { await result.current.openExactSettings(); });
  assert.equal(phone.state.changeExact, 1);
  assert.equal(result.current.status.exactAlarms, 'granted');
});

test('the test alert is scheduled on request and does not disturb the real schedule', async () => {
  const phone = fakePhone();
  const { result } = renderHook(() => useNativeAlarms([reminder()], deps(phone)));
  await settle();
  const before = phone.state.scheduled.length;
  let outcome;
  await act(async () => { outcome = await result.current.sendTest(); });
  assert.equal(outcome.status, 'scheduled');
  assert.equal(phone.state.scheduled.length, before + 1);
  assert.equal(phone.state.scheduled.at(-1).id, TEST_ALARM_ID);
});

test('a failing phone never breaks the screen', async () => {
  const phone = { ...fakePhone(), schedule: async () => { throw new Error('boom'); } };
  const { result } = renderHook(() => useNativeAlarms([reminder()], deps(phone)));
  await settle();
  assert.equal(result.current.lastSync.status, 'error');
  assert.match(result.current.lastSync.error, /boom/);
});
