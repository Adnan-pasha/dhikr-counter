import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

process.env.NODE_ENV = 'development';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://app.test/', pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.localStorage = dom.window.localStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const scrolled = [];
dom.window.Element.prototype.scrollIntoView = function scrollIntoView() { scrolled.push(this.id); };

// A fake IntersectionObserver the tests can drive by hand.
const observers = [];
class FakeObserver {
  constructor(callback) { this.callback = callback; this.observed = []; observers.push(this); }
  observe(el) { this.observed.push(el); }
  disconnect() { this.observed = []; this.disconnected = true; }
}
globalThis.IntersectionObserver = FakeObserver;
dom.window.IntersectionObserver = FakeObserver;

const React = (await import('react')).default;
const { render, cleanup, fireEvent, act } = await import('@testing-library/react');
const { default: ReaderView } = await import('../src/components/ReaderView.tsx');
const { DEFAULT_READER_SETTINGS } = await import('../src/quran/settings.ts');

const surah = { number: 2, name: 'x', englishName: 'Al-Baqara', englishNameTranslation: 'The Cow', numberOfAyahs: 286, revelationType: 'Medinan' };
const ayahsOf = (from, to, base = 7) => Array.from({ length: to - from + 1 }, (_, i) => ({
  number: base + from + i, numberInSurah: from + i, arabic: 'ا', translation: null, transliteration: null, juz: 1, page: 1,
}));

const setVisibility = (state) => Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });

test.afterEach(() => { cleanup(); mock.timers.reset(); observers.length = 0; scrolled.length = 0; setVisibility('visible'); });

const mount = (over = {}) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const calls = { position: [], scrolled: 0 };
  const props = {
    surah, ayahs: ayahsOf(1, 10), loading: false, error: false, settings: DEFAULT_READER_SETTINGS, onChangeSettings: () => {},
    bookmarkedAyahs: [], onBookmarkToggle: () => {}, onBack: () => {}, backTo: 'surahs', onRetry: () => {}, onOpenSurah: () => {},
    onCopy: () => {}, notice: '', noticeId: 0, goal: null, scrollToAyah: null,
    onScrolledToAyah: () => { calls.scrolled += 1; },
    onPosition: (...args) => calls.position.push(args),
    ...over,
  };
  const view = render(React.createElement(ReaderView, props));
  const scroller = document.querySelector('[aria-busy]');
  const observer = () => observers.at(-1);
  const see = (...numbers) => {
    const targets = observer().observed.filter((el) => numbers.includes(Number(el.dataset.ayah)));
    const gone = observer().observed.filter((el) => !numbers.includes(Number(el.dataset.ayah)));
    act(() => observer().callback([
      ...targets.map((target) => ({ target, isIntersecting: true })),
      ...gone.map((target) => ({ target, isIntersecting: false })),
    ]));
  };
  return { ...view, calls, scroller, observer, see, props };
};

test('every ayah card is watched', () => {
  const { observer } = mount();
  assert.equal(observer().observed.length, 10);
});

test('nothing is saved while the reader has only been opened: peeking must not move "continue"', () => {
  const { calls, see } = mount();
  see(1, 2, 3);
  mock.timers.tick(2000);
  assert.deepEqual(calls.position, []);
});

test('once the reader has scrolled, the top ayah and the span on screen are saved after a pause', () => {
  const { calls, see, scroller } = mount();
  fireEvent.wheel(scroller);
  see(4, 5, 6, 7);
  assert.equal(calls.position.length, 0, 'not before the pause');
  mock.timers.tick(900);
  assert.equal(calls.position.length, 1);
  const [surahNumber, ayah, seen] = calls.position[0];
  assert.equal(surahNumber, 2);
  assert.equal(ayah.numberInSurah, 4, 'the topmost visible ayah is the bookmark');
  assert.deepEqual(seen, { from: 7 + 4, to: 7 + 7 }, 'the last visible ayah counts as read too, not only the top one');
});

test('touch scrolling and the keyboard also count as scrolling', () => {
  const touch = mount();
  fireEvent.touchMove(touch.scroller);
  touch.see(1);
  mock.timers.tick(900);
  assert.equal(touch.calls.position.length, 1);
  cleanup();
  mock.timers.reset();
  observers.length = 0;
  const key = mount();
  fireEvent.keyDown(document.body, { key: 'PageDown' });
  key.see(1);
  mock.timers.tick(900);
  assert.equal(key.calls.position.length, 1);
});

test('several reports in quick succession save once, with the latest', () => {
  const { calls, see, scroller } = mount();
  fireEvent.wheel(scroller);
  see(1, 2);
  mock.timers.tick(300);
  see(3, 4);
  mock.timers.tick(300);
  see(5, 6);
  mock.timers.tick(900);
  assert.equal(calls.position.length, 1);
  assert.equal(calls.position[0][1].numberInSurah, 5);
});

test('leaving the page right after scrolling still saves where you were', () => {
  const { calls, see, scroller, unmount } = mount();
  fireEvent.wheel(scroller);
  see(8, 9);
  unmount();
  assert.equal(calls.position.length, 1);
  assert.equal(calls.position[0][1].numberInSurah, 8);
});

test('hiding the app or locking the phone saves it too', () => {
  const { calls, see, scroller } = mount();
  fireEvent.wheel(scroller);
  see(6);
  setVisibility('hidden');
  document.dispatchEvent(new dom.window.Event('visibilitychange'));
  assert.equal(calls.position.length, 1);
});

test('a save is never made for a surah other than the one being read', () => {
  const { calls, see, scroller, rerender, props } = mount();
  fireEvent.wheel(scroller);
  see(3);
  // Move on to another surah before the pause ends; the pending save belongs to surah 2.
  rerender(React.createElement(ReaderView, { ...props, surah: { ...surah, number: 3, englishName: 'Aal-i-Imraan' }, ayahs: ayahsOf(1, 5, 293) }));
  assert.equal(calls.position.length, 1);
  assert.equal(calls.position[0][0], 2, 'attributed to the surah it was read in');
});

test('continuing waits for the saved ayah to exist and then scrolls to it once', () => {
  // Ayahs from the previous surah are still on screen: ayah 40 of surah 2 is not there yet.
  const stale = ayahsOf(1, 5);
  const { calls, rerender, props } = mount({ scrollToAyah: 40, ayahs: stale });
  assert.equal(calls.scrolled, 0, 'the target is kept, not thrown away');
  assert.deepEqual(scrolled, []);
  rerender(React.createElement(ReaderView, { ...props, scrollToAyah: 40, ayahs: ayahsOf(1, 60) }));
  assert.deepEqual(scrolled, ['ayah-2-40']);
  assert.equal(calls.scrolled, 1);
});

test('without IntersectionObserver the page still works', () => {
  const saved = globalThis.IntersectionObserver;
  delete globalThis.IntersectionObserver;
  try {
    assert.doesNotThrow(() => mount());
  } finally {
    globalThis.IntersectionObserver = saved;
  }
});
