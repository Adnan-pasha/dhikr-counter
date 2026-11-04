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

const React = (await import('react')).default;
const { render, screen, fireEvent, cleanup, act } = await import('@testing-library/react');
const { default: HomeNextPrayer } = await import('../src/components/prayers/HomeNextPrayer.tsx');
const placesModule = await import('../src/places.ts');
const { writePrayerLocation } = placesModule;

const NOW = new Date('2026-03-10T12:00:00Z'); // 15:00 in Mecca: Asr is next, at about 15:55

test.beforeEach(() => localStorage.clear());
test.afterEach(() => cleanup());
test.after(() => { dom.window.close(); });

test('with a saved place it names the next prayer and how long until it', () => {
  writePrayerLocation({ lat: 21.4225, lng: 39.8262, timeZone: 'Asia/Riyadh', label: 'Mecca' }, 'city');
  render(React.createElement(HomeNextPrayer, { madhab: 'shafi', onOpen: () => {}, getNow: () => NOW }));
  const card = screen.getByRole('button', { name: /Next prayer: Asr/ });
  assert.match(card.textContent, /Asr/);
  assert.match(card.textContent, /in \d+h \d+m|in \d+m/);
  assert.match(card.textContent, /\d{1,2}:\d{2}\s?[AP]M/i);
});

test('tapping it opens the Prayers tab', () => {
  writePrayerLocation({ lat: 21.4225, lng: 39.8262, timeZone: 'Asia/Riyadh', label: 'Mecca' }, 'city');
  let opened = 0;
  render(React.createElement(HomeNextPrayer, { madhab: 'shafi', onOpen: () => { opened += 1; }, getNow: () => NOW }));
  fireEvent.click(screen.getByRole('button', { name: /Next prayer/ }));
  assert.equal(opened, 1);
});

test('with no place it invites setting prayer times up, and never guesses a city', () => {
  let opened = 0;
  render(React.createElement(HomeNextPrayer, { madhab: 'shafi', onOpen: () => { opened += 1; }, getNow: () => NOW }));
  const card = screen.getByRole('button', { name: /Set up prayer times/ });
  assert.equal(screen.queryByText(/London/), null);
  fireEvent.click(card);
  assert.equal(opened, 1);
});

test('it uses the app\'s Asr rule, even before the Prayers tab has ever saved one', () => {
  writePrayerLocation({ lat: 21.4225, lng: 39.8262, timeZone: 'Asia/Riyadh', label: 'Mecca' }, 'city');
  const timeOf = () => screen.getByRole('button', { name: /Next prayer/ }).textContent.match(/\d{1,2}:\d{2}\s?[AP]M/i)[0];
  const { unmount } = render(React.createElement(HomeNextPrayer, { madhab: 'shafi', onOpen: () => {}, getNow: () => NOW }));
  const standard = timeOf();
  unmount();
  render(React.createElement(HomeNextPrayer, { madhab: 'hanafi', onOpen: () => {}, getNow: () => NOW }));
  assert.notEqual(timeOf(), standard, 'Hanafi Asr is later');
});

test('it follows the saved calculation method', () => {
  writePrayerLocation({ lat: 21.4225, lng: 39.8262, timeZone: 'Asia/Riyadh', label: 'Mecca' }, 'city');
  // Fajr is the next prayer at 00:30, and its time depends on the method's twilight angle (Karachi 18, ISNA 15).
  const lateNight = new Date('2026-03-10T21:30:00Z');
  const timeOf = () => screen.getByRole('button', { name: /Next prayer/ }).textContent.match(/\d{1,2}:\d{2}\s?[AP]M/i)[0];
  const { unmount } = render(React.createElement(HomeNextPrayer, { madhab: 'shafi', onOpen: () => {}, getNow: () => lateNight }));
  assert.match(screen.getByRole('button', { name: /Next prayer/ }).textContent, /Fajr/);
  const karachi = timeOf();
  unmount();
  localStorage.setItem('tasbih_prayer_settings', JSON.stringify({ madhab: 'shafi', calculationMethod: 'ISNA', azanSound: 'standard', azanEnabled: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true } }));
  render(React.createElement(HomeNextPrayer, { madhab: 'shafi', onOpen: () => {}, getNow: () => lateNight }));
  assert.notEqual(timeOf(), karachi, 'a different method gives a different Fajr');
});

test('as time passes the card moves on to the following prayer instead of freezing', () => {
  writePrayerLocation({ lat: 21.4225, lng: 39.8262, timeZone: 'Asia/Riyadh', label: 'Mecca' }, 'city');
  mock.timers.enable({ apis: ['setInterval'] });
  try {
    let t = NOW.getTime(); // 15:00 in Mecca, Asr next
    render(React.createElement(HomeNextPrayer, { madhab: 'shafi', onOpen: () => {}, getNow: () => new Date(t) }));
    assert.match(screen.getByRole('button', { name: /Next prayer/ }).textContent, /Asr/);
    t += 2 * 3600_000; // 17:00: Asr has passed, Maghrib is next
    act(() => { mock.timers.tick(30_000); });
    const card = screen.getByRole('button', { name: /Next prayer/ });
    assert.match(card.textContent, /Maghrib/);
    assert.doesNotMatch(card.textContent, /in 0s/);
  } finally {
    mock.timers.reset();
  }
});

test('after Isha the card shows tomorrow\'s Fajr', () => {
  writePrayerLocation({ lat: 21.4225, lng: 39.8262, timeZone: 'Asia/Riyadh', label: 'Mecca' }, 'city');
  const lateNight = new Date('2026-03-10T21:30:00Z'); // 00:30 in Mecca
  render(React.createElement(HomeNextPrayer, { madhab: 'shafi', onOpen: () => {}, getNow: () => lateNight }));
  assert.match(screen.getByRole('button', { name: /Next prayer/ }).textContent, /Fajr/);
});

test('a saved GPS place is read in the phone\'s current zone, the same as on the Prayers tab', () => {
  writePrayerLocation({ lat: 21.4225, lng: 39.8262, timeZone: 'Pacific/Auckland', label: 'My location' }, 'gps');
  const { readPrayerPlace } = placesModule;
  assert.equal(readPrayerPlace().timeZone, Intl.DateTimeFormat().resolvedOptions().timeZone);
});

test('the card is at least 44px tall', () => {
  writePrayerLocation({ lat: 21.4225, lng: 39.8262, timeZone: 'Asia/Riyadh', label: 'Mecca' }, 'city');
  render(React.createElement(HomeNextPrayer, { madhab: 'shafi', onOpen: () => {}, getNow: () => NOW }));
  assert.match(screen.getByRole('button', { name: /Next prayer/ }).className, /min-h-11/);
});
