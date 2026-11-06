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
const { render, screen, fireEvent, cleanup, act } = await import('@testing-library/react');
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

test('the bar offers Prayers where Qibla used to be, and Qibla moves into More', () => {
  render(React.createElement(BottomNav, { activeTab: 'home', onTabChange: () => {} }));
  assert.ok(document.getElementById('tab_trigger_prayers'), 'a Prayers tab');
  assert.equal(document.getElementById('tab_trigger_qibla'), null, 'no Qibla tab in the bar');
  for (const id of ['home', 'counter', 'adhkaar', 'quran']) assert.ok(document.getElementById(`tab_trigger_${id}`), id);
  fireEvent.click(screen.getByRole('button', { name: 'More features' }));
  assert.ok(screen.getByText('Qibla'), 'Qibla is in the More menu');
});

test('choosing Qibla in More opens it, and the More button is lit while it is open', () => {
  const chosen = [];
  const { rerender } = render(React.createElement(BottomNav, { activeTab: 'home', onTabChange: (tab) => chosen.push(tab) }));
  fireEvent.click(screen.getByRole('button', { name: 'More features' }));
  fireEvent.click(screen.getByText('Qibla'));
  assert.deepEqual(chosen, ['qibla']);
  const moreLabel = () => screen.getByRole('button', { name: 'More features' }).querySelector('span.font-semibold');
  rerender(React.createElement(BottomNav, { activeTab: 'home', onTabChange: () => {} }));
  const idle = moreLabel().style.color;
  rerender(React.createElement(BottomNav, { activeTab: 'qibla', onTabChange: () => {} }));
  assert.notEqual(moreLabel().style.color, idle, 'More changes colour while Qibla is open');
  assert.match(moreLabel().style.color, /text-brand/);
});

test('the app shows the Prayers screen on its tab, and ticking there does not start the after-prayer dhikr offer', () => {
  const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /activeTab === 'prayers'/);
  assert.match(app, /togglePrayer\(date, prayer, false\)/);
  assert.match(app, /togglePrayer\(date, prayer, true\)/);
  assert.match(app, /onOpenQibla=\{\(\) => setActiveTab\('qibla'\)\}/);
});

test('Home shows the next prayer and links to Prayers', () => {
  const home = fs.readFileSync(new URL('../src/components/HomeScreen.tsx', import.meta.url), 'utf8');
  assert.match(home, /<HomeNextPrayer madhab=\{preferences\.madhab\} onOpen=\{\(\) => onNavigateTo\('prayers'\)\} \/>/);
  assert.match(home, /tab: 'prayers'/);
});

test('the bar tells a screen reader which tab is the current one, and only one', () => {
  const { rerender } = render(React.createElement(BottomNav, { activeTab: 'quran', onTabChange: () => {} }));
  const current = () => [...document.querySelectorAll('[aria-current]')].map((el) => el.id);
  assert.deepEqual(current(), ['tab_trigger_quran']);
  rerender(React.createElement(BottomNav, { activeTab: 'prayers', onTabChange: () => {} }));
  assert.deepEqual(current(), ['tab_trigger_prayers']);
});

test('the highlight is a pill that slides between tabs, and the active icon lifts', () => {
  const nav = fs.readFileSync(new URL('../src/components/BottomNav.tsx', import.meta.url), 'utf8');
  assert.match(nav, /layoutId="nav-active-pill"/);
  assert.match(nav, /data-nav-icon/, 'the icon wrapper that lifts');
  assert.match(nav, /y: isActive \? -2 : 0/);
});

test('the bar is a labelled navigation landmark', () => {
  render(React.createElement(BottomNav, { activeTab: 'home', onTabChange: () => {} }));
  const nav = screen.getByRole('navigation', { name: 'Main' });
  assert.ok(nav.querySelector('#tab_trigger_home'));
});

test('More is a real dialog: announced as expanded, focus moves in, Escape closes it and focus goes back', async () => {
  render(React.createElement(BottomNav, { activeTab: 'home', onTabChange: () => {} }));
  const more = screen.getByRole('button', { name: 'More features' });
  assert.equal(more.getAttribute('aria-expanded'), 'false');
  more.focus();
  fireEvent.click(more);
  assert.equal(more.getAttribute('aria-expanded'), 'true');
  const dialog = screen.getByRole('dialog', { name: 'More features' });
  assert.equal(dialog.getAttribute('aria-modal'), 'true');
  assert.ok(screen.getByRole('heading', { name: 'More Features' }));
  assert.equal(document.activeElement, screen.getByRole('button', { name: 'Close menu' }), 'focus is inside the sheet');
  fireEvent.keyDown(document, { key: 'Escape' });
  assert.equal(document.activeElement, more, 'focus returns to the More button');
  // The sheet itself slides away over a moment (an animation jsdom does not finish), so the state is what is checked.
  assert.equal(more.getAttribute('aria-expanded'), 'false', 'announced as collapsed again');
});

test('the current item in the More menu is marked too', () => {
  render(React.createElement(BottomNav, { activeTab: 'stats', onTabChange: () => {} }));
  fireEvent.click(screen.getByRole('button', { name: 'More features' }));
  const current = [...document.querySelectorAll('[role="dialog"] [aria-current]')].map((el) => el.textContent);
  assert.equal(current.length, 1);
  assert.match(current[0], /Stats/);
});
