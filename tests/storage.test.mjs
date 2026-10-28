import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStoredArray } from '../src/domain.ts';

test('parseStoredArray returns parsed arrays', () => {
  assert.deepEqual(parseStoredArray('["a","b"]', []), ['a', 'b']);
});

test('parseStoredArray falls back on corrupt JSON', () => {
  assert.deepEqual(parseStoredArray('{not json', ['x']), ['x']);
});

test('parseStoredArray falls back when JSON is not an array', () => {
  assert.deepEqual(parseStoredArray('{"a":1}', ['x']), ['x']);
  assert.deepEqual(parseStoredArray('null', ['x']), ['x']);
});

test('parseStoredArray falls back on null/empty input', () => {
  assert.deepEqual(parseStoredArray(null, ['x']), ['x']);
  assert.deepEqual(parseStoredArray('', ['x']), ['x']);
});

test('parseStoredArray applies an element guard', () => {
  const isString = (v) => typeof v === 'string';
  assert.deepEqual(parseStoredArray('["a",1,null,"b"]', [], isString), ['a', 'b']);
});
