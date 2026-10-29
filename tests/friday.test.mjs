import test from 'node:test';
import assert from 'node:assert/strict';
import { isFriday, fridayChecklist, toggleDate, FRIDAY_SALAWAT_ID, FRIDAY_KAHF_SURAH } from '../src/friday.ts';

const FRI = '2026-03-20';
const THU = '2026-03-19';
const entry = (date, dhikrId, count = 100, hour = 12) => ({ id: `${date}-${dhikrId}`, dhikrId, dhikrName: dhikrId, count, timestamp: new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`).toISOString() });

test('only Fridays are Fridays, across month and year boundaries', () => {
  assert.equal(isFriday('2026-03-20'), true);
  assert.equal(isFriday('2026-03-19'), false);
  assert.equal(isFriday('2026-03-21'), false);
  assert.equal(isFriday('2027-01-01'), true);
  assert.equal(isFriday('2026-02-27'), true);
});

test('Al-Kahf is surah 18', () => {
  assert.equal(FRIDAY_KAHF_SURAH, 18);
});

test('on a normal day there is no Friday checklist', () => {
  const c = fridayChecklist([], [], THU);
  assert.equal(c.isFriday, false);
  assert.deepEqual(c.items, []);
});

test('a fresh Friday lists Al-Kahf and salawat, both undone', () => {
  const c = fridayChecklist([], [], FRI);
  assert.equal(c.isFriday, true);
  assert.deepEqual(c.items.map((i) => [i.id, i.done]), [['kahf', false], ['salawat', false]]);
  assert.equal(c.doneCount, 0);
});

test('Al-Kahf is done only when marked for that Friday', () => {
  assert.equal(fridayChecklist([], [FRI], FRI).items[0].done, true);
  assert.equal(fridayChecklist([], ['2026-03-13'], FRI).items[0].done, false, 'last Friday does not count');
});

test('salawat counts from today\'s Friday salawat or the standard salawat round', () => {
  assert.equal(fridayChecklist([entry(FRI, FRIDAY_SALAWAT_ID)], [], FRI).items[1].done, true);
  assert.equal(fridayChecklist([entry(FRI, 'darood-ibrahim')], [], FRI).items[1].done, true);
  assert.equal(fridayChecklist([entry(FRI, 'subhanallah')], [], FRI).items[1].done, false);
  assert.equal(fridayChecklist([entry('2026-03-13', FRIDAY_SALAWAT_ID)], [], FRI).items[1].done, false, 'last Friday does not count');
});

test('done count reflects both items', () => {
  const c = fridayChecklist([entry(FRI, FRIDAY_SALAWAT_ID)], [FRI], FRI);
  assert.equal(c.doneCount, 2);
});

test('toggleDate adds then removes without mutating, keeping dates sorted and unique', () => {
  const base = ['2026-03-06'];
  const added = toggleDate(base, FRI);
  assert.deepEqual(base, ['2026-03-06']);
  assert.deepEqual(added, ['2026-03-06', FRI]);
  assert.deepEqual(toggleDate(added, FRI), ['2026-03-06']);
});

test('toggleDate keeps only the most recent dates', () => {
  const many = Array.from({ length: 60 }, (_, i) => `2026-01-${String((i % 28) + 1).padStart(2, '0')}`.replace(/^2026-01/, `20${20 + Math.floor(i / 28)}-01`));
  const next = toggleDate([...new Set(many)].sort(), '2030-01-01');
  assert.ok(next.length <= 60);
  assert.equal(next.at(-1), '2030-01-01');
});
