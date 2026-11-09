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
const { default: PageJumpSheet } = await import('../src/components/PageJumpSheet.tsx');
const { SURAHS } = await import('../src/quran/surahs.ts');
const { FAVOURITE_SURAHS_KEY } = await import('../src/quran/favouriteSurahs.ts');

const FIRST_PAGES = SURAHS.map((s) => s.firstPage);

test.beforeEach(() => { localStorage.clear(); });
test.afterEach(() => cleanup());
test.after(() => { dom.window.close(); });

const open = (props = {}) => {
  const gone = [];
  const view = render(React.createElement(PageJumpSheet, {
    open: true, onClose: () => {}, page: 10, onGo: (page) => gone.push(page), surahFirstPages: FIRST_PAGES, ...props,
  }));
  return { gone, ...view };
};

test('the sheet offers a surah search as well as page number and juz', () => {
  open();
  assert.ok(screen.getByRole('dialog', { name: /page, juz or surah/i }));
  assert.ok(screen.getByRole('searchbox', { name: 'Search surahs' }));
  assert.ok(screen.getByRole('spinbutton', { name: /Page number/i }));
  assert.ok(screen.getByRole('group', { name: 'Juz' }));
});

test('typing a name shows the surah, and choosing it goes to its first page', () => {
  const { gone } = open();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search surahs' }), { target: { value: 'yasin' } });
  const list = screen.getByRole('list', { name: 'Surahs' });
  assert.equal(within(list).getAllByRole('listitem').length, 1);
  fireEvent.click(within(list).getByRole('button', { name: /Yaseen/ }));
  assert.deepEqual(gone, [440]);
});

test('a number works too', () => {
  const { gone } = open();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search surahs' }), { target: { value: '67' } });
  fireEvent.click(screen.getByRole('button', { name: /Al-Mulk/ }));
  assert.deepEqual(gone, [562]);
});

test('every surah is listed before anything is typed', () => {
  open();
  assert.equal(within(screen.getByRole('list', { name: 'Surahs' })).getAllByRole('listitem').length, 114);
});

test('a search with no match says so', () => {
  open();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search surahs' }), { target: { value: 'qxj' } });
  assert.ok(screen.getByText(/No surah matches/));
  assert.equal(screen.queryByRole('list', { name: 'Surahs' }), null);
});

test('favourite surahs are quick jumps at the top, in the order they were saved', () => {
  localStorage.setItem(FAVOURITE_SURAHS_KEY, JSON.stringify([67, 36]));
  const { gone } = open();
  const group = screen.getByRole('group', { name: 'My surahs' });
  const names = within(group).getAllByRole('button').map((b) => b.textContent);
  assert.match(names[0], /Al-Mulk/);
  assert.match(names[1], /Yaseen/);
  fireEvent.click(within(group).getByRole('button', { name: /Yaseen/ }));
  assert.deepEqual(gone, [440]);
});

test('with no favourites there is no empty "My surahs" box in the way', () => {
  open();
  assert.equal(screen.queryByRole('group', { name: 'My surahs' }), null);
});

test('a reader that cannot place surahs yet (its layout is still loading) simply has no surah section', () => {
  open({ surahFirstPages: undefined });
  assert.equal(screen.queryByRole('searchbox', { name: 'Search surahs' }), null);
  assert.ok(screen.getByRole('group', { name: 'Juz' }), 'the rest of the sheet still works');
});

test('the search starts empty each time the sheet opens', () => {
  const { rerender } = open();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search surahs' }), { target: { value: 'mulk' } });
  rerender(React.createElement(PageJumpSheet, { open: false, onClose: () => {}, page: 10, onGo: () => {}, surahFirstPages: FIRST_PAGES }));
  rerender(React.createElement(PageJumpSheet, { open: true, onClose: () => {}, page: 10, onGo: () => {}, surahFirstPages: FIRST_PAGES }));
  assert.equal(screen.getByRole('searchbox', { name: 'Search surahs' }).value, '');
});
