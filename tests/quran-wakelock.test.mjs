import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

process.env.NODE_ENV = 'development';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://app.test/', pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { renderHook, act, cleanup } = await import('@testing-library/react');
const { useWakeLock } = await import('../src/quran/useWakeLock.ts');

const install = () => {
  const locks = [];
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: {
      request: async () => {
        const lock = { released: false, listeners: {} };
        lock.release = async () => { lock.released = true; };
        lock.addEventListener = (type, fn) => { lock.listeners[type] = fn; };
        locks.push(lock);
        return lock;
      },
    },
  });
  return locks;
};

test.afterEach(() => { cleanup(); delete navigator.wakeLock; });

test('the screen lock is taken while active and released on unmount', async () => {
  const locks = install();
  const { unmount } = renderHook(() => useWakeLock(true));
  await act(async () => {});
  assert.equal(locks.length, 1);
  unmount();
  assert.equal(locks[0].released, true);
});

test('nothing is requested while inactive, or where the browser has no wake lock', async () => {
  const locks = install();
  renderHook(() => useWakeLock(false));
  await act(async () => {});
  assert.equal(locks.length, 0);
  delete navigator.wakeLock;
  renderHook(() => useWakeLock(true));
  await act(async () => {});
});

test('coming back to the page takes a fresh lock and releases the old one first', async () => {
  const locks = install();
  renderHook(() => useWakeLock(true));
  await act(async () => {});
  await act(async () => { document.dispatchEvent(new dom.window.Event('visibilitychange')); });
  assert.equal(locks.length, 2);
  assert.equal(locks[0].released, true, 'the earlier lock is not leaked');
});

test('a lock the system drops while the page is visible is taken again', async () => {
  const locks = install();
  renderHook(() => useWakeLock(true));
  await act(async () => {});
  await act(async () => { locks[0].listeners.release?.(); });
  assert.equal(locks.length, 2);
});
