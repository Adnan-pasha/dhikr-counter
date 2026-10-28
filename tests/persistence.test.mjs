import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

process.env.NODE_ENV = 'development'; // StrictMode double-invokes effects only in React's development build
// Browser globals must exist before React, Testing Library and the app modules load.
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://app.test/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.localStorage = dom.window.localStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import('react')).default;
const { renderHook, act, cleanup } = await import('@testing-library/react');
const { usePersistentAppState } = await import('../src/hooks.ts');
const { DEFAULT_ROUTINES } = await import('../src/adhkaar-data.ts');

const DEFAULT_PREFS = {
  soundOn: true, soundTone: 'wooden', vibrateOn: true, autoAdvance: true, theme: 'emerald', colorMode: 'dark',
  volume: 0.5, madhab: 'shafi',
};

/** Mirrors App.tsx: state lives in the caller, the hook hydrates from and persists to localStorage. */
const useHarness = () => {
  const [dhikrs, setDhikrs] = React.useState([]);
  const [currentDhikrId, setCurrentDhikrId] = React.useState('subhanallah');
  const [currentCount, setCurrentCount] = React.useState(0);
  const [history, setHistory] = React.useState([]);
  const [preferences, setPreferences] = React.useState(DEFAULT_PREFS);
  const [reminders, setReminders] = React.useState([]);
  const [streak, setStreak] = React.useState(0);
  const [favouriteIds, setFavouriteIds] = React.useState([]);
  const [routines, setRoutines] = React.useState([]);
  const [salahLogs, setSalahLogs] = React.useState([]);

  usePersistentAppState(
    { defaultDhikrs: [{ id: 'subhanallah', nameAr: 'x', nameEn: 'SubhanAllah', meaning: 'm', targetCount: 33 }], defaultPreferences: DEFAULT_PREFS, defaultReminders: [] },
    { setDhikrs, setCurrentDhikrId, setCurrentCount, setHistory, setPreferences, setReminders, setStreak, setFavouriteIds, setRoutines, setSalahLogs },
    { dhikrs, currentDhikrId, currentCount, history, preferences, reminders, favouriteIds, routines, salahLogs },
  );
  return { routines, favouriteIds, setRoutines, setFavouriteIds, streak };
};

const strictWrapper = ({ children }) => React.createElement(React.StrictMode, null, children);

test.beforeEach(() => { localStorage.clear(); });
test.afterEach(() => { cleanup(); });

test('first launch hydrates the built-in routines and stores them (StrictMode double effects)', async () => {
  const { result } = renderHook(useHarness, { wrapper: strictWrapper });
  await act(async () => {});
  assert.equal(result.current.routines.length, DEFAULT_ROUTINES.length);
  const stored = JSON.parse(localStorage.getItem('tasbih_routines'));
  assert.equal(stored.length, DEFAULT_ROUTINES.length, 'storage holds the defaults, not the empty initial state');
  assert.ok(stored.every((r) => typeof r.icon === 'string' && !('emoji' in r)), 'stored routines use icon keys');
});

test('saved favourites survive a remount in StrictMode', async () => {
  localStorage.setItem('tasbih_favourites', JSON.stringify(['a', 'b']));
  const first = renderHook(useHarness, { wrapper: strictWrapper });
  await act(async () => {});
  assert.deepEqual(first.result.current.favouriteIds, ['a', 'b']);
  assert.deepEqual(JSON.parse(localStorage.getItem('tasbih_favourites')), ['a', 'b']);
  first.unmount();
  const second = renderHook(useHarness, { wrapper: strictWrapper });
  await act(async () => {});
  assert.deepEqual(second.result.current.favouriteIds, ['a', 'b']);
});

test('a user who deleted every routine keeps an empty list', async () => {
  localStorage.setItem('tasbih_routines', '[]');
  const { result } = renderHook(useHarness, { wrapper: strictWrapper });
  await act(async () => {});
  assert.deepEqual(result.current.routines, []);
  assert.equal(localStorage.getItem('tasbih_routines'), '[]');
});

test('legacy emoji routines are upgraded to icon keys on load', async () => {
  localStorage.setItem('tasbih_routines', JSON.stringify([
    { id: 'r1', name: 'Dawn', emoji: '🌅', dhikrIds: ['a'], createdAt: '2026-01-01T00:00:00.000Z' },
  ]));
  const { result } = renderHook(useHarness, { wrapper: strictWrapper });
  await act(async () => {});
  assert.equal(result.current.routines[0].icon, 'sunrise');
  assert.equal('emoji' in result.current.routines[0], false);
  assert.equal(JSON.parse(localStorage.getItem('tasbih_routines'))[0].icon, 'sunrise');
});

test('changes made after hydration are persisted', async () => {
  const { result } = renderHook(useHarness, { wrapper: strictWrapper });
  await act(async () => {});
  await act(async () => { result.current.setFavouriteIds(['z']); });
  assert.deepEqual(JSON.parse(localStorage.getItem('tasbih_favourites')), ['z']);
});
