import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://app.test/' });
globalThis.window = dom.window;
globalThis.localStorage = dom.window.localStorage;

const { announcePrayerConfigChange, onPrayerConfigChange } = await import('../src/prayerConfigEvents.ts');
const { writePrayerLocation, clearPrayerLocation } = await import('../src/places.ts');
const { writePrayerSettings, readPrayerSettings, DEFAULT_PRAYER_SETTINGS } = await import('../src/domain.ts');

test.beforeEach(() => localStorage.clear());
test.after(() => { dom.window.close(); });

const listen = () => {
  const seen = { count: 0 };
  const stop = onPrayerConfigChange(() => { seen.count += 1; });
  return { seen, stop };
};

test('a listener hears an announced change, and stops hearing once removed', () => {
  const { seen, stop } = listen();
  announcePrayerConfigChange();
  assert.equal(seen.count, 1);
  stop();
  announcePrayerConfigChange();
  assert.equal(seen.count, 1);
});

test('choosing a place is announced', () => {
  const { seen, stop } = listen();
  writePrayerLocation({ lat: 21.4, lng: 39.8, timeZone: 'Asia/Riyadh', label: 'Mecca' }, 'city');
  assert.equal(seen.count, 1);
  stop();
});

test('a place that was not saved is not announced', () => {
  const { seen, stop } = listen();
  writePrayerLocation({ lat: 'x', lng: 0, timeZone: 'Asia/Riyadh' }, 'city');
  assert.equal(seen.count, 0);
  stop();
});

test('forgetting the place is announced', () => {
  writePrayerLocation({ lat: 21.4, lng: 39.8, timeZone: 'Asia/Riyadh' }, 'city');
  const { seen, stop } = listen();
  clearPrayerLocation();
  assert.equal(seen.count, 1);
  stop();
});

test('changing a prayer setting (an adhan switch, the method) is announced', () => {
  const { seen, stop } = listen();
  writePrayerSettings({ ...DEFAULT_PRAYER_SETTINGS, calculationMethod: 'MWL' });
  assert.equal(seen.count, 1);
  stop();
});

test('merely reading the settings is not a change, so opening a screen never causes a resync', () => {
  const { seen, stop } = listen();
  readPrayerSettings();
  readPrayerSettings();
  assert.equal(seen.count, 0);
  stop();
});
