import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { AZAN_SOURCES, FAJR_AZAN, getAzanSource, azanSourceFor } from '../src/azan.ts';
import { THIRD_PARTY_NOTICES } from '../src/licenses.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('every adhan is a bundled, same-origin asset: Fajr, Makkah and Madinah', () => {
  assert.deepEqual(Object.keys(AZAN_SOURCES), ['makkah', 'madinah']);
  for (const source of [FAJR_AZAN, ...Object.values(AZAN_SOURCES)]) {
    assert.match(source.path, /^audio\/azan-[a-z]+\.m4a$/);
    assert.ok(fs.existsSync(path.join(root, 'public', source.path)), `${source.path} exists in public/`);
  }
  assert.equal(FAJR_AZAN.path, 'audio/azan-fajr.m4a');
});

test('each bundled adhan is a real AAC/MP4 audio file of sensible size', () => {
  for (const source of [FAJR_AZAN, ...Object.values(AZAN_SOURCES)]) {
    const bytes = fs.readFileSync(path.join(root, 'public', source.path));
    assert.equal(bytes.subarray(4, 8).toString('latin1'), 'ftyp', source.path);
    assert.ok(bytes.length > 300_000 && bytes.length < 2_000_000, `${source.path} size ${bytes.length}`);
  }
});

test('the old placeholder adhan is no longer shipped, and nothing refers to it', () => {
  assert.equal(fs.existsSync(path.join(root, 'public/audio/adhan.m4a')), false);
  assert.doesNotMatch(read('public/sw.js'), /audio\/adhan\.m4a/);
});

test('the service worker precaches all three adhan recordings', () => {
  const sw = read('public/sw.js');
  for (const file of ['azan-fajr', 'azan-makkah', 'azan-madinah']) assert.match(sw, new RegExp(`audio/${file}\\.m4a`), file);
});

test('Fajr always has its own adhan, and the other four follow the one chosen voice', () => {
  assert.equal(azanSourceFor('fajr', 'madinah'), FAJR_AZAN);
  assert.equal(azanSourceFor('fajr', 'makkah'), FAJR_AZAN);
  for (const prayer of ['dhuhr', 'asr', 'maghrib', 'isha']) {
    assert.equal(azanSourceFor(prayer, 'madinah'), AZAN_SOURCES.madinah, prayer);
    assert.equal(azanSourceFor(prayer, 'makkah'), AZAN_SOURCES.makkah, prayer);
  }
  assert.equal(azanSourceFor(undefined, 'madinah'), AZAN_SOURCES.madinah, 'a preview with no prayer plays the chosen voice');
});

test('unknown or legacy ids resolve sensibly: the old standard and Mecca ids become Makkah, Medina becomes Madinah', () => {
  assert.equal(getAzanSource('standard'), AZAN_SOURCES.makkah);
  assert.equal(getAzanSource('mecca'), AZAN_SOURCES.makkah);
  assert.equal(getAzanSource('medina'), AZAN_SOURCES.madinah);
  assert.equal(getAzanSource(undefined), AZAN_SOURCES.makkah);
});

test('the adhan player no longer streams from third-party hosts', () => {
  const qibla = read('src/components/QiblaScreen.tsx');
  for (const host of ['jsdelivr', 'islamcan', 'archive.org', 'githubusercontent', 'farafarizul']) {
    assert.doesNotMatch(qibla, new RegExp(host), host);
  }
  assert.doesNotMatch(qibla, /MECCA_AZAN_URLS|MEDINA_AZAN_URLS/);
});

test('licence notices record where the adhan recordings came from, and credit the prayer-time library', () => {
  const adhan = THIRD_PARTY_NOTICES.find((n) => /adhan recordings/i.test(n.name));
  assert.ok(adhan, 'adhan recordings notice');
  assert.match(adhan.note, /Fajr/);
  assert.match(adhan.note, /Makkah/);
  assert.match(adhan.note, /Madinah/);
  assert.match(adhan.note, /not independently verified/i, 'honest about what was checked');
  assert.equal(THIRD_PARTY_NOTICES.some((n) => /Beautiful_adhan|Adam-synagda/.test(JSON.stringify(n))), false, 'the removed recording is no longer credited');
  assert.ok(THIRD_PARTY_NOTICES.some((n) => n.name === 'adhan' && n.license === 'MIT'));
  assert.ok(THIRD_PARTY_NOTICES.every((n) => n.name && n.license && n.url), 'every notice is complete');
});

// ── service worker: offline adhan with Range support ────────────────────────────

const ORIGIN = 'https://app.test';
const swSource = read('public/sw.js');
const PLACEHOLDER = "/*__BUILD_MANIFEST__*/ { id: 'dev', assets: [] }";

const loadSw = () => {
  const stores = new Map();
  const listeners = {};
  const abs = (u) => new URL(typeof u === 'string' ? u : u.url, `${ORIGIN}/sw.js`).href;
  const open = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name);
    return {
      put: async (req, res) => { store.set(abs(req), res); },
      addAll: async (urls) => {
        for (const u of urls) {
          const res = new Response(u.endsWith('azan-makkah.m4a') ? Buffer.from('0123456789') : 'x', {
            headers: { 'content-type': u.endsWith('.m4a') ? 'audio/mp4' : 'text/plain' },
          });
          store.set(abs(u), res);
        }
      },
      match: async (req) => store.get(abs(req))?.clone(),
    };
  };
  const caches = {
    open: async (n) => open(n),
    keys: async () => [...stores.keys()],
    delete: async (n) => stores.delete(n),
    match: async (req, options) => {
      for (const store of stores.values()) if (store.has(abs(req))) return store.get(abs(req)).clone();
      return undefined;
    },
  };
  const sandbox = {
    self: { addEventListener: (t, fn) => { listeners[t] = fn; }, location: { origin: ORIGIN }, clients: { claim: async () => {} }, skipWaiting: () => {} },
    caches,
    fetch: async () => { throw new TypeError('offline'); },
    Response, URL, Promise, Headers,
    setTimeout: (fn) => { queueMicrotask(fn); return 0; },
  };
  vm.runInNewContext(swSource.replace(PLACEHOLDER, JSON.stringify({ id: 't1', assets: [] })), sandbox);
  return {
    stores,
    install: async () => { const p = []; await listeners.install({ waitUntil: (x) => p.push(x) }); await Promise.all(p); },
    request: async (url, headers = {}) => {
      let responded;
      listeners.fetch({
        request: { url, method: 'GET', mode: 'no-cors', destination: 'audio', headers: new Headers(headers) },
        respondWith: (p) => { responded = p; },
        waitUntil: () => {},
      });
      return responded;
    },
  };
};

test('service worker precaches the adhan so it plays offline', async () => {
  const sw = loadSw();
  await sw.install();
  assert.ok(sw.stores.get('tasbih-shell-t1').has(`${ORIGIN}/audio/azan-makkah.m4a`));
});

test('service worker serves byte ranges for cached audio (required by Safari)', async () => {
  const sw = loadSw();
  await sw.install();
  const res = await (await sw.request(`${ORIGIN}/audio/azan-makkah.m4a`, { range: 'bytes=2-5' }));
  assert.equal(res.status, 206);
  assert.equal(res.headers.get('content-range'), 'bytes 2-5/10');
  assert.equal(await res.text(), '2345');
  const open = await (await sw.request(`${ORIGIN}/audio/azan-makkah.m4a`, { range: 'bytes=4-' }));
  assert.equal(open.status, 206);
  assert.equal(await open.text(), '456789');
  const whole = await (await sw.request(`${ORIGIN}/audio/azan-makkah.m4a`));
  assert.equal(whole.status, 200);
});

test('an unsatisfiable range returns 416', async () => {
  const sw = loadSw();
  await sw.install();
  const res = await (await sw.request(`${ORIGIN}/audio/azan-makkah.m4a`, { range: 'bytes=50-60' }));
  assert.equal(res.status, 416);
});
