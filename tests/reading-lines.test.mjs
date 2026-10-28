import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dhikrReadingLines, sanitizePreferences } from '../src/domain.ts';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const dhikr = { id: 'x', nameAr: 'س', nameEn: 'X', meaning: ' Glory be to Allah ', transliteration: ' Subhan-Allah ', targetCount: 33 };
const prefs = (over = {}) => ({ showTransliteration: true, showTranslation: true, ...over });

test('both reading lines show by default, trimmed', () => {
  assert.deepEqual(dhikrReadingLines(dhikr, prefs()), { transliteration: 'Subhan-Allah', translation: 'Glory be to Allah' });
});

test('each line can be hidden independently', () => {
  assert.deepEqual(dhikrReadingLines(dhikr, prefs({ showTransliteration: false })), { transliteration: null, translation: 'Glory be to Allah' });
  assert.deepEqual(dhikrReadingLines(dhikr, prefs({ showTranslation: false })), { transliteration: 'Subhan-Allah', translation: null });
});

test('missing or blank text is null rather than an empty line', () => {
  assert.deepEqual(dhikrReadingLines({ ...dhikr, transliteration: undefined, meaning: '   ' }, prefs()), { transliteration: null, translation: null });
});

test('preferences keep their reading toggles and default them when absent', () => {
  const fallback = { soundOn: true, soundTone: 'wooden', vibrateOn: true, autoAdvance: true, theme: 'emerald', colorMode: 'dark', volume: 0.5, madhab: 'shafi', completionSoundOn: true, hapticStrength: 'medium', dailyGoal: 100, showTransliteration: true, showTranslation: true };
  assert.equal(sanitizePreferences({}, fallback).showTransliteration, true);
  assert.equal(sanitizePreferences({ showTranslation: false }, fallback).showTranslation, false);
  assert.equal(sanitizePreferences({ showTransliteration: 'no' }, fallback).showTransliteration, true, 'non-boolean ignored');
});

test('the counter, home and library read their lines through the shared helper', () => {
  assert.match(read('src/components/CounterScreen.tsx'), /dhikrReadingLines\(/);
  assert.match(read('src/components/HomeScreen.tsx'), /dhikrReadingLines\(/);
});

test('settings can toggle transliteration and translation', () => {
  const src = read('src/components/SettingsScreen.tsx');
  assert.ok(src.includes('id="switch_show_transliteration"'));
  assert.ok(src.includes('id="switch_show_translation"'));
});

test('custom dhikr capture a transliteration and no longer invent a meaning', () => {
  const lib = read('src/components/AdhkaarLibrary.tsx');
  assert.ok(!lib.includes("'In the name of Allah'"), 'no made-up default meaning');
  assert.ok(lib.includes('placeholder="Transliteration (optional)"'));
  assert.ok(lib.includes('onEditTransliterationChange'));
  const app = read('src/App.tsx');
  assert.ok(app.includes('handleEditDhikr = (id: string, fields: EditableDhikrFields)'));
});

test('a custom dhikr with no meaning does not leave empty lines or dangling dashes', () => {
  assert.ok(read('src/components/AdhkaarLibrary.tsx').includes('{dhikr.meaning && ('));
  const routines = read('src/components/RoutineManager.tsx');
  assert.equal(routines.split('{d.meaning && (').length - 1, 2);
  assert.ok(read('src/components/SettingsScreen.tsx').includes('d.meaning ? `${d.nameEn} — ${d.meaning}` : d.nameEn'));
  assert.ok(read('src/components/HomeScreen.tsx').includes('const favouriteLine'));
});

test('the settings switch lives at module scope so toggling never remounts it', () => {
  const src = read('src/components/SettingsScreen.tsx');
  assert.ok(src.indexOf('const Switch') > -1);
  assert.ok(src.indexOf('const Switch') < src.indexOf('export default function SettingsScreen'));
});
