import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

process.env.NODE_ENV = 'development';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://app.test/', pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.localStorage = dom.window.localStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import('react')).default;
const { render, screen, fireEvent, cleanup, waitFor, act } = await import('@testing-library/react');
const { default: MushafReader } = await import('../src/components/MushafReader.tsx');
const { DEFAULT_READER_SETTINGS } = await import('../src/quran/settings.ts');
const { clearPageCache } = await import('../src/quran/useMushafPage.ts');
const { clearIndopakCache } = await import('../src/quran/indopak.ts');
const { getBackStack } = await import('../src/backStack.ts');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDOPAK = JSON.parse(fs.readFileSync(path.join(root, 'src/quran/data/indopak-digitalkhatt.json'), 'utf8'));

const surah = (number, englishName) => ({ number, name: `سورة ${number}`, englishName, englishNameTranslation: 'The Cow', numberOfAyahs: 286, revelationType: 'Medinan' });
const PAGES = {
  2: [
    { number: 8, surah: surah(2, 'Al-Baqara'), numberInSurah: 1, juz: 1, page: 2, text: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ الٓمٓ' },
    { number: 9, surah: surah(2, 'Al-Baqara'), numberInSurah: 2, juz: 1, page: 2, text: 'ذَٰلِكَ ٱلْكِتَٰبُ' },
  ],
  3: [{ number: 13, surah: surah(2, 'Al-Baqara'), numberInSurah: 6, juz: 1, page: 3, text: 'إِنَّ ٱلَّذِينَ كَفَرُوا۟' }],
  22: [{ number: 150, surah: surah(2, 'Al-Baqara'), numberInSurah: 142, juz: 2, page: 22, text: 'سَيَقُولُ ٱلسُّفَهَآءُ' }],
};
const TRANSLATION = { 8: 'Alif. Lam. Mim.', 9: 'This is the Scripture.', 13: 'As for the disbelievers.', 150: 'The foolish will say.' };

const edition = (url) => String(url).split('/').pop();
const fakeFetch = (log, { failPages = new Set() } = {}) => async (url) => {
  const u = String(url);
  log.push(u);
  const m = u.match(/\/page\/(\d+)\/([^/]+)$/);
  if (m) {
    const page = Number(m[1]);
    if (failPages.has(page) || !PAGES[page]) return { ok: false, status: 500, json: async () => ({}) };
    const ayahs = PAGES[page].map((a) => ({ ...a, text: edition(u) === 'en.pickthall' ? TRANSLATION[a.number] : a.text }));
    return { ok: true, json: async () => ({ code: 200, data: { number: page, ayahs, surahs: {}, edition: { identifier: edition(u) } } }) };
  }
  if (u.includes('indopak-digitalkhatt')) return { ok: true, json: async () => INDOPAK };
  return { ok: false, status: 404, json: async () => ({}) };
};

test.afterEach(async () => {
  cleanup();
  localStorage.clear();
  clearPageCache();
  clearIndopakCache();
  await new Promise((resolve) => setTimeout(resolve, 20));
  getBackStack().reset();
});

const mount = (over = {}) => {
  const log = [];
  globalThis.fetch = over.fetch ?? fakeFetch(log);
  const calls = { positions: [], pages: [], back: 0, bookmarks: [], opened: [], copied: [] };
  render(React.createElement(MushafReader, {
    initialPage: 2,
    settings: { ...DEFAULT_READER_SETTINGS, showTranslation: true },
    onChangeSettings: () => {},
    bookmarkedAyahs: [],
    onBookmarkToggle: (key) => calls.bookmarks.push(key),
    onBack: () => { calls.back += 1; },
    onOpenSurah: (s, a) => calls.opened.push([s, a]),
    onPosition: (position, range) => calls.positions.push([position, range]),
    onPageChange: (p) => calls.pages.push(p),
    onCopy: (t) => calls.copied.push(t),
    dwellMs: 20,
    ...over.props,
  }));
  return { log, calls };
};

test('a page shows its ayahs in one flow, with the surah banner and the Bismillah ahead of the first ayah', async () => {
  mount();
  await screen.findByText(/الٓمٓ/);
  assert.ok(screen.getByText('سورة 2'), 'surah banner');
  assert.equal(screen.getAllByText('Al-Baqara').length, 2, 'the page title and the banner');
  assert.ok(screen.getByText(/ذَٰلِكَ ٱلْكِتَٰبُ/));
  assert.equal(document.body.textContent.includes('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ الٓمٓ'), false, 'the Bismillah is not repeated inside ayah 1');
  assert.match(document.body.textContent, /Page 2/);
  assert.match(document.body.textContent, /604/);
});

test('the page is requested from the text service, not the surah', async () => {
  const { log } = mount();
  await screen.findByText(/الٓمٓ/);
  assert.ok(log.some((u) => u.endsWith('/page/2/quran-uthmani')));
});

test('the next and previous buttons turn the page, and the page change is reported', async () => {
  const { calls } = mount();
  await screen.findByText(/الٓمٓ/);
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  await screen.findByText(/إِنَّ ٱلَّذِينَ/);
  assert.match(document.body.textContent, /Page 3/);
  fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
  await screen.findByText(/الٓمٓ/);
  assert.deepEqual(calls.pages.slice(-2), [3, 2]);
});

test('swiping right turns to the next page and swiping left to the previous', async () => {
  mount();
  await screen.findByText(/الٓمٓ/);
  const area = document.querySelector('[data-page-area]');
  fireEvent.pointerDown(area, { clientX: 100, clientY: 300, pointerId: 1, isPrimary: true });
  fireEvent.pointerUp(area, { clientX: 240, clientY: 305, pointerId: 1, isPrimary: true });
  await screen.findByText(/إِنَّ ٱلَّذِينَ/);
  fireEvent.pointerDown(area, { clientX: 240, clientY: 300, pointerId: 2, isPrimary: true });
  fireEvent.pointerUp(area, { clientX: 100, clientY: 300, pointerId: 2, isPrimary: true });
  await screen.findByText(/الٓمٓ/);
});

test('a vertical drag scrolls and does not turn the page', async () => {
  mount();
  await screen.findByText(/الٓمٓ/);
  const area = document.querySelector('[data-page-area]');
  fireEvent.pointerDown(area, { clientX: 100, clientY: 100, pointerId: 1, isPrimary: true });
  fireEvent.pointerUp(area, { clientX: 110, clientY: 400, pointerId: 1, isPrimary: true });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
  assert.match(document.body.textContent, /Page 2/);
});

test('the first page has no previous page and the last has no next', async () => {
  mount({ props: { initialPage: 1 } });
  await waitFor(() => assert.match(document.body.textContent, /Page 1/));
  assert.equal(screen.getByRole('button', { name: 'Previous page' }).disabled, true);
  cleanup();
  mount({ props: { initialPage: 604 } });
  await waitFor(() => assert.match(document.body.textContent, /Page 604/));
  assert.equal(screen.getByRole('button', { name: 'Next page' }).disabled, true);
});

test('jumping to a page or a juz goes straight there', async () => {
  mount();
  await screen.findByText(/الٓمٓ/);
  fireEvent.click(screen.getByRole('button', { name: /Go to page/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Juz 2' }));
  await screen.findByText(/سَيَقُولُ/);
  assert.match(document.body.textContent, /Page 22/);
  fireEvent.click(screen.getByRole('button', { name: /Go to page/ }));
  const input = await screen.findByLabelText('Page number');
  fireEvent.change(input, { target: { value: '3' } });
  fireEvent.click(screen.getByRole('button', { name: 'Go' }));
  await screen.findByText(/إِنَّ ٱلَّذِينَ/);
});

test('tapping an ayah shows its translation, and copy and bookmark work on it', async () => {
  const { calls } = mount();
  await screen.findByText(/الٓمٓ/);
  fireEvent.click(document.querySelector('[data-ayah="9"]'));
  assert.ok(await screen.findByText('This is the Scripture.'));
  fireEvent.click(screen.getByRole('button', { name: 'Copy ayah' }));
  assert.match(calls.copied[0], /— Al-Baqara 2:2$/);
  fireEvent.click(screen.getByRole('button', { name: 'Bookmark ayah' }));
  assert.deepEqual(calls.bookmarks, ['2:2']);
  fireEvent.click(screen.getByRole('button', { name: 'Read in surah view' }));
  assert.deepEqual(calls.opened, [[2, 2]]);
});

test('a failed page offers a retry and does not lose the page number', async () => {
  const log = [];
  let failing = true;
  const base = fakeFetch(log);
  mount({ fetch: async (url) => (failing && String(url).includes('/page/2/') ? { ok: false, status: 503, json: async () => ({}) } : base(url)) });
  const retry = await screen.findByRole('button', { name: /Retry/ });
  assert.match(document.body.textContent, /Page 2/);
  failing = false;
  fireEvent.click(retry);
  await screen.findByText(/الٓمٓ/);
});

test('a translation that cannot load never hides the Arabic page', async () => {
  const log = [];
  const base = fakeFetch(log);
  mount({ fetch: async (url) => (String(url).endsWith('en.pickthall') ? { ok: false, status: 500, json: async () => ({}) } : base(url)) });
  await screen.findByText(/الٓمٓ/);
  fireEvent.click(document.querySelector('[data-ayah="9"]'));
  assert.equal(screen.queryByText('This is the Scripture.'), null);
});

test('reading a page for a few seconds after a real touch records where the reader is', async () => {
  const { calls } = mount();
  await screen.findByText(/الٓمٓ/);
  assert.equal(calls.positions.length, 0, 'opening a page is not reading it');
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  await screen.findByText(/إِنَّ ٱلَّذِينَ/);
  await waitFor(() => assert.equal(calls.positions.length, 1));
  assert.deepEqual(calls.positions[0], [{ surah: 2, ayah: 6, global: 13 }, { from: 13, to: 13 }]);
});

test('the tajweed script asks for the colour edition too', async () => {
  const { log } = mount({ props: { settings: { ...DEFAULT_READER_SETTINGS, script: 'tajweed', showTranslation: false } } });
  await screen.findByText(/الٓمٓ/);
  assert.ok(log.some((u) => u.endsWith('/page/2/quran-tajweed')));
});

test('IndoPak pages use the bundled text and its font, and ask the service only for ayah details', async () => {
  const { log } = mount({ props: { settings: { ...DEFAULT_READER_SETTINGS, script: 'indopak', showTranslation: false } } });
  await waitFor(() => assert.ok(document.querySelector('.font-indopak [data-ayah="9"]') || document.querySelector('[data-ayah="9"]')));
  const ayah = document.querySelector('[data-ayah="9"]');
  assert.ok(ayah.closest('.font-indopak'));
  assert.equal(ayah.querySelector('[aria-hidden="true"]').textContent, INDOPAK.surahs[1][1], 'exactly as in the bundled file');
  assert.ok(log.some((u) => u.endsWith('/page/2/quran-uthmani')));
});

test('back from the page view is the screen\'s own back action', async () => {
  const { calls } = mount();
  await screen.findByText(/الٓمٓ/);
  fireEvent.click(screen.getByRole('button', { name: /Back to Surah list/ }));
  assert.equal(calls.back, 1);
});

// ── review fixes ─────────────────────────────────────────────────────────────

test('a new page opens at its top, not where the last one was scrolled to', async () => {
  mount();
  await screen.findByText(/الٓمٓ/);
  const area = document.querySelector('[data-page-area]');
  area.scrollTop = 300;
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  await screen.findByText(/إِنَّ ٱلَّذِينَ/);
  assert.equal(area.scrollTop, 0);
});

test('an ayah can be chosen from the keyboard, so every action is reachable without touch', async () => {
  mount();
  await screen.findByText(/الٓمٓ/);
  const ayah = document.querySelector('[data-ayah="9"]');
  assert.equal(ayah.getAttribute('role'), 'button');
  assert.equal(ayah.getAttribute('tabindex'), '0');
  assert.equal(ayah.getAttribute('aria-pressed'), 'false');
  fireEvent.keyDown(ayah, { key: 'Enter' });
  assert.ok(await screen.findByText('This is the Scripture.'));
  assert.equal(ayah.getAttribute('aria-pressed'), 'true');
  fireEvent.keyDown(ayah, { key: ' ' });
  await waitFor(() => assert.equal(screen.queryByText('This is the Scripture.'), null));
});

test('the copy result is announced', async () => {
  mount({ props: { notice: 'Copied', noticeId: 3 } });
  await screen.findByText(/الٓمٓ/);
  assert.equal(screen.getByRole('status', { name: '' }) && document.querySelector('[role="status"].sr-only').textContent, 'Copied');
});

test('jumping to a far page is not counted as reading the pages skipped over', async () => {
  const { calls } = mount();
  await screen.findByText(/الٓمٓ/);
  fireEvent.click(screen.getByRole('button', { name: /Go to page/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Juz 2' }));
  await screen.findByText(/سَيَقُولُ/);
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 80)); });
  assert.equal(calls.positions.length, 0, 'landing is not reading');
  fireEvent.pointerDown(document.querySelector('[data-page-area]'), { clientX: 10, clientY: 10, pointerId: 1, isPrimary: true });
  await waitFor(() => assert.equal(calls.positions.length, 1), { timeout: 2000 });
  assert.deepEqual(calls.positions[0][1], { from: 150, to: 150 });
});

test('a first touch after the page has been on screen for a while still counts it', async () => {
  const { calls } = mount();
  await screen.findByText(/الٓمٓ/);
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 80)); });
  assert.equal(calls.positions.length, 0);
  fireEvent.pointerDown(document.querySelector('[data-page-area]'), { clientX: 10, clientY: 10, pointerId: 1, isPrimary: true });
  await waitFor(() => assert.equal(calls.positions.length, 1), { timeout: 2000 });
});

test('a second finger or a mouse drag never turns the page', async () => {
  mount();
  await screen.findByText(/الٓمٓ/);
  const area = document.querySelector('[data-page-area]');
  fireEvent.pointerDown(area, { clientX: 100, clientY: 300, pointerId: 2, isPrimary: false });
  fireEvent.pointerUp(area, { clientX: 260, clientY: 300, pointerId: 2, isPrimary: false });
  fireEvent.pointerDown(area, { clientX: 100, clientY: 300, pointerId: 3, pointerType: 'mouse' });
  fireEvent.pointerUp(area, { clientX: 260, clientY: 300, pointerId: 3, pointerType: 'mouse' });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
  assert.match(document.body.textContent, /Page 2 of/);
});

test('the title names both surahs when a page ends in a different surah from the one it starts in', async () => {
  PAGES[603] = [
    { number: 6200, surah: surah(111, 'Al-Masad'), numberInSurah: 5, juz: 30, page: 603, text: 'فِى جِيدِهَا' },
    { number: 6201, surah: surah(112, 'Al-Ikhlas'), numberInSurah: 1, juz: 30, page: 603, text: 'قُلْ هُوَ' },
  ];
  mount({ props: { initialPage: 603 } });
  await screen.findByText(/فِى جِيدِهَا/);
  assert.equal(document.querySelector('h1').textContent, 'Al-Masad – Al-Ikhlas');
  delete PAGES[603];
});

test('a translation that failed once is fetched again the next time the page is visited', async () => {
  const log = [];
  const base = fakeFetch(log);
  let failTranslation = true;
  mount({ fetch: async (url) => (failTranslation && String(url).endsWith('en.pickthall') ? { ok: false, status: 500, json: async () => ({}) } : base(url)) });
  await screen.findByText(/الٓمٓ/);
  failTranslation = false;
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  await screen.findByText(/إِنَّ ٱلَّذِينَ/);
  fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
  await screen.findByText(/الٓمٓ/);
  fireEvent.click(document.querySelector('[data-ayah="9"]'));
  assert.ok(await screen.findByText('This is the Scripture.'));
});

test('Read in surah view waits for the surah list instead of doing nothing', async () => {
  mount({ props: { canOpenSurah: false } });
  await screen.findByText(/الٓمٓ/);
  fireEvent.click(document.querySelector('[data-ayah="9"]'));
  assert.equal((await screen.findByRole('button', { name: 'Read in surah view' })).disabled, true);
});

test('browser shortcuts that use the arrow keys do not turn the page', async () => {
  mount();
  await screen.findByText(/الٓمٓ/);
  fireEvent.keyDown(document, { key: 'ArrowLeft', altKey: true });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
  assert.match(document.body.textContent, /Page 2 of/);
  fireEvent.keyDown(document, { key: 'ArrowLeft' });
  await screen.findByText(/إِنَّ ٱلَّذِينَ/);
});
