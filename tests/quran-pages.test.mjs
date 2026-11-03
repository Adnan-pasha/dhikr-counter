import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TOTAL_PAGES, JUZ_FIRST_PAGE, clampPage, pageUrl, buildMushafPage, swipeDirection, pageForJuz,
} from '../src/quran/pages.ts';

const BASMALA = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
const surahInfo = (number, englishName = `Surah ${number}`) => ({ number, name: `سورة ${number}`, englishName, englishNameTranslation: 'x', numberOfAyahs: 10, revelationType: 'Meccan' });
const ayah = (number, surah, numberInSurah, text, extra = {}) => ({ number, text, surah: surahInfo(surah), numberInSurah, juz: 1, page: 2, ...extra });
const body = (ayahs, identifier = 'quran-uthmani') => ({ code: 200, data: { number: 2, ayahs, surahs: {}, edition: { identifier } } });

test('there are 604 pages and any page number is held inside them', () => {
  assert.equal(TOTAL_PAGES, 604);
  assert.equal(clampPage(0), 1);
  assert.equal(clampPage(-5), 1);
  assert.equal(clampPage(605), 604);
  assert.equal(clampPage(300), 300);
  assert.equal(clampPage(12.7), 12);
  assert.equal(clampPage(Number.NaN), 1);
});

test('a page is requested one edition at a time, and only for real pages and editions', () => {
  assert.equal(pageUrl('https://api.test/v1', 2, 'quran-uthmani'), 'https://api.test/v1/page/2/quran-uthmani');
  assert.throws(() => pageUrl('https://api.test/v1', 0, 'quran-uthmani'));
  assert.throws(() => pageUrl('https://api.test/v1', 605, 'quran-uthmani'));
  assert.throws(() => pageUrl('https://api.test/v1', 2, '../etc'));
  assert.throws(() => pageUrl('https://api.test/v1', 2, 'a/b'));
});

test('the thirty juz start on known pages, in order', () => {
  assert.equal(JUZ_FIRST_PAGE.length, 30);
  assert.equal(JUZ_FIRST_PAGE[0], 1);
  assert.equal(JUZ_FIRST_PAGE[29], 582);
  assert.deepEqual([...JUZ_FIRST_PAGE].sort((a, b) => a - b), [...JUZ_FIRST_PAGE]);
  assert.equal(pageForJuz(2), 22);
  assert.equal(pageForJuz(30), 582);
  assert.equal(pageForJuz(31), 582, 'out of range is held inside');
});

test('a page of one surah comes out in order with its surah start and the Bismillah lifted off ayah 1', () => {
  const arabic = body([
    ayah(8, 2, 1, `${BASMALA} الٓمٓ`),
    ayah(9, 2, 2, 'ذَٰلِكَ ٱلْكِتَٰبُ'),
  ]);
  const page = buildMushafPage(2, arabic, { script: 'uthmani' });
  assert.equal(page.page, 2);
  assert.deepEqual(page.ayahs.map((a) => [a.surah, a.numberInSurah]), [[2, 1], [2, 2]]);
  assert.equal(page.ayahs[0].arabic, 'الٓمٓ');
  assert.deepEqual(page.surahStarts.map((s) => [s.number, s.hasBasmala]), [[2, true]]);
});

test('a page that crosses from one surah into the next marks only the surah that begins on it', () => {
  const arabic = body([
    ayah(6200, 111, 5, 'فِى جِيدِهَا'),
    ayah(6201, 112, 1, `${BASMALA} قُلْ هُوَ`),
    ayah(6202, 112, 2, 'ٱللَّهُ ٱلصَّمَدُ'),
  ]);
  const page = buildMushafPage(603, arabic, { script: 'uthmani' });
  assert.deepEqual(page.ayahs.map((a) => a.surah), [111, 112, 112]);
  assert.deepEqual(page.surahStarts.map((s) => s.number), [112]);
  assert.equal(page.ayahs[1].arabic, 'قُلْ هُوَ');
});

test('Al-Fatiha keeps its Bismillah as ayah 1 and has no header Bismillah, and At-Tawbah has none either', () => {
  const fatiha = buildMushafPage(1, body([ayah(1, 1, 1, BASMALA, { page: 1 })]), { script: 'uthmani' });
  assert.equal(fatiha.ayahs[0].arabic, BASMALA);
  assert.deepEqual(fatiha.surahStarts.map((s) => [s.number, s.hasBasmala]), [[1, false]]);
  const tawbah = buildMushafPage(187, body([ayah(1235, 9, 1, 'بَرَآءَةٌ مِّنَ', { page: 187 })]), { script: 'uthmani' });
  assert.deepEqual(tawbah.surahStarts.map((s) => [s.number, s.hasBasmala]), [[9, false]]);
});

test('the translation is matched by ayah number across surahs, never by number within a surah', () => {
  const arabic = body([ayah(6200, 111, 5, 'a'), ayah(6201, 112, 1, 'b'), ayah(6202, 112, 2, 'c')]);
  const translation = body([ayah(6200, 111, 5, 'T-111-5'), ayah(6201, 112, 1, 'T-112-1'), ayah(6202, 112, 2, 'T-112-2')], 'en.pickthall');
  const page = buildMushafPage(603, arabic, { script: 'uthmani', translationBody: translation });
  assert.deepEqual(page.ayahs.map((a) => a.translation), ['T-111-5', 'T-112-1', 'T-112-2']);
  const without = buildMushafPage(603, arabic, { script: 'uthmani' });
  assert.deepEqual(without.ayahs.map((a) => a.translation), [null, null, null]);
});

test('tajweed colours come from the tajweed edition and never change the Uthmani letters', () => {
  const arabic = body([ayah(6222, 112, 1, 'قُلْ هُوَ ٱللَّهُ أَحَدٌ')]);
  const overlay = body([ayah(6222, 112, 1, 'قُلْ هُوَ [h:8078[ٱ]للَّهُ أَحَ[q[د]ٌ')], 'quran-tajweed');
  const [a] = buildMushafPage(604, arabic, { script: 'tajweed', overlayBody: overlay }).ayahs;
  assert.equal(a.arabic, 'قُلْ هُوَ ٱللَّهُ أَحَدٌ');
  assert.deepEqual(a.segments.map((s) => s.rule), [null, 'h', null, 'q', null]);
  assert.equal(a.segments.map((s) => s.text).join(''), a.arabic);
  const plain = buildMushafPage(604, arabic, { script: 'tajweed' }).ayahs[0];
  assert.equal(plain.segments, null, 'missing colours leave plain Uthmani text');
});

test('IndoPak text comes from the bundled file by surah and ayah, and a gap is an error', () => {
  const arabic = body([ayah(6200, 111, 5, 'a'), ayah(6201, 112, 1, 'b')]);
  const data = { surahs: Array.from({ length: 114 }, (_, i) => Array.from({ length: i === 110 ? 5 : 4 }, (__, j) => `IND-${i + 1}-${j + 1}`)) };
  const page = buildMushafPage(603, arabic, { script: 'indopak', indopak: data });
  assert.deepEqual(page.ayahs.map((a) => a.arabic), ['IND-111-5', 'IND-112-1']);
  assert.equal(buildMushafPage(603, arabic, { script: 'indopak' }), null, 'no file, no page');
  const gap = { surahs: data.surahs.map((s, i) => (i === 111 ? [] : s)) };
  assert.equal(buildMushafPage(603, arabic, { script: 'indopak', indopak: gap }), null);
});

test('a bad or empty response gives no page, so the screen can offer a retry', () => {
  assert.equal(buildMushafPage(2, null, { script: 'uthmani' }), null);
  assert.equal(buildMushafPage(2, { code: 500 }, { script: 'uthmani' }), null);
  assert.equal(buildMushafPage(2, { code: 200, data: { ayahs: [] } }, { script: 'uthmani' }), null);
  assert.equal(buildMushafPage(2, { code: 200, data: { ayahs: [{ number: 1 }] } }, { script: 'uthmani' }), null);
});

test('the page remembers its juz and the ayah range it holds', () => {
  const page = buildMushafPage(2, body([ayah(8, 2, 1, 'x', { juz: 1 }), ayah(12, 2, 5, 'y', { juz: 1 })]), { script: 'uthmani' });
  assert.equal(page.juz, 1);
  assert.deepEqual(page.range, { from: 8, to: 12 });
});

// ── swiping ──────────────────────────────────────────────────────────────────

test('swiping right turns to the next page and swiping left to the previous, like a right-to-left book', () => {
  assert.equal(swipeDirection(90, 5), 'next');
  assert.equal(swipeDirection(-90, 5), 'prev');
});

test('small or mostly vertical movements are scrolling, not a page turn', () => {
  assert.equal(swipeDirection(30, 0), null);
  assert.equal(swipeDirection(90, 120), null);
  assert.equal(swipeDirection(0, 0), null);
  assert.equal(swipeDirection(60, 59), null, 'a diagonal drag is not a swipe');
});
