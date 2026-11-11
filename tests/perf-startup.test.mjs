import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('the heavy screens are fetched when first visited, not packed into the first load', () => {
  const app = read('src/App.tsx');
  for (const name of ['SalahTracker', 'QuranReader', 'StatsScreen', 'SettingsScreen', 'AdhkaarLibrary', 'RoutineManager', 'QiblaScreen', 'PrayersScreen']) {
    assert.match(app, new RegExp(String.raw`const ${name} = lazy\(\(\) => import\('\./components/${name}'\)\)`), `${name} is lazy`);
    assert.doesNotMatch(app, new RegExp(`^import ${name} from`, 'm'), `${name} is not imported up front`);
  }
});

test('Home and the counter, which open first, stay in the first load', () => {
  const app = read('src/App.tsx');
  assert.match(app, /^import HomeScreen from/m);
  assert.match(app, /^import CounterScreen from/m);
  assert.match(app, /^import BottomNav from/m);
});

test('a screen that is still loading shows a placeholder instead of a blank page', () => {
  const app = read('src/App.tsx');
  assert.match(app, /<Suspense fallback=\{[\s\S]{0,200}Loading\.\.\./);
});

test('the Home clock shows minutes, so it only redraws when the minute changes', () => {
  const home = read('src/components/HomeScreen.tsx');
  assert.match(home, /minute\(now\) === minute\(previous\) \? previous : now/);
});

test('the service-worker step reads the folder the build really wrote to, and fails loudly if sw.js is missing', () => {
  const config = read('vite.config.ts');
  assert.match(config, /configResolved\(config\)/);
  assert.match(config, /config\.build\.outDir/);
  assert.match(config, /const dist = outDir;/);
  assert.doesNotMatch(config, /if \(!existsSync\(swPath\)\) return;/, 'a missing sw.js must not pass silently');
});
