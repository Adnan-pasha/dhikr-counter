import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

process.env.NODE_ENV = 'development';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://app.test/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.localStorage = dom.window.localStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import('react')).default;
const { renderHook, act, cleanup } = await import('@testing-library/react');
const { useCounterFlow, ADVANCE_DELAY_MS } = await import('../src/hooks.ts');
const { resolveActiveRoutine } = await import('../src/routines.ts');
const { ADHKAAR_LIBRARY, DEFAULT_ROUTINES } = await import('../src/adhkaar-data.ts');

const PREFS = {
  soundOn: false, soundTone: 'wooden', vibrateOn: false, autoAdvance: true, theme: 'emerald', colorMode: 'dark',
  volume: 0.5, madhab: 'shafi', completionSoundOn: false, hapticStrength: 'medium',
};
const lookup = (id) => ADHKAAR_LIBRARY.find((d) => d.id === id);

/** What App.tsx does: the started routine decides the sequence, the hook drives the counter. */
const useApp = ({ startedRoutineId, startId, startHistory = [] }) => {
  const [currentDhikrId, setCurrentDhikrId] = React.useState(startId);
  const [currentCount, setCurrentCount] = React.useState(0);
  const [history, setHistory] = React.useState(startHistory);
  const [, setConfirmModal] = React.useState(null);
  const routine = resolveActiveRoutine(DEFAULT_ROUTINES, startedRoutineId, currentDhikrId);
  const activeRoutine = routine ? routine.dhikrIds.map(lookup) : null;
  const flow = useCounterFlow({
    activeDhikr: lookup(currentDhikrId), currentCount, preferences: PREFS, dhikrs: ADHKAAR_LIBRARY, currentDhikrId,
    activeRoutine, setCurrentCount, setCurrentDhikrId, setHistory, setConfirmModal,
  });
  return { ...flow, currentDhikrId, currentCount, history };
};

test.beforeEach(() => { mock.timers.enable({ apis: ['setTimeout'] }); });
test.afterEach(() => { cleanup(); mock.timers.reset(); });
test.after(() => { dom.window.close(); });

/** Counts every dhikr of a routine to its target, moving on each time, and reports the order it saw. */
const runRoutine = async (result, routine) => {
  const seen = [result.current.currentDhikrId];
  for (let i = 0; i < routine.dhikrIds.length; i += 1) {
    const target = lookup(result.current.currentDhikrId).targetCount;
    for (let tap = 0; tap < target; tap += 1) await act(async () => { result.current.handleIncrement(); });
    if (i < routine.dhikrIds.length - 1) {
      await act(async () => { mock.timers.tick(ADVANCE_DELAY_MS + 1); });
      seen.push(result.current.currentDhikrId);
    }
  }
  return seen;
};

const doneToday = (routine) => routine.dhikrIds.map((id, i) => ({
  id: `earlier-${i}`, dhikrId: id, dhikrName: id, count: lookup(id).targetCount, timestamp: new Date().toISOString(),
}));

for (const routine of DEFAULT_ROUTINES) {
  test(`${routine.name}: every dhikr comes in the routine's own order, then it is finished`, async () => {
    const { result } = renderHook(() => useApp({ startedRoutineId: routine.id, startId: routine.dhikrIds[0] }));
    const seen = await runRoutine(result, routine);
    assert.deepEqual(seen, routine.dhikrIds);
    assert.equal(result.current.routineComplete, true, 'the last dhikr reached its target');
    assert.deepEqual(result.current.history.map((h) => h.dhikrId), routine.dhikrIds, 'each was logged once, in order');
  });

  test(`${routine.name}: run again later the same day it goes through all of it again, nothing skipped or stuck`, async () => {
    const { result } = renderHook(() => useApp({ startedRoutineId: routine.id, startId: routine.dhikrIds[0], startHistory: doneToday(routine) }));
    const seen = await runRoutine(result, routine);
    assert.deepEqual(seen, routine.dhikrIds);
    assert.equal(result.current.routineComplete, true);
    assert.equal(result.current.history.length, routine.dhikrIds.length * 2, 'the second run is logged too');
  });
}

test('After Salah goes from Allahu Akbar to Ayatul Kursi, even though Morning also contains SubhanAllah', async () => {
  const after = DEFAULT_ROUTINES.find((r) => r.id === 'routine-after-salah');
  const { result } = renderHook(() => useApp({ startedRoutineId: after.id, startId: 'allahuakbar' }));
  assert.deepEqual(result.current.upcoming.map((d) => d.id), ['ayatul-kursi', 'dua-good-deed']);
  for (let i = 0; i < 34; i += 1) await act(async () => { result.current.handleIncrement(); });
  assert.equal(result.current.pendingNext?.id, 'ayatul-kursi');
  await act(async () => { mock.timers.tick(ADVANCE_DELAY_MS + 1); });
  assert.equal(result.current.currentDhikrId, 'ayatul-kursi');
});

test('the same dhikr started from the Morning routine follows Morning, not After Salah', async () => {
  const { result } = renderHook(() => useApp({ startedRoutineId: 'routine-morning', startId: 'allahuakbar' }));
  assert.deepEqual(result.current.upcoming.map((d) => d.id), ['darood-ibrahim']);
});

test('a dhikr picked on its own, with no routine, is not pulled into one', async () => {
  const { result } = renderHook(() => useApp({ startedRoutineId: null, startId: 'darood-ibrahim' }));
  assert.equal(result.current.routineComplete, false);
  for (let i = 0; i < 10; i += 1) await act(async () => { result.current.handleIncrement(); });
  assert.equal(result.current.routineComplete, false, 'finishing a single dhikr is not finishing a routine');
});

test('the last dhikr of a routine stays on screen and says the routine is complete', async () => {
  const after = DEFAULT_ROUTINES.find((r) => r.id === 'routine-after-salah');
  const { result } = renderHook(() => useApp({ startedRoutineId: after.id, startId: 'darood-ibrahim' }));
  for (let i = 0; i < 10; i += 1) await act(async () => { result.current.handleIncrement(); });
  await act(async () => { mock.timers.tick(ADVANCE_DELAY_MS * 3); });
  assert.equal(result.current.currentDhikrId, 'darood-ibrahim', 'nothing to move on to');
  assert.equal(result.current.routineComplete, true);
  assert.equal(result.current.pendingNext, null);
});
