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

const React = (await import('react')).default;
const { render, screen, fireEvent, cleanup, act, within } = await import('@testing-library/react');
const { default: NativeAlarmsCard } = await import('../src/components/prayers/NativeAlarmsCard.tsx');

const NEXT = { id: 1, kind: 'adhan', at: new Date(2026, 2, 10, 15, 55), title: 'Asr', body: '', channelId: 'x', extra: { kind: 'adhan', prayer: 'asr', dateKey: '2026-03-10' } };
const NOW = new Date(2026, 2, 10, 12, 0);

const alarms = (over = {}) => {
  const calls = { notifications: 0, exact: 0, test: 0 };
  return {
    calls,
    supported: true,
    status: { notifications: 'granted', exactAlarms: 'granted' },
    lastSync: { status: 'scheduled', scheduled: 50, exact: true },
    next: NEXT,
    requestNotifications: async () => { calls.notifications += 1; return 'granted'; },
    openExactSettings: async () => { calls.exact += 1; return 'denied'; },
    sendTest: async () => { calls.test += 1; return { status: 'scheduled', scheduled: 1, exact: true }; },
    ...over,
  };
};
const mount = (a) => render(React.createElement(NativeAlarmsCard, { alarms: a, now: () => NOW }));

test.afterEach(() => cleanup());
test.after(() => { dom.window.close(); });

test('in a browser it shows nothing, because a page cannot ring when it is closed', () => {
  const { container } = mount(alarms({ supported: false }));
  assert.equal(container.innerHTML, '');
});

test('until the phone has answered it shows nothing rather than a wrong state', () => {
  const { container } = mount(alarms({ status: null }));
  assert.equal(container.innerHTML, '');
});

test('when everything is allowed it says alerts are on and names the next one', () => {
  mount(alarms());
  const region = screen.getByRole('region', { name: 'Prayer alerts' });
  assert.match(region.textContent, /Prayer alerts are on/);
  assert.match(region.textContent, /Next alert: Asr/);
  assert.match(region.textContent, /today/i);
  assert.match(region.textContent, /3:55\s?PM/i);
  assert.equal(within(region).queryByRole('button', { name: /Allow notifications/ }), null);
  assert.equal(within(region).queryByRole('button', { name: /Allow exact timing/ }), null);
});

test('tomorrow\'s alert says tomorrow, a later one names the day', () => {
  const tomorrow = { ...NEXT, at: new Date(2026, 2, 11, 5, 10), title: 'Fajr' };
  mount(alarms({ next: tomorrow }));
  assert.match(screen.getByRole('region', { name: 'Prayer alerts' }).textContent, /Fajr, tomorrow/i);
  cleanup();
  const later = { ...NEXT, at: new Date(2026, 2, 14, 5, 10), title: 'Fajr' };
  mount(alarms({ next: later }));
  assert.match(screen.getByRole('region', { name: 'Prayer alerts' }).textContent, /Fajr, Saturday/);
});

test('without permission to show notifications it asks, and says why', async () => {
  const a = alarms({ status: { notifications: 'prompt', exactAlarms: 'granted' }, lastSync: { status: 'no-permission', scheduled: 0 }, next: null });
  mount(a);
  const region = screen.getByRole('region', { name: 'Prayer alerts' });
  assert.match(region.textContent, /Prayer alerts are off/);
  assert.match(region.textContent, /closed/i, 'explains it is for when the app is closed');
  await act(async () => { fireEvent.click(within(region).getByRole('button', { name: 'Allow notifications' })); });
  assert.equal(a.calls.notifications, 1);
});

test('if notifications were blocked it tells the person where to turn them back on', () => {
  mount(alarms({ status: { notifications: 'denied', exactAlarms: 'granted' }, lastSync: { status: 'no-permission', scheduled: 0 }, next: null }));
  const region = screen.getByRole('region', { name: 'Prayer alerts' });
  assert.match(region.textContent, /blocked/i);
  assert.match(region.textContent, /Settings/);
  assert.ok(within(region).getByRole('button', { name: 'Allow notifications' }));
});

test('without exact timing it explains the cost and opens the system screen', async () => {
  const a = alarms({ status: { notifications: 'granted', exactAlarms: 'denied' } });
  mount(a);
  const region = screen.getByRole('region', { name: 'Prayer alerts' });
  assert.match(region.textContent, /minutes late/i);
  await act(async () => { fireEvent.click(within(region).getByRole('button', { name: 'Allow exact timing' })); });
  assert.equal(a.calls.exact, 1);
});

test('the test alert button sets one up and tells the person what to do next', async () => {
  const a = alarms();
  mount(a);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Send a test alert/ })); });
  assert.equal(a.calls.test, 1);
  assert.match(screen.getByRole('status').textContent, /10 seconds/);
  assert.match(screen.getByRole('status').textContent, /close the app/i);
});

test('a test alert without permission asks for permission instead', async () => {
  mount(alarms({ sendTest: async () => ({ status: 'no-permission', scheduled: 0 }) }));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Send a test alert/ })); });
  assert.match(screen.getByRole('status').textContent, /Allow notifications first/);
});

test('a test alert that fails says so plainly', async () => {
  mount(alarms({ sendTest: async () => ({ status: 'error', scheduled: 0, error: 'boom' }) }));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Send a test alert/ })); });
  assert.match(screen.getByRole('status').textContent, /could not be set/i);
});

test('there is help for phones that stop background alerts, naming the settings to change', () => {
  mount(alarms());
  const help = screen.getByText(/If alerts do not arrive/).closest('details');
  assert.ok(help);
  assert.match(help.textContent, /Xiaomi|POCO/);
  assert.match(help.textContent, /Autostart/);
  assert.match(help.textContent, /No restrictions/);
});

test('every control is at least 44px tall', () => {
  mount(alarms({ status: { notifications: 'prompt', exactAlarms: 'denied' } }));
  for (const button of screen.getAllByRole('button')) assert.match(button.className, /min-h-11|tap-target/, button.textContent);
});

// ── when it did not work, and how long it lasts ───────────────────────────────

test('if the alarms could not be set, the card says so and offers to try again', async () => {
  let retried = 0;
  mount(alarms({ lastSync: { status: 'error', scheduled: 0, error: 'boom' }, next: null, resync: async () => { retried += 1; } }));
  const region = screen.getByRole('region', { name: 'Prayer alerts' });
  assert.match(region.textContent, /could not be set/i);
  assert.doesNotMatch(region.textContent, /Prayer alerts are on/, 'it does not claim to be working');
  await act(async () => { fireEvent.click(within(region).getByRole('button', { name: 'Try again' })); });
  assert.equal(retried, 1);
});

test('when it worked there is no error line and no retry button', () => {
  mount(alarms());
  assert.equal(screen.queryByRole('button', { name: 'Try again' }), null);
  assert.doesNotMatch(screen.getByRole('region', { name: 'Prayer alerts' }).textContent, /could not be set/i);
});

test('the help says to open the app now and then, because alerts are set ten days ahead', () => {
  mount(alarms());
  const help = screen.getByText(/If alerts do not arrive/).closest('details');
  assert.match(help.textContent, /every 10 days|at least once every 10 days/i);
});

test('the test button says it is busy while it works, for screen readers', async () => {
  let release;
  mount(alarms({ sendTest: () => new Promise((resolve) => { release = () => resolve({ status: 'scheduled', scheduled: 1, exact: true }); }) }));
  const button = screen.getByRole('button', { name: /Send a test alert/ });
  assert.equal(button.getAttribute('aria-busy'), 'false');
  await act(async () => { fireEvent.click(button); });
  assert.equal(screen.getByRole('button', { name: /Send a test alert/ }).getAttribute('aria-busy'), 'true');
  await act(async () => { release(); });
  assert.equal(screen.getByRole('button', { name: /Send a test alert/ }).getAttribute('aria-busy'), 'false');
});
