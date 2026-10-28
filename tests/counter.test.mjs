import test from 'node:test';
import assert from 'node:assert/strict';
import {
  tapCount, undoCount, getBeadState, findNextDhikrId, getUpcoming, getHapticPattern, roundInfo, hapticScale,
} from '../src/counter.ts';

// ── tapCount ──────────────────────────────────────────────────────────────────

test('a tap adds one and reports nothing special mid-round', () => {
  const r = tapCount(4, 33);
  assert.deepEqual(r, { count: 5, roundCompleted: false, milestone: false, round: 0 });
});

test('reaching the target completes the round', () => {
  const r = tapCount(32, 33);
  assert.equal(r.count, 33);
  assert.equal(r.roundCompleted, true);
  assert.equal(r.round, 1);
});

test('counting past the target completes every further round', () => {
  assert.equal(tapCount(65, 33).roundCompleted, true);
  assert.equal(tapCount(65, 33).round, 2);
  assert.equal(tapCount(33, 33).roundCompleted, false);
});

test('every tenth tap is a milestone unless it also completes a round', () => {
  assert.equal(tapCount(9, 33).milestone, true);
  assert.equal(tapCount(29, 33).milestone, true);
  assert.equal(tapCount(32, 33).milestone, false, 'completion outranks milestone');
  assert.equal(tapCount(9, 10).milestone, false, '10 is a completion for a target of 10');
  assert.equal(tapCount(9, 10).roundCompleted, true);
});

test('a free counter (no target) never completes but still has milestones', () => {
  const r = tapCount(99, 0);
  assert.equal(r.roundCompleted, false);
  assert.equal(r.milestone, true);
  assert.equal(r.round, 0);
});

// ── undoCount ─────────────────────────────────────────────────────────────────

test('undo removes one tap', () => {
  assert.deepEqual(undoCount(5, 33), { count: 4, undidCompletion: false });
});

test('undo of the tap that completed a round reports it so the log can be removed', () => {
  assert.deepEqual(undoCount(33, 33), { count: 32, undidCompletion: true });
  assert.deepEqual(undoCount(66, 33), { count: 65, undidCompletion: true });
});

test('undo never goes below zero', () => {
  assert.deepEqual(undoCount(0, 33), { count: 0, undidCompletion: false });
});

test('undo on a free counter is never a completion', () => {
  assert.equal(undoCount(33, 0).undidCompletion, false);
});

// ── roundInfo ────────────────────────────────────────────────────────────────

test('roundInfo reports position inside the current round', () => {
  assert.deepEqual(roundInfo(0, 33), { inRound: 0, rounds: 0, remaining: 33 });
  assert.deepEqual(roundInfo(12, 33), { inRound: 12, rounds: 0, remaining: 21 });
  assert.deepEqual(roundInfo(33, 33), { inRound: 33, rounds: 1, remaining: 0 });
  assert.deepEqual(roundInfo(34, 33), { inRound: 1, rounds: 1, remaining: 32 });
  assert.deepEqual(roundInfo(70, 0), { inRound: 70, rounds: 0, remaining: 0 });
});

// ── getBeadState ──────────────────────────────────────────────────────────────

test('bead state shows one bead per count up to the cap', () => {
  assert.deepEqual(getBeadState(0, 33), { total: 33, filled: 0 });
  assert.deepEqual(getBeadState(12, 33), { total: 33, filled: 12 });
  assert.deepEqual(getBeadState(33, 33), { total: 33, filled: 33 }, 'a finished round shows a full string');
  assert.deepEqual(getBeadState(34, 33), { total: 33, filled: 1 }, 'next round starts again');
});

test('small targets use that many beads', () => {
  assert.deepEqual(getBeadState(3, 7), { total: 7, filled: 3 });
  assert.deepEqual(getBeadState(1, 1), { total: 1, filled: 1 });
});

test('large targets scale progress onto the capped string', () => {
  const half = getBeadState(50, 100);
  assert.equal(half.total, 33);
  assert.equal(half.filled, 17, 'rounded to the nearest bead');
  assert.equal(getBeadState(100, 100).filled, 33);
  assert.equal(getBeadState(1, 100).filled, 1, 'a started round always shows at least one bead');
});

test('free counters cycle the string every 33', () => {
  assert.deepEqual(getBeadState(5, 0), { total: 33, filled: 5 });
  assert.deepEqual(getBeadState(33, 0), { total: 33, filled: 33 });
  assert.deepEqual(getBeadState(34, 0), { total: 33, filled: 1 });
});

// ── findNextDhikrId ──────────────────────────────────────────────────────────

const seq = ['a', 'b', 'c', 'd'].map((id) => ({ id }));

test('routine mode advances to the next pending dhikr and skips completed ones', () => {
  assert.equal(findNextDhikrId(seq, 'a', new Set(['a']), 'routine'), 'b');
  assert.equal(findNextDhikrId(seq, 'a', new Set(['a', 'b']), 'routine'), 'c');
});

test('routine mode stops at the end instead of looping', () => {
  assert.equal(findNextDhikrId(seq, 'd', new Set(['d']), 'routine'), null);
  assert.equal(findNextDhikrId(seq, 'c', new Set(['c', 'd']), 'routine'), null);
});

test('free mode moves to the next item and wraps', () => {
  assert.equal(findNextDhikrId(seq, 'b', new Set(), 'free'), 'c');
  assert.equal(findNextDhikrId(seq, 'd', new Set(), 'free'), 'a');
});

test('an unknown current dhikr yields no advance; a one-item sequence yields none', () => {
  assert.equal(findNextDhikrId(seq, 'zzz', new Set(), 'free'), null);
  assert.equal(findNextDhikrId([{ id: 'only' }], 'only', new Set(), 'free'), null);
});

// ── getUpcoming ──────────────────────────────────────────────────────────────

test('upcoming lists the next pending items after the current one', () => {
  assert.deepEqual(getUpcoming(seq, 'a', new Set(['a']), 'routine', 2).map((d) => d.id), ['b', 'c']);
  assert.deepEqual(getUpcoming(seq, 'a', new Set(['a', 'b']), 'routine', 2).map((d) => d.id), ['c', 'd']);
});

test('upcoming in routine mode ends with the sequence; in free mode it wraps', () => {
  assert.deepEqual(getUpcoming(seq, 'c', new Set(), 'routine', 2).map((d) => d.id), ['d']);
  assert.deepEqual(getUpcoming(seq, 'c', new Set(), 'free', 2).map((d) => d.id), ['d', 'a']);
});

test('upcoming never includes the current item or repeats', () => {
  assert.deepEqual(getUpcoming([{ id: 'x' }], 'x', new Set(), 'free', 2), []);
  assert.deepEqual(getUpcoming(seq, 'zzz', new Set(), 'free', 2), []);
});

// ── haptics ──────────────────────────────────────────────────────────────────

test('haptic patterns step up from tap to milestone to completion', () => {
  const tap = getHapticPattern('tap', 'medium');
  const milestone = getHapticPattern('milestone', 'medium');
  const complete = getHapticPattern('complete', 'medium');
  assert.equal(typeof tap, 'number');
  assert.equal(typeof milestone, 'number');
  assert.ok(milestone > tap, 'milestone is stronger than a tap');
  assert.ok(Array.isArray(complete) && complete.length >= 3, 'completion is a pattern');
});

test('haptic strength scales durations', () => {
  const light = getHapticPattern('tap', 'light');
  const strong = getHapticPattern('tap', 'strong');
  assert.ok(strong > light);
  assert.ok(hapticScale('light') < hapticScale('medium'));
  assert.ok(hapticScale('medium') < hapticScale('strong'));
});

test('haptic durations stay in a comfortable range', () => {
  for (const strength of ['light', 'medium', 'strong']) {
    const tap = getHapticPattern('tap', strength);
    assert.ok(tap >= 5 && tap <= 40, `tap ${strength} = ${tap}`);
    for (const n of getHapticPattern('complete', strength)) assert.ok(n >= 0 && n <= 200, `complete ${strength} step ${n}`);
  }
});

// ── beadLayout ───────────────────────────────────────────────────────────────

import { beadLayout, heroFontSize } from '../src/counter.ts';

test('beadLayout places one bead per count, left to right, inside the box', () => {
  const beads = beadLayout(33, 360, 70);
  assert.equal(beads.length, 33);
  for (let i = 1; i < beads.length; i += 1) assert.ok(beads[i].x > beads[i - 1].x, `bead ${i} is right of ${i - 1}`);
  for (const b of beads) {
    assert.ok(b.x - b.r >= 0 && b.x + b.r <= 360, 'bead inside the width');
    assert.ok(b.y - b.r >= 0, 'bead inside the top');
  }
});

test('beadLayout hangs the string: ends are high, the middle sags', () => {
  const beads = beadLayout(33, 360, 70);
  const mid = beads[16];
  assert.ok(mid.y > beads[0].y + 40, 'middle is lower than the ends');
  assert.ok(Math.abs(beads[0].y - beads[32].y) < 0.001, 'ends are level');
  assert.ok(Math.abs(beads[3].y - beads[29].y) < 0.001, 'symmetric');
});

test('beadLayout sizes beads to the room available', () => {
  const dense = beadLayout(33, 360, 70)[0].r;
  const sparse = beadLayout(7, 360, 70)[0].r;
  assert.ok(sparse > dense, 'fewer beads are bigger');
  for (const r of [dense, sparse]) assert.ok(r >= 3 && r <= 12, `radius ${r}`);
});

test('beadLayout handles a single bead and no beads', () => {
  assert.equal(beadLayout(0, 360, 70).length, 0);
  const one = beadLayout(1, 360, 70);
  assert.equal(one.length, 1);
  assert.equal(one[0].x, 180);
});

// ── heroFontSize ─────────────────────────────────────────────────────────────

test('heroFontSize shrinks long phrases so they fit', () => {
  const short = heroFontSize('سُبْحَانَ ٱللَّهِ');
  const medium = heroFontSize('لَا إِلَٰهَ إِلَّا ٱللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ');
  const long = heroFontSize('ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ ۚ لَا تَأْخُذُهُۥ سِنَةٌ وَلَا نَوْمٌ ۚ لَّهُۥ مَا فِى ٱلسَّمَـٰوَٰتِ وَمَا فِى ٱلْأَرْضِ');
  assert.ok(short > medium && medium > long, `${short} > ${medium} > ${long}`);
  for (const size of [short, medium, long]) assert.ok(size >= 28 && size <= 72);
});

test('heroFontSize counts letters, not combining marks', () => {
  const plain = 'سبحان الله';
  const vowelled = 'سُبْحَانَ ٱللَّهِ';
  assert.equal(heroFontSize(plain), heroFontSize(vowelled));
  assert.equal(heroFontSize(''), heroFontSize('x'));
});
