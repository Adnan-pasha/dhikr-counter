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
const { default: ActivityChart } = await import('../src/components/ActivityChart.tsx');

const TODAY = '2026-03-20';
const at = (date, count, hour = 12) => ({ id: `${date}-${count}`, dhikrId: 'd', dhikrName: 'D', count, timestamp: new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`).toISOString() });
const history = [at(TODAY, 150, 6), at('2026-03-19', 100), at('2026-03-05', 40), at('2025-08-10', 60)];
const mount = (h = history) => render(React.createElement(ActivityChart, { history: h, today: TODAY }));
const text = (id) => document.getElementById(id).textContent;

test.afterEach(() => cleanup());

test('opens on the week view with a spoken summary and a comparison', () => {
  mount();
  assert.equal(screen.getByRole('button', { name: 'Week' }).getAttribute('aria-pressed'), 'true');
  assert.equal(text('stats_total'), '250');
  assert.equal(text('stats_active'), '2');
  assert.match(document.querySelector('[role="img"]').getAttribute('aria-label'), /250 beads over the week/);
});

test('switching range recomputes the numbers', () => {
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Day' }));
  assert.equal(text('stats_total'), '150');
  assert.equal(text('stats_best'), '6a');
  assert.match(text('stats_comparison'), /\+50% vs yesterday/);
  fireEvent.click(screen.getByRole('button', { name: 'Month' }));
  assert.equal(text('stats_total'), '290');
  fireEvent.click(screen.getByRole('button', { name: 'Year' }));
  assert.equal(text('stats_total'), '350');
  assert.equal(screen.getByRole('button', { name: 'Year' }).getAttribute('aria-pressed'), 'true');
});

test('an empty history shows zeros and a calm comparison line', () => {
  mount([]);
  assert.equal(text('stats_total'), '0');
  assert.equal(text('stats_best'), '–');
  assert.match(text('stats_comparison'), /Nothing to compare/);
});

test('the month view names its best day as a date, not a bare number', () => {
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Month' }));
  assert.equal(text('stats_best'), 'Mar 20');
});

test('range changes are announced and every bar is readable without sight', () => {
  mount();
  assert.equal(document.querySelector('#activity_chart [aria-live="polite"]') !== null, true);
  const items = [...document.querySelectorAll('#activity_chart ul.sr-only li')];
  assert.equal(items.length, 7, 'one entry per bucket in the week view');
  assert.match(items.at(-1).textContent, /Fri.*150 beads/);
});
