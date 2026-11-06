import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  if (entry.isDirectory()) return walk(full);
  return entry.name.endsWith('.tsx') ? [full] : [];
});

/** The text of every opening <tag ...> in a source file, read with braces and quotes in mind so "=>" inside props does not end it. */
const openingTags = (source, tag) => {
  const found = [];
  let from = 0;
  for (;;) {
    const start = source.indexOf(`<${tag}`, from);
    if (start < 0) return found;
    const next = source[start + tag.length + 1];
    if (next !== undefined && !/[\s/>]/.test(next)) { from = start + 1; continue; }
    let depth = 0;
    let i = start + tag.length + 1;
    for (; i < source.length; i += 1) {
      const c = source[i];
      if (depth === 0 && (c === '"' || c === "'")) { i = source.indexOf(c, i + 1); continue; }
      if (c === '{') depth += 1;
      else if (c === '}') depth -= 1;
      else if (c === '>' && depth === 0) break;
    }
    found.push({ text: source.slice(start, i + 1), index: start });
    from = i;
  }
};

const unnamed = (file) => {
  const source = fs.readFileSync(file, 'utf8');
  const problems = [];
  for (const tag of ['input', 'textarea', 'select']) {
    for (const { text, index } of openingTags(source, tag)) {
      if (/type="(hidden|file)"/.test(text)) continue;
      // Inside a <label> that wraps it, a control is named by that label.
      if (source.lastIndexOf('<label', index) > source.lastIndexOf('</label>', index)) continue;
      if (/aria-label=|aria-labelledby=/.test(text)) continue;
      const id = /\bid="([^"]+)"/.exec(text)?.[1];
      if (id && new RegExp(`htmlFor="${id}"`).test(source)) continue;
      problems.push(text.replace(/\s+/g, ' ').slice(0, 110));
    }
  }
  return problems;
};

test('every input, slider, select and text area has an accessible name a screen reader can announce', () => {
  const failures = walk(root).flatMap((file) => unnamed(file).map((text) => `${path.relative(root, file)}: ${text}`));
  assert.deepEqual(failures, [], `${failures.length} form control(s) have no name:\n${failures.join('\n')}`);
});

test('a label is only used for a control it points at; group captions are not labels', () => {
  const failures = [];
  for (const file of walk(root)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const { text, index } of openingTags(source, 'label')) {
      if (/htmlFor=/.test(text)) continue;
      // A label with no htmlFor is fine only when it wraps its control.
      const rest = source.slice(index, index + 3000);
      const closes = rest.indexOf('</label>');
      if (closes >= 0 && /<(input|select|textarea)/.test(rest.slice(0, closes))) continue;
      failures.push(`${path.relative(root, file)}: ${text.replace(/\s+/g, ' ').slice(0, 100)}`);
    }
  }
  assert.deepEqual(failures, [], `${failures.length} label(s) point at nothing:\n${failures.join('\n')}`);
});
