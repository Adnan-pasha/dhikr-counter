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
const vibrations = [];
dom.window.navigator.vibrate = (pattern) => { vibrations.push(pattern); return true; };

const React = (await import('react')).default;
const { renderHook, act, cleanup } = await import('@testing-library/react');
const { useCounterFlow, ADVANCE_DELAY_MS } = await import('../src/hooks.ts');

const dhikr = (id, targetCount) => ({ id, nameAr: id, nameEn: id, meaning: id, targetCount });
const A = dhikr('a', 3);
const B = dhikr('b', 2);
const C = dhikr('c', 0); // free counter
const PREFS = {
  soundOn: false, soundTone: 'wooden', vibrateOn: true, autoAdvance: true, theme: 'emerald', colorMode: 'dark',
  volume: 0.5, madhab: 'shafi', completionSoundOn: false, hapticStrength: 'medium',
};

/** Mirrors App.tsx: state in the caller, the hook drives it. */
const useHarness = ({ routine = [A, B], preferences = PREFS, startId = 'a', startCount = 0, startHistory = [] } = {}) => {
  const [currentDhikrId, setCurrentDhikrId] = React.useState(startId);
  const [currentCount, setCurrentCount] = React.useState(startCount);
  const [history, setHistory] = React.useState(startHistory);
  const [confirmModal, setConfirmModal] = React.useState(null);
  const sequence = routine;
  const activeDhikr = sequence.find((d) => d.id === currentDhikrId) ?? sequence[0];
  const flow = useCounterFlow({
    activeDhikr, currentCount, preferences, dhikrs: sequence, currentDhikrId,
    activeRoutine: routine.length > 1 ? routine : null, history,
    setCurrentCount, setCurrentDhikrId, setHistory, setConfirmModal,
  });
  return { ...flow, currentDhikrId, currentCount, history, setCurrentDhikrId, confirmModal };
};

const strict = ({ children }) => React.createElement(React.StrictMode, null, children);
const mount = (props) => renderHook(() => useHarness(props), { wrapper: strict });

test.beforeEach(() => { vibrations.length = 0; mock.timers.enable({ apis: ['setTimeout'] }); });
test.afterEach(() => { cleanup(); mock.timers.reset(); });

const tap = async (result, times = 1) => { for (let i = 0; i < times; i += 1) await act(async () => { result.current.handleIncrement(); }); };

test('a tap adds one to the count', async () => {
  const { result } = mount();
  await tap(result, 2);
  assert.equal(result.current.currentCount, 2);
});

test('completing a round logs it once with the dhikr and target', async () => {
  const { result } = mount();
  await tap(result, 3);
  assert.equal(result.current.currentCount, 3);
  assert.equal(result.current.history.length, 1);
  assert.equal(result.current.history[0].dhikrId, 'a');
  assert.equal(result.current.history[0].count, 3);
});

test('after the pause the counter moves to the next dhikr from zero', async () => {
  const { result } = mount();
  await tap(result, 3);
  assert.equal(result.current.currentDhikrId, 'a', 'still on the finished dhikr during the pause');
  await act(async () => { mock.timers.tick(ADVANCE_DELAY_MS + 1); });
  assert.equal(result.current.currentDhikrId, 'b');
  assert.equal(result.current.currentCount, 0);
});

test('undo within the pause removes the completion, restores the count and cancels the advance', async () => {
  const { result } = mount();
  await tap(result, 3);
  await act(async () => { result.current.handleUndo(); });
  assert.equal(result.current.currentCount, 2);
  assert.equal(result.current.history.length, 0, 'the round log is removed');
  await act(async () => { mock.timers.tick(ADVANCE_DELAY_MS * 3); });
  assert.equal(result.current.currentDhikrId, 'a', 'no advance happens');
  assert.equal(result.current.currentCount, 2);
});

test('undo mid-round only lowers the count', async () => {
  const { result } = mount();
  await tap(result, 2);
  await act(async () => { result.current.handleUndo(); });
  assert.equal(result.current.currentCount, 1);
  assert.equal(result.current.history.length, 0);
});

test('undo at zero does nothing', async () => {
  const { result } = mount();
  await act(async () => { result.current.handleUndo(); });
  assert.equal(result.current.currentCount, 0);
});

test('a tap during the pause moves on immediately and counts for the next dhikr', async () => {
  const { result } = mount();
  await tap(result, 3);
  await tap(result, 1);
  assert.equal(result.current.currentDhikrId, 'b');
  assert.equal(result.current.currentCount, 1, 'the tap counted for b');
  await act(async () => { mock.timers.tick(ADVANCE_DELAY_MS * 3); });
  assert.equal(result.current.currentDhikrId, 'b', 'the old timer does not fire again');
  assert.equal(result.current.currentCount, 1);
});

test('switching dhikr by hand cancels a pending advance', async () => {
  const { result } = mount({ routine: [A, B, dhikr('d', 5)] });
  await tap(result, 3);
  await act(async () => { result.current.setCurrentDhikrId('d'); });
  await act(async () => { mock.timers.tick(ADVANCE_DELAY_MS * 3); });
  assert.equal(result.current.currentDhikrId, 'd', 'stays on the chosen dhikr');
});

test('the advance skips dhikr already completed today', async () => {
  const done = [{ id: 'h1', dhikrId: 'b', dhikrName: 'b', count: 2, timestamp: new Date().toISOString() }];
  const { result } = mount({ routine: [A, B, dhikr('d', 5)], startHistory: done });
  await tap(result, 3);
  await act(async () => { mock.timers.tick(ADVANCE_DELAY_MS + 1); });
  assert.equal(result.current.currentDhikrId, 'd');
});

test('the last dhikr of a routine stays put instead of looping', async () => {
  const { result } = mount({ startId: 'b' });
  await tap(result, 2);
  await act(async () => { mock.timers.tick(ADVANCE_DELAY_MS * 3); });
  assert.equal(result.current.currentDhikrId, 'b');
  assert.equal(result.current.history.length, 1);
});

test('with auto-advance off the count keeps going and every round is logged', async () => {
  const { result } = mount({ preferences: { ...PREFS, autoAdvance: false } });
  await tap(result, 7);
  assert.equal(result.current.currentCount, 7);
  assert.equal(result.current.history.length, 2, 'rounds at 3 and 6');
  assert.equal(result.current.currentDhikrId, 'a');
});

test('undoing a later round removes only that round', async () => {
  const { result } = mount({ preferences: { ...PREFS, autoAdvance: false } });
  await tap(result, 6);
  await act(async () => { result.current.handleUndo(); });
  assert.equal(result.current.currentCount, 5);
  assert.equal(result.current.history.length, 1);
});

test('a free counter never completes or advances', async () => {
  const { result } = mount({ routine: [C], startId: 'c' });
  await tap(result, 12);
  assert.equal(result.current.currentCount, 12);
  assert.equal(result.current.history.length, 0);
});

test('rapid taps inside one batch are all counted', async () => {
  const { result } = mount({ preferences: { ...PREFS, autoAdvance: false } });
  await act(async () => { result.current.handleIncrement(); result.current.handleIncrement(); result.current.handleIncrement(); });
  assert.equal(result.current.currentCount, 3);
});

test('haptics step up from tap to milestone to completion and respect the toggle', async () => {
  const { result } = mount({ preferences: { ...PREFS, autoAdvance: false }, routine: [dhikr('x', 12)], startId: 'x' });
  await tap(result, 12);
  assert.equal(typeof vibrations[0], 'number');
  assert.ok(vibrations[9] > vibrations[0], 'tenth tap is a stronger milestone');
  assert.ok(Array.isArray(vibrations[11]), 'twelfth tap completes the round');
  cleanup();
  vibrations.length = 0;
  const quiet = mount({ preferences: { ...PREFS, vibrateOn: false } });
  await tap(quiet.result, 3);
  assert.equal(vibrations.length, 0);
});

test('upcoming shows the next pending dhikr and canUndo follows the count', async () => {
  const { result } = mount({ routine: [A, B, dhikr('d', 5)] });
  assert.deepEqual(result.current.upcoming.map((d) => d.id), ['b', 'd']);
  assert.equal(result.current.canUndo, false);
  await tap(result, 1);
  assert.equal(result.current.canUndo, true);
});

test('reset asks for confirmation and cancels a pending advance', async () => {
  const { result } = mount();
  await tap(result, 3);
  await act(async () => { result.current.handleReset(); });
  assert.ok(result.current.confirmModal, 'confirm dialog shown');
  await act(async () => { result.current.confirmModal.onConfirm(); });
  assert.equal(result.current.currentCount, 0);
  await act(async () => { mock.timers.tick(ADVANCE_DELAY_MS * 3); });
  assert.equal(result.current.currentDhikrId, 'a', 'reset also cancelled the advance');
});

test('pendingNext names the dhikr being moved to during the pause and clears afterwards', async () => {
  const { result } = mount();
  assert.equal(result.current.pendingNext, null);
  await tap(result, 3);
  assert.equal(result.current.pendingNext?.id, 'b');
  await act(async () => { mock.timers.tick(ADVANCE_DELAY_MS + 1); });
  assert.equal(result.current.pendingNext, null);
  await tap(result, 2);
  await act(async () => { result.current.handleUndo(); });
  assert.equal(result.current.pendingNext, null, 'undo clears the hint');
});
