import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeScale, NORMALIZED_PEAK, peakOf } from '../src/audio.ts';

test('peakOf finds the largest absolute sample', () => {
  assert.equal(peakOf(Float32Array.from([0.1, -0.7, 0.4])), Math.fround(0.7));
  assert.equal(peakOf(new Float32Array(0)), 0);
});

test('a hot tone is scaled down to the shared peak level', () => {
  const scale = normalizeScale(2.19);
  assert.ok(scale < 1);
  assert.ok(Math.abs(2.19 * scale - NORMALIZED_PEAK) < 1e-9);
});

test('a quiet tone is scaled up, but never by an extreme factor', () => {
  assert.ok(normalizeScale(0.4) > 1);
  assert.ok(normalizeScale(0.0001) <= 4, 'near-silence is not amplified into noise');
});

test('silence is left alone', () => {
  assert.equal(normalizeScale(0), 1);
});

test('the shared peak leaves headroom below clipping', () => {
  assert.ok(NORMALIZED_PEAK > 0.5 && NORMALIZED_PEAK < 0.95);
});
