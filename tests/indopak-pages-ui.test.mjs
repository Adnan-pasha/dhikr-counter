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
const { render, screen, fireEvent, cleanup, waitFor } = await import('@testing-library/react');
const { default: IndopakPagesReader } = await import('../src/components/IndopakPagesReader.tsx');
const { clearIndopakLayoutCache } = await import('../src/quran/useIndopakLayout.ts');
const { clearIndopakCache } = await import('../src/quran/indopak.ts');
const { clearAyahTranslationCache } = await import('../src/quran/useAyahTranslation.ts');
const { DEFAULT_READER_SETTINGS } = await import('../src/quran/settings.ts');

const data = (name) => JSON.parse(fs.readFileSync(new URL(`../src/quran/data/${name}`, import.meta.url), 'utf8'));
const LAYOUT = data('indopak-15-lines.json');
const TEXT = data('indopak-digitalkhatt.json');
const SURAHS = [
  { number: 1, name: 'الفاتحة', englishName: 'Al-Faatiha', englishNameTranslation: 'The Opening', numberOfAyahs: 7, revelationType: 'Meccan' },
  { number: 2, name: 'البقرة', englishName: 'Al-Baqara', englishNameTranslation: 'The Cow', numberOfAyahs: 286, revelationType: 'Medinan' },
];
const settings = { ...DEFAULT_READER_SETTINGS, script: 'indopak' };

test.afterEach(async () => {
  cleanup();
  localStorage.clear();
  clearIndopakLayoutCache();
  clearIndopakCache();
  clearAyahTranslationCache();
  await new Promise((resolve) => setTimeout(resolve, 20));
});
test.after(() => { dom.window.close(); });

const baseProps = (calls, over) => ({
  initialPage: 3, settings, onChangeSettings: () => {}, surahs: SURAHS, bookmarkedAyahs: [],
  onBookmarkToggle: (k) => calls.bookmarks.push(k), onBack: () => {}, onOpenSurah: (s, a) => calls.opened.push([s, a]),
  onPosition: (p, r) => calls.positions.push([p, r]), onPageChange: (n) => calls.pages.push(n), onCopy: (t) => calls.copies.push(t),
  dwellMs: 30, ...over,
});

const mount = (over = {}) => {
  const calls = { bookmarks: [], copies: [], positions: [], pages: [], opened: [] };
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('indopak-15-lines')) return { ok: true, json: async () => LAYOUT };
    if (u.includes('indopak-digitalkhatt')) return { ok: true, json: async () => TEXT };
    const m = u.match(/\/surah\/(\d+)\/en\.pickthall$/);
    if (m) return { ok: true, json: async () => ({ code: 200, data: { ayahs: Array.from({ length: 300 }, (_, i) => ({ text: `Translation ${m[1]}:${i + 1}` })) } }) };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  render(React.createElement(IndopakPagesReader, baseProps(calls, over)));
  return calls;
};

const ready = () => waitFor(() => assert.ok(document.querySelectorAll('[data-line]').length >= 1));

test('a full page shows fifteen lines, the surah it is in, and page 3 of 610', async () => {
  mount();
  await waitFor(() => assert.equal(document.querySelectorAll('[data-line]').length, 15));
  assert.match(document.body.textContent, /Page 3/);
  assert.match(document.body.textContent, /of 610/);
  assert.match(document.body.textContent, /Al-Baqara/);
});

test('page 1 has the surah name line and the lines of Al-Fatiha', async () => {
  mount({ initialPage: 1 });
  await waitFor(() => assert.ok(document.querySelector('[data-layout-page="1"]')));
  await ready();
  assert.match(document.body.textContent, /الفاتحة/);
});

test('turning the page with the buttons keeps the layout and remembers the page', async () => {
  const calls = mount();
  await ready();
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  await waitFor(() => assert.ok(document.querySelector('[data-layout-page="4"]')));
  fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
  await waitFor(() => assert.ok(document.querySelector('[data-layout-page="3"]')));
  assert.deepEqual(calls.pages.slice(-2), [4, 3]);
});

test('page 610 is the last: Next is disabled', async () => {
  mount({ initialPage: 610 });
  await waitFor(() => assert.ok(document.querySelector('[data-layout-page="610"]')));
  assert.equal(screen.getByRole('button', { name: 'Next page' }).disabled, true);
});

test('tapping a word chooses its ayah: reference, translation, copy, bookmark and the surah view', async () => {
  const calls = mount();
  await ready();
  fireEvent.click(document.querySelector('[data-word]'));
  await screen.findByText(/Al-Baqara 2:5/);
  await screen.findByText('Translation 2:5');
  fireEvent.click(screen.getByRole('button', { name: 'Copy ayah' }));
  assert.match(calls.copies[0], /Translation 2:5/);
  assert.match(calls.copies[0], /Al-Baqara 2:5/);
  assert.ok(!calls.copies[0].includes('۝'), 'the closing ornament is not copied');
  fireEvent.click(screen.getByRole('button', { name: 'Bookmark ayah' }));
  assert.deepEqual(calls.bookmarks, ['2:5']);
  fireEvent.click(screen.getByRole('button', { name: 'Read in surah view' }));
  assert.deepEqual(calls.opened, [[2, 5]]);
  fireEvent.click(screen.getByRole('button', { name: 'Close ayah details' }));
  assert.equal(screen.queryByRole('button', { name: 'Copy ayah' }), null);
});

test('only the words of the chosen ayah are highlighted', async () => {
  mount();
  await ready();
  const first = document.querySelector('[data-word]');
  fireEvent.click(first);
  const index = first.getAttribute('data-ayah-index');
  const marked = [...document.querySelectorAll('[data-word]')].filter((w) => w.style.background);
  assert.ok(marked.length >= 1);
  assert.ok(marked.every((w) => w.getAttribute('data-ayah-index') === index));
});

test('the jump sheet uses 610 pages and the juz pages of this layout', async () => {
  mount();
  await ready();
  fireEvent.click(screen.getByRole('button', { name: 'Go to page, juz or surah' }));
  assert.match(document.body.textContent, /Pages 1 to 610/);
  fireEvent.click(screen.getByRole('button', { name: 'Juz 30' }));
  await waitFor(() => assert.ok(document.querySelector('[data-layout-page="586"]')));
});

test('reading a page after a touch reports its first ayah and span in whole-Quran ayah numbers', async () => {
  const calls = mount({ initialPage: 3 });
  await ready();
  fireEvent.pointerDown(document.querySelector('[data-page-area]'), { isPrimary: true, clientX: 10, clientY: 10, pointerType: 'touch' });
  await waitFor(() => assert.ok(calls.positions.length >= 1));
  const [position, range] = calls.positions[0];
  assert.deepEqual(position, { surah: 2, ayah: 5, global: 12 }, 'page 3 opens inside 2:5, the 12th ayah of the Quran');
  assert.equal(range.from, 12);
  assert.ok(range.to > range.from);
});

test('a damaged layout file shows a retry, not half a page', async () => {
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ pages: [] }) });
  render(React.createElement(IndopakPagesReader, baseProps({ bookmarks: [], copies: [], positions: [], pages: [], opened: [] }, {})));
  await screen.findByRole('button', { name: /Retry/ });
  assert.equal(document.querySelectorAll('[data-line]').length, 0);
});
