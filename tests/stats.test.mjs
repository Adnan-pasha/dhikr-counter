import test from 'node:test';
import assert from 'node:assert/strict';
import { bucketStats, STATS_RANGES } from '../src/stats.ts';

const TODAY = '2026-03-20'; // a Friday
// History entry at a local date and hour.
const at = (date, count, hour = 12) => ({ id: `${date}-${hour}-${count}`, dhikrId: 'd', dhikrName: 'D', count, timestamp: new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`).toISOString() });

test('ranges are day, week, month and year in that order', () => {
  assert.deepEqual(STATS_RANGES.map((r) => r.id), ['day', 'week', 'month', 'year']);
});

// ── day ───────────────────────────────────────────────────────────────────────

test('day view has 24 hourly buckets holding only today', () => {
  const s = bucketStats([at(TODAY, 33, 5), at(TODAY, 100, 5), at(TODAY, 7, 21), at('2026-03-19', 999, 5)], 'day', TODAY);
  assert.equal(s.buckets.length, 24);
  assert.equal(s.buckets[5].beads, 133);
  assert.equal(s.buckets[21].beads, 7);
  assert.equal(s.total, 140);
  assert.equal(s.best?.key, '5');
});

test('day view compares with yesterday', () => {
  const s = bucketStats([at(TODAY, 150), at('2026-03-19', 100)], 'day', TODAY);
  assert.equal(s.previousTotal, 100);
  assert.equal(s.changePct, 50);
});

// ── week ──────────────────────────────────────────────────────────────────────

test('week view is the last seven days ending today, oldest first, with weekday labels', () => {
  const s = bucketStats([at(TODAY, 10), at('2026-03-14', 5), at('2026-03-13', 999)], 'week', TODAY);
  assert.deepEqual(s.buckets.map((b) => b.key), ['2026-03-14', '2026-03-15', '2026-03-16', '2026-03-17', '2026-03-18', '2026-03-19', '2026-03-20']);
  assert.deepEqual(s.buckets.map((b) => b.label), ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  assert.equal(s.total, 15);
  assert.equal(s.activeBuckets, 2);
});

test('week view compares with the seven days before', () => {
  const s = bucketStats([at(TODAY, 50), at('2026-03-10', 200)], 'week', TODAY);
  assert.equal(s.previousTotal, 200);
  assert.equal(s.changePct, -75);
});

test('no previous activity means no percentage rather than infinity', () => {
  const s = bucketStats([at(TODAY, 50)], 'week', TODAY);
  assert.equal(s.previousTotal, 0);
  assert.equal(s.changePct, null);
});

// ── month ─────────────────────────────────────────────────────────────────────

test('month view is the last thirty days, labelled by day of month', () => {
  const s = bucketStats([at(TODAY, 10), at('2026-02-19', 1), at('2026-02-18', 500)], 'month', TODAY);
  assert.equal(s.buckets.length, 30);
  assert.equal(s.buckets[0].key, '2026-02-19');
  assert.equal(s.buckets[0].label, '19');
  assert.equal(s.buckets[29].key, TODAY);
  assert.equal(s.total, 11, 'the day before the window is excluded');
});

// ── year ──────────────────────────────────────────────────────────────────────

test('year view is twelve calendar months ending this month, grouped by month', () => {
  const s = bucketStats([at('2026-03-01', 10), at(TODAY, 20), at('2025-04-30', 5), at('2025-03-31', 999)], 'year', TODAY);
  assert.equal(s.buckets.length, 12);
  assert.equal(s.buckets[0].key, '2025-04');
  assert.equal(s.buckets[0].label, 'Apr');
  assert.equal(s.buckets[11].key, '2026-03');
  assert.equal(s.buckets[11].beads, 30);
  assert.equal(s.buckets[0].beads, 5);
  assert.equal(s.total, 35);
  assert.equal(s.best?.key, '2026-03');
});

test('year view compares with the twelve months before', () => {
  const s = bucketStats([at(TODAY, 300), at('2025-03-31', 100), at('2024-06-01', 100)], 'year', TODAY);
  assert.equal(s.previousTotal, 200);
  assert.equal(s.changePct, 50);
});

// ── common ────────────────────────────────────────────────────────────────────

test('empty history gives zeroed stats with no best bucket', () => {
  for (const { id } of STATS_RANGES) {
    const s = bucketStats([], id, TODAY);
    assert.equal(s.total, 0);
    assert.equal(s.best, null);
    assert.equal(s.activeBuckets, 0);
    assert.equal(s.changePct, null);
    assert.ok(s.buckets.every((b) => b.beads === 0));
  }
});

test('future-dated entries are ignored', () => {
  assert.equal(bucketStats([at('2026-04-01', 500)], 'week', TODAY).total, 0);
});

test('crossing a month boundary keeps the day sequence correct', () => {
  const s = bucketStats([], 'week', '2026-03-02');
  assert.deepEqual(s.buckets.map((b) => b.key), ['2026-02-24', '2026-02-25', '2026-02-26', '2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
});

test('best bucket is the largest, earliest on ties', () => {
  const s = bucketStats([at('2026-03-18', 40), at('2026-03-19', 40), at(TODAY, 10)], 'week', TODAY);
  assert.equal(s.best?.key, '2026-03-18');
});

test('day view compares with yesterday only up to the same hour, so mornings are not a false drop', () => {
  const h = [at(TODAY, 20, 6), at('2026-03-19', 40, 5), at('2026-03-19', 60, 15)];
  const s = bucketStats(h, 'day', TODAY, 8);
  assert.equal(s.previousTotal, 40);
  assert.equal(s.changePct, -50);
  assert.equal(bucketStats(h, 'day', TODAY, 23).previousTotal, 100, 'a full day compares with all of yesterday');
});
