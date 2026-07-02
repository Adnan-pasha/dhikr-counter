import test from 'node:test';
import assert from 'node:assert/strict';
import {
  safeParseJSON,
  sanitizeDhikrs,
  sanitizeHistory,
  sanitizePreferences,
  sanitizeReminders,
  sanitizeAzanSettings,
  sanitizePrayerSettings,
  readPrayerSettings,
  writePrayerSettings,
  computeStreak,
  migrateAndHydrateStorage,
  STORAGE_SCHEMA_VERSION,
  buildReminderOccurrenceKey,
  findDueReminders,
  shouldTriggerReminderOccurrence,
  getLocalDateString,
  shouldTriggerCatchUpReminder,
  getDayKey,
  findCatchUpReminderCandidates,
  minutesSinceReminderTime,
  findMissedReminderCandidates,
} from '../src/domain.ts';

const defaultPrefs = {
  soundOn: true,
  soundTone: 'wooden',
  vibrateOn: true,
  autoAdvance: true,
  theme: 'emerald',
  volume: 0.5,
  madhab: 'shafi',
};

const defaultReminder = [{
  id: 'r1',
  dhikrId: 'subhanallah',
  dhikrName: 'SubhanAllah',
  timeString: '05:15',
  days: ['mon'],
  label: 'Morning',
  isEnabled: true,
}];

test('safeParseJSON returns fallback on invalid JSON', () => {
  const fallback = { ok: true };
  assert.deepEqual(safeParseJSON('{invalid', fallback), fallback);
  assert.deepEqual(safeParseJSON(null, fallback), fallback);
});

test('sanitizePreferences clamps and falls back invalid values', () => {
  const result = sanitizePreferences({
    soundOn: false,
    soundTone: 'bad',
    vibrateOn: true,
    autoAdvance: false,
    theme: 'unknown',
    volume: 99,
  }, defaultPrefs);

  assert.equal(result.soundOn, false);
  assert.equal(result.soundTone, 'wooden');
  assert.equal(result.theme, 'emerald');
  assert.equal(result.volume, 1);
  assert.equal(result.madhab, 'shafi');
});

test('sanitizeDhikrs drops malformed items', () => {
  const fallback = [{ id: 'fallback', nameAr: 'a', nameEn: 'b', meaning: 'c', targetCount: 33 }];
  const result = sanitizeDhikrs([
    { id: 'ok', nameAr: 'x', nameEn: 'y', meaning: 'z', targetCount: 10 },
    { id: 'bad', nameAr: 'x' },
  ], fallback);

  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'ok');
});

test('sanitizeReminders validates shape and day/time format', () => {
  const result = sanitizeReminders([
    defaultReminder[0],
    { ...defaultReminder[0], id: 'bad1', timeString: '5:15' },
    { ...defaultReminder[0], id: 'bad2', days: ['monday'] },
  ], defaultReminder);

  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'r1');
});

test('sanitizeHistory removes malformed entries', () => {
  const result = sanitizeHistory([
    { id: '1', dhikrId: 'd1', dhikrName: 'n', count: 33, timestamp: '2026-05-22T00:00:00.000Z' },
    { id: '2', dhikrId: 'd2', count: 99 },
  ]);
  assert.equal(result.length, 1);
});

test('sanitizeAzanSettings defaults invalid keys to true', () => {
  const result = sanitizeAzanSettings({ fajr: false, dhuhr: 'nope' });
  assert.equal(result.fajr, false);
  assert.equal(result.dhuhr, true);
  assert.equal(result.maghrib, true);
});

test('computeStreak returns 0 for stale logs', () => {
  const result = computeStreak([
    { id: '1', dhikrId: 'd', dhikrName: 'n', count: 33, timestamp: '2020-01-01T00:00:00.000Z' },
  ]);
  assert.equal(result, 0);
});


test('migrateAndHydrateStorage sanitizes persisted data and sets schema version', () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); },
  };

  localStorage.setItem('tasbih_schema_version', '0');
  localStorage.setItem('tasbih_dhikrs', JSON.stringify([{ id: 'ok', nameAr: 'a', nameEn: 'b', meaning: 'c', targetCount: 33 }, { bad: true }]));
  localStorage.setItem('tasbih_current_id', 'missing');
  localStorage.setItem('tasbih_current_count', '-5');
  localStorage.setItem('tasbih_history', JSON.stringify([{ id: '1', dhikrId: 'd', dhikrName: 'n', count: 20, timestamp: '2026-01-01T00:00:00.000Z' }, { bad: true }]));
  localStorage.setItem('tasbih_preferences', JSON.stringify({ soundOn: false, soundTone: 'bad', vibrateOn: true, autoAdvance: true, theme: 'bad', volume: 3 }));
  localStorage.setItem('tasbih_reminders', JSON.stringify([{ id: 'r', dhikrId: 'd', dhikrName: 'n', timeString: '06:30', days: ['fri'], label: 'ok', isEnabled: true }, { id: 'x', timeString: '6:30' }]));

  const hydrated = migrateAndHydrateStorage({
    defaultDhikrs: [{ id: 'fallback', nameAr: 'fa', nameEn: 'fb', meaning: 'fc', targetCount: 11 }],
    defaultPreferences: defaultPrefs,
    defaultReminders: defaultReminder,
  });

  assert.equal(hydrated.dhikrs.length, 1);
  assert.equal(hydrated.currentDhikrId, 'ok');
  assert.equal(hydrated.currentCount, 0);
  assert.equal(hydrated.preferences.soundTone, 'wooden');
  assert.equal(hydrated.reminders.length, 1);
  assert.equal(localStorage.getItem('tasbih_schema_version'), String(STORAGE_SCHEMA_VERSION));
});


test('findDueReminders returns all enabled reminders matching current minute/day', () => {
  const now = new Date(2026, 4, 22, 16, 30, 0);
  const list = findDueReminders([
    { id: 'a', dhikrId: 'd', dhikrName: 'n', timeString: '16:30', days: ['fri'], label: 'x', isEnabled: true },
    { id: 'b', dhikrId: 'd', dhikrName: 'n', timeString: '16:30', days: ['fri'], label: 'y', isEnabled: true },
    { id: 'c', dhikrId: 'd', dhikrName: 'n', timeString: '16:31', days: ['fri'], label: 'z', isEnabled: true },
  ], now);
  assert.equal(list.length, 2);
  assert.equal(list[0].id, 'a');
  assert.equal(list[1].id, 'b');
});

test('shouldTriggerReminderOccurrence dedupes occurrence key', () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); },
  };

  const now = new Date(2026, 4, 22, 16, 30, 0);
  assert.equal(shouldTriggerReminderOccurrence('rem_a', '16:30', now), true);
  assert.equal(shouldTriggerReminderOccurrence('rem_a', '16:30', now), false);
  const key = buildReminderOccurrenceKey('rem_a', '16:30', now);
  assert.match(localStorage.getItem('tasbih_reminder_trigger_log') || '', new RegExp(key.replace(/[|]/g, '\|')));
});


test('getLocalDateString uses local date parts not UTC ISO split', () => {
  const d = new Date(2026, 4, 22, 0, 30, 0);
  assert.equal(getLocalDateString(d), '2026-05-22');
});

test('shouldTriggerReminderOccurrence prunes previous-day keys', () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); },
  };

  localStorage.setItem('tasbih_reminder_trigger_log', JSON.stringify(['old|12:00|thu|2026-05-21']));
  const now = new Date(2026, 4, 22, 16, 30, 0);
  assert.equal(shouldTriggerReminderOccurrence('rem_b', '16:30', now), true);
  const raw = localStorage.getItem('tasbih_reminder_trigger_log') || '[]';
  assert.doesNotMatch(raw, /2026-05-21/);
  assert.match(raw, /2026-05-22/);
});

test('shouldTriggerReminderOccurrence dedupes across polling minutes for same scheduled reminder time', () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); },
  };

  const firstPoll = new Date(2026, 4, 22, 16, 35, 0);
  const secondPoll = new Date(2026, 4, 22, 16, 36, 0);
  assert.equal(shouldTriggerReminderOccurrence('rem_c', '16:30', firstPoll), true);
  assert.equal(shouldTriggerReminderOccurrence('rem_c', '16:30', secondPoll), false);
});


test('shouldTriggerCatchUpReminder allows recent missed reminders within policy window', () => {
  const now = new Date(2026, 4, 22, 16, 35, 0);
  assert.equal(shouldTriggerCatchUpReminder('16:30', now), true);
  assert.equal(shouldTriggerCatchUpReminder('16:20', now), false);
  assert.equal(shouldTriggerCatchUpReminder('16:40', now), false);
});


test('getDayKey follows local calendar day', () => {
  const d = new Date(2026, 4, 24, 12, 0, 0);
  assert.equal(getDayKey(d), 'sun');
});

test('shouldTriggerCatchUpReminder supports custom policy windows', () => {
  const now = new Date(2026, 4, 22, 16, 35, 0);
  assert.equal(shouldTriggerCatchUpReminder('16:20', now, { catchUpWindowMinutes: 20 }), true);
  assert.equal(shouldTriggerCatchUpReminder('16:20', now, { catchUpWindowMinutes: 10 }), false);
});

test('findCatchUpReminderCandidates filters by enabled/day/policy', () => {
  const now = new Date(2026, 4, 22, 16, 35, 0); // Friday
  const reminders = [
    { id: 'a', dhikrId: 'd', dhikrName: 'n', timeString: '16:30', days: ['fri'], label: 'ok', isEnabled: true },
    { id: 'b', dhikrId: 'd', dhikrName: 'n', timeString: '16:10', days: ['fri'], label: 'late', isEnabled: true },
    { id: 'c', dhikrId: 'd', dhikrName: 'n', timeString: '16:30', days: ['thu'], label: 'wrong-day', isEnabled: true },
    { id: 'd', dhikrId: 'd', dhikrName: 'n', timeString: '16:30', days: ['fri'], label: 'disabled', isEnabled: false },
  ];
  const res = findCatchUpReminderCandidates(reminders, now, { catchUpWindowMinutes: 10 });
  assert.equal(res.length, 1);
  assert.equal(res[0].id, 'a');
});


test('minutesSinceReminderTime returns positive/past, negative/future, null/invalid', () => {
  const now = new Date(2026, 4, 22, 16, 35, 0);
  assert.equal(minutesSinceReminderTime('16:30', now), 5);
  assert.equal(minutesSinceReminderTime('16:40', now), -5);
  assert.equal(minutesSinceReminderTime('bad', now), null);
});

test('findMissedReminderCandidates only catches same-day reminders within sleep + policy window', () => {
  const now = new Date(2026, 4, 22, 16, 35, 0);
  const lastActiveAt = new Date(2026, 4, 22, 16, 29, 0);
  const reminders = [
    { id: 'a', dhikrId: 'd', dhikrName: 'n', timeString: '16:30', days: ['fri'], label: 'ok', isEnabled: true },
    { id: 'b', dhikrId: 'd', dhikrName: 'n', timeString: '16:20', days: ['fri'], label: 'too-old', isEnabled: true },
    { id: 'c', dhikrId: 'd', dhikrName: 'n', timeString: '16:33', days: ['fri'], label: 'ok2', isEnabled: true },
  ];
  const res = findMissedReminderCandidates(reminders, now, lastActiveAt, { catchUpWindowMinutes: 10 });
  assert.equal(res.length, 2);
  assert.equal(res[0].id, 'a');
  assert.equal(res[1].id, 'c');

  const noneCrossDay = findMissedReminderCandidates(
    reminders,
    now,
    new Date(2026, 4, 21, 23, 50, 0),
    { catchUpWindowMinutes: 10 },
  );
  assert.equal(noneCrossDay.length, 0);
});


test('sanitizePrayerSettings validates calculation method, madhab, azan sound, and azan toggles', () => {
  const result = sanitizePrayerSettings({
    madhab: 'bad',
    calculationMethod: 'Nope',
    azanSound: 'loud',
    azanEnabled: { fajr: false, dhuhr: 'yes', asr: true, maghrib: false, isha: true },
  }, {
    madhab: 'hanafi',
    calculationMethod: 'MWL',
    azanSound: 'medina',
    azanEnabled: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
  });

  assert.equal(result.madhab, 'hanafi');
  assert.equal(result.calculationMethod, 'MWL');
  assert.equal(result.azanSound, 'medina');
  assert.equal(result.azanEnabled.fajr, false);
  assert.equal(result.azanEnabled.dhuhr, true);
  assert.equal(result.azanEnabled.maghrib, false);
});

test('readPrayerSettings migrates legacy azan settings and writePrayerSettings persists compat keys', () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); },
  };

  localStorage.setItem('tasbih_azan_settings', JSON.stringify({ fajr: false, dhuhr: true, asr: false, maghrib: true, isha: false }));
  const migrated = readPrayerSettings('hanafi');
  assert.equal(migrated.madhab, 'hanafi');
  assert.equal(migrated.azanEnabled.fajr, false);
  assert.equal(migrated.azanEnabled.asr, false);
  assert.match(localStorage.getItem('tasbih_prayer_settings') || '', /azanEnabled/);

  const written = writePrayerSettings({ ...migrated, calculationMethod: 'Egypt', azanSound: 'medina' });
  assert.equal(written.calculationMethod, 'Egypt');
  assert.equal(written.azanSound, 'medina');
  assert.match(localStorage.getItem('tasbih_prayer_settings') || '', /Egypt/);
  assert.match(localStorage.getItem('tasbih_azan_settings') || '', /fajr/);
});
