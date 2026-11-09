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
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Element = dom.window.Element;

const React = (await import('react')).default;
const { render, screen, fireEvent, cleanup, within } = await import('@testing-library/react');
const { default: SurahList } = await import('../src/components/SurahList.tsx');
const { SURAHS } = await import('../src/quran/surahs.ts');
const { FAVOURITE_SURAHS_KEY } = await import('../src/quran/favouriteSurahs.ts');

test.beforeEach(() => { localStorage.clear(); });
test.afterEach(() => cleanup());
test.after(() => { dom.window.close(); });

const mount = (props = {}) => {
  const opened = [];
  const view = render(React.createElement(SurahList, {
    surahs: SURAHS, loading: false, error: false, onRetry: () => {}, lastReadSurah: 0, bookmarkedAyahs: [],
    onSelect: (surah) => opened.push(surah.number), onGoBack: () => {}, ...props,
  }));
  return { opened, ...view };
};
const saved = () => JSON.parse(localStorage.getItem(FAVOURITE_SURAHS_KEY) ?? '[]');

// ── the star on every surah ──

test('every surah has a star that adds it to favourites and takes it off again', () => {
  mount();
  const add = screen.getByRole('button', { name: 'Add Al-Mulk to favourites' });
  assert.equal(add.getAttribute('aria-pressed'), 'false');
  fireEvent.click(add);
  const remove = screen.getByRole('button', { name: 'Remove Al-Mulk from favourites' });
  assert.equal(remove.getAttribute('aria-pressed'), 'true');
  assert.deepEqual(saved(), [67]);
  fireEvent.click(remove);
  assert.deepEqual(saved(), []);
  assert.ok(screen.getByRole('button', { name: 'Add Al-Mulk to favourites' }));
});

test('tapping the star does not open the surah', () => {
  const { opened } = mount();
  fireEvent.click(screen.getByRole('button', { name: 'Add Yaseen to favourites' }));
  assert.deepEqual(opened, []);
});

test('tapping the rest of the row still opens the surah', () => {
  const { opened } = mount();
  fireEvent.click(screen.getByText('Al-Mulk'));
  assert.deepEqual(opened, [67]);
});

// ── My surahs ──

test('favourites appear in a My surahs strip at the top, in the order they were added, and open on a tap', () => {
  localStorage.setItem(FAVOURITE_SURAHS_KEY, JSON.stringify([67, 36, 18]));
  const { opened } = mount();
  const strip = screen.getByRole('region', { name: 'My surahs' });
  const chips = within(strip).getAllByRole('button', { name: /^Open / }).map((b) => b.textContent);
  assert.deepEqual(chips.map((t) => t.replace(/[^A-Za-z-]/g, '')), ['Al-Mulk', 'Yaseen', 'Al-Kahf']);
  fireEvent.click(within(strip).getByRole('button', { name: 'Open Yaseen' }));
  assert.deepEqual(opened, [36]);
});

test('a surah can be taken off from the strip itself', () => {
  localStorage.setItem(FAVOURITE_SURAHS_KEY, JSON.stringify([67, 36]));
  mount();
  const strip = screen.getByRole('region', { name: 'My surahs' });
  fireEvent.click(within(strip).getByRole('button', { name: 'Remove Al-Mulk from My surahs' }));
  assert.deepEqual(saved(), [36]);
});

test('the strip is there even when the surah list could not be loaded (no connection)', () => {
  localStorage.setItem(FAVOURITE_SURAHS_KEY, JSON.stringify([67]));
  mount({ surahs: [], error: true });
  assert.ok(screen.getByRole('region', { name: 'My surahs' }));
  assert.ok(screen.getByText(/Could not load Quran/));
});

// ── the first time ──

test('with nothing saved it suggests the daily surahs, and choosing one moves it into My surahs', () => {
  mount();
  assert.equal(screen.queryByRole('region', { name: 'My surahs' }), null);
  const suggestions = screen.getByRole('region', { name: 'Suggested daily surahs' });
  const names = within(suggestions).getAllByRole('button').map((b) => b.getAttribute('aria-label'));
  assert.deepEqual(names, ['Add Yaseen to My surahs', 'Add Al-Mulk to My surahs', 'Add Al-Kahf to My surahs', 'Add Ar-Rahmaan to My surahs', 'Add Al-Waaqia to My surahs']);
  fireEvent.click(within(suggestions).getByRole('button', { name: 'Add Al-Mulk to My surahs' }));
  assert.deepEqual(saved(), [67]);
  assert.ok(screen.getByRole('region', { name: 'My surahs' }));
  assert.equal(screen.queryByRole('region', { name: 'Suggested daily surahs' }), null, 'suggestions step aside once there is a favourite');
});

// ── searching ──

test('while searching, the strip and suggestions step out of the way', () => {
  localStorage.setItem(FAVOURITE_SURAHS_KEY, JSON.stringify([67]));
  mount();
  fireEvent.change(screen.getByRole('textbox', { name: 'Search surahs' }), { target: { value: 'kah' } });
  assert.equal(screen.queryByRole('region', { name: 'My surahs' }), null);
});

test('the search accepts the spellings people actually use', () => {
  mount();
  fireEvent.change(screen.getByRole('textbox', { name: 'Search surahs' }), { target: { value: 'yasin' } });
  assert.ok(screen.getByText('Yaseen'));
  fireEvent.change(screen.getByRole('textbox', { name: 'Search surahs' }), { target: { value: 'rahman' } });
  assert.ok(screen.getByText('Ar-Rahmaan'));
});

test('the old kinds of search still work: a number, part of a name, the meaning', () => {
  mount();
  const input = screen.getByRole('textbox', { name: 'Search surahs' });
  fireEvent.change(input, { target: { value: '67' } });
  assert.ok(screen.getByText('Al-Mulk'));
  fireEvent.change(input, { target: { value: 'sovereign' } });
  assert.ok(screen.getByText('Al-Mulk'));
});
