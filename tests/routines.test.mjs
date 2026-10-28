import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveActiveRoutine, togglePrayerLog, afterSalahRoutine, AFTER_SALAH_ROUTINE_ID, isFardPrayer } from '../src/routines.ts';
import { GOAL_TEMPLATES, DEFAULT_DAILY_GOAL, progressLabel, sanitizeDailyGoal } from '../src/habits.ts';

const routine = (id, dhikrIds) => ({ id, name: id, icon: 'dua', dhikrIds, createdAt: '2026-01-01T00:00:00.000Z' });

// ── which routine is running ──────────────────────────────────────────────────

test('the routine the user started wins even when an earlier routine shares the dhikr', () => {
  const morning = routine('routine-morning', ['subhanallah', 'alhamdulillah']);
  const after = routine('routine-after-salah', ['subhanallah', 'alhamdulillah', 'allahuakbar']);
  assert.equal(resolveActiveRoutine([morning, after], 'routine-after-salah', 'subhanallah')?.id, 'routine-after-salah');
});

test('without a started routine the first routine containing the dhikr is used', () => {
  const a = routine('a', ['x', 'y']);
  const b = routine('b', ['y']);
  assert.equal(resolveActiveRoutine([a, b], null, 'y')?.id, 'a');
});

test('a started routine is dropped once the current dhikr is not part of it', () => {
  const a = routine('a', ['x']);
  const b = routine('b', ['y']);
  assert.equal(resolveActiveRoutine([a, b], 'a', 'y')?.id, 'b');
  assert.equal(resolveActiveRoutine([a], 'a', 'zzz'), null);
});

test('a deleted routine id falls back safely', () => {
  assert.equal(resolveActiveRoutine([routine('a', ['x'])], 'gone', 'x')?.id, 'a');
});

// ── prayer log toggle ─────────────────────────────────────────────────────────

test('togglePrayerLog marks a prayer done on a new day without mutating', () => {
  const before = [];
  const { logs, nowDone } = togglePrayerLog(before, '2026-03-20', 'fajr');
  assert.deepEqual(before, []);
  assert.deepEqual(logs, [{ date: '2026-03-20', prayers: { fajr: true } }]);
  assert.equal(nowDone, true);
});

test('togglePrayerLog flips an existing prayer and reports the new state', () => {
  const start = [{ date: '2026-03-20', prayers: { fajr: true, dhuhr: true } }];
  const off = togglePrayerLog(start, '2026-03-20', 'fajr');
  assert.deepEqual(off.logs[0].prayers, { fajr: false, dhuhr: true });
  assert.equal(off.nowDone, false);
  assert.deepEqual(start[0].prayers, { fajr: true, dhuhr: true }, 'input untouched');
  const on = togglePrayerLog(off.logs, '2026-03-20', 'fajr');
  assert.equal(on.nowDone, true);
});

test('togglePrayerLog leaves other days alone', () => {
  const start = [{ date: '2026-03-19', prayers: { fajr: true } }];
  const { logs } = togglePrayerLog(start, '2026-03-20', 'asr');
  assert.equal(logs.length, 2);
  assert.deepEqual(logs[0], start[0]);
});

test('only the five obligatory prayers offer the after-salah dhikr', () => {
  for (const p of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) assert.equal(isFardPrayer(p), true, p);
  assert.equal(isFardPrayer('sunrise'), false);
});

test('afterSalahRoutine finds the routine, and is null when it was deleted or emptied', () => {
  const r = routine(AFTER_SALAH_ROUTINE_ID, ['subhanallah']);
  assert.equal(afterSalahRoutine([r])?.id, AFTER_SALAH_ROUTINE_ID);
  assert.equal(afterSalahRoutine([routine('other', ['x'])]), null);
  assert.equal(afterSalahRoutine([routine(AFTER_SALAH_ROUTINE_ID, [])]), null);
});

// ── goal templates and wording ───────────────────────────────────────────────

test('goal templates are ascending, valid goals that include the default', () => {
  const goals = GOAL_TEMPLATES.map((t) => t.goal);
  assert.deepEqual(goals, [...goals].sort((a, b) => a - b));
  assert.ok(goals.includes(DEFAULT_DAILY_GOAL));
  for (const t of GOAL_TEMPLATES) {
    assert.equal(sanitizeDailyGoal(t.goal), t.goal);
    assert.ok(t.name && t.blurb, 'each template explains itself');
  }
});

test('progressLabel reads naturally before and after the goal is reached', () => {
  assert.equal(progressLabel({ beads: 40, goal: 100, ratio: 0.4, done: false }), '40 / 100 beads');
  assert.equal(progressLabel({ beads: 272, goal: 100, ratio: 1, done: true }), 'Goal reached · 272 beads');
  assert.equal(progressLabel({ beads: 100, goal: 100, ratio: 1, done: true }), 'Goal reached · 100 beads');
});
