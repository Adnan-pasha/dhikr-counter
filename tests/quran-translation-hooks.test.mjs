import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

process.env.NODE_ENV = 'development';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://app.test/', pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.localStorage = dom.window.localStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { renderHook, act, cleanup, waitFor } = await import('@testing-library/react');
const { useTranslationCatalog, CATALOG_KEY } = await import('../src/quran/useTranslationCatalog.ts');
const { useQuranEncSurah } = await import('../src/quran/useQuranEncSurah.ts');

const entry = (key, extra = {}) => ({ key, title: `Title ${key}`, language_iso_code: 'en', direction: 'ltr', version: '1.0.0', last_update: 1, ...extra });
const catalogBody = (...keys) => ({ translations: keys.map((k) => entry(k)) });
const surahBody = (...rows) => ({ result: rows.map(([aya, translation, footnotes = '']) => ({ aya: String(aya), translation, footnotes })) });
const json = (body) => ({ ok: true, json: async () => body });

test.afterEach(() => { cleanup(); localStorage.clear(); });

// ── catalogue ─────────────────────────────────────────────────────────────────

test('the catalogue loads, is parsed and is remembered for next time', async () => {
  const urls = [];
  globalThis.fetch = async (url) => { urls.push(String(url)); return json(catalogBody('english_saheeh', 'urdu_junagarhi')); };
  const { result } = renderHook(() => useTranslationCatalog());
  assert.equal(result.current.status, 'loading');
  await waitFor(() => assert.equal(result.current.status, 'ready'));
  assert.deepEqual(result.current.entries.map((e) => e.key), ['english_saheeh', 'urdu_junagarhi']);
  assert.deepEqual(urls, ['https://quranenc.com/api/v1/translations/list']);
  assert.equal(JSON.parse(localStorage.getItem(CATALOG_KEY)).length, 2);
});

test('a remembered catalogue is shown at once, before the network answers', async () => {
  localStorage.setItem(CATALOG_KEY, JSON.stringify([{ key: 'english_saheeh', title: 'T', language: 'en', direction: 'ltr', version: '1', lastUpdate: 1 }]));
  globalThis.fetch = () => new Promise(() => {});
  const { result } = renderHook(() => useTranslationCatalog());
  assert.deepEqual(result.current.entries.map((e) => e.key), ['english_saheeh']);
  assert.equal(result.current.status, 'loading');
});

test('offline, the remembered catalogue stays usable and is marked as saved', async () => {
  localStorage.setItem(CATALOG_KEY, JSON.stringify([{ key: 'english_saheeh', title: 'T', language: 'en', direction: 'ltr', version: '1', lastUpdate: 1 }]));
  globalThis.fetch = async () => { throw new TypeError('offline'); };
  const { result } = renderHook(() => useTranslationCatalog());
  await waitFor(() => assert.equal(result.current.status, 'cached'));
  assert.equal(result.current.entries.length, 1);
});

test('with nothing remembered and no network, it reports an error and can retry', async () => {
  let online = false;
  globalThis.fetch = async () => { if (!online) throw new TypeError('offline'); return json(catalogBody('english_saheeh')); };
  const { result } = renderHook(() => useTranslationCatalog());
  await waitFor(() => assert.equal(result.current.status, 'error'));
  assert.deepEqual(result.current.entries, []);
  online = true;
  act(() => result.current.retry());
  await waitFor(() => assert.equal(result.current.status, 'ready'));
  assert.equal(result.current.entries.length, 1);
});

test('a response with no usable entries is treated as a failure, not as an empty catalogue', async () => {
  globalThis.fetch = async () => json({ translations: [] });
  const { result } = renderHook(() => useTranslationCatalog());
  await waitFor(() => assert.equal(result.current.status, 'error'));
});

test('damaged remembered data is ignored', async () => {
  localStorage.setItem(CATALOG_KEY, '{not json');
  globalThis.fetch = () => new Promise(() => {});
  assert.deepEqual(renderHook(() => useTranslationCatalog()).result.current.entries, []);
});

// ── one surah's translation ───────────────────────────────────────────────────

test('without a QuranEnc translation chosen nothing is requested', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return json({}); };
  const { result } = renderHook(() => useQuranEncSurah(null, 2));
  assert.equal(result.current.status, 'idle');
  assert.equal(result.current.map, null);
  assert.equal(calls, 0);
});

test('a surah\'s translation loads from the official endpoint', async () => {
  const urls = [];
  globalThis.fetch = async (url) => { urls.push(String(url)); return json(surahBody([1, 'Say: He is Allah[1]', '[1] note'], [2, 'Allah, the Eternal'])); };
  const { result } = renderHook(() => useQuranEncSurah('english_saheeh', 112));
  assert.equal(result.current.status, 'loading');
  await waitFor(() => assert.equal(result.current.status, 'ready'));
  assert.equal(result.current.map.get(1).footnotes, '[1] note');
  assert.deepEqual(urls, ['https://quranenc.com/api/v1/translation/sura/english_saheeh/112']);
});

test('switching translation clears the old text straight away, so it is never shown under the new name', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  globalThis.fetch = async (url) => {
    if (String(url).includes('urdu_junagarhi')) await gate;
    return json(surahBody([1, String(url).includes('urdu') ? 'URDU' : 'ENGLISH']));
  };
  const { result, rerender } = renderHook(({ k }) => useQuranEncSurah(k, 112), { initialProps: { k: 'english_saheeh' } });
  await waitFor(() => assert.equal(result.current.status, 'ready'));
  assert.equal(result.current.map.get(1).translation, 'ENGLISH');
  rerender({ k: 'urdu_junagarhi' });
  assert.equal(result.current.status, 'loading');
  assert.equal(result.current.map, null, 'the English text is gone while Urdu loads');
  release();
  await waitFor(() => assert.equal(result.current.map?.get(1).translation, 'URDU'));
});

test('a late answer for a translation you have already left is ignored', async () => {
  let releaseSlow;
  const slow = new Promise((r) => { releaseSlow = r; });
  globalThis.fetch = async (url) => {
    if (String(url).includes('slow_one')) { await slow; return json(surahBody([1, 'SLOW'])); }
    return json(surahBody([1, 'FAST']));
  };
  const { result, rerender } = renderHook(({ k }) => useQuranEncSurah(k, 112), { initialProps: { k: 'slow_one' } });
  rerender({ k: 'fast_one' });
  await waitFor(() => assert.equal(result.current.map?.get(1).translation, 'FAST'));
  releaseSlow();
  await act(async () => { await Promise.resolve(); });
  assert.equal(result.current.map.get(1).translation, 'FAST', 'the slow response did not overwrite it');
});

test('moving to another surah loads that surah', async () => {
  const urls = [];
  globalThis.fetch = async (url) => { urls.push(String(url)); return json(surahBody([1, 'x'])); };
  const { result, rerender } = renderHook(({ s }) => useQuranEncSurah('english_saheeh', s), { initialProps: { s: 1 } });
  await waitFor(() => assert.equal(result.current.status, 'ready'));
  rerender({ s: 2 });
  await waitFor(() => assert.ok(urls.at(-1).endsWith('/english_saheeh/2')));
});

test('a failure is reported, and retrying loads it', async () => {
  let online = false;
  globalThis.fetch = async () => { if (!online) throw new TypeError('offline'); return json(surahBody([1, 'ok'])); };
  const { result } = renderHook(() => useQuranEncSurah('english_saheeh', 1));
  await waitFor(() => assert.equal(result.current.status, 'error'));
  online = true;
  act(() => result.current.retry());
  await waitFor(() => assert.equal(result.current.status, 'ready'));
});

test('an unusable response is an error rather than a blank page', async () => {
  globalThis.fetch = async () => json({ result: [] });
  const { result } = renderHook(() => useQuranEncSurah('english_saheeh', 1));
  await waitFor(() => assert.equal(result.current.status, 'error'));
});
