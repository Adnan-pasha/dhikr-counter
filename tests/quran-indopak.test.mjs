import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseIndopak, loadIndopak, indopakAyahs, stripEndMarker, BASMALA_INDOPAK, INDOPAK_END_MARK, clearIndopakCache,
} from '../src/quran/indopak.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const raw = JSON.parse(fs.readFileSync(path.join(root, 'src/quran/data/indopak-digitalkhatt.json'), 'utf8'));
const data = parseIndopak(raw);

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const toDigits = (n) => String(n).replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)]);

test('the bundled file holds the whole Quran: 114 surahs and 6236 ayahs', () => {
  assert.ok(data, 'file is valid');
  assert.equal(data.surahs.length, 114);
  assert.equal(data.surahs.reduce((n, s) => n + s.length, 0), 6236);
  assert.equal(data.surahs[0].length, 7, 'Al-Fatiha');
  assert.equal(data.surahs[1].length, 286, 'Al-Baqarah');
  assert.equal(data.surahs[113].length, 6, 'An-Nas');
});

test('every ayah carries its own number, which proves the numbering lines up', () => {
  data.surahs.forEach((ayahs, s) => {
    if (s === 0) return;
    ayahs.forEach((text, a) => assert.ok(text.includes(`${INDOPAK_END_MARK}${toDigits(a + 1)}`), `${s + 1}:${a + 1}`));
  });
});

test('Al-Fatiha is numbered the IndoPak way: the Bismillah has no number, and the last ayah holds two numbered verses', () => {
  const marks = data.surahs[0].map((text) => text.slice(text.indexOf(INDOPAK_END_MARK)).replace(/[^۝٠-٩]/g, ''));
  assert.deepEqual(marks, ['۝', ...[1, 2, 3, 4, 5, 7].map((n) => `۝${toDigits(n)}`)]);
  assert.ok(data.surahs[0][6].includes(toDigits(6)), 'verse six sits inside the last ayah');
});

test('the text holds only Arabic letters, marks and spaces, so nothing foreign slipped in', () => {
  // U+034F keeps marks in the right order, U+0870-089F are Arabic Extended-B marks, U+200C/D are joiners.
  const allowed = /^[؀-ۿݐ-ݿࡰ-ࣿﭐ-﷿ﹰ-﻿͏‌‍ ]+$/;
  data.surahs.forEach((ayahs, s) => ayahs.forEach((text, a) => {
    if (s === 0 && a === 6) return; // the one ayah that carries a direction override, checked below
    assert.match(text, allowed, `${s + 1}:${a + 1}`);
  }));
});

test('the only direction-control character in the whole text is the one inside Al-Fatiha 1:7', () => {
  const hits = [];
  data.surahs.forEach((ayahs, s) => ayahs.forEach((text, a) => { if (/[‪-‮⁦-⁩]/.test(text)) hits.push(`${s + 1}:${a + 1}`); }));
  assert.deepEqual(hits, ['1:7']);
});

test('the Bismillah header is the first ayah of Al-Fatiha without its number', () => {
  assert.equal(stripEndMarker(data.surahs[0][0]), BASMALA_INDOPAK);
  assert.ok(!BASMALA_INDOPAK.includes(INDOPAK_END_MARK));
});

test('stripping the end mark leaves the words exactly as they are', () => {
  const text = data.surahs[111][0];
  const plain = stripEndMarker(text);
  assert.ok(text.startsWith(plain));
  assert.ok(!plain.includes(INDOPAK_END_MARK));
  assert.equal(stripEndMarker('بِ'), 'بِ', 'text without a mark is unchanged');
});

test('a surah is looked up by ayah number', () => {
  const map = indopakAyahs(data, 112);
  assert.equal(map.size, 4);
  assert.equal(map.get(1), data.surahs[111][0]);
  assert.equal(indopakAyahs(data, 0).size, 0);
  assert.equal(indopakAyahs(data, 115).size, 0);
});

test('malformed files are rejected rather than half-used', () => {
  assert.equal(parseIndopak(null), null);
  assert.equal(parseIndopak({}), null);
  assert.equal(parseIndopak({ surahs: [['a']] }), null, 'wrong number of surahs');
  assert.equal(parseIndopak({ surahs: raw.surahs.map((s, i) => (i === 5 ? [] : s)) }), null, 'an empty surah');
  assert.equal(parseIndopak({ surahs: raw.surahs.map((s, i) => (i === 5 ? [1, 2] : s)) }), null, 'non-text ayahs');
});

test('loading fetches the file once and keeps it', async () => {
  clearIndopakCache();
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return { ok: true, json: async () => raw }; };
  const a = await loadIndopak(fetchImpl);
  const b = await loadIndopak(fetchImpl);
  assert.equal(a, b);
  assert.equal(calls, 1);
});

test('a failed load is not remembered, so the next try can succeed', async () => {
  clearIndopakCache();
  await assert.rejects(loadIndopak(async () => ({ ok: false, status: 500, json: async () => ({}) })));
  await assert.rejects(loadIndopak(async () => { throw new Error('offline'); }));
  await assert.rejects(loadIndopak(async () => ({ ok: true, json: async () => ({ surahs: [] }) })));
  const ok = await loadIndopak(async () => ({ ok: true, json: async () => raw }));
  assert.equal(ok.surahs.length, 114);
});
