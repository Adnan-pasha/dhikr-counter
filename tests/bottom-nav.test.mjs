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

const React = (await import('react')).default;
const { render, screen, fireEvent, cleanup } = await import('@testing-library/react');
const { default: BottomNav } = await import('../src/components/BottomNav.tsx');
const { getBackStack } = await import('../src/backStack.ts');

test.afterEach(async () => {
  cleanup();
  await new Promise((resolve) => setTimeout(resolve, 20));
  getBackStack().reset();
});
test.after(() => { dom.window.close(); });

const zOf = (el) => Number((el.className.match(/z-\[?(\d+)\]?/) ?? [])[1]);

test('the More menu and its backdrop sit above every screen, including the Qibla location box (z-45)', () => {
  render(React.createElement(BottomNav, { activeTab: 'qibla', onTabChange: () => {} }));
  fireEvent.click(screen.getByRole('button', { name: 'More features' }));
  const backdrop = document.querySelector('.backdrop-blur-sm');
  const sheet = screen.getByText('More Features').closest('[class*="rounded-t-3xl"]');
  assert.ok(backdrop && sheet, 'both are shown');
  assert.ok(zOf(backdrop) > 50, `backdrop z ${zOf(backdrop)} must clear the screens' own layers`);
  assert.ok(zOf(sheet) > zOf(backdrop), 'the menu is above its backdrop');
});

test('left-handed mirrors the bar, so the first tab is nearest the left thumb', () => {
  const { container, rerender } = render(React.createElement(BottomNav, { activeTab: 'home', onTabChange: () => {}, leftHanded: false }));
  const bar = () => container.querySelector('#tab_trigger_home').parentElement;
  assert.doesNotMatch(bar().className, /flex-row-reverse/);
  rerender(React.createElement(BottomNav, { activeTab: 'home', onTabChange: () => {}, leftHanded: true }));
  assert.match(bar().className, /flex-row-reverse/);
});

test('left-handed also puts the More menu\'s close button on the left', () => {
  render(React.createElement(BottomNav, { activeTab: 'home', onTabChange: () => {}, leftHanded: true }));
  fireEvent.click(screen.getByRole('button', { name: 'More features' }));
  const header = screen.getByText('More Features').parentElement;
  assert.match(header.className, /flex-row-reverse/);
});

test('the app passes the left-handed preference to the bar', () => {
  const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /leftHanded=\{preferences\.leftHanded\}/);
});
