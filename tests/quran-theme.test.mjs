import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { THIRD_PARTY_NOTICES } from '../src/licenses.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const css = read('src/index.css');

const TOKENS = ['bg', 'surface', 'ink', 'muted', 'accent', 'border'];

const themeBlock = (name) => {
  const m = css.match(new RegExp(String.raw`\[data-reader-theme="${name}"\]\s*\{([^}]*)\}`));
  assert.ok(m, `a [data-reader-theme="${name}"] block exists`);
  const tokens = {};
  for (const t of TOKENS) {
    const v = m[1].match(new RegExp(String.raw`--reader-${t}:\s*(#[0-9a-fA-F]{6})`));
    assert.ok(v, `${name} defines --reader-${t} as a hex colour`);
    tokens[t] = v[1];
  }
  return tokens;
};

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
  test(`${name} reading theme meets contrast on both its page and its cards`, () => {
    const t = themeBlock(name);
    for (const ground of ['bg', 'surface']) {
      assert.ok(contrast(t.ink, t[ground]) >= 7, `${name}: ink on ${ground} is ${contrast(t.ink, t[ground]).toFixed(2)}`);
      assert.ok(contrast(t.muted, t[ground]) >= 4.5, `${name}: muted on ${ground} is ${contrast(t.muted, t[ground]).toFixed(2)}`);
      assert.ok(contrast(t.accent, t[ground]) >= 4.5, `${name}: accent on ${ground} is ${contrast(t.accent, t[ground]).toFixed(2)}`);
    }
  });
}

test('the Quran face is Amiri Quran, self-hosted, with the Naskh fallback', () => {
  const stack = css.match(/--font-quran:\s*([^;]+);/)[1];
  assert.match(stack.split(',')[0], /Amiri Quran/);
  assert.match(stack, /Noto Naskh Arabic/);
  assert.match(read('src/main.tsx'), /@fontsource\/amiri-quran\/arabic-400\.css/);
  const pkg = JSON.parse(read('package.json'));
  assert.ok(pkg.dependencies['@fontsource/amiri-quran']);
  assert.ok(fs.existsSync(path.join(root, 'node_modules/@fontsource/amiri-quran/files/amiri-quran-arabic-400-normal.woff2')));
});

test('the Quran text, its font and the default translation are credited in the app and in the notices file', () => {
  const names = THIRD_PARTY_NOTICES.map((n) => n.name);
  for (const expected of ['Quran text (Tanzil)', 'Amiri Quran', 'Pickthall translation']) {
    assert.ok(names.includes(expected), `${expected} in licences.ts`);
  }
  const tanzil = THIRD_PARTY_NOTICES.find((n) => n.name === 'Quran text (Tanzil)');
  assert.match(tanzil.license, /CC BY 3\.0/);
  assert.equal(tanzil.url, 'https://tanzil.net');
  const md = read('THIRD_PARTY_NOTICES.md');
  for (const expected of ['Tanzil', 'Amiri Quran', 'Pickthall']) assert.ok(md.includes(expected), `${expected} in THIRD_PARTY_NOTICES.md`);
});
