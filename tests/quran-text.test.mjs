import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeArabic, stripBom, stripLeadingBasmala, hasBasmalaHeader, BASMALA } from '../src/quran/text.ts';

const UTHMANI_B = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
const SIMPLE_B = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';

test('normalizing removes marks and unifies alef forms so scripts compare equal', () => {
  assert.equal(normalizeArabic(UTHMANI_B), 'بسم الله الرحمن الرحيم');
  assert.equal(normalizeArabic(SIMPLE_B), 'بسم الله الرحمن الرحيم');
});

test('a byte-order mark at the start of a verse is removed', () => {
  assert.equal(stripBom('﻿بِسْمِ'), 'بِسْمِ');
  assert.equal(stripBom('بِسْمِ'), 'بِسْمِ');
});

test('surahs that open with the Bismillah get a header; Al-Fatiha and At-Tawbah do not', () => {
  assert.equal(hasBasmalaHeader(1), false, 'in Al-Fatiha the Bismillah is ayah 1 itself');
  assert.equal(hasBasmalaHeader(9), false, 'At-Tawbah has none');
  for (const n of [2, 36, 112, 114]) assert.equal(hasBasmalaHeader(n), true, String(n));
});

test('the API\'s prepended Bismillah is lifted off ayah 1 in either script', () => {
  assert.equal(stripLeadingBasmala(2, `${UTHMANI_B} الٓمٓ`), 'الٓمٓ');
  assert.equal(stripLeadingBasmala(112, `${SIMPLE_B} قُلْ هُوَ اللَّهُ أَحَدٌ`), 'قُلْ هُوَ اللَّهُ أَحَدٌ');
});

test('Al-Fatiha ayah 1 and At-Tawbah are never stripped', () => {
  assert.equal(stripLeadingBasmala(1, UTHMANI_B), UTHMANI_B);
  const tawbah = 'بَرَآءَةٌۭ مِّنَ ٱللَّهِ وَرَسُولِهِۦٓ';
  assert.equal(stripLeadingBasmala(9, tawbah), tawbah);
});

test('text that does not start with the Bismillah is left exactly as it is', () => {
  const t = 'قُلْ هُوَ ٱللَّهُ أَحَدٌ';
  assert.equal(stripLeadingBasmala(112, t), t);
  assert.equal(stripLeadingBasmala(2, ''), '');
});

test('a verse that is only the Bismillah is not reduced to nothing', () => {
  assert.equal(stripLeadingBasmala(2, UTHMANI_B), UTHMANI_B);
});

test('the header constant is the standard Bismillah', () => {
  assert.equal(normalizeArabic(BASMALA), 'بسم الله الرحمن الرحيم');
});

import { toArabicDigits } from '../src/quran/text.ts';

test('ayah numbers are shown in Arabic-Indic digits', () => {
  assert.equal(toArabicDigits(1), '١');
  assert.equal(toArabicDigits(112), '١١٢');
  assert.equal(toArabicDigits(0), '٠');
  assert.equal(toArabicDigits(-3), '٠');
});
