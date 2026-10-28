import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

process.env.NODE_ENV = 'development';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://app.test/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import('react')).default;
const { render, screen, fireEvent, cleanup, act } = await import('@testing-library/react');
const { default: SalahTracker } = await import('../src/components/SalahTracker.tsx');
const { default: OnboardingFlow } = await import('../src/components/OnboardingFlow.tsx');

const routine = { id: 'routine-after-salah', name: 'After Salah', icon: 'dua', dhikrIds: ['a', 'b', 'c'], createdAt: '2026-01-01T00:00:00.000Z' };

test.afterEach(() => cleanup());

const mountSalah = (props = {}) => {
  const calls = { start: 0, dismiss: 0 };
  render(React.createElement(SalahTracker, {
    salahLogs: [], onTogglePrayer: () => {}, onGoBack: () => {},
    afterSalah: { prayer: 'asr', routine },
    onStartAfterSalah: () => { calls.start += 1; },
    onDismissAfterSalah: () => { calls.dismiss += 1; },
    ...props,
  }));
  return calls;
};

test('after a prayer is logged the tracker offers the after-salah dhikr', () => {
  const calls = mountSalah();
  const prompt = document.getElementById('after_salah_prompt');
  assert.equal(prompt.getAttribute('role'), 'status');
  assert.match(prompt.textContent, /Asr logged/);
  assert.match(prompt.textContent, /3 adhkaar/);
  fireEvent.click(document.getElementById('btn_start_after_salah'));
  assert.equal(calls.start, 1);
});

test('the offer can be dismissed', () => {
  const calls = mountSalah();
  fireEvent.click(document.getElementById('btn_dismiss_after_salah'));
  assert.equal(calls.dismiss, 1);
});

test('no offer without a pending prayer or when the routine was deleted', () => {
  mountSalah({ afterSalah: null });
  assert.equal(document.getElementById('after_salah_prompt'), null);
  cleanup();
  mountSalah({ afterSalah: { prayer: 'asr', routine: null } });
  assert.equal(document.getElementById('after_salah_prompt'), null);
});

// Step transitions use AnimatePresence, whose exit never completes in jsdom; the click-through is
// covered in a real browser. Here the contract is checked at the source level.
test('onboarding has a goal step built from the goal templates and returns the goal on every exit', () => {
  const src = fs.readFileSync(new URL('../src/components/OnboardingFlow.tsx', import.meta.url), 'utf8');
  assert.ok(src.includes('GOAL_TEMPLATES.map'));
  assert.ok(src.includes('aria-label="Daily goal"'));
  assert.ok(src.includes('useState<number>(defaultGoal)'));
  // Every call that finishes onboarding ends with the goal argument.
  const calls = src.split('onComplete(').slice(1).map((rest) => rest.slice(0, rest.indexOf(';')));
  const exits = calls.filter((c) => !c.includes('=>') && !c.includes('...'));
  assert.ok(exits.length >= 5, 'found the exit paths');
  for (const call of exits) {
    assert.ok(call.includes(', goal)') || call.includes(', defaultGoal)'), call);
  }
});

test('skipping onboarding keeps the goal already in use', () => {
  const done = [];
  render(React.createElement(OnboardingFlow, { defaultMadhab: 'shafi', defaultGoal: 300, onComplete: (...args) => done.push(args) }));
  fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
  assert.deepEqual(done, [['shafi', 'skipped', 300]]);
});

test('App wires the started routine and the after-salah offer', () => {
  const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /resolveActiveRoutine\(routines, startedRoutineId, currentDhikrId\)/);
  assert.match(app, /setStartedRoutineId\(routineId\)/);
  assert.match(app, /setStartedRoutineId\(null\)/, 'picking a single dhikr clears the started routine');
  assert.ok(app.includes('togglePrayerLog(salahLogsRef.current'), 'prayer taps compose against the latest logs');
  assert.ok(app.includes('setCurrentDhikrId: setCurrentDhikrIdAndForgetRoutine'));
  assert.match(app, /if \(activeTab !== 'salah'\) setAfterSalahPrayer\(null\)/);
});
