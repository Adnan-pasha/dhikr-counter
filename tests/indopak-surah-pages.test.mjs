import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  LAYOUT_PAGES, parseLayout, buildIndopakWords, ayahIndexOf, pageOfAyah, surahsStartingOn,
} from '../src/quran/indopak-layout.ts';
import { parseIndopak } from '../src/quran/indopak.ts';

const read = (p) => JSON.parse(fs.readFileSync(new URL(`../src/quran/data/${p}`, import.meta.url), 'utf8'));
const layout = parseLayout(read('indopak-15-lines.json'));
const words = buildIndopakWords(parseIndopak(read('indopak-digitalkhatt.json')));

// The same computation the IndoPak pages reader does for its "Go to" sheet.
const surahPages = Array.from({ length: 114 }, (_, i) => pageOfAyah(layout, words, ayahIndexOf(words, i + 1, 1)));

test('every surah is placed on a page of the 15-line mushaf', () => {
  assert.equal(surahPages.length, 114);
  assert.ok(surahPages.every((p) => Number.isInteger(p) && p >= 1 && p <= LAYOUT_PAGES));
});

test('surahs run forward through the pages, starting at page 1', () => {
  assert.equal(surahPages[0], 1);
  for (let i = 1; i < 114; i += 1) assert.ok(surahPages[i] >= surahPages[i - 1], `surah ${i + 1} is not before surah ${i}`);
});

test('the page chosen for each surah is the page where this mushaf prints that surah\'s heading', () => {
  for (let n = 1; n <= 114; n += 1) {
    assert.ok(surahsStartingOn(layout, surahPages[n - 1]).includes(n), `surah ${n} has its heading on page ${surahPages[n - 1]}`);
  }
});
