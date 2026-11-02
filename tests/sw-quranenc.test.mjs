import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const PLACEHOLDER = "/*__BUILD_MANIFEST__*/ { id: 'dev', assets: [] }";
const swSource = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const ORIGIN = 'https://app.test';

const respond = (body, type = 'cors') => {
  const res = new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
  Object.defineProperty(res, 'type', { value: type });
  Object.defineProperty(res, 'redirected', { value: false });
  return res;
};

const loadSw = (fetchImpl) => {
  const stores = new Map();
  const listeners = {};
  const abs = (u) => new URL(typeof u === 'string' ? u : u.url, `${ORIGIN}/sw.js`).href;
  const open = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name);
    return { put: async (req, res) => { store.set(abs(req), res); }, addAll: async () => {}, match: async (req) => store.get(abs(req))?.clone() };
  };
  const sandbox = {
    self: { addEventListener: (t, fn) => { listeners[t] = fn; }, location: { origin: ORIGIN }, clients: { claim: async () => {} }, skipWaiting: () => {} },
    caches: {
      open: async (n) => open(n), keys: async () => [...stores.keys()], delete: async (n) => stores.delete(n),
      match: async (req) => { for (const s of stores.values()) if (s.has(abs(req))) return s.get(abs(req)).clone(); return undefined; },
    },
    fetch: (...a) => fetchImpl(...a), Response, URL, Promise,
    setTimeout: (fn) => { queueMicrotask(fn); return 0; },
  };
  vm.runInNewContext(swSource.replace(PLACEHOLDER, JSON.stringify({ id: 't', assets: [] })), sandbox);
  const request = async (url) => {
    let responded;
    const pending = [];
    listeners.fetch({ request: { url, method: 'GET', mode: 'cors', destination: '' }, respondWith: (p) => { responded = p; }, waitUntil: (p) => pending.push(p) });
    const response = responded ? await responded : undefined;
    await Promise.all(pending);
    return response;
  };
  return { stores, request };
};

test('QuranEnc translation responses are cached and served when the network fails', async () => {
  let online = true;
  const sw = loadSw(async () => { if (!online) throw new TypeError('offline'); return respond('{"result":[1]}'); });
  const url = 'https://quranenc.com/api/v1/translation/sura/english_saheeh/112';
  await sw.request(url);
  assert.equal(sw.stores.get('tasbih-quran-v2').has(url), true);
  online = false;
  assert.equal(await (await sw.request(url)).text(), '{"result":[1]}');
});

test('the catalogue is cached too, so the picker works offline', async () => {
  let online = true;
  const sw = loadSw(async () => { if (!online) throw new TypeError('offline'); return respond('{"translations":[]}'); });
  const url = 'https://quranenc.com/api/v1/translations/list';
  await sw.request(url);
  online = false;
  assert.equal(await (await sw.request(url)).text(), '{"translations":[]}');
});

test('the latest version is used whenever the network is there, not a stale cached copy', async () => {
  let body = 'v1';
  const sw = loadSw(async () => respond(body));
  const url = 'https://quranenc.com/api/v1/translation/sura/english_saheeh/1';
  await sw.request(url);
  body = 'v2';
  assert.equal(await (await sw.request(url)).text(), 'v2');
});

test('only the QuranEnc API is handled; its website, downloads and files are left to the browser', async () => {
  const sw = loadSw(async () => respond('x'));
  for (const url of [
    'https://quranenc.com/en/browse/english_saheeh/112',
    'https://quranenc.com/downloads/pdf/english_saheeh.pdf',
    'https://quranenc.com/',
    'https://quranenc.com.evil.example/api/v1/translations/list',
  ]) {
    assert.equal(await sw.request(url), undefined, url);
  }
});
