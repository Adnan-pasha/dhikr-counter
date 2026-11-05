import test, { mock } from 'node:test';
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
dom.window.Element.prototype.scrollIntoView = () => {};

const React = (await import('react')).default;
const { render, screen, fireEvent, cleanup, act } = await import('@testing-library/react');
const { default: QiblaScreen } = await import('../src/components/QiblaScreen.tsx');
const { readPrayerLocation, writePrayerLocation } = await import('../src/places.ts');

const mount = () => render(React.createElement(QiblaScreen, { theme: 'emerald' }));

test.beforeEach(() => { localStorage.clear(); });
test.afterEach(async () => {
  cleanup();
  await new Promise((resolve) => setTimeout(resolve, 20));
});
test.after(() => { dom.window.close(); });

test('with no place chosen, it asks where you are instead of assuming London', async () => {
  mount();
  assert.equal(screen.queryByText(/London/), null);
  assert.ok(screen.getAllByText('Choose your location').length > 0, 'the picker invites a choice');
});

test('choosing a city remembers it', async () => {
  mount();
  fireEvent.click(document.getElementById('city_dropdown_trigger_btn'));
  fireEvent.change(document.getElementById('city_search_text_input'), { target: { value: 'Hyderabad' } });
  fireEvent.click(screen.getByText('Hyderabad, India'));
  assert.deepEqual(
    (({ lat, lng, timeZone, source }) => ({ lat, lng, timeZone, source }))(readPrayerLocation()),
    { lat: 17.385, lng: 78.4867, timeZone: 'Asia/Kolkata', source: 'city' },
  );
});

test('a remembered city is there on the next visit', async () => {
  writePrayerLocation({ lat: 21.4225, lng: 39.8262, timeZone: 'Asia/Riyadh', label: 'Mecca (Haram), Saudi Arabia' }, 'city');
  mount();
  assert.ok(screen.getAllByText('Mecca (Haram), Saudi Arabia').length > 0);
});

test('prayer times, the calculation method and the adhan voice live on the Prayers tab, not here', async () => {
  writePrayerLocation({ lat: 21.4225, lng: 39.8262, timeZone: 'Asia/Riyadh', label: 'Mecca' }, 'city');
  mount();
  for (const id of ['btn_subtab_namaz', 'btn_subtab_qibla', 'select_calculation_agency', 'prayer_needs_location']) {
    assert.equal(document.getElementById(id), null, id);
  }
  assert.equal(screen.queryByText('Daily Namaz Timeline'), null);
  assert.equal(screen.queryByText('Namaz & Azan'), null);
  assert.ok(document.getElementById('city_dropdown_trigger_btn'), 'the city picker is still here, for the compass');
});

test('a city chosen on purpose is not overridden by GPS when the screen opens', async () => {
  writePrayerLocation({ lat: 21.4225, lng: 39.8262, timeZone: 'Asia/Riyadh', label: 'Mecca' }, 'city');
  let asked = 0;
  Object.defineProperty(dom.window.navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: () => { asked += 1; } },
  });
  mount();
  await act(async () => {});
  assert.equal(asked, 0);
});

test('a GPS fix that arrives after the user picked a city does not overwrite it', async () => {
  let deliver = null;
  Object.defineProperty(dom.window.navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: (ok) => { deliver = ok; } },
  });
  mount(); // no saved place: GPS starts on open
  await act(async () => {});
  assert.ok(deliver, 'GPS was requested');
  fireEvent.click(document.getElementById('city_dropdown_trigger_btn'));
  fireEvent.change(document.getElementById('city_search_text_input'), { target: { value: 'Hyderabad' } });
  fireEvent.click(screen.getByText('Hyderabad, India'));
  await act(async () => { deliver({ coords: { latitude: 51.5, longitude: -0.12 } }); });
  const place = readPrayerLocation();
  assert.equal(place.source, 'city');
  assert.equal(place.label, 'Hyderabad, India');
});

test('a GPS fix that arrives with nothing else chosen is saved and shown', async () => {
  let deliver = null;
  Object.defineProperty(dom.window.navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: (ok) => { deliver = ok; } },
  });
  mount();
  await act(async () => {});
  await act(async () => { deliver({ coords: { latitude: 17.385, longitude: 78.4867 } }); });
  const place = readPrayerLocation();
  assert.equal(place.source, 'gps');
  assert.equal(place.lat, 17.385);
});

test('with a GPS fix saved the screen refreshes it on open', async () => {
  writePrayerLocation({ lat: 1, lng: 2, timeZone: 'Asia/Dubai', label: 'My location' }, 'gps');
  let asked = 0;
  Object.defineProperty(dom.window.navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: () => { asked += 1; } },
  });
  mount();
  await act(async () => {});
  assert.equal(asked, 1);
});

// ── the adhan is played from the Prayers tab only ──

const played = [];
globalThis.Audio = class {
  constructor(src) { this.src = src; this.paused = true; played.push(src); }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
};

test.afterEach(() => mock.timers.reset());

test('at prayer time this screen plays nothing: the Prayers tab and the phone\'s alarms do that', async () => {
  const MECCA = { lat: 21.4225, lng: 39.8262, timeZone: 'Asia/Riyadh', label: 'Mecca' };
  const { computePrayerDay, todayKeyIn } = await import('../src/prayerTimes.ts');
  writePrayerLocation(MECCA, 'city');
  const day = computePrayerDay(MECCA, todayKeyIn(MECCA.timeZone, new Date()), { method: 'Karachi', madhab: 'shafi' });
  mock.timers.enable({ apis: ['Date'], now: day.fajr.getTime() + 20_000 });
  played.length = 0;
  mount();
  await act(async () => {});
  assert.equal(played.length, 0);
  assert.equal(screen.queryByText(/Now Broadcasting/), null);
});
