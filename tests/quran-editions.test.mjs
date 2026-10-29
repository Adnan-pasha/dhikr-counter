import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCRIPTS, DEFAULT_SCRIPT, DEFAULT_TRANSLATION, TRANSLATIONS, TRANSLITERATION_EDITION,
  editionsFor, surahUrl, buildReaderAyahs, formatAyahForCopy,
} from '../src/quran/editions.ts';

const ayah = (n, text, extra = {}) => ({ number: 100 + n, numberInSurah: n, text, juz: 30, page: 604, ...extra });
const payload = (surahEds) => ({ code: 200, data: surahEds });
const ed = (identifier, ayahs) => ({ edition: { identifier }, ayahs });

test('two scripts are offered now: Uthmani and Simple', () => {
  assert.deepEqual(SCRIPTS.map((s) => s.id), ['uthmani', 'simple']);
  assert.equal(DEFAULT_SCRIPT, 'uthmani');
  for (const s of SCRIPTS) assert.ok(s.edition && s.label && s.sample, s.id);
});

test('the default translation is public domain, with its credit', () => {
  assert.equal(DEFAULT_TRANSLATION, 'en.pickthall');
  const t = TRANSLATIONS.find((x) => x.id === DEFAULT_TRANSLATION);
  assert.ok(t);
  assert.match(t.credit, /Pickthall/);
  assert.match(t.credit, /public domain/i);
});

test('transliteration stays off until a source with a clear licence is chosen', () => {
  assert.equal(TRANSLITERATION_EDITION, null);
});

test('requested editions follow the settings and contain no nulls', () => {
  assert.deepEqual(editionsFor({ script: 'uthmani', showTranslation: true, showTransliteration: false }), ['quran-uthmani', 'en.pickthall']);
  assert.deepEqual(editionsFor({ script: 'simple', showTranslation: false, showTransliteration: true }), ['quran-simple']);
});

test('the API URL joins the editions for one surah', () => {
  assert.equal(surahUrl('https://api.test/v1', 112, ['quran-uthmani', 'en.pickthall']), 'https://api.test/v1/surah/112/editions/quran-uthmani,en.pickthall');
});

test('ayahs are matched by edition id, not by position', () => {
  const body = payload([
    ed('en.pickthall', [ayah(1, 'Say: He is Allah, the One!'), ayah(2, 'Allah, the eternally Besought of all!')]),
    ed('quran-uthmani', [ayah(1, 'قُلْ هُوَ ٱللَّهُ أَحَدٌ'), ayah(2, 'ٱللَّهُ ٱلصَّمَدُ')]),
  ]);
  const out = buildReaderAyahs(112, body, 'uthmani', true);
  assert.equal(out.length, 2);
  assert.equal(out[0].arabic, 'قُلْ هُوَ ٱللَّهُ أَحَدٌ');
  assert.equal(out[0].translation, 'Say: He is Allah, the One!');
  assert.equal(out[1].numberInSurah, 2);
});

test('the prepended Bismillah and byte-order mark are lifted off the first ayah', () => {
  const b = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
  const body = payload([ed('quran-uthmani', [ayah(1, `﻿${b} الٓمٓ`), ayah(2, 'ذَٰلِكَ')])]);
  const out = buildReaderAyahs(2, body, 'uthmani', false);
  assert.equal(out[0].arabic, 'الٓمٓ');
  assert.equal(out[0].translation, null);
});

test('Al-Fatiha keeps its Bismillah as the first ayah', () => {
  const b = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
  const out = buildReaderAyahs(1, payload([ed('quran-uthmani', [ayah(1, b)])]), 'uthmani', false);
  assert.equal(out[0].arabic, b);
});

test('a missing translation edition does not drop the Arabic', () => {
  const out = buildReaderAyahs(112, payload([ed('quran-uthmani', [ayah(1, 'قُلْ')])]), 'uthmani', true);
  assert.equal(out.length, 1);
  assert.equal(out[0].translation, null);
});

test('malformed or error responses give null so the UI can show a retry', () => {
  assert.equal(buildReaderAyahs(1, null, 'uthmani', true), null);
  assert.equal(buildReaderAyahs(1, { code: 500 }, 'uthmani', true), null);
  assert.equal(buildReaderAyahs(1, { code: 200, data: [] }, 'uthmani', true), null);
  assert.equal(buildReaderAyahs(1, { code: 200, data: [{ edition: { identifier: 'quran-uthmani' }, ayahs: 'x' }] }, 'uthmani', true), null);
});

test('the copy format is Arabic, translation, then a reference', () => {
  const text = formatAyahForCopy({ surahName: 'Al-Ikhlas', surahNumber: 112, ayahNumber: 1, arabic: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ', translation: 'Say: He is Allah, the One!' });
  assert.equal(text, 'قُلْ هُوَ ٱللَّهُ أَحَدٌ\n\nSay: He is Allah, the One!\n\n— Al-Ikhlas 112:1');
  assert.equal(formatAyahForCopy({ surahName: 'Al-Ikhlas', surahNumber: 112, ayahNumber: 1, arabic: 'قُلْ', translation: null }), 'قُلْ\n\n— Al-Ikhlas 112:1');
});
