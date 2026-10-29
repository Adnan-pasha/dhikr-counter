import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../src/components/SettingsScreen.tsx', import.meta.url), 'utf8');

test('the switch is exposed as a labelled ARIA switch that carries its id', () => {
  const start = src.indexOf('const Switch = (');
  const body = src.slice(start, src.indexOf('const testSound', start));
  assert.ok(body.includes('role="switch"'));
  assert.ok(body.includes('aria-checked={checked}'));
  assert.ok(body.includes('aria-label={label}'));
  assert.ok(body.includes('id={id}'), 'the id given by callers reaches the DOM');
});

test('every switch is given a label', () => {
  const uses = src.split('<Switch').slice(1).map((chunk) => chunk.slice(0, chunk.indexOf('/>')));
  assert.ok(uses.length >= 7);
  for (const use of uses) assert.ok(use.includes('label='), `unlabelled switch: ${use.slice(0, 60).trim()}`);
});

test('each daily goal button stacks its number above its name instead of running them together', () => {
  const start = src.indexOf('GOAL_TEMPLATES.map(');
  const button = src.slice(start, src.indexOf('</button>', start));
  assert.ok(button.includes('flex-col'), '.tap-target is a flex row, so the two spans need flex-col');
  assert.ok(button.includes('min-w-0'));
});
