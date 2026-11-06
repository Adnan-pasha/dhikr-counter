import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

process.env.NODE_ENV = 'development';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://app.test/', pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
const realStorage = dom.window.localStorage;
globalThis.localStorage = realStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import('react')).default;
const { render, screen, fireEvent, cleanup } = await import('@testing-library/react');
const { sanitizeReminders, safeSetItem, alignPrayerMadhab, readPrayerSettings, DEFAULT_PRAYER_SETTINGS } = await import('../src/domain.ts');
const { onPrayerConfigChange } = await import('../src/prayerConfigEvents.ts');
const { default: AppErrorBoundary } = await import('../src/components/AppErrorBoundary.tsx');

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test.beforeEach(() => { globalThis.localStorage = realStorage; realStorage.clear(); });
test.afterEach(() => cleanup());
test.after(() => { dom.window.close(); });

const DEFAULTS = [{ id: 'd', dhikrId: 'x', dhikrName: 'X', timeString: '05:15', days: ['mon'], label: 'Default', isEnabled: true }];
const mine = { id: 'm', dhikrId: 'x', dhikrName: 'X', timeString: '09:00', days: ['mon'], label: 'Mine', isEnabled: true };

// ── deleted reminders stay deleted ──

test('an emptied reminder list stays empty instead of bringing the defaults back', () => {
  assert.deepEqual(sanitizeReminders([], DEFAULTS), []);
});

test('a missing or wholly corrupt list still falls back to the defaults, and a real list is kept', () => {
  assert.deepEqual(sanitizeReminders(undefined, DEFAULTS), DEFAULTS);
  assert.deepEqual(sanitizeReminders('nonsense', DEFAULTS), DEFAULTS);
  assert.deepEqual(sanitizeReminders([{ id: 1 }, null], DEFAULTS), DEFAULTS, 'entries that are all unusable mean the data is corrupt');
  assert.deepEqual(sanitizeReminders([mine, { id: 1 }], DEFAULTS), [mine], 'a bad entry is dropped, the good one kept');
});

// ── a full or blocked phone store does not crash the app ──

test('a storage write that fails reports failure instead of throwing', () => {
  globalThis.localStorage = { setItem() { throw new dom.window.DOMException('full', 'QuotaExceededError'); }, getItem: () => null, removeItem() {}, clear() {} };
  assert.equal(safeSetItem('k', 'v'), false);
  globalThis.localStorage = realStorage;
  assert.equal(safeSetItem('k', 'v'), true);
  assert.equal(realStorage.getItem('k'), 'v');
});

test('every saving effect in the app goes through the safe write', () => {
  const hooks = read('src/hooks.ts');
  const region = hooks.slice(hooks.indexOf('// Persist only after hydration'), hooks.indexOf('interface DhikrActionDeps'));
  assert.ok(region.length > 500, 'found the saving effects');
  assert.doesNotMatch(region, /localStorage\.setItem\(/);
  assert.match(region, /safeSetItem\('tasbih_history'/);
});

// ── one madhab for the screen and the phone's alarms ──

test('the madhab chosen in Settings reaches the prayer settings the alarms are planned from', () => {
  readPrayerSettings('shafi'); // saved while the preference still said shafi
  const changes = [];
  const stop = onPrayerConfigChange(() => changes.push(1));
  alignPrayerMadhab('hanafi');
  assert.equal(JSON.parse(realStorage.getItem('tasbih_prayer_settings')).madhab, 'hanafi');
  assert.equal(changes.length, 1, 'the alarms are told to plan again');
  alignPrayerMadhab('hanafi');
  assert.equal(changes.length, 1, 'nothing to change, nothing announced');
  stop();
});

test('aligning keeps the other prayer settings', () => {
  realStorage.setItem('tasbih_prayer_settings', JSON.stringify({ ...DEFAULT_PRAYER_SETTINGS, calculationMethod: 'MWL', azanSound: 'madinah' }));
  alignPrayerMadhab('hanafi');
  const saved = JSON.parse(realStorage.getItem('tasbih_prayer_settings'));
  assert.equal(saved.calculationMethod, 'MWL');
  assert.equal(saved.azanSound, 'madinah');
  assert.equal(saved.madhab, 'hanafi');
});

test('the app aligns the madhab once its saved data has loaded, and again whenever it changes', () => {
  const hooks = read('src/hooks.ts');
  assert.match(hooks, /alignPrayerMadhab\(state\.preferences\.madhab\)/);
  assert.match(hooks, /\[hydrated, state\.preferences\.madhab\]/);
});

// ── erasing everything also clears the phone's alarms ──

test('erasing all data tells the alarms to plan again, so no old alert rings afterwards', () => {
  const hooks = read('src/hooks.ts');
  const after = hooks.slice(hooks.indexOf('localStorage.clear();'));
  assert.match(after.slice(0, 200), /announcePrayerConfigChange\(\)/);
});

// ── the crash screen's Reset Data asks first ──

const Boom = () => { throw new Error('boom'); };
const crash = () => {
  const quiet = console.error;
  console.error = () => {};
  const view = render(React.createElement(AppErrorBoundary, null, React.createElement(Boom)));
  console.error = quiet;
  return view;
};

test('Reset Data on the crash screen does not erase anything until it is confirmed', () => {
  realStorage.setItem('tasbih_history', '[1]');
  crash();
  fireEvent.click(screen.getByRole('button', { name: 'Reset Data' }));
  assert.equal(realStorage.getItem('tasbih_history'), '[1]', 'one tap only asks');
  assert.match(document.body.textContent, /cannot be undone|erase/i);
  fireEvent.click(screen.getByRole('button', { name: /Keep my data|Cancel/ }));
  assert.equal(realStorage.getItem('tasbih_history'), '[1]');
  assert.ok(screen.getByRole('button', { name: 'Reset Data' }), 'back to the first choice');
});

test('after confirming, the data is erased', () => {
  realStorage.setItem('tasbih_history', '[1]');
  crash();
  fireEvent.click(screen.getByRole('button', { name: 'Reset Data' }));
  fireEvent.click(screen.getByRole('button', { name: /Erase everything/ }));
  assert.equal(realStorage.getItem('tasbih_history'), null);
});
