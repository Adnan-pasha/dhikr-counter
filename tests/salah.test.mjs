import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FARD_PRAYERS, prayerCount, cleanSalahLogs, setDay, salahStreak, monthCells, shiftMonth,
  canShowMonth, earliestDate, readInstallDate, seedInstallDate, dayLabel, addDays, BACKFILL_DAYS,
} from '../src/salah.ts';

const log = (date, ...done) => ({ date, prayers: Object.fromEntries(done.map((p) => [p, true])) });
const ALL = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

test('there are five prayers and sunrise is not one of them', () => {
  assert.deepEqual([...FARD_PRAYERS], ALL);
});

test('prayerCount counts only the five, ignoring old sunrise ticks', () => {
  assert.equal(prayerCount(undefined), 0);
  assert.equal(prayerCount({ date: '2026-03-01', prayers: { fajr: true, sunrise: true, asr: false } }), 1);
});

test('cleanSalahLogs removes sunrise, empty days, bad dates and non-objects', () => {
  const cleaned = cleanSalahLogs([
    { date: '2026-03-01', prayers: { fajr: true, sunrise: true } },
    { date: '2026-03-02', prayers: { sunrise: true } },
    { date: '2026-03-03', prayers: { fajr: false } },
    { date: 'nope', prayers: { fajr: true } },
    { date: '2026-03-04' },
    null,
  ]);
  assert.deepEqual(cleaned, [{ date: '2026-03-01', prayers: { fajr: true } }]);
});

test('setDay marks all five or clears the day, without changing the input', () => {
  const before = [log('2026-03-01', 'fajr')];
  const full = setDay(before, '2026-03-02', true);
  assert.equal(prayerCount(full.find((l) => l.date === '2026-03-02')), 5);
  assert.equal(before.length, 1);
  const cleared = setDay(full, '2026-03-02', false);
  assert.equal(cleared.find((l) => l.date === '2026-03-02'), undefined);
  assert.equal(cleared.length, 1);
});

test('addDays steps across month and year ends', () => {
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('streak counts full days back from today, and an unfinished today does not break it', () => {
  const logs = [log('2026-03-09', ...ALL), log('2026-03-08', ...ALL), log('2026-03-07', 'fajr')];
  assert.equal(salahStreak(logs, '2026-03-10'), 2, 'today still open');
  assert.equal(salahStreak([...logs, log('2026-03-10', ...ALL)], '2026-03-10'), 3);
  assert.equal(salahStreak([log('2026-03-10', 'fajr'), log('2026-03-09', ...ALL)], '2026-03-10'), 1, 'a partly done today is skipped');
});

test('editing a past day changes the streak', () => {
  const logs = [log('2026-03-09', ...ALL), log('2026-03-07', ...ALL), log('2026-03-06', ...ALL)];
  assert.equal(salahStreak(logs, '2026-03-10'), 1);
  assert.equal(salahStreak(setDay(logs, '2026-03-08', true), '2026-03-10'), 4);
});

test('monthCells lays out the days with blanks, counts and future days', () => {
  const m = monthCells(2026, 2, '2026-03-10', [log('2026-03-09', ...ALL), log('2026-03-02', 'fajr', 'isha')]);
  assert.equal(m.blanks, 0, '1 March 2026 is a Sunday');
  assert.equal(m.days.length, 31);
  assert.equal(m.days[8].count, 5);
  assert.equal(m.days[1].count, 2);
  assert.equal(m.days[9].future, false);
  assert.equal(m.days[10].future, true);
  assert.equal(monthCells(2026, 3, '2026-03-10', []).blanks, 3, '1 April 2026 is a Wednesday');
});

test('shiftMonth wraps years, and months outside the install-to-today range are refused', () => {
  assert.deepEqual(shiftMonth({ year: 2026, month: 0 }, -1), { year: 2025, month: 11 });
  assert.deepEqual(shiftMonth({ year: 2026, month: 11 }, 1), { year: 2027, month: 0 });
  assert.equal(canShowMonth({ year: 2026, month: 1 }, '2026-02-15', '2026-04-10'), true);
  assert.equal(canShowMonth({ year: 2026, month: 0 }, '2026-02-15', '2026-04-10'), false);
  assert.equal(canShowMonth({ year: 2026, month: 4 }, '2026-02-15', '2026-04-10'), false);
});

test('days can be filled in for a while before the install date, since people start using the app having already prayed', () => {
  assert.equal(BACKFILL_DAYS, 60);
  assert.equal(earliestDate([log('2026-01-05', 'fajr')], '2026-02-01', '2026-04-10'), addDays('2026-01-05', -BACKFILL_DAYS));
  assert.equal(earliestDate([], '2026-02-01', '2026-04-10'), addDays('2026-02-01', -BACKFILL_DAYS));
});

test('a brand new install can still reach the last two months, and an odd install date never pushes it past today', () => {
  assert.equal(earliestDate([], '2026-04-10', '2026-04-10'), '2026-02-09');
  assert.equal(earliestDate([], '2027-01-01', '2026-04-10'), '2026-02-09');
  assert.equal(earliestDate([], null, '2026-04-10'), '2026-02-09');
});

const memoryStorage = () => {
  const data = new Map();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
};

test('seeding writes the oldest known day once, and never moves it later', () => {
  const storage = memoryStorage();
  assert.equal(seedInstallDate(storage, '2026-05-09', ['2026-03-02', '2026-04-01', 'junk']), '2026-03-02');
  assert.equal(storage.data.get('tasbih_installed_on'), '2026-03-02');
  assert.equal(seedInstallDate(storage, '2026-05-10', ['2026-04-20']), '2026-03-02', 'kept once written');
});

test('seeding with no data at all uses today, and ignores days from the future', () => {
  const a = memoryStorage();
  assert.equal(seedInstallDate(a, '2026-05-09', []), '2026-05-09');
  const b = memoryStorage();
  assert.equal(seedInstallDate(b, '2026-05-09', ['2027-01-01']), '2026-05-09');
});

test('reading the install date never writes, and falls back to today when it is missing or garbage', () => {
  const storage = memoryStorage();
  assert.equal(readInstallDate(storage, '2026-03-01'), '2026-03-01');
  assert.equal(storage.data.size, 0);
  storage.data.set('tasbih_installed_on', '2026-01-10');
  assert.equal(readInstallDate(storage, '2026-03-01'), '2026-01-10');
  storage.data.set('tasbih_installed_on', 'garbage');
  assert.equal(readInstallDate(storage, '2026-03-01'), '2026-03-01');
});

test('with no storage the install date is today', () => {
  assert.equal(readInstallDate(null, '2026-05-09'), '2026-05-09');
});

test('dayLabel reads out the date and how many prayers are done', () => {
  assert.equal(dayLabel('2026-11-03', 4), 'Tuesday 3 November, 4 of 5 prayers');
  assert.equal(dayLabel('2026-11-03', 5), 'Tuesday 3 November, all 5 prayers');
  assert.equal(dayLabel('2026-11-03', 0), 'Tuesday 3 November, no prayers');
});
