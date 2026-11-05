import test from 'node:test';
import assert from 'node:assert/strict';
import { differsFromPhoneClock } from '../src/prayerTimes.ts';

const NOW = new Date('2026-11-05T13:53:00Z');

test('the same zone under an older name is the same clock, so "there" is not shown', () => {
  assert.equal(differsFromPhoneClock(NOW, 'Asia/Kolkata', 'Asia/Calcutta'), false);
  assert.equal(differsFromPhoneClock(NOW, 'Asia/Kolkata', 'Asia/Kolkata'), false);
});

test('two different zones that happen to read the same right now are not worth mentioning either', () => {
  assert.equal(differsFromPhoneClock(NOW, 'Europe/London', 'Africa/Abidjan'), false);
});

test('a place in another time zone is shown with its own clock', () => {
  assert.equal(differsFromPhoneClock(NOW, 'Asia/Riyadh', 'Asia/Kolkata'), true);
  assert.equal(differsFromPhoneClock(NOW, 'Pacific/Auckland', 'Europe/London'), true);
});

test('an unusable zone name never throws', () => {
  assert.doesNotThrow(() => differsFromPhoneClock(NOW, 'Not/AZone', 'Asia/Kolkata'));
});
