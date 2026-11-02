import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PICKTHALL_ID, QURANENC_BASE, catalogUrl, surahTranslationUrl, translationIdFor, parseTranslationId,
  parseCatalog, languageLabel, groupByLanguage, parseQuranEncSurah, applyTranslation, translationCredit, translationLabel,
} from '../src/quran/translations.ts';
import { sanitizeReaderSettings, DEFAULT_READER_SETTINGS } from '../src/quran/settings.ts';

const entry = (key, over = {}) => ({
  key, direction: 'ltr', language_iso_code: 'en', version: '1.0.1', last_update: 1700000000, title: `Title of ${key}`, description: 'd', file: key,
  database_url: 'https://x/y.zip', pdf_url: 'https://x/y.pdf', ...over,
});

// ── ids and URLs ──────────────────────────────────────────────────────────────

test('the built-in translation and QuranEnc ones have distinct ids', () => {
  assert.equal(PICKTHALL_ID, 'pickthall');
  assert.equal(translationIdFor('english_saheeh'), 'quranenc:english_saheeh');
});

test('ids parse back to their source, and anything else is rejected', () => {
  assert.deepEqual(parseTranslationId('pickthall'), { source: 'builtin' });
  assert.deepEqual(parseTranslationId('quranenc:urdu_junagarhi'), { source: 'quranenc', key: 'urdu_junagarhi' });
  for (const bad of ['', 'quranenc:', 'quranenc:Has Space', 'quranenc:../../etc', 'other:thing', 5, null, undefined, 'quranenc:' + 'a'.repeat(100)]) {
    assert.equal(parseTranslationId(bad), null, String(bad));
  }
});

test('the API URLs point at the official QuranEnc endpoints', () => {
  assert.equal(QURANENC_BASE, 'https://quranenc.com/api/v1');
  assert.equal(catalogUrl(), 'https://quranenc.com/api/v1/translations/list');
  assert.equal(surahTranslationUrl('english_saheeh', 112), 'https://quranenc.com/api/v1/translation/sura/english_saheeh/112');
});

test('a key that is not a safe slug never reaches a URL', () => {
  assert.throws(() => surahTranslationUrl('../x', 1));
  assert.throws(() => surahTranslationUrl('ok_key', 0));
  assert.throws(() => surahTranslationUrl('ok_key', 115));
});

// ── catalogue ─────────────────────────────────────────────────────────────────

test('the catalogue keeps what the reader needs and drops the download links', () => {
  const out = parseCatalog({ translations: [entry('english_saheeh', { title: 'English Translation - Noor International Center', version: '1.1.2' })] });
  assert.deepEqual(out, [{
    key: 'english_saheeh', title: 'English Translation - Noor International Center', language: 'en', direction: 'ltr', version: '1.1.2', lastUpdate: 1700000000,
  }]);
});

test('entries without a usable key or title are skipped, and a bad body gives an empty list', () => {
  const out = parseCatalog({ translations: [entry('good'), { key: 'no title' }, { title: 'no key' }, null, 'x', entry('Bad Key')] });
  assert.deepEqual(out.map((e) => e.key), ['good']);
  for (const body of [null, undefined, 'x', {}, { translations: 'x' }, []]) assert.deepEqual(parseCatalog(body), []);
});

test('direction defaults to left to right and only accepts rtl or ltr', () => {
  const out = parseCatalog({ translations: [entry('aa', { direction: 'rtl' }), entry('bb', { direction: 'sideways' }), entry('cc', { direction: undefined })] });
  assert.deepEqual(out.map((e) => e.direction), ['rtl', 'ltr', 'ltr']);
});

test('language names are readable, in English and in the language itself', () => {
  const ur = languageLabel('ur');
  assert.equal(ur.english, 'Urdu');
  assert.notEqual(ur.native, ur.english);
  assert.equal(languageLabel('xx-unknown').english, 'xx-unknown', 'unknown codes fall back to the code');
  assert.equal(languageLabel('mdh').english, 'Maguindanaon', 'a QuranEnc language the runtime cannot name');
});

test('translations are grouped by language, languages and titles sorted', () => {
  const entries = parseCatalog({ translations: [
    entry('urdu_b', { language_iso_code: 'ur', title: 'Urdu B' }),
    entry('english_b', { language_iso_code: 'en', title: 'English B' }),
    entry('english_a', { language_iso_code: 'en', title: 'English A' }),
    entry('arabic_a', { language_iso_code: 'ar', title: 'Arabic A' }),
  ] });
  const groups = groupByLanguage(entries, '');
  assert.deepEqual(groups.map((g) => g.language), ['ar', 'en', 'ur']);
  assert.deepEqual(groups[1].items.map((e) => e.key), ['english_a', 'english_b']);
});

test('search matches the title, the key and the language name, ignoring case', () => {
  const entries = parseCatalog({ translations: [
    entry('urdu_junagarhi', { language_iso_code: 'ur', title: 'Urdu Translation - Junagarhi' }),
    entry('english_saheeh', { language_iso_code: 'en', title: 'English Translation - Noor' }),
  ] });
  assert.deepEqual(groupByLanguage(entries, 'JUNA').flatMap((g) => g.items.map((e) => e.key)), ['urdu_junagarhi']);
  assert.deepEqual(groupByLanguage(entries, 'english').flatMap((g) => g.items.map((e) => e.key)), ['english_saheeh']);
  assert.deepEqual(groupByLanguage(entries, 'saheeh').flatMap((g) => g.items.map((e) => e.key)), ['english_saheeh']);
  assert.deepEqual(groupByLanguage(entries, 'zzz'), []);
});

// ── a surah's translation ─────────────────────────────────────────────────────

const body = (rows) => ({ result: rows });
const row = (aya, translation, footnotes = '') => ({ id: String(1000 + aya), sura: '112', aya: String(aya), arabic_text: 'x', translation, footnotes });

test('a surah response becomes translation and footnotes by ayah number', () => {
  const map = parseQuranEncSurah(body([row(1, 'Say: He is Allah[1]', '[1] note'), row(2, 'Allah, the Eternal')]));
  assert.equal(map.size, 2);
  assert.deepEqual(map.get(1), { translation: 'Say: He is Allah[1]', footnotes: '[1] note' });
  assert.deepEqual(map.get(2), { translation: 'Allah, the Eternal', footnotes: null }, 'an empty footnote is no footnote');
});

test('the text is kept exactly as published, markers and all', () => {
  const text = '  Say: “He is Allah, the One[1];”  ';
  assert.equal(parseQuranEncSurah(body([row(1, text)])).get(1).translation, text);
});

test('malformed rows are skipped and a bad response gives null', () => {
  const map = parseQuranEncSurah(body([row(1, 'ok'), { aya: 'x', translation: 'bad number' }, { aya: '2' }, null]));
  assert.deepEqual([...map.keys()], [1]);
  for (const bad of [null, undefined, 'x', {}, { result: 'x' }, { result: [] }, { result: [null] }]) assert.equal(parseQuranEncSurah(bad), null, JSON.stringify(bad));
});

test('applying a translation fills text and footnotes without touching the Arabic or the input', () => {
  const ayahs = [
    { number: 6222, numberInSurah: 1, arabic: 'A', translation: 'old', transliteration: null, footnotes: null, juz: 30, page: 604 },
    { number: 6223, numberInSurah: 2, arabic: 'B', translation: 'old', transliteration: null, footnotes: null, juz: 30, page: 604 },
  ];
  const map = new Map([[1, { translation: 'new', footnotes: '[1] n' }]]);
  const out = applyTranslation(ayahs, map);
  assert.equal(out[0].translation, 'new');
  assert.equal(out[0].footnotes, '[1] n');
  assert.equal(out[0].arabic, 'A');
  assert.equal(out[1].translation, null, 'an ayah the translation does not cover shows none, not the previous text');
  assert.equal(ayahs[0].translation, 'old', 'the input is untouched');
});

test('with no translation loaded, the ayahs show none', () => {
  const ayahs = [{ number: 1, numberInSurah: 1, arabic: 'A', translation: 'old', transliteration: null, footnotes: 'x', juz: 1, page: 1 }];
  assert.equal(applyTranslation(ayahs, null)[0].translation, null);
  assert.equal(applyTranslation(ayahs, null)[0].footnotes, null);
});

// ── credit line ───────────────────────────────────────────────────────────────

test('the credit names the publisher, the version and the source', () => {
  const credit = translationCredit({ key: 'english_saheeh', title: 'English Translation - Noor International Center', language: 'en', direction: 'ltr', version: '1.1.2', lastUpdate: 1 });
  assert.match(credit.text, /Noor International Center/);
  assert.match(credit.text, /v1\.1\.2/);
  assert.match(credit.text, /QuranEnc\.com/);
  assert.equal(credit.url, 'https://quranenc.com/en/browse/english_saheeh');
});

test('the built-in translation is credited as public domain', () => {
  const credit = translationCredit(null);
  assert.match(credit.text, /Pickthall/);
  assert.match(credit.text, /public domain/i);
});

// ── settings ──────────────────────────────────────────────────────────────────

test('the chosen translation is remembered, and a bad stored value falls back to the default', () => {
  assert.equal(DEFAULT_READER_SETTINGS.translation, 'pickthall');
  assert.equal(sanitizeReaderSettings({ translation: 'quranenc:urdu_junagarhi' }).translation, 'quranenc:urdu_junagarhi');
  for (const bad of ['quranenc:../x', 7, null, 'whatever']) assert.equal(sanitizeReaderSettings({ translation: bad }).translation, 'pickthall');
});

// ── credits ───────────────────────────────────────────────────────────────────

import fs from 'node:fs';
import { THIRD_PARTY_NOTICES } from '../src/licenses.ts';

test('QuranEnc and its terms are credited in the app and in the notices file', () => {
  const notice = THIRD_PARTY_NOTICES.find((n) => n.name === 'Quran translations (QuranEnc)');
  assert.ok(notice, 'listed in licences.ts');
  assert.equal(notice.url, 'https://quranenc.com');
  assert.match(notice.note, /unmodified/i);
  assert.match(notice.note, /version/i);
  const md = fs.readFileSync(new URL('../THIRD_PARTY_NOTICES.md', import.meta.url), 'utf8');
  assert.ok(md.includes('QuranEnc'), 'listed in THIRD_PARTY_NOTICES.md');
  assert.ok(md.includes('no modification'), 'the terms we follow are written down');
});

test('the translation label reads well for both kinds', () => {
  assert.equal(translationLabel('pickthall', []), 'English: Pickthall');
  assert.equal(translationLabel('quranenc:urdu_junagarhi', [{ key: 'urdu_junagarhi', title: 'Urdu Translation - Junagarhi' }]), 'Urdu Translation - Junagarhi');
  assert.equal(translationLabel('quranenc:unlisted_one', []), 'unlisted_one', 'unknown keys still show something');
  assert.equal(translationLabel('garbage', []), 'English: Pickthall', 'a bad id falls back to the built-in label');
});

test('a translation not yet in the catalogue is still credited to QuranEnc', () => {
  const credit = translationCredit(null, 'unlisted_one');
  assert.match(credit.text, /QuranEnc\.com/);
  assert.equal(credit.url, 'https://quranenc.com/en/browse/unlisted_one');
});
