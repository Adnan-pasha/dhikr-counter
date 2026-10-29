import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_READER_SETTINGS, READER_THEMES, TEXT_SIZES, sanitizeReaderSettings, arabicFontSize, stepTextSize,
} from '../src/quran/settings.ts';

test('defaults read comfortably: dark theme, middle size, Uthmani, translation on', () => {
  const d = DEFAULT_READER_SETTINGS;
  assert.equal(d.theme, 'dark');
  assert.equal(d.script, 'uthmani');
  assert.equal(d.showTranslation, true);
  assert.equal(d.keepScreenOn, false);
  assert.ok(d.textSize > 0 && d.textSize < TEXT_SIZES.length - 1, 'not at either end');
});

test('three reading themes are offered', () => {
  assert.deepEqual(READER_THEMES.map((t) => t.id), ['dark', 'paper', 'modern']);
});

test('stored settings are accepted when valid', () => {
  const stored = { theme: 'paper', textSize: 4, script: 'simple', showTranslation: false, showTransliteration: false, keepScreenOn: true };
  assert.deepEqual(sanitizeReaderSettings(stored), stored);
});

test('anything invalid falls back field by field, never wholesale', () => {
  const out = sanitizeReaderSettings({ theme: 'neon', textSize: 99, script: 'indopak', showTranslation: 'yes', keepScreenOn: true });
  assert.equal(out.theme, DEFAULT_READER_SETTINGS.theme);
  assert.equal(out.textSize, DEFAULT_READER_SETTINGS.textSize);
  assert.equal(out.script, DEFAULT_READER_SETTINGS.script, 'IndoPak is not available yet');
  assert.equal(out.showTranslation, DEFAULT_READER_SETTINGS.showTranslation);
  assert.equal(out.keepScreenOn, true, 'valid fields survive');
});

test('non-objects give the defaults', () => {
  for (const v of [null, undefined, 'x', 5, []]) assert.deepEqual(sanitizeReaderSettings(v), DEFAULT_READER_SETTINGS);
});

test('text sizes grow steadily and stay in a readable range', () => {
  const px = TEXT_SIZES.map((_, i) => arabicFontSize(i));
  assert.deepEqual(px, [...px].sort((a, b) => a - b));
  assert.ok(px[0] >= 22 && px.at(-1) <= 56);
  assert.equal(arabicFontSize(-5), px[0]);
  assert.equal(arabicFontSize(999), px.at(-1));
});

test('stepping the size is clamped at both ends', () => {
  assert.equal(stepTextSize(0, -1), 0);
  assert.equal(stepTextSize(TEXT_SIZES.length - 1, 1), TEXT_SIZES.length - 1);
  assert.equal(stepTextSize(2, 1), 3);
});
