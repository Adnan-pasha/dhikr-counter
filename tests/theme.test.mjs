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
  const families = ['amber', 'brand', 'emerald', 'indigo', 'rose', 'teal', 'cyan', 'violet', 'yellow', 'orange', 'red', 'sky'];
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

// ── brand + dark neutral scale (Phase 1 step 2) ───────────────────────────────

const DARK_SURFACES = ['--color-bg-surface', '--color-bg-raised'];

test('dark neutral text shades (slate 50-500) are AA on dark surfaces', () => {
  for (const shade of [50, 100, 200, 300, 400, 500]) {
    const colour = dark[`--color-slate-${shade}`];
    assert.ok(colour, `dark --color-slate-${shade} defined`);
    for (const surface of DARK_SURFACES) {
      assert.ok(contrast(colour, dark[surface]) >= 4.5, `dark slate-${shade} ${colour} on ${surface} = ${contrast(colour, dark[surface]).toFixed(2)}`);
    }
  }
});

test('dark neutral scale is tinted green, not the default blue-grey', () => {
  const isGreenTinted = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return g >= b && g >= r;
  };
  for (const shade of [400, 600, 700, 800, 900, 950]) assert.ok(isGreenTinted(dark[`--color-slate-${shade}`]), `slate-${shade}`);
  for (const name of ['--color-bg-deep', '--color-bg-base', '--color-bg-surface', '--color-bg-raised']) {
    assert.ok(isGreenTinted(dark[name]), name);
  }
});

test('dark surfaces keep elevation order', () => {
  const l = (n) => luminance(dark[n]);
  assert.ok(l('--color-bg-deep') <= l('--color-bg-base'));
  assert.ok(l('--color-bg-base') <= l('--color-bg-surface'));
  assert.ok(l('--color-bg-surface') <= l('--color-bg-raised'));
  assert.ok(l('--color-bg-raised') <= l('--color-bg-overlay'));
});

test('brand is a teal-green scale and the primary brand token is no longer amber', () => {
  for (const shade of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]) {
    assert.ok(dark[`--color-brand-${shade}`], `--color-brand-${shade}`);
  }
  assert.notEqual(dark['--color-brand'], '#FBBF24');
  assert.notEqual(light['--color-brand'], '#D97706');
  const [r, g] = [1, 3].map((i) => parseInt(dark['--color-brand-500'].slice(i, i + 2), 16));
  assert.ok(g > r, 'brand-500 is green-dominant');
  assert.ok(contrast(dark['--color-brand'], dark['--color-bg-surface']) >= 4.5, 'brand on dark surface');
  assert.ok(contrast(light['--color-brand'], '#FFFFFF') >= 4.5, 'brand on white');
  assert.ok(contrast(light['--color-text-brand'], '#F1F5F9') >= 4.5, 'brand text on light grey');
});

test('dark text on brand-500 call-to-action fills is AA', () => {
  assert.ok(contrast('#070E0C', dark['--color-brand-500']) >= 4.5);
});

test('amber is reserved for streak and warning surfaces', () => {
  const allowed = new Set(['HomeScreen.tsx', 'StatsScreen.tsx', 'SalahTracker.tsx', 'QiblaScreen.tsx', 'ReminderBanner.tsx']);
  const dir = path.join(root, 'src/components');
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.tsx') || allowed.has(file)) continue;
    const src = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.doesNotMatch(src, /amber-\d/, `${file} must use brand-*, not amber-*`);
  }
});

test('destructive confirmations use a danger style, not the brand colour', () => {
  const modal = fs.readFileSync(path.join(root, 'src/components/ConfirmModal.tsx'), 'utf8');
  assert.match(modal, /destructive/);
  assert.match(modal, /bg-red-/);
  const hooks = fs.readFileSync(path.join(root, 'src/hooks.ts'), 'utf8');
  const resetAll = hooks.slice(hooks.indexOf('const handleResetAllData'));
  assert.match(resetAll.slice(0, resetAll.indexOf('onConfirm')), /destructive:\s*true/);
  const clearHistory = hooks.slice(hooks.indexOf('const handleClearHistory'));
  assert.match(clearHistory.slice(0, clearHistory.indexOf('onConfirm')), /destructive:\s*true/);
});

test('slate-950 is a surface shade in light mode; call-to-action text uses text-on-brand', () => {
  assert.ok(luminance(light['--color-slate-950']) >= luminance(light['--color-slate-900']), 'light slate-950 is a surface');
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  for (const file of walk(path.join(root, 'src')).filter((f) => /\.(tsx|ts)$/.test(f))) {
    const src = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(src, /(?<![-\w])(hover:|focus:)?text-slate-950\b/, `${path.basename(file)} uses text-slate-950`);
  }
  assert.match(css, /\.text-on-brand\s*\{[^}]*color\s*:\s*#070E0C/i);
  assert.ok(contrast('#070E0C', dark['--color-brand-500']) >= 4.5);
});

test('custom text sizes used in components are defined and at least 12px', () => {
  const walkTsx = (dir) => fs.readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walkTsx(path.join(dir, e.name)) : [path.join(dir, e.name)]))
    .filter((f) => f.endsWith('.tsx'));
  const used = new Set();
  for (const file of walkTsx(path.join(root, 'src'))) {
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/(?<![-\w])text-(\d?xs)\b/g)) used.add(m[1]);
  }
  assert.ok(used.size > 0);
  for (const name of used) {
    if (name === 'xs') continue; // Tailwind default (0.75rem)
    const decl = css.match(new RegExp(String.raw`--text-${name}:\s*([\d.]+)rem`));
    assert.ok(decl, `--text-${name} is used in components but not defined in @theme`);
    assert.ok(parseFloat(decl[1]) >= 0.75, `--text-${name} = ${decl[1]}rem is below 12px`);
  }
});

test('icon-only action buttons meet the 44px touch target', () => {
  for (const file of ['AdhkaarLibrary.tsx', 'RoutineManager.tsx']) {
    const src = fs.readFileSync(path.join(root, 'src/components', file), 'utf8');
    assert.doesNotMatch(src, /className=(\{`|")p-1\.5 rounded-(xl|lg) /, `${file} has an undersized icon button`);
  }
});
