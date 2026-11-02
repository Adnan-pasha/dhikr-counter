import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseTajweed, plainText, colourText, TAJWEED_RULES, ruleFor, tajweedColorVar,
} from '../src/quran/tajweed.ts';
import { stripLeadingBasmala } from '../src/quran/text.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8');

// Real output of the text service for 1:1 and 112:1.
const FATIHA_1 = 'بِسْمِ [h:1[ٱ]للَّهِ [h:2[ٱ][l[ل]رَّحْمَ[n[ـٰ]نِ [h:3[ٱ][l[ل]رَّح[p[ِي]مِ';
const IKHLAS_1 = 'قُلْ هُوَ [h:8078[ٱ]للَّهُ أَحَ[q[د]ٌ';

test('parsing splits the text into plain and coloured pieces, in order', () => {
  const segments = parseTajweed(IKHLAS_1);
  assert.deepEqual(segments, [
    { text: 'قُلْ هُوَ ', rule: null },
    { text: 'ٱ', rule: 'h' },
    { text: 'للَّهُ أَحَ', rule: null },
    { text: 'د', rule: 'q' },
    { text: 'ٌ', rule: null },
  ]);
});

test('the markers never reach the reader and no letter is lost or added', () => {
  const plain = plainText(FATIHA_1);
  assert.equal(plain, 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ');
  assert.ok(!/[\[\]]/.test(plain));
  assert.equal(parseTajweed(FATIHA_1).map((s) => s.text).join(''), plain);
});

test('text without any markers is one plain piece, unchanged', () => {
  assert.deepEqual(parseTajweed('بِسْمِ ٱللَّهِ'), [{ text: 'بِسْمِ ٱللَّهِ', rule: null }]);
  assert.deepEqual(parseTajweed(''), []);
});

test('an unknown rule code keeps its letters and simply has no colour', () => {
  assert.deepEqual(parseTajweed('ا[z:5[ب]ج'), [{ text: 'ابج', rule: null }]);
});

test('a marker that is never closed is kept as plain text rather than dropped', () => {
  assert.equal(plainText('ابج[h:1[د'), 'ابج[h:1[د');
});

test('every rule the service sends has a name, an Arabic name and a colour variable', () => {
  const codes = 'hslnpmoqcfwiaudbg'.split('');
  for (const code of codes) {
    const rule = ruleFor(code);
    assert.ok(rule, `rule ${code}`);
    assert.ok(rule.name && rule.arabic && rule.summary, code);
    assert.match(tajweedColorVar(code), /^var\(--tj-[a-z]\)$/);
  }
  assert.equal(TAJWEED_RULES.length, new Set(TAJWEED_RULES.map((r) => r.code)).size, 'codes are unique');
  assert.equal(ruleFor('z'), null);
});

test('markers can be nested, and the innermost rule colours its letters', () => {
  assert.deepEqual(parseTajweed('و[o[ُوٓ[s[ا]ۚ]'), [
    { text: 'و', rule: null },
    { text: 'ُوٓ', rule: 'o' },
    { text: 'ا', rule: 's' },
    { text: 'ۚ', rule: 'o' },
  ]);
});

// ── colouring the verified Uthmani text ──────────────────────────────────────
// The tajweed edition spells some letters differently from the Uthmani text, so the Uthmani text is what
// is shown and the tajweed edition only says which letters to colour.

const samples = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/tajweed-samples.json'), 'utf8'));
const uthmaniFor = (s) => (s.ayah === 1 ? stripLeadingBasmala(s.surah, s.uthmani.replace(/^﻿/, '')) : s.uthmani);
const sample = (surah, ayah) => samples.find((s) => s.surah === surah && s.ayah === ayah);

test('every sample ayah is coloured onto its Uthmani text without changing a single character', () => {
  for (const s of samples) {
    const base = uthmaniFor(s);
    const segments = colourText(s.tajweed, base);
    assert.ok(segments, `${s.surah}:${s.ayah} aligns`);
    assert.equal(segments.map((p) => p.text).join(''), base, `${s.surah}:${s.ayah} text is exactly the Uthmani text`);
    assert.ok(segments.some((p) => p.rule), `${s.surah}:${s.ayah} has some colour`);
  }
});

test('rules land on the right letters', () => {
  const s = sample(112, 1);
  const segments = colourText(s.tajweed, uthmaniFor(s));
  assert.deepEqual(segments.filter((p) => p.rule).map((p) => [p.rule, p.text]), [['h', 'ٱ'], ['q', 'د']]);
});

test('a letter the tajweed edition spells out but the Uthmani text writes as a mark still takes its colour', () => {
  const s = sample(2, 2);
  const segments = colourText(s.tajweed, uthmaniFor(s));
  const madd = segments.find((p) => p.rule === 'n');
  assert.ok(madd, 'the madd on ذَٰلِكَ is coloured');
  assert.ok(madd.text.includes('ٰ'), 'the dagger alef carries the colour');
});

test('text that does not line up gives no colours rather than wrong ones', () => {
  assert.equal(colourText('[h:1[ب]', 'جد'), null);
  assert.equal(colourText('', 'جد'), null);
});

// ── colours are readable on every reading theme ──────────────────────────────

const channel = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const luminance = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

for (const name of ['dark', 'paper', 'modern']) {
  test(`${name} theme: every tajweed colour is readable on the page and on the cards`, () => {
    const block = css.match(new RegExp(String.raw`\[data-reader-theme="${name}"\]\s*\{([^}]*)\}`));
    assert.ok(block, `${name} block`);
    const token = (n) => block[1].match(new RegExp(String.raw`--${n}:\s*(#[0-9a-fA-F]{6})`))?.[1];
    for (const rule of TAJWEED_RULES) {
      const colour = token(`tj-${rule.code}`);
      assert.ok(colour, `${name} defines --tj-${rule.code}`);
      for (const ground of ['reader-bg', 'reader-surface']) {
        const ratio = contrast(colour, token(ground));
        assert.ok(ratio >= 4.5, `${name}: ${rule.name} (${colour}) on ${ground} is ${ratio.toFixed(2)}`);
      }
    }
  });
}

test('the longest sample ayah is coloured quickly, so opening a long surah does not freeze the page', () => {
  const s = sample(2, 282);
  const base = uthmaniFor(s);
  colourText(s.tajweed, base);
  const started = performance.now();
  for (let i = 0; i < 20; i += 1) colourText(s.tajweed, base);
  assert.ok((performance.now() - started) / 20 < 15, 'under 15 ms per ayah');
});
