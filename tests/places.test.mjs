import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://app.test/' });
globalThis.window = dom.window;
globalThis.localStorage = dom.window.localStorage;

const { CITY_PRESETS, qiblaBearing, readPrayerLocation, writePrayerLocation, clearPrayerLocation, PRAYER_LOCATION_KEY } =
  await import('../src/places.ts');
const { computePrayerDay, PRAYER_EVENTS } = await import('../src/prayerTimes.ts');

test.beforeEach(() => localStorage.clear());
test.after(() => { dom.window.close(); });

test('qiblaBearing points Mecca\'s neighbours the right way', () => {
  assert.equal(qiblaBearing(51.5074, -0.1278), 119); // London, well known
  const fromNorth = qiblaBearing(40.7128, -74.006); // New York faces north-east
  assert.ok(fromNorth > 40 && fromNorth < 70, String(fromNorth));
  const fromSouth = qiblaBearing(-33.9249, 18.4241); // Cape Town faces north-east too
  assert.ok(fromSouth > 20 && fromSouth < 50, String(fromSouth));
});

test('every city has a real zone, sane coordinates, a unique name and a working prayer day', () => {
  assert.ok(CITY_PRESETS.length >= 50);
  const names = new Set();
  for (const city of CITY_PRESETS) {
    assert.ok(!names.has(city.name), `duplicate ${city.name}`);
    names.add(city.name);
    assert.ok(Math.abs(city.lat) <= 90 && Math.abs(city.lng) <= 180, city.name);
    assert.doesNotThrow(() => new Intl.DateTimeFormat('en-US', { timeZone: city.timeZone }), city.name);
    assert.equal(city.direction, qiblaBearing(city.lat, city.lng));
    const day = computePrayerDay(city, '2026-03-10', { method: 'MWL', madhab: 'shafi' });
    for (const e of PRAYER_EVENTS) assert.ok(Number.isFinite(day[e].getTime()), `${city.name} ${e}`);
  }
});

test('nothing is stored until a place is chosen, and there is no default place', () => {
  assert.equal(readPrayerLocation(), null);
});

test('a chosen place survives a reload', () => {
  writePrayerLocation({ lat: 17.385, lng: 78.4867, timeZone: 'Asia/Kolkata', label: 'Hyderabad, India' }, 'city');
  assert.deepEqual(readPrayerLocation(), { lat: 17.385, lng: 78.4867, timeZone: 'Asia/Kolkata', label: 'Hyderabad, India', source: 'city' });
});

test('the source is remembered so the app knows whether to refresh from GPS', () => {
  writePrayerLocation({ lat: 1, lng: 2, timeZone: 'Asia/Dubai' }, 'gps');
  assert.equal(readPrayerLocation().source, 'gps');
});

test('bad stored data reads as no place', () => {
  localStorage.setItem(PRAYER_LOCATION_KEY, '{not json');
  assert.equal(readPrayerLocation(), null);
  localStorage.setItem(PRAYER_LOCATION_KEY, JSON.stringify({ lat: 999, lng: 0, timeZone: 'Asia/Dubai' }));
  assert.equal(readPrayerLocation(), null);
});

test('an unknown source is stored as a city, never trusted', () => {
  localStorage.setItem(PRAYER_LOCATION_KEY, JSON.stringify({ lat: 1, lng: 2, timeZone: 'Asia/Dubai', source: 'hacker' }));
  assert.equal(readPrayerLocation().source, 'city');
});

test('writing an unusable place stores nothing and says so', () => {
  assert.equal(writePrayerLocation({ lat: 'x', lng: 0, timeZone: 'Asia/Dubai' }, 'city'), null);
  assert.equal(localStorage.getItem(PRAYER_LOCATION_KEY), null);
});

test('clearPrayerLocation forgets the place', () => {
  writePrayerLocation({ lat: 1, lng: 2, timeZone: 'Asia/Dubai' }, 'city');
  clearPrayerLocation();
  assert.equal(readPrayerLocation(), null);
});

test('storage that throws never breaks the screen', () => {
  const real = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('blocked'); } });
  try {
    assert.equal(readPrayerLocation(), null);
    assert.equal(writePrayerLocation({ lat: 1, lng: 2, timeZone: 'Asia/Dubai' }, 'city'), null);
  } finally {
    Object.defineProperty(globalThis, 'localStorage', real);
  }
});
