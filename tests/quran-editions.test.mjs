import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCRIPTS, DEFAULT_SCRIPT, DEFAULT_TRANSLATION, TRANSLATIONS, TRANSLITERATION_EDITION,
  editionsFor, surahUrl, buildReaderAyahs, formatAyahForCopy,
} from '../src/quran/editions.ts';

const ayah = (n, text, extra = {}) => ({ number: 100 + n, numberInSurah: n, text, juz: 30, page: 604, ...extra });
const payload = (surahEds) => ({ code: 200, data: surahEds });
const ed = (identifier, ayahs) => ({ edition: { identifier }, ayahs });

test('four scripts are offered now: Uthmani, Simple, Tajweed colours and IndoPak', () => {
  assert.deepEqual(SCRIPTS.map((s) => s.id), ['uthmani', 'simple', 'tajweed', 'indopak']);
  assert.equal(SCRIPTS.find((s) => s.id === 'tajweed').overlay, 'quran-tajweed');
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

test('the tajweed script shows the Uthmani text and colours it from the tajweed edition', () => {
  const body = payload([
    ed('quran-uthmani', [ayah(1, 'قُلْ هُوَ ٱللَّهُ أَحَدٌ')]),
    ed('quran-tajweed', [ayah(1, 'قُلْ هُوَ [h:8078[ٱ]للَّهُ أَحَ[q[د]ٌ')]),
  ]);
  const [out] = buildReaderAyahs(112, body, 'tajweed', false);
  assert.equal(out.arabic, 'قُلْ هُوَ ٱللَّهُ أَحَدٌ', 'the text is the Uthmani text, with no markers');
  assert.deepEqual(out.arabicSegments.map((s) => s.rule), [null, 'h', null, 'q', null]);
  assert.equal(out.arabicSegments.map((s) => s.text).join(''), out.arabic);
});

test('tajweed asks for both the Uthmani text and the tajweed edition', () => {
  const eds = editionsFor({ script: 'tajweed', showTranslation: false, showTransliteration: false });
  assert.deepEqual(eds, ['quran-uthmani', 'quran-tajweed']);
});

test('if the tajweed edition is missing or does not line up, the plain Uthmani text is still shown', () => {
  const missing = buildReaderAyahs(112, payload([ed('quran-uthmani', [ayah(1, 'قُلْ')])]), 'tajweed', false);
  assert.equal(missing[0].arabic, 'قُلْ');
  assert.equal(missing[0].arabicSegments, null);
  const off = buildReaderAyahs(112, payload([ed('quran-uthmani', [ayah(1, 'قُلْ')]), ed('quran-tajweed', [ayah(1, 'جد')])]), 'tajweed', false);
  assert.equal(off[0].arabic, 'قُلْ');
  assert.equal(off[0].arabicSegments, null);
});

test('IndoPak takes its Arabic from the bundled file and only the ayah details from the service', () => {
  assert.deepEqual(editionsFor({ script: 'indopak', showTranslation: false, showTransliteration: false }), ['quran-uthmani']);
  const body = payload([ed('quran-uthmani', [ayah(1, 'قُلْ هُوَ'), ayah(2, 'ٱللَّهُ')])]);
  const local = new Map([[1, 'IND-1'], [2, 'IND-2']]);
  const out = buildReaderAyahs(112, body, 'indopak', false, false, undefined, local);
  assert.deepEqual(out.map((a) => a.arabic), ['IND-1', 'IND-2']);
  assert.deepEqual(out.map((a) => a.number), [101, 102], 'ayah numbers, juz and page still come from the service');
  assert.equal(out[0].arabicSegments, null);
});

test('IndoPak without its text file is an error, never a quiet switch to another script', () => {
  const body = payload([ed('quran-uthmani', [ayah(1, 'قُلْ')])]);
  assert.equal(buildReaderAyahs(112, body, 'indopak', false), null);
  assert.equal(buildReaderAyahs(112, body, 'indopak', false, false, undefined, new Map()), null);
});

test('each built ayah remembers the script it was built in', () => {
  const body = payload([ed('quran-uthmani', [ayah(1, 'a')])]);
  assert.equal(buildReaderAyahs(112, body, 'uthmani', false)[0].script, 'uthmani');
  assert.equal(buildReaderAyahs(112, body, 'indopak', false, false, undefined, new Map([[1, 'x']]))[0].script, 'indopak');
});

test('IndoPak with one ayah missing from its file is an error too', () => {
  const body = payload([ed('quran-uthmani', [ayah(1, 'a'), ayah(2, 'b')])]);
  assert.equal(buildReaderAyahs(112, body, 'indopak', false, false, undefined, new Map([[1, 'IND-1']])), null);
});

test('IndoPak is never trimmed of a Bismillah: its first ayahs are used as they are', () => {
  const body = payload([ed('quran-uthmani', [ayah(1, 'x')])]);
  const text = 'بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ الٓمّٓ';
  const [out] = buildReaderAyahs(2, body, 'indopak', false, false, undefined, new Map([[1, text]]));
  assert.equal(out.arabic, text);
});

test('the other scripts carry no coloured pieces', () => {
  const [out] = buildReaderAyahs(112, payload([ed('quran-uthmani', [ayah(1, 'قُلْ')])]), 'uthmani', false);
  assert.equal(out.arabicSegments, null);
});

test('the Bismillah header is lifted off a tajweed first ayah and the colours after it are kept', () => {
  const basmala = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
  const body = payload([
    ed('quran-uthmani', [ayah(1, `${basmala} قُلْ هُوَ ٱللَّهُ`)]),
    ed('quran-tajweed', [ayah(1, 'قُلْ هُوَ [h:1[ٱ]للَّهُ')]),
  ]);
  const [out] = buildReaderAyahs(112, body, 'tajweed', false);
  assert.equal(out.arabic, 'قُلْ هُوَ ٱللَّهُ');
  assert.equal(out.arabicSegments.map((s) => s.text).join(''), 'قُلْ هُوَ ٱللَّهُ');
  assert.equal(out.arabicSegments.find((s) => s.rule === 'h').text, 'ٱ');
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

// ── choosing a translation ────────────────────────────────────────────────────

test('a QuranEnc translation is not requested from the Arabic service, only the script is', () => {
  assert.deepEqual(editionsFor({ script: 'uthmani', showTranslation: true, showTransliteration: false, translation: 'quranenc:english_saheeh' }), ['quran-uthmani']);
  assert.deepEqual(editionsFor({ script: 'uthmani', showTranslation: true, showTransliteration: false, translation: 'pickthall' }), ['quran-uthmani', 'en.pickthall']);
  assert.deepEqual(editionsFor({ script: 'simple', showTranslation: true, showTransliteration: false }), ['quran-simple', 'en.pickthall'], 'no choice means the built-in one');
});

test('with a QuranEnc translation chosen, ayahs come back without the built-in text', () => {
  const body = payload([
    ed('quran-uthmani', [ayah(1, 'قُلْ')]),
    ed('en.pickthall', [ayah(1, 'Say')]),
  ]);
  const out = buildReaderAyahs(112, body, 'uthmani', true, false, 'quranenc:english_saheeh');
  assert.equal(out[0].translation, null, 'the QuranEnc text is added later and never mixed with Pickthall');
  assert.equal(out[0].footnotes, null);
  assert.equal(buildReaderAyahs(112, body, 'uthmani', true)[0].translation, 'Say');
});
