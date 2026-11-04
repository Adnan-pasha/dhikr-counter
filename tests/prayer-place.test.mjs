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

const { renderHook, act, cleanup } = await import('@testing-library/react');
const { usePrayerPlace } = await import('../src/usePrayerPlace.ts');
const { readPrayerLocation, writePrayerLocation, CITY_PRESETS } = await import('../src/places.ts');
const { deviceTimeZone } = await import('../src/prayerTimes.ts');

let requests;
const fakeGeolocation = () => {
  requests = [];
  Object.defineProperty(dom.window.navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: (ok, fail) => requests.push({ ok, fail }) },
  });
};
const noGeolocation = () => Object.defineProperty(dom.window.navigator, 'geolocation', { configurable: true, value: undefined });

test.beforeEach(() => { localStorage.clear(); fakeGeolocation(); });
test.afterEach(() => cleanup());
test.after(() => { dom.window.close(); });

const hyderabad = CITY_PRESETS.find((c) => c.name === 'Hyderabad, India');

test('with nothing saved there is no place and GPS is asked for', () => {
  const { result } = renderHook(() => usePrayerPlace());
  assert.equal(result.current.place, null);
  assert.equal(requests.length, 1);
  assert.equal(result.current.gpsLoading, true);
});

test('a GPS fix becomes the place, is remembered, and uses the phone\'s time zone', async () => {
  const { result } = renderHook(() => usePrayerPlace());
  await act(async () => { requests[0].ok({ coords: { latitude: 17.385, longitude: 78.4867 } }); });
  assert.equal(result.current.place.lat, 17.385);
  assert.equal(result.current.place.timeZone, deviceTimeZone());
  assert.equal(result.current.place.source, 'gps');
  assert.equal(result.current.gpsLoading, false);
  assert.equal(readPrayerLocation().source, 'gps');
});

test('a refused or failed GPS leaves no place and explains what to do', async () => {
  const { result } = renderHook(() => usePrayerPlace());
  await act(async () => { requests[0].fail({ code: 1 }); });
  assert.equal(result.current.place, null);
  assert.match(result.current.gpsError, /permission|allow/i);
  await act(async () => { result.current.requestGps(); });
  await act(async () => { requests[1].fail({ code: 2 }); });
  assert.match(result.current.gpsError, /city/i);
});

test('without location support it says so and offers cities', () => {
  noGeolocation();
  const { result } = renderHook(() => usePrayerPlace());
  assert.equal(result.current.place, null);
  assert.match(result.current.gpsError, /not supported|city/i);
  assert.equal(result.current.gpsLoading, false);
});

test('a city chosen on purpose is the place, is remembered, and GPS is not asked for', () => {
  writePrayerLocation({ lat: hyderabad.lat, lng: hyderabad.lng, timeZone: hyderabad.timeZone, label: hyderabad.name }, 'city');
  const { result } = renderHook(() => usePrayerPlace());
  assert.equal(result.current.place.label, 'Hyderabad, India');
  assert.equal(requests.length, 0);
});

test('a saved GPS place is shown straight away and refreshed in the background', async () => {
  writePrayerLocation({ lat: 1, lng: 2, timeZone: 'Asia/Dubai', label: 'My location' }, 'gps');
  const { result } = renderHook(() => usePrayerPlace());
  assert.equal(result.current.place.lat, 1, 'shown before the fix arrives');
  assert.equal(result.current.place.timeZone, deviceTimeZone(), 'in the phone\'s current zone, not a stale one');
  assert.equal(requests.length, 1);
  await act(async () => { requests[0].ok({ coords: { latitude: 3, longitude: 4 } }); });
  assert.equal(result.current.place.lat, 3);
});

test('picking a city saves it, and a GPS fix that arrives afterwards does not undo it', async () => {
  const { result } = renderHook(() => usePrayerPlace());
  await act(async () => { result.current.selectCity(hyderabad); });
  assert.equal(result.current.place.label, 'Hyderabad, India');
  assert.equal(result.current.place.source, 'city');
  assert.equal(result.current.gpsLoading, false);
  await act(async () => { requests[0].ok({ coords: { latitude: 51.5, longitude: -0.12 } }); });
  assert.equal(result.current.place.label, 'Hyderabad, India');
  assert.equal(readPrayerLocation().source, 'city');
});

test('asking for GPS again after choosing a city replaces the city with the fix', async () => {
  const { result } = renderHook(() => usePrayerPlace());
  await act(async () => { result.current.selectCity(hyderabad); });
  await act(async () => { result.current.requestGps(); });
  await act(async () => { requests[requests.length - 1].ok({ coords: { latitude: 51.5, longitude: -0.12 } }); });
  assert.equal(result.current.place.source, 'gps');
  assert.equal(result.current.place.lat, 51.5);
});
