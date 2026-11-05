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

const React = (await import('react')).default;
const { render, screen, fireEvent, cleanup } = await import('@testing-library/react');
const { default: RoutineManager } = await import('../src/components/RoutineManager.tsx');
const { DEFAULT_ROUTINES } = await import('../src/adhkaar-data.ts');

const afterSalah = DEFAULT_ROUTINES.find((r) => r.id === 'routine-after-salah');

test.afterEach(async () => { cleanup(); await new Promise((r) => setTimeout(r, 20)); });
test.after(() => { dom.window.close(); });

const mount = (completedTodayIds = []) => {
  const started = [];
  render(React.createElement(RoutineManager, {
    routines: DEFAULT_ROUTINES, customDhikrs: [], currentDhikrId: 'subhanallah', completedTodayIds,
    onStartDhikr: (id, routineId) => started.push([id, routineId]),
    onAddRoutine: () => {}, onEditRoutine: () => {}, onDeleteRoutine: () => {}, onNavigateToAdhkaar: () => {}, onGoBack: () => {},
  }));
  fireEvent.click(screen.getAllByText('After Salah')[0]);
  return started;
};

test('Begin starts the routine that was chosen, so its own order is followed', () => {
  const started = mount();
  fireEvent.click(screen.getByRole('button', { name: /Begin After Salah/ }));
  assert.deepEqual(started, [['subhanallah', 'routine-after-salah']]);
});

test('Continue also names the routine, and starts at the first item not done yet', () => {
  const started = mount(['subhanallah', 'alhamdulillah']);
  fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
  assert.deepEqual(started, [['allahuakbar', 'routine-after-salah']]);
});

test('starting one item from the list keeps the routine too', () => {
  const started = mount(['subhanallah']);
  fireEvent.click(screen.getByRole('button', { name: 'Start reciting Alhamdulillah' }));
  assert.deepEqual(started, [['alhamdulillah', 'routine-after-salah']]);
});

test('a routine finished earlier today can be run again from its first item', () => {
  const started = mount(afterSalah.dhikrIds);
  assert.match(document.body.textContent, /Complete! Masha'Allah/);
  fireEvent.click(screen.getByRole('button', { name: /Repeat After Salah/ }));
  assert.deepEqual(started, [['subhanallah', 'routine-after-salah']]);
});

test('there is no Repeat button while the routine is still in progress', () => {
  mount(['subhanallah']);
  assert.equal(screen.queryByRole('button', { name: /Repeat/ }), null);
});

test('App keeps the routine the Routines screen started, and ends it with Finish', () => {
  const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /onStartDhikr=\{\(id, routineId\) => \{\s*setCurrentDhikrId\(id\);\s*setStartedRoutineId\(routineId\)/);
});

test('App tells the counter when the routine is complete, and Finish ends it, resets the counter and returns Home', () => {
  const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /routineComplete=\{routineComplete\}/);
  const handler = app.match(/onFinishRoutine=\{activeRoutine \? \(\) => \{([^}]*)\} : undefined\}/)?.[1] ?? '';
  assert.match(handler, /afterFinishingRoutine\(activeRoutine\)/, 'the reset comes from one tested rule');
  assert.match(handler, /setStartedRoutineId\(null\)/);
  assert.match(handler, /setCurrentCount\(reset\.count\)/);
  assert.match(handler, /setCurrentDhikrId\(reset\.dhikrId\)/);
  assert.match(handler, /setActiveTab\('home'\)/);
});

test('picking a dhikr from the library or Home starts it on its own, with no routine', () => {
  const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const home = app.match(/onStartDhikr=\{\(id\) => \{[^}]*setStartedRoutineId\(null\)/g) ?? [];
  const library = app.match(/onSelectDhikr=\{\(id\) => \{[^}]*setStartedRoutineId\(null\)/g) ?? [];
  assert.equal(home.length, 1, 'Home starts a single dhikr with no routine');
  assert.equal(library.length, 1, 'the Adhkaar library starts a single dhikr with no routine');
});

test('the running routine is remembered across a restart, and a routine listing a dhikr twice is run without repeats', () => {
  const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /useState<string \| null>\(\(\) => readStartedRoutine\(browserStorage\(\)\)\)/);
  assert.match(app, /writeStartedRoutine\(browserStorage\(\), startedRoutineId\)/);
  assert.match(app, /uniqueInOrder\(matched\.dhikrIds\)/);
});
