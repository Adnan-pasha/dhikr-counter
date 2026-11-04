import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  LAYOUT_PAGES, LAYOUT_WORDS, parseLayout, buildIndopakWords, linesOfPage, wordsOfLine, ayahIndexOfWord,
  ayahsOnPage, surahsStartingOn, pageOfAyah, firstPageOfJuz, juzOfAyah, fitFontSize, clampLayoutPage,
} from '../src/quran/indopak-layout.ts';
import { parseIndopak } from '../src/quran/indopak.ts';

const read = (p) => JSON.parse(fs.readFileSync(new URL(`../src/quran/data/${p}`, import.meta.url), 'utf8'));
const layout = parseLayout(read('indopak-15-lines.json'));
const words = buildIndopakWords(parseIndopak(read('indopak-digitalkhatt.json')));

test('the bundled layout is 610 pages of at most 15 lines', () => {
  assert.ok(layout, 'parses');
  assert.equal(layout.pages.length, LAYOUT_PAGES);
  for (const lines of layout.pages) assert.ok(lines.length >= 1 && lines.length <= 15);
  assert.equal(layout.pages.filter((l) => l.length === 15).length, 607, 'all but the three short pages are full');
});

test('the words come to exactly the 83,668 the layout counts, and ayahs begin where the data says', () => {
  assert.ok(words, 'builds');
  assert.equal(words.words.length, LAYOUT_WORDS);
  assert.equal(words.ayahStart.length, 6236);
  assert.equal(words.ayahStart[0], 1);
  assert.deepEqual(words.refs[0], { surah: 1, ayah: 1 });
  assert.deepEqual(words.refs[6235], { surah: 114, ayah: 6 });
  // 72:16 is the one ayah whose first two words the word list joins; the id count still comes out right.
  const index = words.refs.findIndex((r) => r.surah === 72 && r.ayah === 16);
  assert.equal(words.ayahStart[index + 1] - words.ayahStart[index], 8);
});

test('every word belongs to exactly one line, in order, with none missed', () => {
  let next = 1;
  for (let page = 1; page <= LAYOUT_PAGES; page += 1) {
    for (const line of linesOfPage(layout, page)) {
      if (line.kind !== 'ayah') continue;
      assert.equal(line.from, next, `page ${page}`);
      assert.equal(wordsOfLine(words, line).length, line.to - line.from + 1);
      next = line.to + 1;
    }
  }
  assert.equal(next - 1, LAYOUT_WORDS);
});

test('a word maps to its ayah, and the first words of the Quran are Al-Fatiha', () => {
  assert.equal(ayahIndexOfWord(words, 1), 0);
  assert.equal(ayahIndexOfWord(words, words.ayahStart[1]), 1);
  assert.equal(ayahIndexOfWord(words, words.ayahStart[1] - 1), 0);
  assert.equal(ayahIndexOfWord(words, LAYOUT_WORDS), 6235);
});

test('page 1 is Al-Fatiha, page 2 opens Al-Baqarah, page 610 holds the last two surahs', () => {
  const first = linesOfPage(layout, 1);
  assert.equal(first[0].kind, 'surah');
  assert.deepEqual(surahsStartingOn(layout, 1), [1]);
  assert.deepEqual(surahsStartingOn(layout, 2), [2]);
  assert.deepEqual(surahsStartingOn(layout, 610), [113, 114]);
  const last = ayahsOnPage(layout, words, 610);
  assert.equal(words.refs[last[0]].surah, 113);
  assert.equal(words.refs[last[last.length - 1]].surah, 114);
});

test('ayahsOnPage lists each ayah once, in order, including one that carries over from the page before', () => {
  const page = ayahsOnPage(layout, words, 3);
  assert.deepEqual([...page].sort((a, b) => a - b), page);
  assert.equal(new Set(page).size, page.length);
});

test('pageOfAyah finds the page an ayah starts on, and the juz table lands on the right pages', () => {
  assert.equal(pageOfAyah(layout, words, 0), 1);
  assert.equal(firstPageOfJuz(layout, words, 1), 1);
  assert.equal(firstPageOfJuz(layout, words, 30) > firstPageOfJuz(layout, words, 29), true);
  const pages = Array.from({ length: 30 }, (_, i) => firstPageOfJuz(layout, words, i + 1));
  assert.deepEqual([...pages].sort((a, b) => a - b), pages, 'juz begin on rising pages');
  assert.equal(juzOfAyah(words, words.refs.findIndex((r) => r.surah === 2 && r.ayah === 142)), 2);
  assert.equal(juzOfAyah(words, 0), 1);
  assert.equal(juzOfAyah(words, 6235), 30);
});

test('page numbers are kept inside 1 to 610', () => {
  assert.equal(clampLayoutPage(0), 1);
  assert.equal(clampLayoutPage(999), 610);
  assert.equal(clampLayoutPage(Number.NaN), 1);
  assert.equal(clampLayoutPage(12.9), 12);
});

test('parseLayout refuses a damaged file instead of half using it', () => {
  assert.equal(parseLayout(null), null);
  assert.equal(parseLayout({ pages: [] }), null);
  assert.equal(parseLayout({ pages: layout.pages.slice(0, 5).map(() => []) }), null);
});

test('buildIndopakWords refuses text that does not add up to the layout', () => {
  assert.equal(buildIndopakWords({ surahs: [['one two'], ['three']] }), null);
});

test('the font size is set by the widest line or by the height, whichever is smaller', () => {
  // A line 400px wide at 40px in a 320px box needs 32px; 15 lines at 1.9 tall in 900px allow 31.5px.
  const byWidth = fitFontSize({ baseSize: 40, naturalWidths: [300, 400, 250], containerWidth: 320, availableHeight: 5000, lineCount: 15, lineHeight: 1.9 });
  assert.equal(byWidth, 32);
  const byHeight = fitFontSize({ baseSize: 40, naturalWidths: [100], containerWidth: 320, availableHeight: 570, lineCount: 15, lineHeight: 1.9 });
  assert.equal(Math.round(byHeight * 10) / 10, 20);
  assert.equal(fitFontSize({ baseSize: 40, naturalWidths: [], containerWidth: 0, availableHeight: 0, lineCount: 15, lineHeight: 1.9 }), 14, 'never below the readable floor');
});
