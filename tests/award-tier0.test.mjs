import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dailyProgress, unloggedBeads } from '../src/habits.ts';
import { hijriLabel, hijriLabelForDay } from '../src/hijri.ts';
import { dayCount } from '../src/domain.ts';

const read = (file) => readFileSync(file, 'utf8');

// ── a finished round is counted once ──────────────────────────────────────────

test('a finished round leaves no unlogged beads: it is already in the history', () => {
  assert.equal(unloggedBeads(33, 33), 0);
  assert.equal(unloggedBeads(66, 33), 0);
});

test('beads past the last finished round are the unlogged ones', () => {
  assert.equal(unloggedBeads(5, 33), 5);
  assert.equal(unloggedBeads(40, 33), 7);
});

test('a dhikr with no target logs nothing, so every bead is unlogged', () => {
  assert.equal(unloggedBeads(12, 0), 12);
});

test('unlogged beads are never negative or fractional nonsense', () => {
  assert.equal(unloggedBeads(-4, 33), 0);
  assert.equal(unloggedBeads(Number.NaN, 33), 0);
});

test('33 taps on a 33-bead dhikr show 33 beads today, not 66', () => {
  const finishedToday = 33; // the round the counter just logged
  const progress = dailyProgress(finishedToday, unloggedBeads(33, 33), 100);
  assert.equal(progress.beads, 33);
});

test('the app adds only unlogged beads to the saved history, for today and for the all-time total', () => {
  const app = read('src/App.tsx');
  assert.doesNotMatch(app, /dailyProgress\(finishedToday, currentCount,/);
  assert.doesNotMatch(app, /\+ currentCount\}/);
  assert.match(app, /unloggedBeads\(currentCount, activeDhikr\.targetCount\)/);
});

// ── one Islamic date across the app ───────────────────────────────────────────

test('the Islamic date for a calendar day matches the Prayers screen for the same day', () => {
  const day = new Date(2026, 10, 5);
  assert.equal(hijriLabelForDay(day), '25 Jumada al-Awwal 1448 AH');
  assert.equal(hijriLabelForDay(day), hijriLabel(new Date(2026, 10, 5, 12), Intl.DateTimeFormat().resolvedOptions().timeZone));
});

test('the Islamic date for a day does not depend on the hour it is asked', () => {
  assert.equal(hijriLabelForDay(new Date(2026, 10, 11, 0, 5)), hijriLabelForDay(new Date(2026, 10, 11, 23, 55)));
});

test('an invalid day gives an empty Islamic date rather than nonsense', () => {
  assert.equal(hijriLabelForDay(new Date('invalid')), '');
});

for (const file of ['src/components/HomeScreen.tsx', 'src/components/SalahTracker.tsx']) {
  test(`${file} takes the Islamic date from the shared module, not its own arithmetic`, () => {
    const source = read(file);
    assert.doesNotMatch(source, /1948440/);
    assert.match(source, /hijriLabelForDay/);
  });
}

// ── the app is called Muneeb ──────────────────────────────────────────────────

test('the first-run screen and Home carry the name Muneeb', () => {
  assert.match(read('src/components/OnboardingFlow.tsx'), />Muneeb</);
  const home = read('src/components/HomeScreen.tsx');
  assert.doesNotMatch(home, /Dhikr Counter/);
  assert.match(home, /Muneeb/);
});

test('the reminders note names the app Muneeb', () => {
  const note = read('src/components/NotificationSettings.tsx');
  assert.doesNotMatch(note, /while Dhikr is open/);
  assert.match(note, /while Muneeb is open/);
});

test('Settings ships no placeholder footer', () => {
  const settings = read('src/components/SettingsScreen.tsx');
  assert.doesNotMatch(settings, /sandbox/i);
  assert.doesNotMatch(settings, /Companion Hub/i);
});

// ── one day is "1 day" ────────────────────────────────────────────────────────

test('a count of days reads naturally for one and for many', () => {
  assert.equal(dayCount(1), '1 day');
  assert.equal(dayCount(0), '0 days');
  assert.equal(dayCount(12), '12 days');
});

test('streak wording never prints a bare "N days" built by hand', () => {
  assert.doesNotMatch(read('src/domain.ts'), /\$\{streak\} days/);
  assert.doesNotMatch(read('src/components/HomeScreen.tsx'), /unit: 'days'/);
});
