import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

process.env.NODE_ENV = 'development';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://app.test/', pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.localStorage = dom.window.localStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Element = dom.window.Element;
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);

const React = (await import('react')).default;
const { render, screen, fireEvent, cleanup } = await import('@testing-library/react');
const { default: CounterScreen } = await import('../src/components/CounterScreen.tsx');
const { ADHKAAR_LIBRARY } = await import('../src/adhkaar-data.ts');

const darood = ADHKAAR_LIBRARY.find((d) => d.id === 'darood-ibrahim');
const kursi = ADHKAAR_LIBRARY.find((d) => d.id === 'ayatul-kursi');
const PREFS = {
  soundOn: false, soundTone: 'wooden', vibrateOn: false, autoAdvance: true, theme: 'emerald', colorMode: 'dark', volume: 0.5,
  madhab: 'shafi', completionSoundOn: false, hapticStrength: 'medium', dailyGoal: 100, showTransliteration: true,
  showTranslation: true, leftHanded: false,
};

const mount = (over = {}) => {
  const calls = { taps: 0, finished: 0 };
  render(React.createElement(CounterScreen, {
    currentDhikr: darood, currentCount: 4, history: [], preferences: PREFS,
    onIncrement: () => { calls.taps += 1; }, onUndo: () => {}, canUndo: true, onReset: () => {}, onToggleSound: () => {},
    onNavigateToLibrary: () => {}, upcoming: [], pendingNext: null,
    onFinishRoutine: () => { calls.finished += 1; },
    ...over,
  }));
  return calls;
};

test.afterEach(async () => { cleanup(); await new Promise((r) => setTimeout(r, 20)); });
test.after(() => { dom.window.close(); });

const textRegion = () => document.getElementById('dhikr_text');
const stage = () => document.getElementById('tap_bead_clicker');
const ringGroup = () => document.getElementById('counter_ring_group');

// ── the count is always on screen, however long the text ──────────────────────

test('a long dhikr scrolls inside its own area, so it can never push the count off the screen', () => {
  mount();
  assert.ok(textRegion(), 'the text has its own area');
  assert.match(textRegion().className, /overflow-y-auto/);
  assert.match(textRegion().className, /min-h-0/, 'it can shrink');
  assert.match(textRegion().className, /flex-1/, 'it takes whatever space is left');
  assert.ok(textRegion().textContent.includes(darood.nameAr.slice(0, 20)), 'the whole Arabic text is inside it');
});

test('the tap layer is a plain button with nothing inside it but ripples, so nothing is nested in a button', () => {
  mount({ currentCount: 10, routineComplete: true });
  assert.equal(stage().querySelectorAll('button, [tabindex], a, input').length, 0, 'no interactive element inside the tap button');
  assert.equal(stage().contains(textRegion()), false, 'the text is a sibling, not a child');
  assert.equal(stage().contains(ringGroup()), false, 'so is the count');
  assert.equal(stage().contains(screen.getByRole('button', { name: 'Finish' })), false, 'and so is Finish');
});

test('the dhikr text is a labelled, focusable region, so a screen reader and the keyboard can reach and scroll it', () => {
  mount();
  const region = textRegion();
  assert.equal(region.getAttribute('role'), 'region');
  assert.equal(region.getAttribute('aria-label'), 'Dhikr text');
  assert.equal(region.getAttribute('tabindex'), '0');
  assert.equal(region.querySelector('[lang="ar"]')?.getAttribute('dir'), 'rtl', 'the Arabic is marked as such');
});

test('Space on the focused text scrolls it instead of counting a bead', () => {
  const calls = mount();
  textRegion().focus();
  fireEvent.keyDown(textRegion(), { code: 'Space', key: ' ' });
  assert.equal(calls.taps, 0);
});

test('Space with nothing focused still counts', () => {
  const calls = mount();
  fireEvent.keyDown(document.body, { code: 'Space', key: ' ' });
  assert.equal(calls.taps, 1);
});

test('the ring, the count and the remaining line are in a block that never shrinks away', () => {
  mount();
  assert.match(ringGroup().className, /shrink-0/);
  assert.ok(ringGroup().textContent.includes('4'), 'the count');
  assert.ok(ringGroup().textContent.includes('/10'), 'the target');
  assert.match(ringGroup().textContent, /6 remaining/);
  assert.equal(textRegion().contains(ringGroup()), false, 'the count is not inside the scrolling text');
});

test('the Arabic, transliteration and translation all stay readable by scrolling, not cut off', () => {
  mount();
  const text = textRegion().textContent;
  assert.ok(text.includes('Allāhumma'), 'transliteration');
  assert.ok(text.includes('Full of Praise'), 'translation to its last words');
});

test('long Ayatul Kursi is shown in full', () => {
  mount({ currentDhikr: kursi, currentCount: 0 });
  assert.ok(textRegion().textContent.includes(kursi.nameAr), 'every word of the verse');
  assert.match(textRegion().textContent, /the Most High, the Most Great/);
});

// ── scrolling the text does not count; tapping it does ────────────────────────

test('touching the text to scroll it does not count a bead', () => {
  const calls = mount();
  fireEvent.pointerDown(textRegion(), { pointerType: 'touch', isPrimary: true });
  assert.equal(calls.taps, 0);
});

test('a tap on the text (a click, which a scroll never produces) counts exactly one bead', () => {
  const calls = mount();
  fireEvent.click(textRegion(), { detail: 1 });
  assert.equal(calls.taps, 1);
});

test('a click on the text from assistive technology (no pointer) also counts exactly one bead, never two', () => {
  const calls = mount();
  fireEvent.click(textRegion(), { detail: 0 });
  assert.equal(calls.taps, 1);
});

test('touching anywhere else on the stage still counts on touch-down', () => {
  const calls = mount();
  fireEvent.pointerDown(stage(), { pointerType: 'touch', isPrimary: true });
  assert.equal(calls.taps, 1);
});

test('a click that follows a counted touch-down is not counted again', () => {
  const calls = mount();
  fireEvent.pointerDown(stage(), { pointerType: 'touch', isPrimary: true });
  fireEvent.click(stage(), { detail: 1 });
  assert.equal(calls.taps, 1);
});

test('a keyboard or screen-reader activation (a click with no pointer) counts once', () => {
  const calls = mount();
  fireEvent.click(stage(), { detail: 0 });
  assert.equal(calls.taps, 1);
});

// ── finishing a routine ───────────────────────────────────────────────────────

test('when the routine is finished it says so and offers Finish', () => {
  const calls = mount({ currentCount: 10, routineComplete: true });
  assert.match(screen.getAllByText(/Routine complete/)[0].textContent, /Routine complete/);
  const finish = screen.getByRole('button', { name: 'Finish' });
  assert.match(finish.className, /tap-target|min-h-11/);
  fireEvent.pointerDown(finish, { pointerType: 'touch', isPrimary: true });
  fireEvent.click(finish, { detail: 1 });
  assert.equal(calls.finished, 1);
  assert.equal(calls.taps, 0, 'pressing Finish is not a bead');
});

test('while the routine is not finished there is no Finish button and no routine message', () => {
  mount({ currentCount: 4, routineComplete: false });
  assert.equal(screen.queryByRole('button', { name: 'Finish' }), null);
  assert.equal(screen.queryByText(/Routine complete/), null);
});

test('the routine being finished is announced to screen readers', () => {
  mount({ currentCount: 10, routineComplete: true });
  const live = document.querySelector('[role="status"][aria-live="polite"]');
  assert.match(live.textContent, /Routine complete/);
});

test('with no Finish handler (a single dhikr) nothing is offered', () => {
  mount({ currentCount: 10, routineComplete: true, onFinishRoutine: undefined });
  assert.equal(screen.queryByRole('button', { name: 'Finish' }), null);
});
