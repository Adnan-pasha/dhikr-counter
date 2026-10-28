import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const appShell = () => {
  const app = read('src/App.tsx');
  return {
    shell: app.slice(app.indexOf('id="app_root_viewport"'), app.indexOf('id="phone_simulator_frame"')),
    withFrame: app.slice(app.indexOf('id="app_root_viewport"'), app.indexOf('{/* Status bar')),
  };
};

// On phone browsers 100vh is the height with the address bar hidden, so a screen sized in vh
// is taller than what is visible: the header scrolls out of view when the page is tapped.
test('the app shell is sized with dynamic viewport units, not 100vh', () => {
  const { withFrame } = appShell();
  assert.doesNotMatch(withFrame, /\bh-screen\b|\bmin-h-screen\b|\bw-screen\b/);
  assert.equal((withFrame.match(/\bh-dvh\b/g) || []).length, 2, 'the shell and the frame both use dvh');
});

test('the shell cannot be scrolled out from under the header on phones', () => {
  const { shell } = appShell();
  assert.doesNotMatch(shell, /(?<![:\w-])overflow-y-auto/, 'only the desktop (md:) frame may scroll the outer container');
  assert.match(shell, /\boverflow-hidden\b/);
});

test('html and body fill the viewport and do not scroll on their own', () => {
  const css = read('src/index.css');
  assert.match(css, /html\s*,\s*body\s*\{[^}]*overflow\s*:\s*hidden/);
});
