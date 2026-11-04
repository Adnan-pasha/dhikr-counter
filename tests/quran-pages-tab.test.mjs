import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

process.env.NODE_ENV = 'development';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://app.test/', pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.localStorage = dom.window.localStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
window.HTMLElement.prototype.scrollIntoView = () => {};

const React = (await import('react')).default;
const { render, screen, fireEvent, cleanup, waitFor, act } = await import('@testing-library/react');
const { default: QuranReader } = await import('../src/components/QuranReader.tsx');
const { EMPTY_PROGRESS } = await import('../src/quran/progress.ts');
const { clearPageCache } = await import('../src/quran/useMushafPage.ts');
const { getBackStack } = await import('../src/backStack.ts');
const { LAST_PAGE_KEY } = await import('../src/quran/useLastPage.ts');

const surahInfo = { number: 112, name: 'الإخلاص', englishName: 'Al-Ikhlas', englishNameTranslation: 'Sincerity', numberOfAyahs: 4, revelationType: 'Meccan' };
const LIST = { code: 200, data: [surahInfo] };
const pageAyahs = (page) => [
  { number: 6222, surah: surahInfo, numberInSurah: 1, juz: 30, page, text: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ' },
  { number: 6223, surah: surahInfo, numberInSurah: 2, juz: 30, page, text: 'ٱللَّهُ ٱلصَّمَدُ' },
];
const surahBody = { code: 200, data: [
  { edition: { identifier: 'quran-uthmani' }, ayahs: pageAyahs(604).map((a) => ({ number: a.number, numberInSurah: a.numberInSurah, text: a.text, juz: 30, page: 604 })) },
  { edition: { identifier: 'en.pickthall' }, ayahs: [{ number: 6222, numberInSurah: 1, text: 'Say: He is Allah', juz: 30, page: 604 }, { number: 6223, numberInSurah: 2, text: 'Allah, the eternal', juz: 30, page: 604 }] },
] };

const NO_ACTIONS = { addSeconds() {}, setGoal() {}, recordPosition() {}, startKhatam() {}, endKhatam() {}, reset() {} };

test.afterEach(async () => {
  cleanup();
  localStorage.clear();
  clearPageCache();
  await new Promise((resolve) => setTimeout(resolve, 20));
  getBackStack().reset();
});

const mount = (progressActions = NO_ACTIONS) => {
  const urls = [];
  globalThis.fetch = async (url) => {
    const u = String(url);
    urls.push(u);
    if (u.includes('indopak-15-lines')) return { ok: true, json: async () => JSON.parse(fs.readFileSync(new URL('../src/quran/data/indopak-15-lines.json', import.meta.url), 'utf8')) };
    if (u.includes('indopak-digitalkhatt')) return { ok: true, json: async () => JSON.parse(fs.readFileSync(new URL('../src/quran/data/indopak-digitalkhatt.json', import.meta.url), 'utf8')) };
    const m = u.match(/\/page\/(\d+)\/([^/]+)$/);
    if (m) return { ok: true, json: async () => ({ code: 200, data: { number: Number(m[1]), ayahs: pageAyahs(Number(m[1])), surahs: {}, edition: { identifier: m[2] } } }) };
    if (u.includes('quranenc.com')) return { ok: true, json: async () => ({ translations: [] }) };
    return { ok: true, json: async () => (u.endsWith('/surah') ? LIST : surahBody) };
  };
  render(React.createElement(QuranReader, {
    bookmarkedAyahs: [], lastReadSurah: 0, onBookmarkToggle: () => {}, onUpdateLastRead: () => {}, onGoBack: () => {},
    progress: EMPTY_PROGRESS, progressActions, today: '2026-03-20',
  }));
  return urls;
};

const openPages = async () => {
  await screen.findByText('Al-Ikhlas');
  fireEvent.click(screen.getByRole('button', { name: 'Pages' }));
};

test('the Quran screen has a Pages section next to Read and My Progress', async () => {
  mount();
  await screen.findByText('Al-Ikhlas');
  for (const name of ['Read', 'Pages', 'My Progress']) assert.ok(screen.getByRole('button', { name }), name);
});

test('Pages opens the mushaf at page 1 the first time', async () => {
  const urls = mount();
  await openPages();
  await waitFor(() => assert.match(document.body.textContent, /Page 1 of 604/));
  assert.ok(urls.some((u) => u.endsWith('/page/1/quran-uthmani')));
});

test('Pages opens where the reader left off, and remembers each page turn', async () => {
  localStorage.setItem(LAST_PAGE_KEY, '604');
  mount();
  await openPages();
  await waitFor(() => assert.match(document.body.textContent, /Page 604 of 604/));
  fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
  await waitFor(() => assert.equal(localStorage.getItem(LAST_PAGE_KEY), '603'));
});

test('reading a page after a touch feeds My Progress with where the reader is', async () => {
  const recorded = [];
  mount({ ...NO_ACTIONS, recordPosition: (position, seen) => recorded.push([position, seen]) });
  localStorage.setItem(LAST_PAGE_KEY, '603');
  await openPages();
  await screen.findByText(/قُلْ هُوَ/);
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  await waitFor(() => assert.ok(recorded.length >= 1), { timeout: 6000 });
  assert.deepEqual(recorded[0][0], { surah: 112, ayah: 1, global: 6222 });
  assert.deepEqual(recorded[0][1], { from: 6222, to: 6223 });
});

test('back from Pages returns to the surah list', async () => {
  mount();
  await openPages();
  await screen.findByText(/قُلْ هُوَ/);
  await act(async () => { window.history.back(); await new Promise((resolve) => setTimeout(resolve, 30)); });
  await waitFor(() => assert.ok(screen.getByRole('button', { name: 'Reading settings' })));
});

test('opening a surah from a page and going back lands on the page again', async () => {
  mount();
  await openPages();
  await screen.findByText(/قُلْ هُوَ/);
  fireEvent.click(document.querySelector('[data-ayah="6222"]'));
  fireEvent.click(await screen.findByRole('button', { name: 'Read in surah view' }));
  await screen.findByRole('button', { name: 'Back to Pages' });
  fireEvent.click(screen.getByRole('button', { name: 'Back to Pages' }));
  await waitFor(() => assert.match(document.body.textContent, /Page 1 of 604/));
});

test('with the IndoPak script, Pages is the 15-line mushaf with its own 610 pages and its own place', async () => {
  localStorage.setItem('tasbih_reader_settings', JSON.stringify({ script: 'indopak' }));
  localStorage.setItem(LAST_PAGE_KEY, '604');
  mount();
  await openPages();
  await waitFor(() => assert.match(document.body.textContent, /15-line IndoPak/));
  await waitFor(() => assert.match(document.body.textContent, /Page 1 of 610/), { timeout: 4000 });
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  await waitFor(() => assert.equal(localStorage.getItem('tasbih_quran_last_page_indopak15'), '2'));
  assert.equal(localStorage.getItem(LAST_PAGE_KEY), '604', 'the 604-page place is left alone');
});

test('with another script, Pages is still the 604-page mushaf', async () => {
  localStorage.setItem('tasbih_reader_settings', JSON.stringify({ script: 'simple' }));
  mount();
  await openPages();
  await waitFor(() => assert.match(document.body.textContent, /Page 1 of 604/));
  assert.doesNotMatch(document.body.textContent, /15-line IndoPak/);
});
