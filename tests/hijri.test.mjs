import test from 'node:test';
import assert from 'node:assert/strict';
import { hijriLabel, hijriParts } from '../src/hijri.ts';

const noon = (iso) => new Date(`${iso}T09:00:00Z`);

test('a date is given as day, month name and year with AH', () => {
  assert.equal(hijriLabel(noon('2026-11-05'), 'Asia/Kolkata'), '25 Jumada al-Awwal 1448 AH');
});

test('Ramadan 1447 begins on 18 February 2026 and Eid is on 20 March, on the Umm al-Qura calendar', () => {
  assert.equal(hijriLabel(noon('2026-02-17'), 'Asia/Riyadh'), "29 Sha'ban 1447 AH");
  assert.equal(hijriLabel(noon('2026-02-18'), 'Asia/Riyadh'), '1 Ramadan 1447 AH');
  assert.equal(hijriLabel(noon('2026-03-20'), 'Asia/Riyadh'), '1 Shawwal 1447 AH');
});

test('the numbers are what is used, never the engine\'s own month or era names', () => {
  // Some phones know the Islamic calendar's numbers but not its names, and print "May 25, 1448 BC".
  const parts = hijriParts(noon('2026-11-05'), 'Asia/Kolkata');
  assert.deepEqual(parts, { day: 25, month: 5, year: 1448 });
  assert.doesNotMatch(hijriLabel(noon('2026-11-05'), 'Asia/Kolkata'), /May|BC|AD/);
});

test('the day follows the place\'s own clock, so the new Hijri day starts at the right moment there', () => {
  const instant = new Date('2026-11-05T20:30:00Z'); // already 6 Nov in India, still 5 Nov in London
  assert.equal(hijriParts(instant, 'Asia/Kolkata').day, hijriParts(instant, 'Europe/London').day + 1);
});

test('an unknown zone falls back to the phone\'s zone instead of failing', () => {
  assert.match(hijriLabel(noon('2026-11-05'), 'Not/AZone'), /^\d{1,2} .+ \d{4} AH$/);
});

test('nothing is shown, rather than something wrong, when the calendar cannot be read', () => {
  assert.equal(hijriLabel(new Date('invalid'), 'Asia/Kolkata'), '');
});

test('every one of the twelve months has a name', () => {
  const seen = new Set();
  for (let day = 0; day < 400; day += 10) {
    const label = hijriLabel(new Date(Date.UTC(2026, 0, 1 + day, 9)), 'Asia/Riyadh');
    assert.match(label, /^\d{1,2} \S.* \d{4} AH$/, label);
    seen.add(label.replace(/^\d+ /, '').replace(/ \d{4} AH$/, ''));
  }
  assert.ok(seen.size >= 12, `saw ${seen.size} month names`);
});
