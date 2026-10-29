import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_PROGRESS, GOAL_CHOICES, AYAT_IN_QURAN, AYAT_PER_MINUTE, IDLE_MS, MAX_LOG_DAYS, PRACTISED_SECONDS, MAX_STEP_AYAT, SURAH_AYAT,
  sanitizeProgress, isReading, addReadingSeconds, secondsOn, minutesOn, goalRatio, goalReached, setGoal,
  ayatPerDay, daysToKhatam, weekStrip, recordPosition, practisedDay, startKhatam, endKhatam, khatamStatus,
  globalAyah, addReadRange, readCount,
} from '../src/quran/progress.ts';

const TODAY = '2026-03-20';
// A state where the reader has already read this many ayat from the start, however they got there.
const readTo = (p, count) => ({ ...p, read: count > 0 ? [[1, count]] : [] });

// ── the Quran's shape ─────────────────────────────────────────────────────────

test('the ayah counts add up to the whole Quran', () => {
  assert.equal(SURAH_AYAT.length, 114);
  assert.equal(SURAH_AYAT.reduce((a, b) => a + b, 0), AYAT_IN_QURAN);
});

test('a surah and ayah become a number from 1 to 6236', () => {
  assert.equal(globalAyah(1, 1), 1);
  assert.equal(globalAyah(2, 1), 8);
  assert.equal(globalAyah(2, 255), 262);
  assert.equal(globalAyah(114, 6), AYAT_IN_QURAN);
});

test('ayat that do not exist are rejected', () => {
  assert.equal(globalAyah(1, 8), null);
  assert.equal(globalAyah(0, 1), null);
  assert.equal(globalAyah(115, 1), null);
  assert.equal(globalAyah(2, 0), null);
  assert.equal(globalAyah(2, 1.5), null);
});

// ── goals and projection ──────────────────────────────────────────────────────

test('the goal choices are 5, 10 and 15 minutes', () => {
  assert.deepEqual([...GOAL_CHOICES], [5, 10, 15]);
});

test('a minute of reading is about six ayat, which gives the projection people can plan around', () => {
  assert.equal(AYAT_PER_MINUTE, 6);
  assert.equal(ayatPerDay(5), 30);
  assert.equal(ayatPerDay(15), 90);
  assert.equal(daysToKhatam(5), 208);
  assert.equal(daysToKhatam(10), 104);
  assert.equal(daysToKhatam(15), 70);
});

// ── what counts as reading ────────────────────────────────────────────────────

test('time only counts while the reader is open, the page is visible and the reader was touched recently', () => {
  assert.equal(isReading({ active: true, visible: true, msSinceActivity: 1000 }), true);
  assert.equal(isReading({ active: false, visible: true, msSinceActivity: 1000 }), false, 'reader closed');
  assert.equal(isReading({ active: true, visible: false, msSinceActivity: 1000 }), false, 'page hidden');
  assert.equal(isReading({ active: true, visible: true, msSinceActivity: IDLE_MS + 1 }), false, 'idle');
  assert.equal(isReading({ active: true, visible: true, msSinceActivity: IDLE_MS }), true, 'exactly at the limit still counts');
});

// ── the reading log ───────────────────────────────────────────────────────────

test('seconds add up per day without mutating the old state', () => {
  const a = addReadingSeconds(EMPTY_PROGRESS, TODAY, 5);
  const b = addReadingSeconds(a, TODAY, 7);
  assert.equal(secondsOn(EMPTY_PROGRESS, TODAY), 0);
  assert.equal(secondsOn(a, TODAY), 5);
  assert.equal(secondsOn(b, TODAY), 12);
  assert.equal(secondsOn(b, '2026-03-19'), 0);
});

test('bad or huge increments are ignored or capped', () => {
  assert.equal(secondsOn(addReadingSeconds(EMPTY_PROGRESS, TODAY, -5), TODAY), 0);
  assert.equal(secondsOn(addReadingSeconds(EMPTY_PROGRESS, TODAY, Number.NaN), TODAY), 0);
  assert.equal(secondsOn(addReadingSeconds(EMPTY_PROGRESS, TODAY, 999999), TODAY), 3600, 'one update can add at most an hour');
});

test('only the most recent days are kept', () => {
  let p = EMPTY_PROGRESS;
  for (let i = 0; i < MAX_LOG_DAYS + 20; i++) {
    const day = new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10);
    p = addReadingSeconds(p, day, 1);
  }
  assert.equal(p.log.length, MAX_LOG_DAYS);
  assert.equal(p.log.at(-1).date, new Date(Date.UTC(2025, 0, MAX_LOG_DAYS + 20)).toISOString().slice(0, 10));
});

test('minutes are whole minutes read', () => {
  assert.equal(minutesOn(addReadingSeconds(EMPTY_PROGRESS, TODAY, 119), TODAY), 1);
  assert.equal(minutesOn(addReadingSeconds(EMPTY_PROGRESS, TODAY, 120), TODAY), 2);
});

test('a day is practised once a minute of reading is in', () => {
  assert.equal(PRACTISED_SECONDS, 60);
  assert.equal(practisedDay(addReadingSeconds(EMPTY_PROGRESS, TODAY, 59), TODAY), false);
  assert.equal(practisedDay(addReadingSeconds(EMPTY_PROGRESS, TODAY, 60), TODAY), true);
});

// ── goal ring ─────────────────────────────────────────────────────────────────

test('without a goal there is no ring and nothing counts as reached', () => {
  const p = addReadingSeconds(EMPTY_PROGRESS, TODAY, 600);
  assert.equal(goalRatio(p, TODAY), 0);
  assert.equal(goalReached(p, TODAY), false);
});

test('the ring fills towards the goal and caps at full', () => {
  let p = setGoal(EMPTY_PROGRESS, 5);
  p = addReadingSeconds(p, TODAY, 150);
  assert.equal(goalRatio(p, TODAY), 0.5);
  assert.equal(goalReached(p, TODAY), false);
  p = addReadingSeconds(p, TODAY, 600);
  assert.equal(goalRatio(p, TODAY), 1);
  assert.equal(goalReached(p, TODAY), true);
});

test('setGoal accepts the three choices or clears the goal, and ignores anything else', () => {
  assert.equal(setGoal(EMPTY_PROGRESS, 10).goalMinutes, 10);
  assert.equal(setGoal(setGoal(EMPTY_PROGRESS, 10), null).goalMinutes, null);
  assert.equal(setGoal(setGoal(EMPTY_PROGRESS, 10), 7).goalMinutes, 10, 'an invalid choice leaves the goal alone');
});

// ── the week strip ────────────────────────────────────────────────────────────

test('the week strip is seven days ending today with each day\'s fill', () => {
  let p = setGoal(EMPTY_PROGRESS, 5);
  p = addReadingSeconds(p, TODAY, 300);
  p = addReadingSeconds(p, '2026-03-18', 150);
  const strip = weekStrip(p, TODAY);
  assert.equal(strip.length, 7);
  assert.deepEqual(strip.map((d) => d.date), ['2026-03-14', '2026-03-15', '2026-03-16', '2026-03-17', '2026-03-18', '2026-03-19', '2026-03-20']);
  assert.deepEqual(strip.map((d) => d.label), ['S', 'S', 'M', 'T', 'W', 'T', 'F']);
  assert.equal(strip.at(-1).isToday, true);
  assert.equal(strip.at(-1).reached, true);
  assert.equal(strip[4].ratio, 0.5);
  assert.equal(strip[0].ratio, 0);
});

// ── read ranges ───────────────────────────────────────────────────────────────

test('read ranges merge when they overlap or touch, and stay sorted', () => {
  assert.deepEqual(addReadRange([], 5, 10), [[5, 10]]);
  assert.deepEqual(addReadRange([[5, 10]], 11, 15), [[5, 15]], 'touching ranges join');
  assert.deepEqual(addReadRange([[5, 10]], 8, 12), [[5, 12]]);
  assert.deepEqual(addReadRange([[5, 10]], 20, 25), [[5, 10], [20, 25]]);
  assert.deepEqual(addReadRange([[5, 10], [20, 25]], 9, 21), [[5, 25]], 'one range can bridge two');
  assert.deepEqual(addReadRange([[20, 25]], 1, 3), [[1, 3], [20, 25]]);
});

test('ranges are clamped to the Quran and never mutated', () => {
  const before = [[5, 10]];
  const after = addReadRange(before, 6000, 7000);
  assert.deepEqual(before, [[5, 10]]);
  assert.deepEqual(after, [[5, 10], [6000, AYAT_IN_QURAN]]);
  assert.deepEqual(addReadRange([], -5, 3), [[1, 3]]);
});

test('the count of ayat read adds up the ranges', () => {
  assert.equal(readCount(EMPTY_PROGRESS), 0);
  assert.equal(readCount({ ...EMPTY_PROGRESS, read: [[1, 10], [20, 25]] }), 16);
});

// ── position ──────────────────────────────────────────────────────────────────

const at = (surah, ayah) => ({ surah, ayah, global: globalAyah(surah, ayah) });

test('recording a position remembers it and counts the ayat that were on screen', () => {
  const p = recordPosition(EMPTY_PROGRESS, at(2, 5), { from: 12, to: 14 });
  assert.deepEqual(p.position, at(2, 5));
  assert.deepEqual(p.read, [[12, 14]]);
});

test('without a screen span only the ayah itself counts', () => {
  assert.deepEqual(recordPosition(EMPTY_PROGRESS, at(1, 3)).read, [[3, 3]]);
});

test('reading on from the last save counts everything in between', () => {
  let p = recordPosition(EMPTY_PROGRESS, at(2, 1), { from: 8, to: 10 });
  p = recordPosition(p, at(2, 20), { from: 27, to: 29 });
  assert.deepEqual(p.read, [[8, 29]], 'the ayat scrolled through between the two saves are read');
});

test('a jump counts only what was on screen, so one tap on a faraway surah does not fake progress', () => {
  let p = recordPosition(EMPTY_PROGRESS, at(2, 1), { from: 8, to: 10 });
  p = recordPosition(p, at(114, 1), { from: 6231, to: 6233 });
  assert.equal(p.position.surah, 114, 'the bookmark follows');
  assert.deepEqual(p.read, [[8, 10], [6231, 6233]]);
  assert.equal(readCount(p), 6);
});

test('going backwards moves the bookmark without erasing anything', () => {
  let p = recordPosition(EMPTY_PROGRESS, at(2, 40), { from: 47, to: 49 });
  p = recordPosition(p, at(2, 1), { from: 8, to: 10 });
  assert.equal(p.position.ayah, 1);
  assert.deepEqual(p.read, [[8, 10], [47, 49]]);
});

test('starting far from the beginning still counts, so a khatam can begin anywhere', () => {
  // Opening An-Naba (about 5672) and reading on through the end of the Quran.
  let p = EMPTY_PROGRESS;
  for (let g = 5672; g <= AYAT_IN_QURAN; g += 20) {
    const surah = (() => { let n = 0; for (let i = 0; i < 114; i++) { n += SURAH_AYAT[i]; if (g <= n) return i + 1; } return 114; })();
    p = recordPosition(p, { surah, ayah: 1, global: g }, { from: g, to: Math.min(AYAT_IN_QURAN, g + 4) });
  }
  assert.ok(readCount(p) > 500, `counted ${readCount(p)}`);
  assert.ok(p.read.length >= 1);
});

test('reading the whole Quran by steps reaches 6236, so a khatam can finish', () => {
  let p = EMPTY_PROGRESS;
  for (let g = 1; g <= AYAT_IN_QURAN; g += 15) p = recordPosition(p, { surah: 1, ayah: 1, global: g }, { from: g, to: Math.min(AYAT_IN_QURAN, g + 6) });
  p = recordPosition(p, { surah: 114, ayah: 6, global: AYAT_IN_QURAN }, { from: AYAT_IN_QURAN - 2, to: AYAT_IN_QURAN });
  assert.equal(readCount(p), AYAT_IN_QURAN);
  assert.equal(p.read.length, 1);
});

test('the step limit is a sane number of ayat', () => {
  assert.ok(MAX_STEP_AYAT >= 20 && MAX_STEP_AYAT <= 120);
});

test('recording the same place and screen again changes nothing', () => {
  const p = recordPosition(EMPTY_PROGRESS, at(2, 1), { from: 8, to: 10 });
  assert.equal(recordPosition(p, at(2, 1), { from: 8, to: 10 }), p);
});

// ── khatam ────────────────────────────────────────────────────────────────────

test('a khatam plan splits the Quran over the chosen days', () => {
  const p = startKhatam(EMPTY_PROGRESS, TODAY, 30);
  assert.deepEqual(p.khatam, { startDate: TODAY, days: 30 });
  const s = khatamStatus(p, TODAY);
  assert.equal(s.dayNumber, 1);
  assert.equal(s.perDay, Math.ceil(AYAT_IN_QURAN / 30));
  assert.equal(s.targetToday, s.perDay);
  assert.equal(s.read, 0);
  assert.equal(s.remainingToday, s.perDay);
  assert.equal(s.percent, 0);
  assert.equal(s.finished, false);
});

test('the plan length is kept within a sensible range', () => {
  assert.equal(startKhatam(EMPTY_PROGRESS, TODAY, 1).khatam.days, 7);
  assert.equal(startKhatam(EMPTY_PROGRESS, TODAY, 9999).khatam.days, 365);
  assert.equal(startKhatam(EMPTY_PROGRESS, TODAY, Number.NaN).khatam.days, 30);
});

test('ahead and behind are measured against the end of today\'s portion', () => {
  let p = startKhatam(EMPTY_PROGRESS, '2026-03-10', 30); // 11 days in
  const s0 = khatamStatus(p, TODAY);
  assert.equal(s0.dayNumber, 11);
  assert.equal(s0.targetToday, 11 * s0.perDay);
  assert.ok(s0.aheadBy < 0, 'nothing read yet means behind');
  p = readTo(p, s0.targetToday + 40);
  const s1 = khatamStatus(p, TODAY);
  assert.equal(s1.aheadBy, 40);
  assert.equal(s1.remainingToday, 0);
});

test('the day number never runs past the plan, and finishing is recognised', () => {
  let p = startKhatam(EMPTY_PROGRESS, '2026-01-01', 30);
  assert.equal(khatamStatus(p, TODAY).dayNumber, 30);
  p = readTo(p, AYAT_IN_QURAN);
  const s = khatamStatus(p, TODAY);
  assert.equal(s.finished, true);
  assert.equal(s.percent, 100);
});

test('a plan that has not started yet reports day one, and ending a plan clears it', () => {
  const p = startKhatam(EMPTY_PROGRESS, '2026-03-25', 30);
  assert.equal(khatamStatus(p, TODAY).dayNumber, 1);
  assert.equal(endKhatam(p).khatam, null);
  assert.equal(khatamStatus(endKhatam(p), TODAY), null);
});

test('a plan cannot start on a date that does not exist', () => {
  assert.equal(startKhatam(EMPTY_PROGRESS, '2026-02-31', 30).khatam, null);
});

// ── stored data ───────────────────────────────────────────────────────────────

test('stored progress is accepted when valid', () => {
  const stored = {
    goalMinutes: 10,
    log: [{ date: '2026-03-19', seconds: 400 }, { date: TODAY, seconds: 90 }],
    position: { surah: 2, ayah: 10, global: 17 },
    read: [[1, 40], [100, 120]],
    khatam: { startDate: '2026-03-01', days: 60 },
  };
  assert.deepEqual(sanitizeProgress(stored), stored);
});

test('anything invalid is dropped field by field, never wholesale', () => {
  const out = sanitizeProgress({
    goalMinutes: 7,
    log: [{ date: 'nope', seconds: 5 }, { date: TODAY, seconds: -1 }, { date: TODAY, seconds: 100 }, { date: TODAY, seconds: 50 }, 'x'],
    position: { surah: 200, ayah: 1, global: 1 },
    read: 'junk',
    khatam: { startDate: 'x', days: 30 },
  });
  assert.equal(out.goalMinutes, null);
  assert.deepEqual(out.log, [{ date: TODAY, seconds: 150 }], 'valid duplicates merge; invalid rows go');
  assert.equal(out.position, null);
  assert.deepEqual(out.read, []);
  assert.equal(out.khatam, null);
});

test('impossible dates are rejected even though they parse', () => {
  const out = sanitizeProgress({ log: [{ date: '2026-02-31', seconds: 60 }, { date: '2026-02-28', seconds: 60 }], khatam: { startDate: '2026-02-30', days: 30 } });
  assert.deepEqual(out.log, [{ date: '2026-02-28', seconds: 60 }]);
  assert.equal(out.khatam, null);
});

test('a position that does not match the Quran is dropped', () => {
  assert.equal(sanitizeProgress({ position: { surah: 1, ayah: 200, global: 200 } }).position, null, 'Al-Fatiha has 7 ayat');
  assert.equal(sanitizeProgress({ position: { surah: 2, ayah: 1, global: 5 } }).position, null, 'global number disagrees');
  assert.deepEqual(sanitizeProgress({ position: { surah: 2, ayah: 1, global: 8 } }).position, { surah: 2, ayah: 1, global: 8 });
});

test('stored read ranges are cleaned: bad ones dropped, overlaps merged, order fixed', () => {
  const out = sanitizeProgress({ read: [[50, 60], [1, 10], [5, 20], [9, 3], ['a', 4], [0, 5], [6236, 7000], [30, 40]] });
  assert.deepEqual(out.read, [[1, 20], [30, 40], [50, 60]]);
});

test('non-objects give the empty state', () => {
  for (const v of [null, undefined, 'x', 5, []]) assert.deepEqual(sanitizeProgress(v), EMPTY_PROGRESS);
});
