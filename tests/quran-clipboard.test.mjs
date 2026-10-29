import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://app.test/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });

const { copyText } = await import('../src/quran/clipboard.ts');

const setClipboard = (value) => Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
const setExec = (fn) => { document.execCommand = fn; };

test.afterEach(() => { setClipboard(undefined); delete document.execCommand; });

test('the modern clipboard is used when it is there', async () => {
  const written = [];
  setClipboard({ writeText: async (t) => { written.push(t); } });
  assert.equal(await copyText('hello'), true);
  assert.deepEqual(written, ['hello']);
});

test('without the modern clipboard a hidden textarea and execCommand do the job, and are cleaned up', async () => {
  let selected = null;
  setExec(() => { selected = document.querySelector('textarea').value; return true; });
  assert.equal(await copyText('fallback text'), true);
  assert.equal(selected, 'fallback text');
  assert.equal(document.querySelector('textarea'), null, 'no leftover element');
});

test('a refused modern write falls back instead of failing', async () => {
  setClipboard({ writeText: async () => { throw new Error('denied'); } });
  setExec(() => true);
  assert.equal(await copyText('x'), true);
});

test('when nothing works the answer is false, never a throw', async () => {
  setExec(() => false);
  assert.equal(await copyText('x'), false);
  setExec(() => { throw new Error('nope'); });
  assert.equal(await copyText('x'), false);
});
