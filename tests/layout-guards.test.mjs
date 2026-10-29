import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const componentsDir = path.join(root, 'src/components');

// .tap-target is declared after Tailwind's utilities in the same layer, so it sets display and
// justify-content last and quietly beats utilities such as `flex` or `justify-between`. Left-aligned
// or spread-out rows need `min-h-11` instead.
const CONFLICTS = /\b(justify-between|justify-start|justify-end|justify-around|justify-evenly|block|grid|hidden|inline-block|text-left)\b/;

test('.tap-target is never combined with layout utilities it would override', () => {
  const offenders = [];
  for (const file of fs.readdirSync(componentsDir).filter((f) => f.endsWith('.tsx'))) {
    const src = fs.readFileSync(path.join(componentsDir, file), 'utf8');
    for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
      const classes = m[1] ?? m[2];
      if (/\btap-target\b/.test(classes) && CONFLICTS.test(classes)) {
        offenders.push(`${file}: ${classes.trim().slice(0, 90)}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test('the rule that causes it is still the one described above', () => {
  const css = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8');
  const rule = css.match(/\.tap-target\s*\{([^}]*)\}/)[1];
  assert.match(rule, /display:\s*inline-flex/);
  assert.match(rule, /justify-content:\s*center/);
});
