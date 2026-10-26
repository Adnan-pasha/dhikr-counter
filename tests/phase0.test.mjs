import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('viewport allows pinch zoom (WCAG 1.4.4)', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /user-scalable\s*=\s*no/);
  assert.doesNotMatch(html, /maximum-scale\s*=\s*1(\.0)?\b/);
});

test('manifest ships PNG icons with a dedicated maskable entry', () => {
  const manifest = JSON.parse(read('public/manifest.json'));
  const png = manifest.icons.filter((i) => i.type === 'image/png');
  assert.ok(png.some((i) => i.sizes === '192x192' && i.purpose === 'any'));
  assert.ok(png.some((i) => i.sizes === '512x512' && i.purpose === 'any'));
  assert.ok(png.some((i) => i.sizes === '512x512' && i.purpose === 'maskable'));
  for (const icon of png) assert.ok(fs.existsSync(path.join(root, 'public', icon.src)), `${icon.src} exists`);
  assert.equal(manifest.background_color.toLowerCase(), manifest.theme_color.toLowerCase());
});

test('service worker carries the build manifest placeholder the Vite plugin fills in', () => {
  // Behaviour is covered in sw.test.mjs; this guards the build-time injection contract.
  assert.match(read('public/sw.js'), /\/\*__BUILD_MANIFEST__\*\/ \{ id: 'dev', assets: \[\] \}/);
  assert.match(read('vite.config.ts'), /swBuildManifest/);
});

test('no unguarded JSON.parse on persisted slices', () => {
  const hooks = read('src/hooks.ts');
  const app = read('src/App.tsx');
  assert.doesNotMatch(hooks, /JSON\.parse\(saved/);
  assert.doesNotMatch(app, /JSON\.parse\(saved/);
  assert.match(hooks, /parseStoredArray/);
  assert.match(app, /parseStoredArray/);
});

test('reset-all also resets favourites, routines and salah logs', () => {
  const hooks = read('src/hooks.ts');
  const start = hooks.indexOf('const handleResetAllData');
  const reset = hooks.slice(start, hooks.indexOf('localStorage.clear()', start));
  assert.match(reset, /deps\.setFavouriteIds\(\[\]\)/);
  assert.match(reset, /deps\.setRoutines\(DEFAULT_ROUTINES\)/);
  assert.match(reset, /deps\.setSalahLogs\(\[\]\)/);
});

test('counter screen routes keys and announcements through the tested pure functions', () => {
  const src = read('src/components/CounterScreen.tsx');
  assert.match(src, /shouldCountOnKey\(/);
  assert.match(src, /getCounterLiveMessage\(/);
  assert.match(src, /aria-live="polite"/);
});

test('confirm modal is an accessible dialog', () => {
  const src = read('src/components/ConfirmModal.tsx');
  assert.match(src, /role="dialog"/);
  assert.match(src, /aria-modal="true"/);
  assert.match(src, /Escape/);
});

test('service worker registers in production builds only', () => {
  const main = read('src/main.tsx');
  assert.match(main, /import\.meta\.env\.PROD/);
  assert.match(main, /hadController/);
});

test('stylesheet honours reduced motion and shows keyboard focus', () => {
  const css = read('src/index.css');
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /:focus-visible/);
});

test('app root honours reduced motion for motion library', () => {
  const main = read('src/main.tsx');
  assert.match(main, /MotionConfig[\s\S]*reducedMotion="user"/);
});

test('dead components and unused server deps are removed', () => {
  assert.equal(fs.existsSync(path.join(root, 'src/components/DhikrLibrary.tsx')), false);
  assert.equal(fs.existsSync(path.join(root, 'src/components/RoutineBuilder.tsx')), false);
  const pkg = JSON.parse(read('package.json'));
  for (const dep of ['express', '@google/genai', 'dotenv']) assert.equal(pkg.dependencies[dep], undefined, dep);
  assert.equal(pkg.name, 'dhikr-app');
});

test('fonts are self-hosted, not loaded via render-blocking @import', () => {
  const css = read('src/index.css');
  assert.doesNotMatch(css, /@import url\(['"]https:\/\/fonts\.googleapis/);
});
