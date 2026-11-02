import test from 'node:test';
import assert from 'node:assert/strict';
import { BackStack, depthOf } from '../src/backStack.ts';

/** A browser history that behaves like the real one: moving fires popstate afterwards, with the state landed on. */
const makeHistory = () => {
  const h = {
    entries: [null],
    index: 0,
    listener: null,
    exited: false,
    pushState(state) { h.entries = h.entries.slice(0, h.index + 1); h.entries.push(state); h.index += 1; },
    back() {
      queueMicrotask(() => {
        if (h.index === 0) { h.exited = true; return; }
        h.index -= 1;
        h.listener?.(h.entries[h.index]);
      });
    },
    forward() {
      queueMicrotask(() => {
        if (h.index >= h.entries.length - 1) return;
        h.index += 1;
        h.listener?.(h.entries[h.index]);
      });
    },
  };
  return h;
};

const setup = () => {
  const history = makeHistory();
  const stack = new BackStack(history);
  history.listener = (state) => stack.onPop(state);
  return { history, stack };
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 5));

test('the system back button closes the top layer once', async () => {
  const { history, stack } = setup();
  const calls = [];
  stack.push(() => calls.push('sheet'));
  history.back();
  await settle();
  assert.deepEqual(calls, ['sheet']);
  assert.equal(history.index, 0);
});

test('layers close one at a time, newest first', async () => {
  const { history, stack } = setup();
  const calls = [];
  stack.push(() => calls.push('reader'));
  stack.push(() => calls.push('sheet'));
  history.back();
  await settle();
  assert.deepEqual(calls, ['sheet']);
  history.back();
  await settle();
  assert.deepEqual(calls, ['sheet', 'reader']);
});

test('closing a layer from the screen takes its history entry away without running its back action', async () => {
  const { history, stack } = setup();
  const calls = [];
  const id = stack.push(() => calls.push('sheet'));
  stack.remove(id);
  await settle();
  assert.deepEqual(calls, []);
  assert.equal(history.index, 0, 'the entry is gone, so the system back button leaves the app');
});

test('a layer closed after its own back action has nothing left to remove', async () => {
  const { history, stack } = setup();
  const id = stack.push(() => {});
  history.back();
  await settle();
  stack.remove(id);
  await settle();
  assert.equal(history.index, 0);
  assert.equal(history.exited, false);
});

test('a layer closed from beneath another is skipped later, so back still does something visible', async () => {
  const { history, stack } = setup();
  const calls = [];
  stack.push(() => calls.push('reader'));
  const sheet = stack.push(() => calls.push('sheet'));
  stack.push(() => calls.push('tab'));
  stack.remove(sheet);
  history.back();
  await settle();
  assert.deepEqual(calls, ['tab']);
  history.back();
  await settle();
  assert.deepEqual(calls, ['tab', 'reader'], 'the closed sheet is stepped over');
});

test('going Home clears the trail, so back from Home leaves the app in one press', async () => {
  const { history, stack } = setup();
  const calls = [];
  stack.push(() => calls.push('tab-a'));
  stack.push(() => calls.push('tab-b'));
  stack.markAllDead();
  history.back();
  await settle();
  assert.deepEqual(calls, []);
  assert.equal(history.exited, true);
});

test('removing an unknown layer does nothing', async () => {
  const { history, stack } = setup();
  stack.remove(999);
  await settle();
  assert.equal(history.index, 0);
});

test('a layer closed and another opened in the same moment keep the entry count in step', async () => {
  const { history, stack } = setup();
  const calls = [];
  const first = stack.push(() => calls.push('first'));
  stack.remove(first);
  stack.push(() => calls.push('second'));
  await settle();
  assert.equal(history.index, 1, 'one entry for one open layer');
  assert.deepEqual(calls, [], 'closing from the screen never runs a back action');
  history.back();
  await settle();
  assert.deepEqual(calls, ['second']);
});

test('the Forward button does not close a layer: the browser is sent straight back', async () => {
  const { history, stack } = setup();
  const calls = [];
  stack.push(() => calls.push('tab'));
  const sheet = stack.push(() => calls.push('sheet'));
  history.back();
  await settle();
  assert.deepEqual(calls, ['sheet']);
  history.forward();
  await settle();
  assert.deepEqual(calls, ['sheet'], 'nothing else was closed');
  assert.equal(history.index, 1, 'back on the entry the open layer stands for');
  history.back();
  await settle();
  assert.deepEqual(calls, ['sheet', 'tab']);
  void sheet;
});

test('entries left behind by a reload are walked back to the start, with no layer closed', async () => {
  const history = makeHistory();
  // The browser still holds two entries from before the reload; this fresh stack has no layers.
  history.pushState({ backDepth: 1 }, '');
  history.pushState({ backDepth: 2 }, '');
  const stack = new BackStack(history);
  history.listener = (state) => stack.onPop(state);
  stack.onPop(history.entries[history.index]);
  await settle();
  assert.equal(history.index, 0);
  assert.equal(history.exited, false);
});

test('a back press that lands while a removal is still travelling closes only what it was asked to', async () => {
  const { history, stack } = setup();
  const calls = [];
  stack.push(() => calls.push('reader'));
  const sheet = stack.push(() => calls.push('sheet'));
  stack.remove(sheet); // the sheet's own close button
  await settle();
  assert.deepEqual(calls, []);
  history.back(); // then one press of the phone's back button
  await settle();
  assert.deepEqual(calls, ['reader']);
});

test('depth is read from an entry, and entries the app did not push count as the start', () => {
  assert.equal(depthOf({ backDepth: 3 }), 3);
  assert.equal(depthOf(null), 0);
  assert.equal(depthOf({}), 0);
  assert.equal(depthOf({ backDepth: -1 }), 0);
  assert.equal(depthOf({ backDepth: '2' }), 0);
});
