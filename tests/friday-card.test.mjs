import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

process.env.NODE_ENV = 'development';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://app.test/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import('react')).default;
const { render, screen, fireEvent, cleanup } = await import('@testing-library/react');
const { default: FridayCard } = await import('../src/components/FridayCard.tsx');

const checklist = (over = {}) => ({
  isFriday: true,
  items: [{ id: 'kahf', label: 'Read Surah Al-Kahf', done: false }, { id: 'salawat', label: 'Send abundant salawat', done: false }],
  doneCount: 0,
  ...over,
});

const mount = (c = checklist()) => {
  const calls = { open: 0, toggle: 0, salawat: 0 };
  render(React.createElement(FridayCard, {
    checklist: c, onOpenKahf: () => { calls.open += 1; }, onToggleKahf: () => { calls.toggle += 1; }, onStartSalawat: () => { calls.salawat += 1; },
  }));
  return calls;
};

test.afterEach(() => cleanup());

test('nothing renders except on a Friday', () => {
  mount({ isFriday: false, items: [], doneCount: 0 });
  assert.equal(document.getElementById('friday_card'), null);
});

test('the card greets, counts progress and lists both sunnahs', () => {
  mount(checklist({ doneCount: 1 }));
  const card = document.getElementById('friday_card');
  assert.match(card.textContent, /Jumu.ah Mubarak/);
  assert.match(card.textContent, /1 of 2/);
  assert.match(card.textContent, /Read Surah Al-Kahf/);
  assert.match(card.textContent, /Send abundant salawat/);
});

test('Al-Kahf can be opened and marked read; salawat can be started', () => {
  const calls = mount();
  fireEvent.click(screen.getByRole('button', { name: /Open Al-Kahf/ }));
  fireEvent.click(screen.getByRole('button', { name: /Mark Al-Kahf as read/ }));
  fireEvent.click(screen.getByRole('button', { name: /Start salawat/ }));
  assert.deepEqual(calls, { open: 1, toggle: 1, salawat: 1 });
});

test('a finished item is announced as done and the mark button becomes an undo', () => {
  mount(checklist({
    items: [{ id: 'kahf', label: 'Read Surah Al-Kahf', done: true }, { id: 'salawat', label: 'Send abundant salawat', done: true }],
    doneCount: 2,
  }));
  assert.equal(screen.getByRole('button', { name: /Al-Kahf marked as read/ }).getAttribute('aria-pressed'), 'true');
  assert.match(document.getElementById('friday_card').textContent, /Salawat done/);
});
