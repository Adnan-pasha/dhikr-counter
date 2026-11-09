import test from 'node:test';
import assert from 'node:assert/strict';
import { SURAHS, surahByNumber } from '../src/quran/surahs.ts';
import { searchSurahs } from '../src/quran/surahSearch.ts';
import { TOTAL_PAGES, JUZ_FIRST_PAGE } from '../src/quran/pages.ts';

// ── the built-in table ──

test('there are 114 surahs, in order, each with every field the surah list needs', () => {
  assert.equal(SURAHS.length, 114);
  SURAHS.forEach((s, i) => {
    assert.equal(s.number, i + 1);
    assert.ok(s.name.length > 0 && s.englishName.length > 0 && s.englishNameTranslation.length > 0, `names for ${s.number}`);
    assert.ok(Number.isInteger(s.numberOfAyahs) && s.numberOfAyahs >= 3, `ayahs for ${s.number}`);
    assert.ok(s.revelationType === 'Meccan' || s.revelationType === 'Medinan');
  });
});

test('the Quran has 6,236 ayahs, so the counts add up', () => {
  assert.equal(SURAHS.reduce((sum, s) => sum + s.numberOfAyahs, 0), 6236);
});

test('first pages run forward through the 604-page mushaf, from page 1 to the last page', () => {
  assert.equal(SURAHS[0].firstPage, 1);
  for (let i = 1; i < SURAHS.length; i += 1) assert.ok(SURAHS[i].firstPage >= SURAHS[i - 1].firstPage, `surah ${i + 1} does not start before surah ${i}`);
  assert.ok(SURAHS.every((s) => s.firstPage >= 1 && s.firstPage <= TOTAL_PAGES));
  assert.equal(SURAHS[113].firstPage, TOTAL_PAGES);
});

test('the daily surahs start where every printed mushaf has them', () => {
  const page = (n) => surahByNumber(n).firstPage;
  assert.equal(page(1), 1);    // Al-Fatihah
  assert.equal(page(2), 2);    // Al-Baqarah
  assert.equal(page(18), 293); // Al-Kahf
  assert.equal(page(32), 415); // As-Sajdah
  assert.equal(page(36), 440); // Yaseen
  assert.equal(page(55), 531); // Ar-Rahman
  assert.equal(page(56), 534); // Al-Waqiah
  assert.equal(page(67), 562); // Al-Mulk
  assert.equal(page(78), 582); // An-Naba
  assert.equal(page(112), 604); // Al-Ikhlas
});

test('a juz begins on a page where, or after which, the surah that holds its first ayah has begun', () => {
  // Juz 2 starts in Al-Baqarah (page 22), juz 30 in An-Naba (page 582).
  assert.equal(JUZ_FIRST_PAGE[29], surahByNumber(78).firstPage);
  assert.ok(JUZ_FIRST_PAGE[1] >= surahByNumber(2).firstPage);
});

test('a surah is found by its number', () => {
  assert.equal(surahByNumber(67).englishName, 'Al-Mulk');
  assert.equal(surahByNumber(0), undefined);
  assert.equal(surahByNumber(115), undefined);
});

// ── searching ──

const numbers = (query) => searchSurahs(query).map((s) => s.number);

test('an empty search shows every surah', () => {
  assert.equal(searchSurahs('').length, 114);
  assert.equal(searchSurahs('   ').length, 114);
});

test('a number finds that surah first', () => {
  assert.equal(numbers('67')[0], 67);
  assert.equal(numbers('1')[0], 1);
  assert.deepEqual(numbers('114'), [114]);
});

test('the daily surahs are found however they are spelt', () => {
  for (const q of ['yasin', 'yaseen', 'ya-sin', 'ya sin', 'Yaseen']) assert.ok(numbers(q).includes(36), q);
  for (const q of ['mulk', 'al mulk', 'al-mulk', 'Al-Mulk']) assert.ok(numbers(q).includes(67), q);
  for (const q of ['rahman', 'rahmaan', 'ar rahman', 'ar-rahmaan']) assert.ok(numbers(q).includes(55), q);
  for (const q of ['waqia', 'waqiah', 'waqiaa', 'al waqiah']) assert.ok(numbers(q).includes(56), q);
  for (const q of ['kahf', 'al kahf', 'Al-Kahf']) assert.ok(numbers(q).includes(18), q);
  for (const q of ['ikhlas', 'ikhlaas']) assert.ok(numbers(q).includes(112), q);
});

test('the meaning works too, and the exact name comes before looser matches', () => {
  assert.ok(numbers('sovereignty').includes(67));
  assert.ok(numbers('the opening').includes(1));
  assert.equal(numbers('mulk')[0], 67);
});

test('something that is not a surah finds nothing', () => {
  assert.deepEqual(numbers('qxj'), []);
  assert.deepEqual(numbers('!!!'), [], 'only punctuation');
  assert.deepEqual(numbers('0'), []);
  assert.deepEqual(numbers('115'), []);
});
