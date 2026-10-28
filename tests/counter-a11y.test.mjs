import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldCountOnKey, getCounterLiveMessage } from '../src/domain.ts';

const key = (overrides = {}) => ({
  code: 'Space',
  repeat: false,
  defaultPrevented: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  isEditable: false,
  insideInteractive: false,
  modalOpen: false,
  ...overrides,
});

test('Space and Enter count when focus is on the page body', () => {
  assert.equal(shouldCountOnKey(key({ code: 'Space' })), true);
  assert.equal(shouldCountOnKey(key({ code: 'Enter' })), true);
});

test('other keys never count', () => {
  assert.equal(shouldCountOnKey(key({ code: 'KeyA' })), false);
});

test('held keys do not auto-repeat the count', () => {
  assert.equal(shouldCountOnKey(key({ repeat: true })), false);
});

test('focused controls keep native Space/Enter behaviour', () => {
  assert.equal(shouldCountOnKey(key({ insideInteractive: true })), false);
});

test('typing contexts are ignored', () => {
  assert.equal(shouldCountOnKey(key({ isEditable: true })), false);
});

test('modifier shortcuts and already-handled events are ignored', () => {
  assert.equal(shouldCountOnKey(key({ ctrlKey: true })), false);
  assert.equal(shouldCountOnKey(key({ metaKey: true })), false);
  assert.equal(shouldCountOnKey(key({ altKey: true })), false);
  assert.equal(shouldCountOnKey(key({ defaultPrevented: true })), false);
});

test('shortcut is disabled while a modal is open', () => {
  assert.equal(shouldCountOnKey(key({ modalOpen: true })), false);
});

const live = (overrides = {}) => ({ count: 0, previousCount: 0, target: 33, name: 'SubhanAllah', ...overrides });

test('live message is silent for ordinary taps', () => {
  assert.equal(getCounterLiveMessage(live({ count: 5, previousCount: 4 })), '');
});

test('live message announces every tenth count', () => {
  assert.equal(getCounterLiveMessage(live({ count: 10, previousCount: 9 })), '10 counted');
});

test('live message announces completion of each round', () => {
  assert.equal(getCounterLiveMessage(live({ count: 33, previousCount: 32 })), 'SubhanAllah complete, 33 counted');
  assert.equal(getCounterLiveMessage(live({ count: 66, previousCount: 65 })), 'SubhanAllah complete, 66 counted');
});

test('live message stays silent on undo or reset', () => {
  assert.equal(getCounterLiveMessage(live({ count: 10, previousCount: 11 })), '');
  assert.equal(getCounterLiveMessage(live({ count: 33, previousCount: 34 })), '');
  assert.equal(getCounterLiveMessage(live({ count: 0, previousCount: 12 })), '');
});

test('free counters (no target) still announce every tenth count', () => {
  assert.equal(getCounterLiveMessage(live({ count: 20, previousCount: 19, target: 0 })), '20 counted');
});
