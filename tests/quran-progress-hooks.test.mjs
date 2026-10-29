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

const { renderHook, act, cleanup } = await import('@testing-library/react');
const { useQuranProgress, PROGRESS_KEY } = await import('../src/quran/useQuranProgress.ts');
const { useReadingClock, FLUSH_SECONDS } = await import('../src/quran/useReadingClock.ts');
const { IDLE_MS } = await import('../src/quran/progress.ts');

const setVisibility = (state) => Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });

test.afterEach(() => { cleanup(); localStorage.clear(); mock.timers.reset(); setVisibility('visible'); });

// ── store ─────────────────────────────────────────────────────────────────────

test('progress starts empty and is remembered across visits', () => {
  const first = renderHook(() => useQuranProgress());
  assert.equal(first.result.current.progress.goalMinutes, null);
  act(() => first.result.current.actions.setGoal(10));
  first.unmount();
  const second = renderHook(() => useQuranProgress());
  assert.equal(second.result.current.progress.goalMinutes, 10);
  assert.equal(JSON.parse(localStorage.getItem(PROGRESS_KEY)).goalMinutes, 10);
});

test('damaged stored data falls back safely', () => {
  localStorage.setItem(PROGRESS_KEY, '{not json');
  assert.equal(renderHook(() => useQuranProgress()).result.current.progress.goalMinutes, null);
  cleanup();
  localStorage.setItem(PROGRESS_KEY, JSON.stringify({ goalMinutes: 15, log: 'junk', furthest: 'x' }));
  const { result } = renderHook(() => useQuranProgress());
  assert.equal(result.current.progress.goalMinutes, 15);
  assert.deepEqual(result.current.progress.log, []);
});

test('actions update reading time, position and the khatam plan', () => {
  const { result } = renderHook(() => useQuranProgress());
  act(() => result.current.actions.addSeconds('2026-03-20', 90));
  act(() => result.current.actions.recordPosition({ surah: 2, ayah: 5, global: 12 }));
  act(() => result.current.actions.startKhatam('2026-03-20', 30));
  const p = result.current.progress;
  assert.equal(p.log[0].seconds, 90);
  assert.equal(p.position.ayah, 5);
  assert.equal(p.khatam.days, 30);
  act(() => result.current.actions.endKhatam());
  assert.equal(result.current.progress.khatam, null);
});

test('the span of ayat on screen reaches the store, not only the position', () => {
  const { result } = renderHook(() => useQuranProgress());
  act(() => result.current.actions.recordPosition({ surah: 1, ayah: 6, global: 6 }, { from: 6, to: 7 }));
  assert.deepEqual(result.current.progress.read, [[6, 7]], 'ayah 7 was on screen, so it counts as read');
  assert.deepEqual(JSON.parse(localStorage.getItem(PROGRESS_KEY)).read, [[6, 7]]);
});

test('reset forgets everything, in memory and on disk', () => {
  const { result } = renderHook(() => useQuranProgress());
  act(() => result.current.actions.setGoal(5));
  act(() => result.current.actions.reset());
  assert.equal(result.current.progress.goalMinutes, null);
  assert.equal(JSON.parse(localStorage.getItem(PROGRESS_KEY)).goalMinutes, null);
});

// ── reading clock ─────────────────────────────────────────────────────────────

const mountClock = (active = true) => {
  mock.timers.enable({ apis: ['setInterval', 'setTimeout', 'Date'], now: 1_000_000 });
  const credits = [];
  const hook = renderHook(({ on }) => useReadingClock({ active: on, onCredit: (s, date) => credits.push([s, date]) }), { initialProps: { on: active } });
  const total = () => credits.reduce((sum, [s]) => sum + s, 0);
  return { ...hook, credits, total };
};

test('every second of active reading is counted and handed over in small batches', () => {
  const { credits, total } = mountClock();
  mock.timers.tick(FLUSH_SECONDS * 1000);
  assert.equal(total(), FLUSH_SECONDS);
  assert.equal(credits.length, 1, 'one batch, not one call per second');
  assert.match(credits[0][1], /^\d{4}-\d{2}-\d{2}$/, 'credited to a local date');
});

test('nothing counts while the reader is closed', () => {
  const { total } = mountClock(false);
  mock.timers.tick(60_000);
  assert.equal(total(), 0);
});

test('time stops after the idle limit and resumes when the reader is touched', () => {
  const { total } = mountClock();
  mock.timers.tick(IDLE_MS + 10_000);
  const afterIdle = total();
  assert.ok(afterIdle <= IDLE_MS / 1000 + 1, `idle time is not counted (got ${afterIdle})`);
  mock.timers.tick(20_000);
  assert.equal(total(), afterIdle, 'still idle, still nothing');
  document.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true }));
  mock.timers.tick((FLUSH_SECONDS + 1) * 1000);
  assert.ok(total() > afterIdle, 'touching starts the clock again');
});

test('a hidden page does not count', () => {
  const { total } = mountClock();
  mock.timers.tick(3_000);
  setVisibility('hidden');
  document.dispatchEvent(new dom.window.Event('visibilitychange'));
  const before = total();
  mock.timers.tick(20_000);
  assert.equal(total(), before);
});

test('coming back to the app is not reading: no free credit without a touch', () => {
  const { total } = mountClock();
  mock.timers.tick(1_000);
  setVisibility('hidden');
  document.dispatchEvent(new dom.window.Event('visibilitychange'));
  const reported = total();
  mock.timers.tick(20_000);
  setVisibility('visible');
  document.dispatchEvent(new dom.window.Event('visibilitychange'));
  mock.timers.tick(25_000);
  assert.equal(total(), reported, 'switching apps and back, then doing nothing, earns nothing');
  document.dispatchEvent(new dom.window.Event('wheel', { bubbles: true }));
  mock.timers.tick((FLUSH_SECONDS + 1) * 1000);
  assert.ok(total() > reported, 'a real touch starts the clock again');
});

test('leaving the reader hands over the seconds not yet reported', () => {
  const { unmount, total } = mountClock();
  mock.timers.tick(3_000);
  assert.equal(total(), 0, 'not flushed yet');
  unmount();
  assert.equal(total(), 3);
});
