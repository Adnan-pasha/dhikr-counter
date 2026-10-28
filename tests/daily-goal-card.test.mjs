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
const { default: DailyGoalCard } = await import('../src/components/DailyGoalCard.tsx');
const { sanitizePreferences } = await import('../src/domain.ts');

const progress = { beads: 40, goal: 100, ratio: 0.4, done: false };
const streak = (over = {}) => ({ streak: 5, freezes: 0, freezeDates: [], atRisk: false, paused: false, ...over });

const mount = (props = {}) => {
  const calls = { start: [], end: 0 };
  render(React.createElement(DailyGoalCard, {
    progress, streakInfo: streak(), onStartPause: (d) => calls.start.push(d), onEndPause: () => { calls.end += 1; }, ...props,
  }));
  return calls;
};

test.afterEach(() => cleanup());

test('the ring is exposed as a progressbar with a spoken value', () => {
  mount();
  const bar = screen.getByRole('progressbar', { name: 'Daily goal' });
  assert.equal(bar.getAttribute('aria-valuenow'), '40');
  assert.equal(bar.getAttribute('aria-valuemax'), '100');
  assert.equal(bar.getAttribute('aria-valuetext'), '40 of 100 beads today');
});

test('the streak line is shown and pause is offered while a streak is running', () => {
  mount({ streakInfo: streak({ atRisk: true }) });
  assert.match(document.getElementById('streak_message').textContent, /5-day streak\. One bead today/);
  assert.ok(document.getElementById('btn_pause_streak'));
});

test('no pause button without a streak to protect', () => {
  mount({ streakInfo: streak({ streak: 0 }) });
  assert.equal(document.getElementById('btn_pause_streak'), null);
});

test('choosing a pause length starts a pause for that many days', () => {
  const calls = mount();
  fireEvent.click(document.getElementById('btn_pause_streak'));
  fireEvent.click(screen.getByRole('button', { name: '7 days' }));
  assert.deepEqual(calls.start, [7]);
  assert.ok(document.getElementById('btn_pause_streak'), 'the picker closes afterwards');
});

test('cancel closes the picker without pausing', () => {
  const calls = mount();
  fireEvent.click(document.getElementById('btn_pause_streak'));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  assert.deepEqual(calls.start, []);
});

test('while paused the card offers Resume and says the streak is on hold', () => {
  const calls = mount({ streakInfo: streak({ paused: true }) });
  assert.match(document.getElementById('streak_message').textContent, /on hold/i);
  fireEvent.click(document.getElementById('btn_resume_streak'));
  assert.equal(calls.end, 1);
});

test('a finished goal shows a check instead of a percentage', () => {
  mount({ progress: { beads: 120, goal: 100, ratio: 1, done: true } });
  assert.match(screen.getByRole('progressbar').textContent, /✓/);
});

test('saved preferences without a goal keep the default; stored goals are clamped', () => {
  const fallback = { soundOn: true, soundTone: 'wooden', vibrateOn: true, autoAdvance: true, theme: 'emerald', colorMode: 'dark', volume: 0.5, madhab: 'shafi', completionSoundOn: true, hapticStrength: 'medium', dailyGoal: 100 };
  assert.equal(sanitizePreferences({ soundOn: false }, fallback).dailyGoal, 100);
  assert.equal(sanitizePreferences({ dailyGoal: 5 }, fallback).dailyGoal, 10);
  assert.equal(sanitizePreferences({ dailyGoal: 'abc' }, fallback).dailyGoal, 100);
  assert.equal(sanitizePreferences({ dailyGoal: 300 }, fallback).dailyGoal, 300);
});

test('focus follows the control that replaces the one pressed', async () => {
  const { act } = await import('@testing-library/react');
  mount();
  await act(async () => { fireEvent.click(document.getElementById('btn_pause_streak')); });
  assert.equal(document.activeElement.textContent, '3 days', 'first choice focused');
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); });
  assert.equal(document.activeElement.id, 'btn_pause_streak', 'back on the trigger after cancel');
});

test('the streak line is announced politely when it changes', () => {
  mount();
  assert.equal(document.getElementById('streak_message').getAttribute('role'), 'status');
});
