import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { THIRD_PARTY_NOTICES } from '../src/licenses.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('Arabic text is set in size-adjusted Lateef, self-hosted, with Naskh as the glyph fallback', () => {
  const css = read('src/index.css');
  const stack = css.match(/--font-arabic:\s*([^;]+);/)[1];
  assert.match(stack.split(',')[0], /Lateef Adjusted/);
  assert.match(stack, /Noto Naskh Arabic/, 'fallback covers glyphs Lateef lacks');
  // Lateef is a compact face; size-adjust brings it to the optical size of the other faces.
  for (const weight of [400, 600, 700]) {
    const face = css.match(new RegExp(String.raw`@font-face\s*\{[^}]*lateef-arabic-${weight}-normal\.woff2[^}]*\}`));
    assert.ok(face, `@font-face for Lateef ${weight}`);
    assert.match(face[0], /font-family:\s*"Lateef Adjusted"/);
    assert.match(face[0], /size-adjust:\s*1[12]\d(\.\d+)?%/);
    assert.match(face[0], new RegExp(String.raw`font-weight:\s*${weight}`));
    assert.match(face[0], /font-display:\s*swap/);
  }
  const main = read('src/main.tsx');
  assert.doesNotMatch(main, /@fontsource\/lateef/, 'faces are declared in CSS, not double-loaded');
  assert.match(main, /@fontsource\/noto-naskh-arabic\/arabic-400\.css/);
});

test('Lateef is declared a dependency and credited under its OFL licence', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.ok(pkg.dependencies['@fontsource/lateef']);
  const notice = THIRD_PARTY_NOTICES.find((n) => n.name === 'Lateef');
  assert.ok(notice, 'Lateef in licences.ts');
  assert.equal(notice.license, 'SIL OFL 1.1');
  assert.match(read('THIRD_PARTY_NOTICES.md'), /Lateef/);
});

test('built font files for the Arabic faces ship with the app', () => {
  for (const weight of [400, 600, 700]) {
    assert.ok(fs.existsSync(path.join(root, `node_modules/@fontsource/lateef/files/lateef-arabic-${weight}-normal.woff2`)), `lateef ${weight}`);
  }
});

test('UI font stack falls back to Naskh so Arabic ligature signs in English text still draw', () => {
  const css = read('src/index.css');
  const sans = css.match(/--font-sans:\s*([^;]+);/)[1];
  assert.match(sans, /Noto Naskh Arabic/);
  assert.ok(sans.indexOf('Noto Naskh Arabic') < sans.indexOf('ui-sans-serif'), 'before system fallbacks');
});
