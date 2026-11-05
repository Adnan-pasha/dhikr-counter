import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveActiveRoutine, togglePrayerLog, afterSalahRoutine, AFTER_SALAH_ROUTINE_ID, isFardPrayer,
  uniqueInOrder, readStartedRoutine, writeStartedRoutine, STARTED_ROUTINE_KEY, afterFinishingRoutine,
} from '../src/routines.ts';
import { GOAL_TEMPLATES, DEFAULT_DAILY_GOAL, progressLabel, sanitizeDailyGoal } from '../src/habits.ts';

const routine = (id, dhikrIds) => ({ id, name: id, icon: 'dua', dhikrIds, createdAt: '2026-01-01T00:00:00.000Z' });

// ── which routine is running ──────────────────────────────────────────────────

test('the routine the user started wins even when an earlier routine shares the dhikr', () => {
  const morning = routine('routine-morning', ['subhanallah', 'alhamdulillah']);
  const after = routine('routine-after-salah', ['subhanallah', 'alhamdulillah', 'allahuakbar']);
  assert.equal(resolveActiveRoutine([morning, after], 'routine-after-salah', 'subhanallah')?.id, 'routine-after-salah');
});

test('without a started routine no routine is guessed, because the same dhikr sits in several routines', () => {
  const a = routine('a', ['x', 'y']);
  const b = routine('b', ['y']);
  assert.equal(resolveActiveRoutine([a, b], null, 'y'), null);
  assert.equal(resolveActiveRoutine([a, b], null, 'x'), null);
});

test('a started routine is dropped once the current dhikr is not part of it, and nothing else is guessed', () => {
  const a = routine('a', ['x']);
  const b = routine('b', ['y']);
  assert.equal(resolveActiveRoutine([a, b], 'a', 'y'), null);
  assert.equal(resolveActiveRoutine([a], 'a', 'zzz'), null);
});

test('a deleted routine id means no routine', () => {
  assert.equal(resolveActiveRoutine([routine('a', ['x'])], 'gone', 'x'), null);
});

test('every default routine, started by id, is the one that runs for each of its dhikr', async () => {
  const { DEFAULT_ROUTINES } = await import('../src/adhkaar-data.ts');
  for (const r of DEFAULT_ROUTINES) {
    for (const id of r.dhikrIds) assert.equal(resolveActiveRoutine(DEFAULT_ROUTINES, r.id, id)?.id, r.id, `${r.id} / ${id}`);
  }
});

// ── a routine that lists the same dhikr twice must not loop ───────────────────

test('a dhikr listed twice in a routine is counted once, in the place it first appears', () => {
  assert.deepEqual(uniqueInOrder(['a', 'b', 'a', 'c', 'b']), ['a', 'b', 'c']);
  assert.deepEqual(uniqueInOrder([]), []);
  assert.deepEqual(uniqueInOrder(['x']), ['x']);
});

// ── finishing a routine leaves the counter ready for next time ───────────────

test('finishing a routine puts the counter back on its first dhikr, at zero', () => {
  assert.deepEqual(afterFinishingRoutine([{ id: 'subhanallah' }, { id: 'alhamdulillah' }, { id: 'darood-ibrahim' }]), { dhikrId: 'subhanallah', count: 0 });
});

test('with nothing to go back to, only the count is cleared', () => {
  assert.deepEqual(afterFinishingRoutine([]), { dhikrId: null, count: 0 });
});

// ── the running routine survives the app being closed ────────────────────────

const memory = () => {
  const data = new Map();
  return { data, getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => { data.set(k, String(v)); }, removeItem: (k) => { data.delete(k); } };
};

test('the running routine is remembered, and forgotten when none is running', () => {
  const storage = memory();
  assert.equal(readStartedRoutine(storage), null);
  writeStartedRoutine(storage, 'routine-after-salah');
  assert.equal(readStartedRoutine(storage), 'routine-after-salah');
  writeStartedRoutine(storage, null);
  assert.equal(readStartedRoutine(storage), null);
  assert.equal(storage.data.has(STARTED_ROUTINE_KEY), false, 'the key is removed, not left empty');
});

test('a missing or blocked store never breaks anything', () => {
  assert.equal(readStartedRoutine(null), null);
  assert.doesNotThrow(() => writeStartedRoutine(null, 'x'));
  const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
  assert.equal(readStartedRoutine(blocked), null);
  assert.doesNotThrow(() => writeStartedRoutine(blocked, 'x'));
  assert.doesNotThrow(() => writeStartedRoutine(blocked, null));
});

test('a stored value that is not a routine id is ignored', () => {
  const storage = memory();
  storage.data.set(STARTED_ROUTINE_KEY, '');
  assert.equal(readStartedRoutine(storage), null);
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
