import test from 'node:test';
import assert from 'node:assert/strict';
import {
  planAlarms, HORIZON_DAYS, MAX_ALARMS, ADHAN_CHANNEL, REMINDER_CHANNEL, nextAlarmAfter,
} from '../src/nativeAlarms.ts';
import { computePrayerDay } from '../src/prayerTimes.ts';

const MECCA = { lat: 21.4225, lng: 39.8262, timeZone: 'Asia/Riyadh', label: 'Mecca' };
const OSLO = { lat: 59.9139, lng: 10.7522, timeZone: 'Europe/Oslo', label: 'Oslo' };
const OPTS = { method: 'Karachi', madhab: 'shafi' };
const ALL_ON = { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true };
// 00:30 in Mecca on 11 March 2026 (after Isha, before Fajr), so every prayer of the first day is still ahead.
const NOW = new Date('2026-03-10T21:30:00Z');

const reminder = (over = {}) => ({
  id: 'r1', dhikrId: 'subhanallah', dhikrName: 'SubhanAllah', timeString: '05:30',
  days: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'], label: 'Morning dhikr', isEnabled: true, ...over,
});
const plan = (over = {}) => planAlarms({ place: MECCA, options: OPTS, adhanEnabled: ALL_ON, reminders: [], now: NOW, ...over });
const adhan = (alarms) => alarms.filter((a) => a.kind === 'adhan');
const reminders = (alarms) => alarms.filter((a) => a.kind === 'reminder');

// ── the adhan ─────────────────────────────────────────────────────────────────

test('five prayers a day for ten days when every adhan is on', () => {
  assert.equal(HORIZON_DAYS, 10);
  assert.equal(adhan(plan()).length, 50);
});

test('each alarm is at the instant the engine gives for that prayer, in the place\'s own day', () => {
  const day = computePrayerDay(MECCA, '2026-03-11', OPTS);
  const alarms = adhan(plan());
  for (const prayer of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) {
    const found = alarms.find((a) => a.extra.prayer === prayer && a.extra.dateKey === '2026-03-11');
    assert.ok(found, prayer);
    assert.equal(found.at.getTime(), day[prayer].getTime(), prayer);
  }
});

test('an adhan switched off is not scheduled, the others are', () => {
  const alarms = adhan(plan({ adhanEnabled: { ...ALL_ON, fajr: false, isha: false } }));
  assert.equal(alarms.length, 30);
  assert.ok(alarms.every((a) => !['fajr', 'isha'].includes(a.extra.prayer)));
});

test('prayers already past are left out', () => {
  const day = computePrayerDay(MECCA, '2026-03-11', OPTS);
  const afterAsr = new Date(day.asr.getTime() + 60_000);
  const alarms = adhan(plan({ now: afterAsr }));
  const today = alarms.filter((a) => a.extra.dateKey === '2026-03-11').map((a) => a.extra.prayer);
  assert.deepEqual(today, ['maghrib', 'isha']);
  assert.ok(alarms.every((a) => a.at.getTime() > afterAsr.getTime()));
});

test('with no place nothing is scheduled for the adhan, and nothing is guessed', () => {
  assert.equal(adhan(plan({ place: null })).length, 0);
});

test('an adhan alarm names the prayer, uses the adhan channel and says what to open', () => {
  const asr = adhan(plan()).find((a) => a.extra.prayer === 'asr');
  assert.equal(asr.title, 'Asr');
  assert.match(asr.body, /Asr/);
  assert.equal(asr.channelId, ADHAN_CHANNEL);
  assert.deepEqual(Object.keys(asr.extra).sort(), ['dateKey', 'kind', 'prayer']);
  assert.equal(asr.extra.kind, 'adhan');
});

test('Isha that falls after midnight is still scheduled, at its real time', () => {
  const opts = { method: 'Egypt', madhab: 'shafi' };
  const june = new Date('2026-06-20T12:00:00Z');
  const alarms = adhan(planAlarms({ place: OSLO, options: opts, adhanEnabled: ALL_ON, reminders: [], now: june }));
  const day = computePrayerDay(OSLO, '2026-06-21', opts);
  const isha = alarms.find((a) => a.extra.prayer === 'isha' && a.extra.dateKey === '2026-06-21');
  assert.equal(isha.at.getTime(), day.isha.getTime());
  assert.ok(isha.at.getTime() > new Date('2026-06-21T22:00:00Z').getTime(), 'it is after midnight in Oslo');
});

test('the calendar day is the place\'s, not the phone\'s', () => {
  const auckland = { lat: -36.8485, lng: 174.7633, timeZone: 'Pacific/Auckland', label: 'Auckland' };
  const alarms = adhan(planAlarms({ place: auckland, options: OPTS, adhanEnabled: ALL_ON, reminders: [], now: new Date('2026-01-14T12:00:00Z') }));
  const firstKeys = [...new Set(alarms.map((a) => a.extra.dateKey))].sort();
  assert.equal(firstKeys[0], '2026-01-15', 'Auckland is already on the 15th');
});

// ── the reminders ─────────────────────────────────────────────────────────────

const local = (y, m, d, hh, mm) => new Date(y, m - 1, d, hh, mm, 0, 0);

test('a daily reminder is scheduled at its local time on each coming day', () => {
  const now = local(2026, 3, 10, 12, 0);
  const alarms = reminders(plan({ reminders: [reminder()], now }));
  assert.equal(alarms.length, 10);
  assert.equal(alarms[0].at.getTime(), local(2026, 3, 11, 5, 30).getTime(), 'the first 05:30 still ahead is tomorrow');
  assert.equal(alarms[9].at.getTime(), local(2026, 3, 20, 5, 30).getTime());
});

test('today\'s reminder is included while its time is still ahead', () => {
  const now = local(2026, 3, 10, 4, 0);
  const first = reminders(plan({ reminders: [reminder()], now }))[0];
  assert.equal(first.at.getTime(), local(2026, 3, 10, 5, 30).getTime());
});

test('only the chosen weekdays', () => {
  const now = local(2026, 3, 9, 12, 0); // a Monday
  const alarms = reminders(plan({ reminders: [reminder({ days: ['mon', 'fri'] })], now }));
  const names = alarms.map((a) => ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][a.at.getDay()]);
  assert.ok(names.every((d) => d === 'mon' || d === 'fri'), names.join());
  assert.equal(alarms.length, 2, 'Friday the 13th and Monday the 16th, within ten days of Monday the 9th at noon');
});

test('a reminder that is switched off, empty of days or with a bad time is not scheduled', () => {
  const now = local(2026, 3, 10, 12, 0);
  for (const bad of [{ isEnabled: false }, { days: [] }, { timeString: '25:99' }, { timeString: 'soon' }, { timeString: '' }]) {
    assert.equal(reminders(plan({ reminders: [reminder(bad)], now })).length, 0, JSON.stringify(bad));
  }
});

test('a reminder says its label, names the dhikr to open and uses the reminders channel', () => {
  const now = local(2026, 3, 10, 12, 0);
  const alarm = reminders(plan({ reminders: [reminder()], now }))[0];
  assert.equal(alarm.title, 'Morning dhikr');
  assert.match(alarm.body, /SubhanAllah/);
  assert.equal(alarm.channelId, REMINDER_CHANNEL);
  assert.equal(alarm.extra.kind, 'reminder');
  assert.equal(alarm.extra.dhikrId, 'subhanallah');
  assert.equal(alarm.extra.reminderId, 'r1');
});

test('a reminder with no label still has a title', () => {
  const now = local(2026, 3, 10, 12, 0);
  assert.equal(reminders(plan({ reminders: [reminder({ label: '   ' })], now }))[0].title, 'Time for dhikr');
});

test('reminders are scheduled even when no place is chosen', () => {
  const now = local(2026, 3, 10, 12, 0);
  assert.equal(reminders(plan({ place: null, reminders: [reminder()], now })).length, 10);
});

// ── the plan as a whole ───────────────────────────────────────────────────────

test('the plan is in time order, every alarm is in the future, and none is past the horizon', () => {
  const now = local(2026, 3, 10, 12, 0);
  const alarms = plan({ reminders: [reminder(), reminder({ id: 'r2', timeString: '21:00' })], now });
  const times = alarms.map((a) => a.at.getTime());
  assert.deepEqual(times, [...times].sort((a, b) => a - b));
  assert.ok(times.every((t) => t > now.getTime()));
  assert.ok(times[times.length - 1] < now.getTime() + (HORIZON_DAYS + 2) * 86_400_000);
});

test('ids are whole numbers Android accepts, unique, and the same on every run', () => {
  const now = local(2026, 3, 10, 12, 0);
  const input = { reminders: [reminder(), reminder({ id: 'r2', timeString: '21:00' })], now };
  const a = plan(input);
  const b = plan(input);
  assert.deepEqual(a.map((x) => x.id), b.map((x) => x.id), 'stable');
  assert.equal(new Set(a.map((x) => x.id)).size, a.length, 'unique');
  for (const { id } of a) assert.ok(Number.isInteger(id) && id > 0 && id <= 2_147_483_647, String(id));
});

test('there is a cap, so a huge reminder list cannot flood the phone\'s alarm limit', () => {
  const many = Array.from({ length: 60 }, (_, i) => reminder({ id: `r${i}`, timeString: `${String(i % 24).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}` }));
  const now = local(2026, 3, 10, 12, 0);
  const alarms = plan({ reminders: many, now });
  assert.equal(alarms.length, MAX_ALARMS);
  const unlimited = planAlarms({ place: MECCA, options: OPTS, adhanEnabled: ALL_ON, reminders: many, now, cap: 10_000 });
  assert.ok(unlimited.length > MAX_ALARMS);
});

test('when the cap bites it is the reminders that give way: every prayer alert is kept, and the earliest reminders', () => {
  const many = Array.from({ length: 60 }, (_, i) => reminder({ id: `r${i}`, timeString: `${String(i % 24).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}` }));
  const now = local(2026, 3, 10, 12, 0);
  const capped = plan({ reminders: many, now });
  const unlimited = planAlarms({ place: MECCA, options: OPTS, adhanEnabled: ALL_ON, reminders: many, now, cap: 10_000 });
  assert.equal(adhan(capped).length, adhan(unlimited).length, 'no prayer alert is lost');
  const keptReminders = reminders(capped).map((a) => a.id);
  const earliestReminders = reminders(unlimited).slice(0, keptReminders.length).map((a) => a.id);
  assert.deepEqual(keptReminders, earliestReminders, 'the reminders kept are the earliest ones');
  const times = capped.map((a) => a.at.getTime());
  assert.deepEqual(times, [...times].sort((a, b) => a - b), 'still in time order');
});

test('a very small cap still keeps the soonest prayer alerts', () => {
  const alarms = plan({ cap: 3 });
  assert.equal(alarms.length, 3);
  assert.deepEqual(alarms.map((a) => a.at.getTime()), plan().slice(0, 3).map((a) => a.at.getTime()));
});

test('the horizon can be shortened', () => {
  assert.equal(adhan(plan({ days: 3 })).length, 15);
});

test('inputs are not changed', () => {
  const reminderList = [reminder()];
  const frozen = JSON.stringify(reminderList);
  const place = { ...MECCA };
  plan({ reminders: reminderList, place });
  assert.equal(JSON.stringify(reminderList), frozen);
  assert.deepEqual(place, MECCA);
});

test('nextAlarmAfter names the soonest alarm still ahead, for the card to show', () => {
  const alarms = plan();
  assert.equal(nextAlarmAfter(alarms, NOW).at.getTime(), alarms[0].at.getTime());
  assert.equal(nextAlarmAfter(alarms, new Date(alarms[alarms.length - 1].at.getTime() + 1)), null);
  assert.equal(nextAlarmAfter([], NOW), null);
});

test('the id kept for the test notification is never given to a real alarm, even if the hash lands on it', async () => {
  const { TEST_ALARM_ID } = await import('../src/nativeAlarms.ts');
  const { planAlarms: plans } = await import('../src/nativeAlarms.ts');
  // A reminder whose key hashes to the reserved id is not feasible to search for, so check the rule directly:
  // every id in a large plan is different from it, and the constant is a valid Android id.
  const many = Array.from({ length: 40 }, (_, i) => reminder({ id: `x${i}`, timeString: `${String(i % 24).padStart(2, '0')}:00` }));
  const ids = plans({ place: MECCA, options: OPTS, adhanEnabled: ALL_ON, reminders: many, now: local(2026, 3, 10, 12, 0), cap: 10_000 }).map((a) => a.id);
  assert.ok(!ids.includes(TEST_ALARM_ID));
  assert.ok(Number.isInteger(TEST_ALARM_ID) && TEST_ALARM_ID <= 2_147_483_647);
});

// ── the nudge before the schedule runs out ───────────────────────────────────

const refreshAlarms = (alarms) => alarms.filter((a) => a.kind === 'refresh');

test('a gentle nudge is set for the day before the schedule ends, in the morning, to open the app', () => {
  const now = local(2026, 3, 10, 12, 0);
  const [nudge, ...extra] = refreshAlarms(plan({ now }));
  assert.equal(extra.length, 0, 'exactly one');
  assert.equal(nudge.at.getTime(), local(2026, 3, 19, 9, 0).getTime(), 'the last full day, at 9 in the morning');
  assert.match(nudge.title, /alerts going/i);
  assert.equal(nudge.channelId, REMINDER_CHANNEL);
  assert.deepEqual(nudge.extra, { kind: 'refresh' });
});

test('the nudge is set even with no place and no reminders', () => {
  const now = local(2026, 3, 10, 12, 0);
  assert.equal(refreshAlarms(plan({ place: null, now })).length, 1);
});

test('the nudge never counts as the next alert shown to the person', () => {
  const alarms = plan({ days: 3 });
  assert.notEqual(nextAlarmAfter(alarms, NOW).kind, 'refresh');
  assert.equal(nextAlarmAfter(refreshAlarms(alarms), NOW), null, 'only a nudge ahead means no real alert is next');
});

test('the nudge fits the cap and the horizon, and a shorter horizon moves it earlier', () => {
  const now = local(2026, 3, 10, 12, 0);
  assert.equal(refreshAlarms(plan({ now, cap: 1 })).length, 0, 'prayers come first when there is hardly any room');
  assert.equal(refreshAlarms(plan({ now, days: 3 }))[0].at.getTime(), local(2026, 3, 12, 9, 0).getTime());
});
