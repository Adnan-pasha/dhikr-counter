import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

process.env.NODE_ENV = 'development';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://app.test/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.localStorage = dom.window.localStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import('react')).default;
const { render, screen, fireEvent, cleanup } = await import('@testing-library/react');
const { default: SalahTracker } = await import('../src/components/SalahTracker.tsx');
const { toDateString, addDays, dayLabel } = await import('../src/salah.ts');

const today = toDateString(new Date());
const yesterday = addDays(today, -1);
const threeDaysAgo = addDays(today, -3);

test.afterEach(() => { cleanup(); localStorage.clear(); });
test.after(() => { dom.window.close(); });

const mount = (logs = [], over = {}) => {
  const calls = { toggles: [], days: [] };
  render(React.createElement(SalahTracker, {
    salahLogs: logs, onGoBack: () => {},
    onTogglePrayer: (date, prayer) => calls.toggles.push([date, prayer]),
    onSetDay: (date, done) => calls.days.push([date, done]),
    ...over,
  }));
  return calls;
};

const dayButtons = (date, count = 0) => screen.getAllByRole('button', { name: dayLabel(date, count) });
const full = (date) => ({ date, prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true } });

test('five prayers are listed and Sunrise is gone', () => {
  mount();
  assert.equal(screen.getAllByRole('checkbox').length, 5);
  assert.equal(screen.queryByText('Sunrise'), null);
  assert.match(document.body.textContent, /0\/5/);
});

test('tapping a day in an earlier month opens it, and the prayers then log against that date', () => {
  localStorage.setItem('tasbih_installed_on', addDays(today, -60));
  const calls = mount();
  fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
  const earlier = toDateString(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 15));
  const [cell] = dayButtons(earlier);
  assert.ok(cell, 'the 15th of last month is in the calendar');
  fireEvent.click(cell);
  assert.ok(screen.getByRole('button', { name: 'Back to today' }));
  fireEvent.click(screen.getAllByRole('checkbox')[1]);
  assert.deepEqual(calls.toggles, [[earlier, 'dhuhr']]);
});

test('tapping a day in the last-7-days strip opens it', () => {
  localStorage.setItem('tasbih_installed_on', addDays(today, -10));
  const calls = mount();
  fireEvent.click(dayButtons(threeDaysAgo)[0]);
  fireEvent.click(screen.getAllByRole('checkbox')[0]);
  assert.deepEqual(calls.toggles, [[threeDaysAgo, 'fajr']]);
});

test('Mark all and Clear day act on the day being shown', () => {
  const calls = mount([full(today)]);
  fireEvent.click(screen.getByRole('button', { name: 'Clear day' }));
  assert.deepEqual(calls.days, [[today, false]]);
  assert.equal(screen.getByRole('button', { name: /Mark all 5/ }).disabled, true, 'nothing to mark when all five are done');
});

test('Back to today returns to today', () => {
  localStorage.setItem('tasbih_installed_on', addDays(today, -10));
  mount();
  fireEvent.click(dayButtons(yesterday)[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Back to today' }));
  assert.equal(screen.queryByRole('button', { name: 'Back to today' }), null);
});

test('yesterday with prayers missing is offered as a shortcut, and opens when tapped', () => {
  localStorage.setItem('tasbih_installed_on', addDays(today, -10));
  mount([{ date: yesterday, prayers: { fajr: true, asr: true } }]);
  fireEvent.click(screen.getByRole('button', { name: /Yesterday: 2\/5/ }));
  assert.ok(screen.getByRole('button', { name: 'Back to today' }));
});

test('no shortcut when yesterday is complete or before the app was installed', () => {
  mount([full(yesterday)]);
  assert.equal(screen.queryByRole('button', { name: /Yesterday:/ }), null);
  cleanup();
  mount();
  assert.equal(screen.queryByRole('button', { name: /Yesterday:/ }), null, 'installed today, so yesterday is out of reach');
});

test('the calendar goes back to the install month and no further, and never forward past this month', () => {
  localStorage.setItem('tasbih_installed_on', addDays(today, -40));
  mount();
  assert.equal(screen.getByRole('button', { name: 'Next month' }).disabled, true);
  let guard = 0;
  while (!screen.getByRole('button', { name: 'Previous month' }).disabled && guard++ < 5) {
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
  }
  assert.ok(guard >= 1 && guard <= 3, `went back ${guard} months`);
  assert.equal(screen.getByRole('button', { name: 'Next month' }).disabled, false);
});

test('a completed day shows a tick, not only a colour, and days have spoken labels', () => {
  mount([full(today)]);
  const cell = screen.getAllByRole('button').find((b) => /all 5 prayers$/.test(b.getAttribute('aria-label') ?? '') && b.querySelector('svg') && b.closest('.grid-cols-7'));
  assert.ok(cell);
});

test('when midnight passes while today is showing, the screen moves on to the new today', () => {
  const props = { salahLogs: [], onGoBack: () => {}, onTogglePrayer: () => {}, onSetDay: () => {} };
  const { rerender } = render(React.createElement(SalahTracker, { ...props, today }));
  assert.equal(screen.queryByRole('button', { name: 'Back to today' }), null);
  const tomorrow = addDays(today, 1);
  rerender(React.createElement(SalahTracker, { ...props, today: tomorrow }));
  assert.equal(screen.queryByRole('button', { name: 'Back to today' }), null, 'still on today, now the new one');
  assert.match(document.body.textContent, new RegExp(String(new Date(tomorrow + 'T00:00:00').getDate())));
});

test('the dhikr offer is only shown while today is open', () => {
  localStorage.setItem('tasbih_installed_on', addDays(today, -10));
  const routine = { id: 'routine-after-salah', name: 'After Salah', icon: 'dua', dhikrIds: ['a'], createdAt: '2026-01-01T00:00:00.000Z' };
  mount([], { afterSalah: { prayer: 'asr', routine } });
  assert.ok(document.getElementById('after_salah_prompt'));
  fireEvent.click(dayButtons(yesterday)[0]);
  assert.equal(document.getElementById('after_salah_prompt'), null);
});
