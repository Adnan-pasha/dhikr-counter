import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRAYER_EVENTS, FARD_EVENTS, CALCULATION_METHODS, computePrayerDay, todayKeyIn, addDaysToKey,
  nextEvent, currentEvent, eventWindow, pickNext, pickCurrent, formatClock, formatCountdown, sanitizeLocation,
} from '../src/prayerTimes.ts';

const MECCA = { lat: 21.4225, lng: 39.8262, timeZone: 'Asia/Riyadh' };
const LONDON = { lat: 51.5074, lng: -0.1278, timeZone: 'Europe/London' };
const AUCKLAND = { lat: -36.8485, lng: 174.7633, timeZone: 'Pacific/Auckland' };
const TROMSO = { lat: 69.6492, lng: 18.9553, timeZone: 'Europe/Oslo' };
const OSLO = { lat: 59.9139, lng: 10.7522, timeZone: 'Europe/Oslo' };
const OPTS = { method: 'MWL', madhab: 'shafi' };

const ms = (d) => d.getTime();

test('six events in the order they happen, five of them fard', () => {
  assert.deepEqual([...PRAYER_EVENTS], ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']);
  assert.deepEqual([...FARD_EVENTS], ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']);
});

test('storage accepts exactly the methods the calculator offers', async () => {
  const { PRAYER_CALCULATION_METHODS, sanitizePrayerSettings } = await import('../src/domain.ts');
  assert.deepEqual([...PRAYER_CALCULATION_METHODS].sort(), CALCULATION_METHODS.map((m) => m.id).sort());
  for (const { id } of CALCULATION_METHODS) {
    assert.equal(sanitizePrayerSettings({ calculationMethod: id }).calculationMethod, id);
  }
  assert.equal(sanitizePrayerSettings({ calculationMethod: 'Nonsense' }).calculationMethod, 'Karachi');
});

test('every calculation method id builds a valid day', () => {
  assert.ok(CALCULATION_METHODS.length >= 10);
  for (const { id } of CALCULATION_METHODS) {
    const day = computePrayerDay(MECCA, '2026-03-10', { method: id, madhab: 'shafi' });
    for (const e of PRAYER_EVENTS) assert.ok(!Number.isNaN(ms(day[e])), `${id} ${e}`);
  }
});

test('a day has its events in chronological order', () => {
  const day = computePrayerDay(LONDON, '2026-03-10', OPTS);
  const times = PRAYER_EVENTS.map((e) => ms(day[e]));
  assert.deepEqual(times, [...times].sort((a, b) => a - b));
  assert.equal(day.dateKey, '2026-03-10');
});

test('Hanafi Asr is later than Shafi Asr', () => {
  const shafi = computePrayerDay(MECCA, '2026-03-10', OPTS);
  const hanafi = computePrayerDay(MECCA, '2026-03-10', { ...OPTS, madhab: 'hanafi' });
  assert.ok(ms(hanafi.asr) > ms(shafi.asr));
  assert.equal(ms(hanafi.dhuhr), ms(shafi.dhuhr));
});

test('maliki and hanbali use the standard Asr', () => {
  const shafi = computePrayerDay(MECCA, '2026-03-10', OPTS);
  for (const madhab of ['maliki', 'hanbali']) {
    assert.equal(ms(computePrayerDay(MECCA, '2026-03-10', { ...OPTS, madhab }).asr), ms(shafi.asr));
  }
});

test('manual offsets move only the chosen prayer by whole minutes', () => {
  const base = computePrayerDay(MECCA, '2026-03-10', OPTS);
  const moved = computePrayerDay(MECCA, '2026-03-10', { ...OPTS, offsets: { maghrib: 3, fajr: -2 } });
  assert.equal(ms(moved.maghrib) - ms(base.maghrib), 3 * 60000);
  assert.equal(ms(moved.fajr) - ms(base.fajr), -2 * 60000);
  assert.equal(ms(moved.isha), ms(base.isha));
});

test('offsets are clamped to 30 minutes either way', () => {
  const base = computePrayerDay(MECCA, '2026-03-10', OPTS);
  const moved = computePrayerDay(MECCA, '2026-03-10', { ...OPTS, offsets: { isha: 500, asr: -500 } });
  assert.equal(ms(moved.isha) - ms(base.isha), 30 * 60000);
  assert.equal(ms(moved.asr) - ms(base.asr), -30 * 60000);
});

test('the calendar day follows the place, not the device time zone (Auckland is a day ahead of UTC)', () => {
  const day = computePrayerDay(AUCKLAND, '2026-01-15', OPTS);
  for (const e of PRAYER_EVENTS) {
    assert.equal(todayKeyIn('Pacific/Auckland', day[e]), '2026-01-15', e);
  }
});

test('London March Fajr uses the true twilight angle, matching an independent source (04:35)', () => {
  const day = computePrayerDay(LONDON, '2026-03-10', OPTS);
  assert.equal(formatClock(day.fajr, 'Europe/London', false), '04:35');
});

test('Umm al-Qura Isha is 90 minutes after Maghrib, and 120 in Ramadan', () => {
  const opts = { method: 'UmmAlQura', madhab: 'shafi' };
  const gap = (key) => {
    const day = computePrayerDay(MECCA, key, opts);
    return (ms(day.isha) - ms(day.maghrib)) / 60000;
  };
  assert.equal(gap('2026-03-10'), 120); // Ramadan 1447
  assert.equal(gap('2026-06-10'), 90);
});

test('Umm al-Qura does not add the Ramadan gap in other Hijri months, even September', () => {
  // September is month 9 of the Gregorian calendar; only the Hijri month 9 may trigger the longer gap.
  const day = computePrayerDay(MECCA, '2026-09-10', { method: 'UmmAlQura', madhab: 'shafi' });
  assert.equal((ms(day.isha) - ms(day.maghrib)) / 60000, 90);
});

test('other methods are unaffected by Ramadan', () => {
  // MWL's Isha comes from a sun angle, so its gap after Maghrib changes with the season but is never the fixed 120.
  const ramadan = computePrayerDay(MECCA, '2026-03-10', OPTS);
  assert.notEqual(Math.round((ms(ramadan.isha) - ms(ramadan.maghrib)) / 60000), 120);
});

test('midnight sun uses exactly the times of the nearest latitude that has a sunset', () => {
  const day = computePrayerDay(TROMSO, '2026-06-21', OPTS);
  const fallback = computePrayerDay({ ...TROMSO, lat: 48.5 }, '2026-06-21', OPTS);
  for (const e of PRAYER_EVENTS) {
    assert.ok(Number.isFinite(ms(day[e])), e);
    assert.equal(ms(day[e]), ms(fallback[e]), e);
  }
});

test('Isha after midnight: until it arrives the current prayer is still Maghrib and Isha is next', () => {
  // Oslo, Egyptian method, midsummer: Isha for the 21st is 00:14 on the 22nd.
  const opts = { method: 'Egypt', madhab: 'shafi' };
  const day = computePrayerDay(OSLO, '2026-06-21', opts);
  assert.equal(todayKeyIn('Europe/Oslo', day.isha), '2026-06-22', 'precondition: Isha lands after midnight');
  const fivePastMidnight = new Date('2026-06-21T22:05:00Z'); // 00:05 CEST on the 22nd
  assert.equal(currentEvent(OSLO, opts, fivePastMidnight).event, 'maghrib');
  const next = nextEvent(OSLO, opts, fivePastMidnight, { fardOnly: true });
  assert.equal(next.event, 'isha');
  assert.equal(ms(next.time), ms(day.isha));
  assert.equal(currentEvent(OSLO, opts, new Date(ms(day.isha) + 1000)).event, 'isha');
});

test('across the spring clock change the next Fajr is still tomorrow\'s, on the right date', () => {
  const afterIshaOn28th = new Date('2026-03-28T22:30:00Z'); // clocks go forward at 01:00 UTC on the 29th
  const next = nextEvent(LONDON, OPTS, afterIshaOn28th, { fardOnly: true });
  assert.equal(next.event, 'fajr');
  assert.equal(next.dateKey, '2026-03-29');
  assert.equal(todayKeyIn('Europe/London', next.time), '2026-03-29');
  assert.ok(ms(next.time) > ms(afterIshaOn28th));
});

test('pickNext and pickCurrent work from a prepared window without recomputing', () => {
  const window = eventWindow(MECCA, OPTS, '2026-03-10');
  assert.equal(window.length, 18);
  const day = computePrayerDay(MECCA, '2026-03-10', OPTS);
  const at = new Date(ms(day.asr) + 1000);
  assert.equal(pickCurrent(window, at).event, 'asr');
  assert.equal(pickNext(window, at).event, 'maghrib');
});

test('a chosen high-latitude rule changes the Oslo summer Isha', () => {
  const a = computePrayerDay(OSLO, '2026-06-21', { ...OPTS, highLatitude: 'middleOfTheNight' });
  const b = computePrayerDay(OSLO, '2026-06-21', { ...OPTS, highLatitude: 'seventhOfTheNight' });
  assert.ok(Number.isFinite(ms(a.isha)) && Number.isFinite(ms(b.isha)));
  assert.notEqual(ms(a.isha), ms(b.isha));
});

test('todayKeyIn reads the date in the given zone', () => {
  const instant = new Date('2026-03-10T23:30:00Z');
  assert.equal(todayKeyIn('Asia/Riyadh', instant), '2026-03-11');
  assert.equal(todayKeyIn('America/New_York', instant), '2026-03-10');
});

test('todayKeyIn falls back to the device zone for a bad zone name', () => {
  assert.match(todayKeyIn('Not/AZone', new Date('2026-03-10T12:00:00Z')), /^\d{4}-\d{2}-\d{2}$/);
});

test('addDaysToKey crosses month and year ends', () => {
  assert.equal(addDaysToKey('2026-12-31', 1), '2027-01-01');
  assert.equal(addDaysToKey('2026-03-01', -1), '2026-02-28');
});

test('nextEvent is the first later event today', () => {
  const day = computePrayerDay(MECCA, '2026-03-10', OPTS);
  const justAfterDhuhr = new Date(ms(day.dhuhr) + 1000);
  const next = nextEvent(MECCA, OPTS, justAfterDhuhr);
  assert.equal(next.event, 'asr');
  assert.equal(ms(next.time), ms(day.asr));
});

test('after Isha the next event is tomorrow\'s Fajr', () => {
  const day = computePrayerDay(MECCA, '2026-03-10', OPTS);
  const tomorrow = computePrayerDay(MECCA, '2026-03-11', OPTS);
  const next = nextEvent(MECCA, OPTS, new Date(ms(day.isha) + 60000));
  assert.equal(next.event, 'fajr');
  assert.equal(ms(next.time), ms(tomorrow.fajr));
});

test('fardOnly skips sunrise', () => {
  const day = computePrayerDay(MECCA, '2026-03-10', OPTS);
  const afterFajr = new Date(ms(day.fajr) + 1000);
  assert.equal(nextEvent(MECCA, OPTS, afterFajr).event, 'sunrise');
  assert.equal(nextEvent(MECCA, OPTS, afterFajr, { fardOnly: true }).event, 'dhuhr');
});

test('currentEvent is the latest event already started, and Isha overnight', () => {
  const day = computePrayerDay(MECCA, '2026-03-10', OPTS);
  assert.equal(currentEvent(MECCA, OPTS, new Date(ms(day.asr) + 1000)).event, 'asr');
  const beforeFajr = new Date(ms(day.fajr) - 3600000);
  const cur = currentEvent(MECCA, OPTS, beforeFajr);
  assert.equal(cur.event, 'isha');
  assert.ok(ms(cur.time) < ms(day.fajr));
});

test('formatClock uses the place\'s zone and 12 or 24 hour clocks', () => {
  const instant = new Date('2026-03-10T12:30:00Z');
  assert.match(formatClock(instant, 'Asia/Riyadh', true), /^03:30\s?PM$/i);
  assert.equal(formatClock(instant, 'Asia/Riyadh', false), '15:30');
  assert.equal(formatClock(new Date('2026-03-10T21:05:00Z'), 'Asia/Riyadh', false), '00:05', 'midnight is 00, never 24');
});

test('formatCountdown reads as hours and minutes, never negative', () => {
  assert.equal(formatCountdown(80 * 60000), '1h 20m');
  assert.equal(formatCountdown(12 * 60000 + 30000), '12m');
  assert.equal(formatCountdown(45 * 1000), '45s');
  assert.equal(formatCountdown(-5000), '0s');
  assert.equal(formatCountdown(3 * 3600000), '3h 0m');
});

test('sanitizeLocation keeps good places and rejects bad ones', () => {
  assert.deepEqual(sanitizeLocation({ lat: 10, lng: 20, timeZone: 'Asia/Dubai', label: 'Dubai' }),
    { lat: 10, lng: 20, timeZone: 'Asia/Dubai', label: 'Dubai' });
  assert.equal(sanitizeLocation({ lat: 91, lng: 0, timeZone: 'Asia/Dubai' }), null);
  assert.equal(sanitizeLocation({ lat: 0, lng: 181, timeZone: 'Asia/Dubai' }), null);
  assert.equal(sanitizeLocation({ lat: 'x', lng: 0, timeZone: 'Asia/Dubai' }), null);
  assert.equal(sanitizeLocation(null), null);
  const fallback = sanitizeLocation({ lat: 1, lng: 2, timeZone: 'Bad/Zone' });
  assert.equal(fallback.timeZone, Intl.DateTimeFormat().resolvedOptions().timeZone);
});
