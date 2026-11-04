import test from 'node:test';
import assert from 'node:assert/strict';
import { READER_THEMES, LINE_SPACINGS, DEFAULT_READER_SETTINGS, lineHeightFor, sanitizeReaderSettings } from '../src/quran/settings.ts';
import { sanitizePreferences } from '../src/domain.ts';

test('a high-contrast reading theme is offered', () => {
  assert.ok(READER_THEMES.some((t) => t.id === 'contrast'));
  assert.equal(sanitizeReaderSettings({ theme: 'contrast' }).theme, 'contrast');
});

test('there are four line spacings, from compact to loose, and the default is the one the reader always had', () => {
  assert.deepEqual(LINE_SPACINGS.map((s) => s.id), ['compact', 'normal', 'relaxed', 'loose']);
  const values = LINE_SPACINGS.map((s) => s.value);
  assert.deepEqual([...values].sort((a, b) => a - b), values, 'in increasing order');
  assert.equal(lineHeightFor(DEFAULT_READER_SETTINGS.lineSpacing), 2.2);
});

test('line spacing is stored as an index and a bad value falls back without losing the other settings', () => {
  assert.equal(sanitizeReaderSettings({ lineSpacing: 3 }).lineSpacing, 3);
  for (const bad of [-1, 4, 1.5, '2', null]) {
    const s = sanitizeReaderSettings({ lineSpacing: bad, textSize: 4 });
    assert.equal(s.lineSpacing, DEFAULT_READER_SETTINGS.lineSpacing, `${bad}`);
    assert.equal(s.textSize, 4);
  }
  assert.equal(lineHeightFor(99), lineHeightFor(DEFAULT_READER_SETTINGS.lineSpacing), 'out of range reads as the default');
});

test('the left-handed layout is a saved preference, off unless it is exactly true', () => {
  const fallback = { soundOn: true, soundTone: 'wooden', vibrateOn: true, autoAdvance: true, theme: 'emerald', colorMode: 'dark', volume: 0.5, madhab: 'shafi', completionSoundOn: true, hapticStrength: 'medium', dailyGoal: 100, showTransliteration: true, showTranslation: true, leftHanded: false };
  assert.equal(sanitizePreferences({ leftHanded: true }, fallback).leftHanded, true);
  assert.equal(sanitizePreferences({ leftHanded: 'yes' }, fallback).leftHanded, false);
  assert.equal(sanitizePreferences({}, fallback).leftHanded, false);
});
