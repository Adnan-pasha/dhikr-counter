import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8');

// ── helpers ──────────────────────────────────────────────────────────────────

/** Collect `--name: #hex` declarations from every top-level block matching `selector`. */
const collectVars = (selector) => {
  const vars = {};
  let from = 0;
  for (;;) {
    const start = css.indexOf(`${selector} {`, from);
    if (start === -1) break;
    const open = css.indexOf('{', start);
    let depth = 1;
    let i = open + 1;
    while (depth > 0 && i < css.length) {
      if (css[i] === '{') depth += 1;
      if (css[i] === '}') depth -= 1;
      i += 1;
    }
    const block = css.slice(open + 1, i - 1);
    for (const m of block.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) vars[m[1]] = m[2].toUpperCase();
    from = i;
  }
  return vars;
};

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const dark = { ...collectVars(':root'), ...collectVars('@theme') };
const light = collectVars('[data-theme="light"]');
const LIGHT_SURFACES = ['#FFFFFF', '#F1F5F9'];

// ── light mode palette remap ─────────────────────────────────────────────────

test('light mode remaps palette variables instead of !important class overrides', () => {
  assert.doesNotMatch(css, /\.(bg|text|border|divide)-slate-[\w\\/[\]#.-]*[^{]*\{[^}]*!important/);
  assert.ok(light['--color-slate-800'], 'slate scale is remapped via variables');
});

test('light mode slate text shades are AA on light surfaces', () => {
  for (const shade of [50, 100, 200, 300, 400, 500]) {
    for (const surface of LIGHT_SURFACES) {
      const colour = light[`--color-slate-${shade}`];
      assert.ok(colour, `--color-slate-${shade} defined`);
      assert.ok(contrast(colour, surface) >= 4.5, `slate-${shade} ${colour} on ${surface} = ${contrast(colour, surface).toFixed(2)}`);
    }
  }
});

test('light mode surface shades keep elevation order (900 lightest, 700 darkest)', () => {
  const l = (n) => luminance(light[`--color-slate-${n}`]);
  assert.ok(l(900) >= l(800), '900 >= 800');
  assert.ok(l(800) >= l(700), '800 >= 700');
  assert.equal(light['--color-slate-900'], '#FFFFFF');
});

test('light mode accent text shades (300/400) are AA on light surfaces', () => {
  const families = ['amber', 'emerald', 'indigo', 'rose', 'teal', 'cyan', 'violet', 'yellow', 'orange', 'red', 'sky'];
  for (const family of families) {
    for (const shade of [300, 400]) {
      const colour = light[`--color-${family}-${shade}`];
      assert.ok(colour, `--color-${family}-${shade} remapped`);
      for (const surface of LIGHT_SURFACES) {
        assert.ok(contrast(colour, surface) >= 4.5, `${family}-${shade} ${colour} on ${surface} = ${contrast(colour, surface).toFixed(2)}`);
      }
    }
  }
});

test('semantic text tokens are AA in both modes', () => {
  for (const role of ['--color-text-primary', '--color-text-secondary', '--color-text-muted']) {
    assert.ok(contrast(dark[role], dark['--color-bg-surface']) >= 4.5, `dark ${role}`);
    assert.ok(contrast(light[role], '#FFFFFF') >= 4.5, `light ${role}`);
  }
});

// ── navigation tokens ────────────────────────────────────────────────────────

test('bottom nav colours are theme tokens with AA inactive contrast in both modes', () => {
  for (const [name, vars] of [['dark', dark], ['light', light]]) {
    assert.ok(vars['--nav-bg'], `${name} --nav-bg`);
    assert.ok(vars['--nav-inactive'], `${name} --nav-inactive`);
    assert.ok(contrast(vars['--nav-inactive'], vars['--nav-bg']) >= 4.5, `${name} inactive nav contrast`);
  }
  const nav = fs.readFileSync(path.join(root, 'src/components/BottomNav.tsx'), 'utf8');
  assert.doesNotMatch(nav, /rgba\(9,\s*14,\s*26/);
  assert.doesNotMatch(nav, /#64748B/i);
  assert.match(nav, /var\(--nav-bg\)/);
  assert.match(nav, /var\(--nav-inactive\)/);
});

test('minimum touch target utility exists', () => {
  assert.match(css, /\.tap-target\s*\{[^}]*min-(height|width)\s*:\s*44px/);
});
