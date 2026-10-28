import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays, computeStreakInfo, dailyProgress, beadsOnDay, addActiveDay, sanitizeActiveDays, isPaused, startPause, endPause, sanitizePauses,
  sanitizeDailyGoal, DEFAULT_DAILY_GOAL, FREEZE_EVERY, MAX_FREEZES, MAX_PAUSE_DAYS,
} from '../src/habits.ts';

const TODAY = '2026-03-20';
// A history entry on a given local date (noon avoids any timezone edge).
const on = (date, count = 33) => ({ id: `h-${date}`, dhikrId: 'd', dhikrName: 'D', count, timestamp: new Date(`${date}T12:00:00`).toISOString() });
const days = (from, n) => Array.from({ length: n }, (_, i) => addDays(from, i));
const run = (from, n) => days(from, n).map((d) => on(d));

// ── addDays ───────────────────────────────────────────────────────────────────

test('addDays moves across month and year boundaries', () => {
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-20', 0), '2026-03-20');
});

// ── streak basics (must match the old behaviour when no freezes apply) ───────

test('no history means no streak', () => {
  assert.deepEqual(computeStreakInfo([], [], TODAY), { streak: 0, freezes: 0, freezeDates: [], atRisk: false, paused: false });
});

test('consecutive days up to today count', () => {
  const info = computeStreakInfo(run('2026-03-18', 3), [], TODAY);
  assert.equal(info.streak, 3);
  assert.equal(info.atRisk, false);
});

test('today not done yet keeps yesterday\'s streak alive and flags it at risk', () => {
  const info = computeStreakInfo(run('2026-03-17', 3), [], TODAY);
  assert.equal(info.streak, 3);
  assert.equal(info.atRisk, true);
});

test('a missed day with nothing banked resets the streak', () => {
  const info = computeStreakInfo(run('2026-03-10', 4), [], TODAY);
  assert.equal(info.streak, 0);
  assert.equal(info.atRisk, false);
});

test('several entries on one day count as one day', () => {
  const info = computeStreakInfo([on('2026-03-19'), on('2026-03-19'), on('2026-03-20')], [], TODAY);
  assert.equal(info.streak, 2);
});

test('a zero-count entry does not make a day active', () => {
  assert.equal(computeStreakInfo([on('2026-03-20', 0)], [], TODAY).streak, 0);
});

// ── freezes ───────────────────────────────────────────────────────────────────

test('a freeze is earned for every full week of streak', () => {
  const info = computeStreakInfo(run('2026-03-14', FREEZE_EVERY), [], TODAY);
  assert.equal(info.streak, FREEZE_EVERY);
  assert.equal(info.freezes, 1);
});

test('freezes never bank beyond the cap', () => {
  const info = computeStreakInfo(run('2026-02-20', 29), [], TODAY);
  assert.equal(info.streak, 29);
  assert.equal(info.freezes, MAX_FREEZES);
});

test('a banked freeze covers one missed day and the streak continues', () => {
  // 7 days (earns 1), miss one, then keep going to today.
  const history = [...run('2026-03-06', 7), ...run('2026-03-14', 7)];
  const info = computeStreakInfo(history, [], TODAY);
  assert.deepEqual(info.freezeDates, ['2026-03-13']);
  assert.equal(info.streak, 14);
  // Earned one at day 7, spent it on the gap, earned another at day 14 of active days.
  assert.equal(info.freezes, 1);
});

test('without a banked freeze the same gap resets the streak to the run after it', () => {
  const history = [...run('2026-03-09', 3), ...run('2026-03-14', 7)];
  const info = computeStreakInfo(history, [], TODAY);
  assert.equal(info.streak, 7);
  assert.deepEqual(info.freezeDates, []);
});

test('a gap longer than the banked freezes breaks the streak', () => {
  const history = [...run('2026-03-01', 7), ...run('2026-03-17', 4)];
  const info = computeStreakInfo(history, [], TODAY);
  // 1 freeze banked, 9 missed days → broken; only the final run counts.
  assert.equal(info.streak, 4);
});

// ── pauses ────────────────────────────────────────────────────────────────────

test('paused days neither break nor extend the streak', () => {
  const history = [...run('2026-03-10', 3), on('2026-03-18'), on('2026-03-19'), on('2026-03-20')];
  const pauses = [{ from: '2026-03-13', until: '2026-03-17' }];
  const info = computeStreakInfo(history, pauses, TODAY);
  assert.equal(info.streak, 6);
  assert.deepEqual(info.freezeDates, []);
});

test('an active pause today reports paused and never at risk', () => {
  const info = computeStreakInfo(run('2026-03-16', 3), [{ from: '2026-03-19', until: '2026-03-25' }], TODAY);
  assert.equal(info.paused, true);
  assert.equal(info.atRisk, false);
  assert.equal(info.streak, 3);
});

test('isPaused is inclusive of both ends', () => {
  const pauses = [{ from: '2026-03-10', until: '2026-03-12' }];
  assert.equal(isPaused('2026-03-10', pauses), true);
  assert.equal(isPaused('2026-03-12', pauses), true);
  assert.equal(isPaused('2026-03-13', pauses), false);
  assert.equal(isPaused('2026-03-09', pauses), false);
});

test('startPause adds a range without mutating and clamps its length', () => {
  const before = [];
  const after = startPause(before, '2026-03-20', 400);
  assert.deepEqual(before, []);
  assert.equal(after.length, 1);
  assert.equal(after[0].from, '2026-03-20');
  assert.equal(after[0].until, addDays('2026-03-20', MAX_PAUSE_DAYS - 1));
});

test('startPause with a bad length falls back to one day', () => {
  assert.deepEqual(startPause([], '2026-03-20', Number.NaN), [{ from: '2026-03-20', until: '2026-03-20' }]);
  assert.deepEqual(startPause([], '2026-03-20', 0), [{ from: '2026-03-20', until: '2026-03-20' }]);
});

test('endPause stops an active pause the day before today and keeps past ones', () => {
  const pauses = [{ from: '2026-03-01', until: '2026-03-03' }, { from: '2026-03-18', until: '2026-03-25' }];
  const ended = endPause(pauses, TODAY);
  assert.deepEqual(ended, [{ from: '2026-03-01', until: '2026-03-03' }, { from: '2026-03-18', until: '2026-03-19' }]);
  assert.equal(pauses[1].until, '2026-03-25', 'input untouched');
});

test('endPause drops a pause that began today', () => {
  assert.deepEqual(endPause([{ from: TODAY, until: '2026-03-25' }], TODAY), []);
});

test('sanitizePauses drops malformed, reversed and absurdly long ranges', () => {
  const out = sanitizePauses([
    { from: '2026-03-01', until: '2026-03-03' },
    { from: '2026-03-05', until: '2026-03-01' },
    { from: 'nope', until: '2026-03-01' },
    { from: '2026-01-01', until: '2027-01-01' },
    null,
    'x',
  ]);
  assert.deepEqual(out, [{ from: '2026-03-01', until: '2026-03-03' }]);
  assert.deepEqual(sanitizePauses('junk'), []);
});

// ── daily goal ring ───────────────────────────────────────────────────────────

test('beadsOnDay sums only that local day', () => {
  assert.equal(beadsOnDay([on('2026-03-19', 500), on(TODAY, 40), on(TODAY, 30)], TODAY), 70);
  assert.equal(beadsOnDay([], TODAY), 0);
});

test('daily progress adds the unfinished round to what is finished today', () => {
  assert.deepEqual(dailyProgress(70, 10, 100), { beads: 80, goal: 100, ratio: 0.8, done: false });
});

test('daily progress caps the ring at 1 and marks it done', () => {
  const p = dailyProgress(250, 0, 100);
  assert.equal(p.ratio, 1);
  assert.equal(p.done, true);
  assert.equal(p.beads, 250);
});

test('daily progress is safe with no goal or a negative count', () => {
  assert.equal(dailyProgress(0, 0, 0).ratio, 0);
  assert.equal(dailyProgress(0, -5, 100).beads, 0);
});

// ── partial rounds count as practice ──────────────────────────────────────────

test('a day with only unfinished-round taps still counts when logged as an active day', () => {
  const info = computeStreakInfo(run('2026-03-17', 3), [], TODAY, [TODAY]);
  assert.equal(info.streak, 4);
  assert.equal(info.atRisk, false);
});

test('an active day with no history entry keeps a past streak intact', () => {
  const history = [...run('2026-03-15', 2), ...run('2026-03-19', 2)];
  const info = computeStreakInfo(history, [], TODAY, ['2026-03-17', '2026-03-18']);
  assert.equal(info.streak, 6);
  assert.deepEqual(info.freezeDates, []);
});

test('addActiveDay is immutable, idempotent and capped', () => {
  const base = ['2026-03-01'];
  const next = addActiveDay(base, '2026-03-02');
  assert.deepEqual(base, ['2026-03-01']);
  assert.deepEqual(next, ['2026-03-01', '2026-03-02']);
  assert.equal(addActiveDay(next, '2026-03-02'), next, 'same reference when already present');
  const long = Array.from({ length: 400 }, (_, i) => addDays('2025-01-01', i));
  const capped = addActiveDay(long, '2026-03-20');
  assert.equal(capped.length, 400);
  assert.equal(capped.at(-1), '2026-03-20');
  assert.equal(capped[0], '2025-01-02');
});

test('sanitizeActiveDays keeps only valid unique dates', () => {
  assert.deepEqual(sanitizeActiveDays(['2026-03-02', 'bad', 5, '2026-03-02', '2026-03-01']), ['2026-03-01', '2026-03-02']);
  assert.deepEqual(sanitizeActiveDays('x'), []);
});

test('sanitizeDailyGoal clamps and defaults', () => {
  assert.equal(sanitizeDailyGoal(undefined), DEFAULT_DAILY_GOAL);
  assert.equal(sanitizeDailyGoal('x'), DEFAULT_DAILY_GOAL);
  assert.equal(sanitizeDailyGoal(1), 10);
  assert.equal(sanitizeDailyGoal(10_000_000), 100000);
  assert.equal(sanitizeDailyGoal(333.7), 334);
});

// ── gentle status copy ────────────────────────────────────────────────────────

import { streakMessage } from '../src/habits.ts';

const info = (over) => ({ streak: 0, freezes: 0, freezeDates: [], atRisk: false, paused: false, ...over });

test('streak copy invites rather than scolds', () => {
  assert.match(streakMessage(info({})), /one bead/i);
  assert.match(streakMessage(info({ streak: 5, atRisk: true })), /5-day streak/);
  assert.doesNotMatch(streakMessage(info({ streak: 5, atRisk: true })), /lose|lost|break|broken|hurry|don't/i);
});

test('streak copy mentions freezes only when banked, with correct plural', () => {
  assert.doesNotMatch(streakMessage(info({ streak: 8 })), /freeze/i);
  assert.match(streakMessage(info({ streak: 8, freezes: 1 })), /1 freeze\b(?!s)/);
  assert.match(streakMessage(info({ streak: 15, freezes: 2 })), /2 freezes/);
});

test('streak copy when paused reassures the streak is kept', () => {
  assert.match(streakMessage(info({ streak: 9, paused: true })), /on hold/i);
});
