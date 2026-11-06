import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
const { render, screen, cleanup } = await import('@testing-library/react');
const { default: ReminderBanner } = await import('../src/components/ReminderBanner.tsx');
const { default: QiblaScreen } = await import('../src/components/QiblaScreen.tsx');

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test.afterEach(() => cleanup());
test.after(() => { dom.window.close(); });

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// ── colour ──

test('on the light theme every badge colour reaches 4.5:1 on white and on the pale page', () => {
  const css = read('src/index.css');
  for (const name of ['amber', 'emerald', 'indigo', 'rose', 'slate', 'teal']) {
    const colour = new RegExp(`\\[data-theme="light"\\] \\.badge-${name}\\s*\\{\\s*color:\\s*(#[0-9A-Fa-f]{6})`).exec(css)?.[1];
    assert.ok(colour, `${name} has a light-theme colour`);
    assert.ok(contrast(colour, '#FFFFFF') >= 4.5, `${name} ${colour} on white: ${contrast(colour, '#FFFFFF').toFixed(2)}`);
    assert.ok(contrast(colour, '#F1F5F9') >= 4.5, `${name} ${colour} on the pale page`);
  }
});

// ── knowing which screen you are on ──

test('each screen is a main landmark with a name, the page title follows it, and focus moves to it', () => {
  const app = read('src/App.tsx');
  assert.match(app, /<motion\.main[\s\S]{0,200}aria-label=\{screenTitle\}/);
  assert.match(app, /tabIndex=\{-1\}/);
  assert.match(app, /document\.title = `\$\{screenTitle\} · Muneeb`/);
  assert.match(app, /screenRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  for (const title of ['Home', 'Tasbih', 'Adhkaar', 'Routines', 'Salah', 'Quran', 'Stats', 'Settings', 'Qibla', 'Prayers']) {
    assert.match(app, new RegExp(`'${title}'`), title);
  }
});

test('focus is not dragged to the first screen when the app opens', () => {
  assert.match(read('src/App.tsx'), /firstScreen\.current = false;\s*return;/);
});

// ── the reminder banner is announced and can be tapped ──

test('a due reminder is announced, and its buttons are big enough to hit', () => {
  const reminder = { id: 'r', dhikrId: 'x', dhikrName: 'Astaghfirullah', timeString: '05:15', days: ['mon'], label: 'Morning', isEnabled: true };
  render(React.createElement(ReminderBanner, { reminder, preferences: { soundOn: false, volume: 0.5 }, onDismiss: () => {}, onStartChanting: () => {} }));
  const banner = screen.getByRole('status');
  assert.match(banner.textContent, /Morning/);
  for (const name of ['Start', 'Dismiss reminder']) {
    assert.match(screen.getByRole('button', { name }).className, /min-h-11/, name);
  }
  assert.match(screen.getByRole('button', { name: 'Dismiss reminder' }).className, /min-w-11/);
});

// ── counter ──

test('the counter has a heading, hands focus over with focus mode, and does not read the count three times', () => {
  const counter = read('src/components/CounterScreen.tsx');
  assert.match(counter, /<h1 className="sr-only">/);
  assert.match(counter, /inert=\{isFocusMode\}/);
  assert.match(counter, /\(isFocusMode \? exitFocusModeRef : enterFocusModeRef\)\.current\?\.focus\(\)/);
  assert.match(counter, /<span aria-hidden="true" style=\{\{ fontSize: `min\(\$\{display\.countSize\}px/);
});

// ── Qibla ──

test('the Qibla dial is hidden from screen readers (its angle is text), and the alignment is announced', () => {
  localStorage.clear();
  const { container } = render(React.createElement(QiblaScreen, { theme: 'emerald' }));
  assert.equal(container.querySelector('#compass_rotator_dial').getAttribute('aria-hidden'), 'true');
  assert.ok(container.querySelector('[role="status"]'), 'the alignment text is a live region');
});

test('a location error on the Qibla screen is an alert', () => {
  assert.match(read('src/components/QiblaScreen.tsx'), /role="alert"[\s\S]{0,500}\{gpsError\}/);
});
