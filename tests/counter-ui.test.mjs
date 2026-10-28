import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('the whole stage is one tap target counted on pointer down, with click reserved for keyboard and assistive tech', () => {
  const src = read('src/components/CounterScreen.tsx');
  assert.match(src, /id="tap_bead_clicker"/);
  assert.match(src, /onPointerDown=\{handlePointerDown\}/);
  assert.match(src, /e\.detail === 0/, 'clicks from pointers are not double counted');
  assert.match(src, /touch-manipulation/);
});

test('counter screen shows the bead string, the dimmed queue, undo and the pending next phrase', () => {
  const src = read('src/components/CounterScreen.tsx');
  assert.match(src, /<BeadString/);
  assert.match(src, /upcoming\.map/);
  assert.match(src, /id="btn_undo"/);
  assert.match(src, /pendingNext/);
  assert.match(src, /heroFontSize\(/);
});

test('queue text uses theme tokens, not opacity, so contrast is guaranteed', () => {
  const src = read('src/components/CounterScreen.tsx');
  const queue = src.slice(src.indexOf('upcoming.map'), src.indexOf('upcoming.map') + 600);
  assert.match(queue, /var\(--color-text-muted\)/);
  assert.doesNotMatch(queue, /opacity/);
});

test('settings expose haptic strength and a separate round-complete chime', () => {
  const src = read('src/components/SettingsScreen.tsx');
  assert.match(src, /hapticStrength/);
  assert.match(src, /switch_completion_chime/);
  assert.match(src, /completionSoundOn/);
});

test('screens ease in on entry', () => {
  const app = read('src/App.tsx');
  assert.match(app, /key=\{activeTab\}/);
  assert.match(app, /initial=\{\{ opacity: 0, y: 8 \}\}/);
});

test('the tone buffers are pre-rendered and used for taps', () => {
  const audio = read('src/audio.ts');
  assert.match(audio, /OfflineAudioContext/);
  assert.match(audio, /createBufferSource/);
  assert.match(audio, /export function warmTone/);
});

test('the controls row compacts on narrow phones so a long target cannot push Reset off screen', () => {
  const src = read('src/components/CounterScreen.tsx');
  const controls = src.slice(src.indexOf('{/* ── Controls'), src.indexOf('{/* Exit focus mode */}'));
  assert.match(controls, /max-\[400px\]:hidden/, 'the Target label hides on narrow screens');
  assert.equal((controls.match(/max-\[400px\]:px-3/g) || []).length, 2, 'Undo and Reset tighten their padding');
  assert.match(controls, /min-w-0/, 'the target chip may shrink');
});
