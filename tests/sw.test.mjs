import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLACEHOLDER = "/*__BUILD_MANIFEST__*/ { id: 'dev', assets: [] }";
const ORIGIN = 'https://app.test';
const swSource = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');

const makeResponse = (body, { type = 'basic', contentType = 'application/javascript', status = 200, redirected = false } = {}) => {
  const res = new Response(body, { status, headers: { 'content-type': contentType } });
  Object.defineProperty(res, 'type', { value: type });
  Object.defineProperty(res, 'redirected', { value: redirected });
  return res;
};

const abs = (u) => new URL(typeof u === 'string' ? u : u.url, `${ORIGIN}/sw.js`).href;

const loadSw = ({ manifest = { id: 't1', assets: ['assets/app-1.js'] }, fetchImpl = async () => makeResponse('ok') } = {}) => {
  const stores = new Map();
  const listeners = {};
  const state = { skipped: false, claimed: false, matchCalls: [] };

  const open = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name);
    return {
      put: async (req, res) => { store.set(abs(req), res); },
      addAll: async (urls) => { for (const u of urls) store.set(abs(u), makeResponse('precached')); },
      match: async (req) => store.get(abs(req))?.clone(),
    };
  };

  const caches = {
    open: async (name) => open(name),
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
    match: async (req, options) => {
      state.matchCalls.push(options);
      for (const store of stores.values()) {
        if (store.has(abs(req))) return store.get(abs(req)).clone();
      }
      return undefined;
    },
  };

  const sandbox = {
    self: {
      addEventListener: (type, fn) => { listeners[type] = fn; },
      location: { origin: ORIGIN },
      clients: { claim: async () => { state.claimed = true; } },
      skipWaiting: () => { state.skipped = true; },
    },
    caches,
    fetch: (...args) => fetchImpl(...args),
    Response,
    URL,
    Promise,
    // Fire timers on the next microtask so timeout paths are testable without waiting.
    setTimeout: (fn) => { queueMicrotask(fn); return 0; },
  };

  vm.runInNewContext(swSource.replace(PLACEHOLDER, JSON.stringify(manifest)), sandbox);

  const dispatchWait = async (type, event = {}) => {
    const pending = [];
    await listeners[type]({ ...event, waitUntil: (p) => pending.push(p) });
    await Promise.all(pending);
  };

  const request = async (url, { mode = 'cors', destination = 'script' } = {}) => {
    let responded;
    const pending = [];
    listeners.fetch({
      request: { url, method: 'GET', mode, destination },
      respondWith: (p) => { responded = p; },
      waitUntil: (p) => pending.push(p),
    });
    const response = responded ? await responded : undefined;
    await Promise.all(pending);
    return response;
  };

  return { stores, state, dispatchWait, request, listeners };
};

test('install pre-caches the shell and every hashed build asset', async () => {
  const sw = loadSw();
  await sw.dispatchWait('install');
  const shell = sw.stores.get('tasbih-shell-t1');
  assert.ok(shell.has(`${ORIGIN}/assets/app-1.js`), 'hashed bundle precached');
  assert.ok(shell.has(`${ORIGIN}/index.html`), 'index precached');
  assert.ok(shell.has(`${ORIGIN}/icon-192.png`), 'icon precached');
});

test('install does not skip waiting; SKIP_WAITING message does', async () => {
  const sw = loadSw();
  await sw.dispatchWait('install');
  assert.equal(sw.state.skipped, false);
  await sw.dispatchWait('message', { data: { type: 'SKIP_WAITING' } });
  assert.equal(sw.state.skipped, true);
});

test('activate removes superseded app caches but keeps Quran and foreign caches', async () => {
  const sw = loadSw();
  sw.stores.set('tasbih-shell-old', new Map());
  sw.stores.set('tasbih-cache-v1', new Map());
  sw.stores.set('tasbih-quran-v1', new Map());
  sw.stores.set('tasbih-shell-t1', new Map());
  sw.stores.set('other-app-cache', new Map());
  await sw.dispatchWait('activate');
  assert.deepEqual([...sw.stores.keys()].sort(), ['other-app-cache', 'tasbih-quran-v1', 'tasbih-shell-t1']);
  assert.equal(sw.state.claimed, true);
});

test('HTML served for a missing /assets/ file is not cached (SPA fallback poisoning)', async () => {
  const sw = loadSw({ fetchImpl: async () => makeResponse('<html></html>', { contentType: 'text/html; charset=utf-8' }) });
  await sw.request(`${ORIGIN}/assets/gone-9.js`);
  const shell = sw.stores.get('tasbih-shell-t1');
  assert.equal(shell?.has(`${ORIGIN}/assets/gone-9.js`) ?? false, false);
});

test('a real hashed asset is cached and then served cache-first', async () => {
  let calls = 0;
  const sw = loadSw({ fetchImpl: async () => { calls += 1; return makeResponse('console.log(1)'); } });
  await sw.request(`${ORIGIN}/assets/new-2.js`);
  assert.equal(sw.stores.get('tasbih-shell-t1').has(`${ORIGIN}/assets/new-2.js`), true);
  await sw.request(`${ORIGIN}/assets/new-2.js`);
  assert.equal(calls, 1, 'second request served from cache');
});

test('redirected and opaque responses are not cached', async () => {
  const redirected = loadSw({ fetchImpl: async () => makeResponse('x', { redirected: true }) });
  await redirected.request(`${ORIGIN}/assets/r.js`);
  assert.equal(redirected.stores.get('tasbih-shell-t1')?.size ?? 0, 0);

  const opaque = loadSw({ fetchImpl: async () => makeResponse('x', { type: 'opaque' }) });
  await opaque.request(`${ORIGIN}/assets/o.js`);
  assert.equal(opaque.stores.get('tasbih-shell-t1')?.size ?? 0, 0);
});

test('Quran API responses are cached and served when the network fails', async () => {
  let online = true;
  const sw = loadSw({
    fetchImpl: async () => {
      if (!online) throw new TypeError('offline');
      return makeResponse('{"data":1}', { type: 'cors', contentType: 'application/json' });
    },
  });
  const url = 'https://api.alquran.cloud/v1/surah/1';
  await sw.request(url);
  assert.equal(sw.stores.get('tasbih-quran-v1').has(url), true);
  online = false;
  const res = await sw.request(url);
  assert.equal(await res.text(), '{"data":1}');
});

test('Quran API falls back to cache when the network hangs past the timeout', async () => {
  let hang = false;
  const sw = loadSw({
    fetchImpl: () => (hang ? new Promise(() => {}) : Promise.resolve(makeResponse('cached-surah', { type: 'cors', contentType: 'application/json' }))),
  });
  const url = 'https://api.alquran.cloud/v1/surah/2';
  await sw.request(url);
  hang = true;
  const res = await sw.request(url);
  assert.equal(await res.text(), 'cached-surah');
});

test('offline navigation falls back to the cached index.html', async () => {
  let online = true;
  const sw = loadSw({
    fetchImpl: async () => {
      if (!online) throw new TypeError('offline');
      return makeResponse('<html>live</html>', { contentType: 'text/html' });
    },
  });
  await sw.dispatchWait('install');
  online = false;
  const res = await sw.request(`${ORIGIN}/some/deep/link`, { mode: 'navigate', destination: 'document' });
  assert.equal(await res.text(), 'precached');
});

// Hosts commonly send `Vary: Origin`, and browsers add an Origin header to same-origin
// module-script requests that precached entries lack. Without ignoreVary the lookup misses
// and the first offline reload is a blank page (reproduced in Chrome).
test('every cache lookup ignores Vary so precached assets match module-script requests', async () => {
  const sw = loadSw();
  await sw.dispatchWait('install');
  await sw.request(`${ORIGIN}/assets/app-1.js`);
  await sw.request(`${ORIGIN}/icon.svg`);
  await sw.request(`${ORIGIN}/some/link`, { mode: 'navigate', destination: 'document' });
  await sw.request('https://api.alquran.cloud/v1/surah/1');
  assert.ok(sw.state.matchCalls.length >= 2, `lookups made: ${sw.state.matchCalls.length}`);
  for (const options of sw.state.matchCalls) {
    assert.equal(options && options.ignoreVary, true);
  }
});
