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
dom.window.Element.prototype.scrollIntoView = () => {};

const React = (await import('react')).default;
const { render, screen, fireEvent, cleanup, act } = await import('@testing-library/react');
const { default: QiblaScreen } = await import('../src/components/QiblaScreen.tsx');
const { readPrayerLocation, writePrayerLocation } = await import('../src/places.ts');

const mount = () => render(React.createElement(QiblaScreen, { theme: 'emerald', madhab: 'shafi', onMadhabChange: () => {} }));
const openTimes = () => fireEvent.click(document.getElementById('btn_subtab_namaz'));

test.beforeEach(() => { localStorage.clear(); });
test.afterEach(async () => {
  cleanup();
  await new Promise((resolve) => setTimeout(resolve, 20));
});
test.after(() => { dom.window.close(); });

test('with no place chosen, it asks where you are instead of showing London\'s times', async () => {
  mount();
  openTimes();
  assert.ok(document.getElementById('prayer_needs_location'), 'asks for a location');
  assert.equal(screen.queryByText('Daily Namaz Timeline'), null, 'no timeline for a guessed place');
  assert.equal(screen.queryByText(/London/), null);
  assert.ok(screen.getAllByText('Choose your location').length > 0, 'the picker invites a choice');
});

test('choosing a city shows its times and remembers it', async () => {
  mount();
  fireEvent.click(document.getElementById('city_dropdown_trigger_btn'));
  fireEvent.change(document.getElementById('city_search_text_input'), { target: { value: 'Hyderabad' } });
  fireEvent.click(screen.getByText('Hyderabad, India'));
  openTimes();
  assert.equal(document.getElementById('prayer_needs_location'), null);
  assert.ok(screen.getByText('Daily Namaz Timeline'));
  assert.deepEqual(
    (({ lat, lng, timeZone, source }) => ({ lat, lng, timeZone, source }))(readPrayerLocation()),
    { lat: 17.385, lng: 78.4867, timeZone: 'Asia/Kolkata', source: 'city' },
  );
});

test('a remembered city is there on the next visit, with its five prayers and sunrise', async () => {
  writePrayerLocation({ lat: 21.4225, lng: 39.8262, timeZone: 'Asia/Riyadh', label: 'Mecca (Haram), Saudi Arabia' }, 'city');
  mount();
  openTimes();
  assert.equal(document.getElementById('prayer_needs_location'), null);
  for (const name of ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']) {
    assert.ok(screen.getAllByText(name).length > 0, name);
  }
});

test('the calculation list offers every method, not just five', async () => {
  writePrayerLocation({ lat: 21.4225, lng: 39.8262, timeZone: 'Asia/Riyadh', label: 'Mecca' }, 'city');
  mount();
  openTimes();
  const select = document.getElementById('select_calculation_agency');
  assert.equal(select.querySelectorAll('option').length, 12);
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
  openTimes();
  assert.equal(document.getElementById('prayer_needs_location'), null);
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
