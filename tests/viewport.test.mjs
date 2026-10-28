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

// .screen clips its own overflow and the page cannot scroll, so a screen needs an inner scroll area
// or everything below the fold is unreachable (the Salah list could not be scrolled to Maghrib/Isha).
test('every screen built on .screen has its own scroll container', () => {
  const dir = path.join(root, 'src/components');
  const offenders = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.tsx'))) {
    const src = fs.readFileSync(path.join(dir, file), 'utf8');
    if (!src.includes('className="screen"')) continue;
    if (!/scroll-area|overflow-y-auto/.test(src)) offenders.push(file);
  }
  assert.deepEqual(offenders, []);
});

test('the Salah prayer list scrolls inside the screen', () => {
  const src = read('src/components/SalahTracker.tsx');
  assert.match(src, /className="scroll-area space-y-5"/);
});
