import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('without a build, the stamp says it is a development run', async () => {
  const { BUILD_STAMP } = await import('../src/buildInfo.ts');
  assert.equal(BUILD_STAMP, 'development');
});

test('a real build records when it was made, so any installed copy can be told apart', () => {
  const config = read('vite.config.ts');
  assert.match(config, /__BUILD_STAMP__: JSON\.stringify\(/);
  assert.match(config, /toISOString\(\)/);
});

test('Settings shows the build', () => {
  const settings = read('src/components/SettingsScreen.tsx');
  assert.match(settings, /import \{ BUILD_STAMP \} from '..\/buildInfo'/);
  assert.match(settings, /id="build_stamp"[^>]*>[^<]*Build \{BUILD_STAMP\}/);
});
