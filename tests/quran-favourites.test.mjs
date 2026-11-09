import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

process.env.NODE_ENV = 'development';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://app.test/', pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
const realStorage = dom.window.localStorage;
globalThis.localStorage = realStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { renderHook, act, cleanup } = await import('@testing-library/react');
const {
  FAVOURITE_SURAHS_KEY, SUGGESTED_SURAHS, sanitizeFavouriteSurahs, readFavouriteSurahs, toggleFavouriteSurah, useFavouriteSurahs,
} = await import('../src/quran/favouriteSurahs.ts');
const { surahByNumber } = await import('../src/quran/surahs.ts');

test.beforeEach(() => { globalThis.localStorage = realStorage; realStorage.clear(); });
test.afterEach(() => cleanup());
test.after(() => { dom.window.close(); });

// ── what is kept ──

test('only real surah numbers are kept, once each, in the order they were added', () => {
  assert.deepEqual(sanitizeFavouriteSurahs([67, 36, 67, 18]), [67, 36, 18]);
  assert.deepEqual(sanitizeFavouriteSurahs([0, 115, -3, 1.5, '36', null, 36, NaN]), [36]);
  assert.deepEqual(sanitizeFavouriteSurahs('nonsense'), []);
  assert.deepEqual(sanitizeFavouriteSurahs(undefined), []);
});

test('nothing saved means no favourites; damaged data means no favourites, not a crash', () => {
  assert.deepEqual(readFavouriteSurahs(), []);
  realStorage.setItem(FAVOURITE_SURAHS_KEY, '{not json');
  assert.deepEqual(readFavouriteSurahs(), []);
  realStorage.setItem(FAVOURITE_SURAHS_KEY, JSON.stringify([67, 'x', 999, 36]));
  assert.deepEqual(readFavouriteSurahs(), [67, 36]);
});

test('toggling adds a surah to the end, and toggling again removes it', () => {
  assert.deepEqual(toggleFavouriteSurah(67), [67]);
  assert.deepEqual(toggleFavouriteSurah(36), [67, 36]);
  assert.deepEqual(toggleFavouriteSurah(67), [36]);
  assert.deepEqual(JSON.parse(realStorage.getItem(FAVOURITE_SURAHS_KEY)), [36]);
});

test('toggling something that is not a surah changes nothing', () => {
  toggleFavouriteSurah(67);
  assert.deepEqual(toggleFavouriteSurah(0), [67]);
  assert.deepEqual(toggleFavouriteSurah(115), [67]);
});

test('a phone whose storage is full keeps the choice on screen instead of crashing', () => {
  globalThis.localStorage = { getItem: () => null, setItem() { throw new dom.window.DOMException('full', 'QuranExceededError'); }, removeItem() {}, clear() {} };
  assert.doesNotThrow(() => toggleFavouriteSurah(67));
});

test('the suggestions are the surahs people read every day, and all exist', () => {
  assert.deepEqual(SUGGESTED_SURAHS, [36, 67, 18, 55, 56]);
  assert.deepEqual(SUGGESTED_SURAHS.map((n) => surahByNumber(n).englishName), ['Yaseen', 'Al-Mulk', 'Al-Kahf', 'Ar-Rahmaan', 'Al-Waaqia']);
});

// ── the hook shared by the Read tab and the Pages sheet ──

test('the hook starts from what is saved and updates when a surah is toggled', () => {
  realStorage.setItem(FAVOURITE_SURAHS_KEY, JSON.stringify([67]));
  const { result } = renderHook(() => useFavouriteSurahs());
  assert.deepEqual(result.current.favourites, [67]);
  assert.equal(result.current.isFavourite(67), true);
  assert.equal(result.current.isFavourite(36), false);
  act(() => { result.current.toggle(36); });
  assert.deepEqual(result.current.favourites, [67, 36]);
  assert.equal(result.current.isFavourite(36), true);
});

test('two places showing favourites at once stay in step', () => {
  const first = renderHook(() => useFavouriteSurahs());
  const second = renderHook(() => useFavouriteSurahs());
  act(() => { first.result.current.toggle(18); });
  assert.deepEqual(second.result.current.favourites, [18]);
});

test('the same list is handed back until it really changes, so screens do not redraw for nothing', () => {
  realStorage.setItem(FAVOURITE_SURAHS_KEY, JSON.stringify([67]));
  const { result, rerender } = renderHook(() => useFavouriteSurahs());
  const before = result.current.favourites;
  rerender();
  assert.equal(result.current.favourites, before);
});
