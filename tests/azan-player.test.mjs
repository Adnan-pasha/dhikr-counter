import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

process.env.NODE_ENV = 'development';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://app.test/', pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const created = [];
let playOutcome = 'ok';
class FakeAudio {
  constructor(src) {
    this.src = src; this.paused = true; this.currentTime = 0; this.listeners = {};
    created.push(this);
  }
  addEventListener(name, fn) { this.listeners[name] = fn; }
  pause() { this.paused = true; }
  play() {
    if (playOutcome === 'blocked') return Promise.reject(new Error('NotAllowedError'));
    this.paused = false;
    return Promise.resolve();
  }
  finish() { this.paused = true; this.listeners.ended?.(); }
}
globalThis.Audio = FakeAudio;

const { renderHook, act, cleanup } = await import('@testing-library/react');
const { useAzanPlayer } = await import('../src/useAzanPlayer.ts');

test.beforeEach(() => { created.length = 0; playOutcome = 'ok'; });
test.afterEach(() => cleanup());
test.after(() => { dom.window.close(); });

test('play starts the bundled adhan and reports it as playing', async () => {
  const { result } = renderHook(() => useAzanPlayer('makkah'));
  await act(async () => { result.current.play(); });
  assert.equal(created.length, 1);
  assert.match(created[0].src, /audio\/azan-makkah\.m4a$/);
  assert.equal(result.current.playing, true);
  assert.equal(result.current.error, null);
});

test('Fajr always plays its own adhan, whatever voice is chosen', async () => {
  const { result } = renderHook(() => useAzanPlayer('madinah'));
  await act(async () => { result.current.play('fajr'); });
  assert.match(created[0].src, /audio\/azan-fajr\.m4a$/);
});

test('the other four prayers play the chosen voice', async () => {
  const { result } = renderHook(() => useAzanPlayer('madinah'));
  for (const prayer of ['dhuhr', 'asr', 'maghrib', 'isha']) {
    await act(async () => { result.current.play(prayer); });
    assert.match(created[created.length - 1].src, /audio\/azan-madinah\.m4a$/, prayer);
  }
});

test('a preview can play a voice other than the chosen one', async () => {
  const { result } = renderHook(() => useAzanPlayer('makkah'));
  await act(async () => { result.current.play(undefined, 'madinah'); });
  assert.match(created[0].src, /audio\/azan-madinah\.m4a$/);
});

test('it stops when the recording ends', async () => {
  const { result } = renderHook(() => useAzanPlayer());
  await act(async () => { result.current.play(); });
  await act(async () => { created[0].finish(); });
  assert.equal(result.current.playing, false);
});

test('stop pauses and rewinds', async () => {
  const { result } = renderHook(() => useAzanPlayer());
  await act(async () => { result.current.play(); });
  await act(async () => { result.current.stop(); });
  assert.equal(created[0].paused, true);
  assert.equal(created[0].currentTime, 0);
  assert.equal(result.current.playing, false);
});

test('playing again never layers a second adhan over the first', async () => {
  const { result } = renderHook(() => useAzanPlayer());
  await act(async () => { result.current.play(); });
  await act(async () => { result.current.play(); });
  assert.equal(created.length, 2);
  assert.equal(created[0].paused, true, 'the first was stopped');
  assert.equal(created[1].paused, false);
});

test('a blocked or failed play says so instead of failing silently', async () => {
  playOutcome = 'blocked';
  const { result } = renderHook(() => useAzanPlayer());
  await act(async () => { result.current.play(); });
  assert.equal(result.current.playing, false);
  assert.match(result.current.error, /could not play|tap/i);
});

test('leaving the screen stops the adhan', async () => {
  const { result, unmount } = renderHook(() => useAzanPlayer());
  await act(async () => { result.current.play(); });
  unmount();
  assert.equal(created[0].paused, true);
});
