import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const PLACEHOLDER = "/*__BUILD_MANIFEST__*/ { id: 'dev', assets: [] }";
const swSource = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

const loadSw = ({ windows = [] } = {}) => {
  const listeners = {};
  const log = { opened: [], closed: 0 };
  const sandbox = {
    self: {
      addEventListener: (type, fn) => { listeners[type] = fn; },
      location: { origin: 'https://app.test' },
      clients: {
        claim: async () => {},
        matchAll: async () => windows,
        openWindow: async (url) => { log.opened.push(url); },
      },
      skipWaiting: () => {},
    },
    caches: { open: async () => ({}), keys: async () => [], delete: async () => true, match: async () => undefined },
    fetch: async () => new Response('ok'),
    Response, URL, Promise,
    setTimeout: (fn) => { queueMicrotask(fn); return 0; },
  };
  vm.runInNewContext(swSource.replace(PLACEHOLDER, JSON.stringify({ id: 't', assets: [] })), sandbox);

  const click = async (data) => {
    const pending = [];
    listeners.notificationclick({
      notification: { data, close: () => { log.closed += 1; } },
      waitUntil: (p) => pending.push(p),
    });
    await Promise.all(pending);
  };
  return { click, log, listeners };
};

const fakeWindow = () => {
  const w = { focused: 0, messages: [] };
  w.focus = async () => { w.focused += 1; };
  w.postMessage = (m) => { w.messages.push(m); };
  return w;
};

test('the service worker handles notification taps', () => {
  assert.equal(typeof loadSw().listeners.notificationclick, 'function');
});

test('a tap focuses the open app and asks it to start the dhikr', async () => {
  const win = fakeWindow();
  const sw = loadSw({ windows: [win] });
  await sw.click({ dhikrId: 'ayatul-kursi' });
  assert.equal(sw.log.closed, 1, 'the notification is dismissed');
  assert.equal(win.focused, 1);
  // Messages are built inside the service worker's own realm, so compare plain data.
  assert.deepEqual(JSON.parse(JSON.stringify(win.messages)), [{ type: 'OPEN_DHIKR', dhikrId: 'ayatul-kursi' }]);
  assert.deepEqual(sw.log.opened, []);
});

test('a window that cannot be focused still gets the dhikr message', async () => {
  const win = fakeWindow();
  win.focus = async () => { throw new Error('not focusable'); };
  const sw = loadSw({ windows: [win] });
  await sw.click({ dhikrId: 'ayatul-kursi' });
  assert.equal(win.messages.length, 1);
});

test('with no window open, a tap launches the app on that dhikr', async () => {
  const sw = loadSw();
  await sw.click({ dhikrId: 'ayatul-kursi' });
  assert.deepEqual(sw.log.opened, ['./?dhikr=ayatul-kursi']);
});

test('the dhikr id is encoded in the launch URL', async () => {
  const sw = loadSw();
  await sw.click({ dhikrId: 'a b&c' });
  assert.deepEqual(sw.log.opened, ['./?dhikr=a%20b%26c']);
});

test('a tap without a dhikr just opens or focuses the app', async () => {
  const win = fakeWindow();
  const withWindow = loadSw({ windows: [win] });
  await withWindow.click(undefined);
  assert.equal(win.focused, 1);
  assert.deepEqual(win.messages, []);
  const without = loadSw();
  await without.click(null);
  assert.deepEqual(without.log.opened, ['./']);
});
