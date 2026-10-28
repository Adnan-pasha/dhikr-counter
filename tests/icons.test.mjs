import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICON_KEYS, ICONS, ROUTINE_ICON_KEYS, isIconKey, iconKeyForEmoji, normalizeRoutine } from '../src/icons.tsx';
import { SALAH_META, CATEGORY_META } from '../src/types.ts';
import { DEFAULT_ROUTINES } from '../src/adhkaar-data.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('every icon key resolves to a component', () => {
  assert.ok(ICON_KEYS.length >= 25);
  for (const key of ICON_KEYS) {
    const icon = ICONS[key];
    assert.ok(icon && (typeof icon === 'function' || typeof icon === 'object'), `${key} has an icon`);
  }
});

test('isIconKey guards unknown values', () => {
  assert.equal(isIconKey('fajr'), true);
  assert.equal(isIconKey('🌅'), false);
  assert.equal(isIconKey(undefined), false);
});

test('prayer and category metadata use icon keys, not emoji', () => {
  for (const [id, meta] of Object.entries(SALAH_META)) {
    assert.ok(isIconKey(meta.icon), `salah ${id}`);
  }
  for (const [id, meta] of Object.entries(CATEGORY_META)) {
    assert.ok(isIconKey(meta.icon), `category ${id}`);
  }
});

test('legacy routine emoji map to the nearest icon key', () => {
  assert.equal(iconKeyForEmoji('🌅'), 'sunrise');
  assert.equal(iconKeyForEmoji('🌙'), 'moon');
  assert.equal(iconKeyForEmoji('🤲'), 'dua');
  assert.equal(iconKeyForEmoji('📿'), 'beads');
  assert.equal(iconKeyForEmoji('🕌'), 'mosque');
  assert.equal(iconKeyForEmoji('🧩'), 'sparkles', 'unknown emoji fall back');
  assert.equal(iconKeyForEmoji(undefined), 'sparkles');
});

test('normalizeRoutine upgrades stored routines that only have an emoji', () => {
  const legacy = { id: 'r1', name: 'Fajr', emoji: '🌅', dhikrIds: ['a'], createdAt: '2026-01-01T00:00:00.000Z' };
  const upgraded = normalizeRoutine(legacy);
  assert.equal(upgraded.icon, 'sunrise');
  assert.equal('emoji' in upgraded, false);
  assert.deepEqual(upgraded.dhikrIds, ['a']);
  const modern = normalizeRoutine({ id: 'r2', name: 'Eve', icon: 'moon', dhikrIds: [], createdAt: 'x' });
  assert.equal(modern.icon, 'moon');
  assert.equal(normalizeRoutine({ id: 'r3', name: 'x', icon: 'not-an-icon', dhikrIds: [], createdAt: 'x' }).icon, 'sparkles');
});

test('built-in routines use icon keys', () => {
  for (const routine of DEFAULT_ROUTINES) assert.ok(isIconKey(routine.icon), routine.id);
});

test('routine picker offers only real icon keys', () => {
  assert.ok(ROUTINE_ICON_KEYS.length >= 8);
  for (const key of ROUTINE_ICON_KEYS) assert.ok(isIconKey(key), key);
});

// ── no emoji left in the UI layer ─────────────────────────────────────────────

const ALLOWED_GLYPHS = new Set(['✓', '✔', '✕', '➊', '➋', '➌', '➍', '➎', '➏', '→', '×']);
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));

test('no emoji pictographs remain in UI source (icons are themable Lucide components)', () => {
  const offenders = [];
  // icons.tsx holds the legacy emoji -> icon migration table, the one place emoji must appear.
  for (const file of walk(path.join(root, 'src')).filter((f) => /\.(tsx?|css)$/.test(f) && path.basename(f) !== 'icons.tsx')) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(/\p{Extended_Pictographic}/gu)) {
      if (!ALLOWED_GLYPHS.has(match[0])) offenders.push(`${path.basename(file)}: ${match[0]}`);
    }
  }
  assert.deepEqual([...new Set(offenders)], []);
});
