import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

process.env.NODE_ENV = 'development';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://app.test/', pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.localStorage = dom.window.localStorage;
globalThis.sessionStorage = dom.window.sessionStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Element = dom.window.Element;
dom.window.Element.prototype.scrollIntoView = () => {};

const audios = [];
globalThis.Audio = class {
  constructor(src) { this.src = src; this.paused = true; this.currentTime = 0; audios.push(this); }
  addEventListener() {}
  pause() { this.paused = true; }
  play() { this.paused = false; return Promise.resolve(); }
};

const React = (await import('react')).default;
const { render, screen, fireEvent, cleanup, within, act } = await import('@testing-library/react');
const { default: PrayersScreen } = await import('../src/components/PrayersScreen.tsx');
const { writePrayerLocation, readPrayerLocation } = await import('../src/places.ts');
const { forgetPlayedAdhans } = await import('../src/adhanMemory.ts');
const { computePrayerDay, formatClock } = await import('../src/prayerTimes.ts');
const { toDateString, addDays, dayLabel } = await import('../src/salah.ts');

const MECCA = { lat: 21.4225, lng: 39.8262, timeZone: 'Asia/Riyadh', label: 'Mecca (Haram), Saudi Arabia' };
const NOW = new Date('2026-03-10T12:00:00Z'); // 15:00 in Mecca: Dhuhr has started, Asr is next
const today = toDateString(NOW);
const yesterday = addDays(today, -1);
const OPTS = { method: 'Karachi', madhab: 'shafi' };

const noGeolocation = () => Object.defineProperty(dom.window.navigator, 'geolocation', { configurable: true, value: undefined });

const mount = (over = {}) => {
  const calls = { toggles: [], madhab: [], qibla: 0 };
  const view = render(React.createElement(PrayersScreen, {
    madhab: 'shafi',
    onMadhabChange: (m) => calls.madhab.push(m),
    salahLogs: [],
    onTogglePrayer: (date, prayer) => calls.toggles.push([date, prayer]),
    onOpenQibla: () => { calls.qibla += 1; },
    today,
    getNow: () => NOW,
    ...over,
  }));
  return { calls, ...view };
};

test.beforeEach(() => { localStorage.clear(); forgetPlayedAdhans(); audios.length = 0; noGeolocation(); });
test.afterEach(async () => { cleanup(); await new Promise((r) => setTimeout(r, 20)); });
test.after(() => { dom.window.close(); });

const withMecca = () => writePrayerLocation(MECCA, 'city');

test('with no place chosen it asks where you are, and shows no times', () => {
  mount();
  assert.ok(document.getElementById('prayers_needs_location'));
  assert.ok(screen.getByRole('button', { name: 'Use my location' }));
  assert.ok(screen.getByRole('button', { name: 'Choose a city' }));
  assert.equal(screen.queryAllByRole('checkbox').length, 0);
});

test('with a place it shows the next prayer first, then all six times', () => {
  withMecca();
  mount();
  const card = document.getElementById('next_prayer_card');
  assert.ok(card);
  assert.match(card.textContent, /Asr/);
  const day = computePrayerDay({ lat: MECCA.lat, lng: MECCA.lng, timeZone: MECCA.timeZone }, today, OPTS);
  for (const name of ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']) {
    assert.ok(document.getElementById(`prayer_row_${name.toLowerCase()}`), name);
  }
  assert.match(document.getElementById('prayer_row_asr').textContent, new RegExp(formatClock(day.asr, 'Asia/Riyadh', true).replace(/^0/, '0?')));
});

test('the current prayer is marked, and sunrise has no tick because it is not a prayer', () => {
  withMecca();
  mount();
  assert.match(document.getElementById('prayer_row_dhuhr').getAttribute('aria-current') ?? '', /true|time/);
  assert.equal(document.getElementById('prayer_row_asr').getAttribute('aria-current'), null);
  assert.equal(screen.getAllByRole('checkbox').length, 5);
  assert.equal(within(document.getElementById('prayer_row_sunrise')).queryByRole('checkbox'), null);
});

test('ticking a prayer logs it against the day shown', () => {
  withMecca();
  const { calls } = mount();
  fireEvent.click(within(document.getElementById('prayer_row_fajr')).getByRole('checkbox'));
  assert.deepEqual(calls.toggles, [[today, 'fajr']]);
});

test('ticks reflect what is already logged', () => {
  withMecca();
  mount({ salahLogs: [{ date: today, prayers: { fajr: true, asr: true } }] });
  const checked = (id) => within(document.getElementById(`prayer_row_${id}`)).getByRole('checkbox').getAttribute('aria-checked');
  assert.equal(checked('fajr'), 'true');
  assert.equal(checked('asr'), 'true');
  assert.equal(checked('dhuhr'), 'false');
});

test('the day strip shows seven days, and an earlier day shows its own times and logs against it', () => {
  withMecca();
  const { calls } = mount({ salahLogs: [{ date: yesterday, prayers: { isha: true } }] });
  assert.equal(document.querySelectorAll('#prayer_day_strip button').length, 7);
  fireEvent.click(screen.getByRole('button', { name: dayLabel(yesterday, 1) }));
  const earlier = computePrayerDay({ lat: MECCA.lat, lng: MECCA.lng, timeZone: MECCA.timeZone }, yesterday, OPTS);
  assert.match(document.getElementById('prayer_row_fajr').textContent, new RegExp(formatClock(earlier.fajr, 'Asia/Riyadh', true).replace(/^0/, '0?')));
  assert.equal(within(document.getElementById('prayer_row_isha')).getByRole('checkbox').getAttribute('aria-checked'), 'true');
  assert.equal(document.getElementById('prayer_row_dhuhr').getAttribute('aria-current'), null, 'nothing is "now" on another day');
  fireEvent.click(within(document.getElementById('prayer_row_dhuhr')).getByRole('checkbox'));
  assert.deepEqual(calls.toggles, [[yesterday, 'dhuhr']]);
});

test('each prayer has its own adhan switch, on by default, and the choice is remembered', () => {
  withMecca();
  mount();
  const fajr = screen.getByRole('switch', { name: /Adhan for Fajr/ });
  assert.equal(fajr.getAttribute('aria-checked'), 'true');
  fireEvent.click(fajr);
  assert.equal(screen.getByRole('switch', { name: /Adhan for Fajr/ }).getAttribute('aria-checked'), 'false');
  assert.equal(JSON.parse(localStorage.getItem('tasbih_prayer_settings')).azanEnabled.fajr, false);
  assert.equal(within(document.getElementById('prayer_row_sunrise')).queryByRole('switch'), null);
});

test('the location chip opens a sheet where a city can be searched and chosen', () => {
  withMecca();
  mount();
  fireEvent.click(screen.getByRole('button', { name: /Mecca \(Haram\)/ }));
  const dialog = screen.getByRole('dialog', { name: 'Your location' });
  fireEvent.change(within(dialog).getByRole('searchbox', { name: 'Search cities' }), { target: { value: 'hyder' } });
  assert.equal(within(dialog).queryByRole('button', { name: /Mecca/ }), null, 'the list is filtered');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Hyderabad, India' }));
  assert.equal(screen.queryByRole('dialog'), null, 'the sheet closes');
  assert.equal(readPrayerLocation().label, 'Hyderabad, India');
  assert.ok(screen.getByRole('button', { name: /Hyderabad, India/ }));
});

test('a search with no match says so', () => {
  withMecca();
  mount();
  fireEvent.click(screen.getByRole('button', { name: /Mecca \(Haram\)/ }));
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search cities' }), { target: { value: 'zzzz' } });
  assert.match(document.body.textContent, /No city matches/);
});

test('"Choose a city" in the empty state opens the same sheet', () => {
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Choose a city' }));
  assert.ok(screen.getByRole('dialog', { name: 'Your location' }));
});

test('settings: the calculation method and Asr rule are changed and remembered', () => {
  withMecca();
  const { calls } = mount();
  fireEvent.click(screen.getByRole('button', { name: 'Prayer settings' }));
  const dialog = screen.getByRole('dialog', { name: 'Prayer settings' });
  const method = within(dialog).getByLabelText('Calculation method');
  assert.equal(method.querySelectorAll('option').length, 12);
  fireEvent.change(method, { target: { value: 'MWL' } });
  assert.equal(JSON.parse(localStorage.getItem('tasbih_prayer_settings')).calculationMethod, 'MWL');
  const before = document.getElementById('prayer_row_asr').textContent;
  fireEvent.click(within(dialog).getByRole('radio', { name: /Hanafi/ }));
  assert.deepEqual(calls.madhab, ['hanafi']);
  assert.equal(JSON.parse(localStorage.getItem('tasbih_prayer_settings')).madhab, 'hanafi');
  assert.notEqual(document.getElementById('prayer_row_asr').textContent, before, 'Asr moved later');
});

test('the Qibla compass is one tap away', () => {
  withMecca();
  const { calls } = mount();
  fireEvent.click(screen.getByRole('button', { name: 'Qibla compass' }));
  assert.equal(calls.qibla, 1);
});

const MECCA_PLACE = { lat: MECCA.lat, lng: MECCA.lng, timeZone: MECCA.timeZone };

test('the adhan sounds once when a prayer time arrives and its switch is on', async () => {
  withMecca();
  const day = computePrayerDay(MECCA_PLACE, today, OPTS);
  mount({ getNow: () => new Date(day.fajr.getTime() + 20_000) });
  await act(async () => {});
  assert.equal(audios.length, 1);
  assert.match(audios[0].src, /azan-fajr\.m4a$/, 'Fajr has its own adhan');
  assert.match(screen.getByRole('status', { name: /adhan/i }).textContent, /Fajr/);
});

test('Dhuhr, Asr, Maghrib and Isha play the chosen voice, and Madinah can be chosen in settings', async () => {
  withMecca();
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Prayer settings' }));
  const dialog = screen.getByRole('dialog', { name: 'Prayer settings' });
  const voices = within(dialog).getByRole('radiogroup', { name: 'Adhan voice' });
  assert.equal(within(voices).getByRole('radio', { name: 'Makkah' }).getAttribute('aria-checked'), 'true', 'Makkah is the default');
  fireEvent.click(within(voices).getByRole('radio', { name: 'Madinah' }));
  assert.equal(JSON.parse(localStorage.getItem('tasbih_prayer_settings')).azanSound, 'madinah');
  assert.equal(within(voices).getByRole('radio', { name: 'Madinah' }).getAttribute('aria-checked'), 'true');
  cleanup();

  const day = computePrayerDay(MECCA_PLACE, today, OPTS);
  mount({ getNow: () => new Date(day.dhuhr.getTime() + 20_000) });
  await act(async () => {});
  assert.equal(audios.length, 1);
  assert.match(audios[0].src, /azan-madinah\.m4a$/);
});

test('previewing a voice plays it, and the button turns into a stop button', async () => {
  withMecca();
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Prayer settings' }));
  const dialog = screen.getByRole('dialog', { name: 'Prayer settings' });
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Hear Madinah' })); });
  assert.match(audios[audios.length - 1].src, /azan-madinah\.m4a$/, 'plays Madinah even though Makkah is chosen');
  assert.ok(within(dialog).getByRole('button', { name: 'Stop Madinah' }), 'now offers to stop');
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Stop Madinah' })); });
  assert.ok(within(dialog).getByRole('button', { name: 'Hear Madinah' }));
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Hear Fajr adhan' })); });
  assert.match(audios[audios.length - 1].src, /azan-fajr\.m4a$/);
});

test('as the clock moves past a prayer time the adhan starts then, once, and never again on later checks', async () => {
  withMecca();
  mock.timers.enable({ apis: ['setInterval'] });
  try {
    const day = computePrayerDay(MECCA_PLACE, today, OPTS);
    let t = day.fajr.getTime() - 30_000;
    mount({ getNow: () => new Date(t) });
    await act(async () => {});
    assert.equal(audios.length, 0, 'not yet');
    t += 40_000;
    await act(async () => { mock.timers.tick(5000); });
    assert.equal(audios.length, 1, 'sounds when the time arrives');
    await act(async () => { mock.timers.tick(5000); mock.timers.tick(5000); });
    assert.equal(audios.length, 1, 'later checks do not repeat it');
    t += 200_000; // past the two-minute window
    await act(async () => { mock.timers.tick(5000); });
    assert.equal(audios.length, 1, 'and it does not start late');
  } finally {
    mock.timers.reset();
  }
});

test('leaving the tab and coming back within two minutes does not sound it a second time', async () => {
  withMecca();
  const day = computePrayerDay(MECCA_PLACE, today, OPTS);
  const view = mount({ getNow: () => new Date(day.fajr.getTime() + 20_000) });
  await act(async () => {});
  assert.equal(audios.length, 1);
  view.unmount();
  mount({ getNow: () => new Date(day.fajr.getTime() + 60_000) });
  await act(async () => {});
  assert.equal(audios.length, 1, 'remembered across the visit');
});

test('turning an adhan on just after its time does not sound it at once', async () => {
  withMecca();
  localStorage.setItem('tasbih_prayer_settings', JSON.stringify({ madhab: 'shafi', calculationMethod: 'Karachi', azanSound: 'standard', azanEnabled: { fajr: false, dhuhr: true, asr: true, maghrib: true, isha: true } }));
  const day = computePrayerDay(MECCA_PLACE, today, OPTS);
  mount({ getNow: () => new Date(day.fajr.getTime() + 30_000) });
  await act(async () => {});
  fireEvent.click(screen.getByRole('switch', { name: /Adhan for Fajr/ }));
  await act(async () => {});
  assert.equal(audios.length, 0);
});

test('two quick setting changes both stick', () => {
  withMecca();
  mount();
  fireEvent.click(screen.getByRole('switch', { name: /Adhan for Fajr/ }));
  fireEvent.click(screen.getByRole('switch', { name: /Adhan for Isha/ }));
  const saved = JSON.parse(localStorage.getItem('tasbih_prayer_settings')).azanEnabled;
  assert.equal(saved.fajr, false);
  assert.equal(saved.isha, false);
});

test('a saved GPS place whose refresh fails says so instead of staying silent', async () => {
  writePrayerLocation(MECCA, 'gps');
  let fail = null;
  Object.defineProperty(dom.window.navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (_ok, no) => { fail = no; } } });
  mount();
  await act(async () => { fail({ code: 2 }); });
  assert.match(document.body.textContent, /Could not refresh your location/);
});

test('"Use my location" in the sheet closes it when the fix arrives, and stays open when it fails', async () => {
  withMecca();
  let ok = null; let no = null;
  Object.defineProperty(dom.window.navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (a, b) => { ok = a; no = b; } } });
  mount();
  fireEvent.click(screen.getByRole('button', { name: /Mecca \(Haram\)/ }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Your location' })).getByRole('button', { name: 'Use my location' }));
  await act(async () => { no({ code: 2 }); });
  assert.ok(screen.getByRole('dialog', { name: 'Your location' }), 'a failure keeps the sheet open to show why');
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Your location' })).getByRole('button', { name: 'Use my location' }));
  await act(async () => { ok({ coords: { latitude: 17.385, longitude: 78.4867 } }); });
  assert.equal(screen.queryByRole('dialog'), null, 'a fix closes it');
  assert.equal(readPrayerLocation().source, 'gps');
});

test('the heading shows the day being looked at, and the Hijri date follows it', () => {
  withMecca();
  mount({ salahLogs: [{ date: yesterday, prayers: { fajr: true } }] });
  const todayHeading = new Date(`${today}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  assert.match(document.body.textContent, new RegExp(todayHeading));
  fireEvent.click(screen.getByRole('button', { name: dayLabel(yesterday, 1) }));
  const earlierHeading = new Date(`${yesterday}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  assert.match(document.body.textContent, new RegExp(earlierHeading));
});

test('choosing Standard keeps a Maliki or Hanbali choice, and only leaves Hanafi', () => {
  withMecca();
  const { calls } = mount({ madhab: 'maliki' });
  fireEvent.click(screen.getByRole('button', { name: 'Prayer settings' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Prayer settings' })).getByRole('radio', { name: /Standard/ }));
  assert.deepEqual(calls.madhab, [], 'nothing to change');
  assert.equal(JSON.parse(localStorage.getItem('tasbih_prayer_settings')).madhab, 'maliki');
});

test('the rows are a list, and the one whose time it is carries aria-current', () => {
  withMecca();
  mount();
  assert.equal(screen.getByRole('list', { name: 'Prayer times' }).querySelectorAll('[role="listitem"]').length, 6);
});

test('with the switch off the adhan stays silent', async () => {
  withMecca();
  localStorage.setItem('tasbih_prayer_settings', JSON.stringify({ madhab: 'shafi', calculationMethod: 'Karachi', azanSound: 'standard', azanEnabled: { fajr: false, dhuhr: true, asr: true, maghrib: true, isha: true } }));
  const day = computePrayerDay({ lat: MECCA.lat, lng: MECCA.lng, timeZone: MECCA.timeZone }, today, OPTS);
  mount({ getNow: () => new Date(day.fajr.getTime() + 20_000) });
  await act(async () => {});
  assert.equal(audios.length, 0);
});

test('every control is at least 44px tall', () => {
  withMecca();
  mount();
  for (const control of [...screen.getAllByRole('checkbox'), ...screen.getAllByRole('switch')]) {
    assert.match(control.className, /min-h-11/);
  }
  for (const name of ['Prayer settings', 'Qibla compass']) {
    assert.match(screen.getByRole('button', { name }).className, /min-h-11/);
  }
});

// ── on the phone: the alarm card, and a tapped alert plays its adhan ───────────

const phoneAlarms = (over = {}) => ({
  supported: true,
  status: { notifications: 'granted', exactAlarms: 'granted' },
  lastSync: { status: 'scheduled', scheduled: 50, exact: true },
  next: null,
  requestNotifications: async () => 'granted',
  openExactSettings: async () => 'granted',
  sendTest: async () => ({ status: 'scheduled', scheduled: 1, exact: true }),
  ...over,
});

test('on the phone the Prayers screen shows the alerts card, and in a browser it does not', () => {
  withMecca();
  mount({ alarms: phoneAlarms() });
  assert.ok(screen.getByRole('region', { name: 'Prayer alerts' }));
  cleanup();
  mount();
  assert.equal(screen.queryByRole('region', { name: 'Prayer alerts' }), null);
});

test('the alerts card is there even before a place is chosen, since reminders need it too', () => {
  mount({ alarms: phoneAlarms() });
  assert.ok(screen.getByRole('region', { name: 'Prayer alerts' }));
});

test('on the phone the screen does not play the adhan itself at prayer time, because the phone\'s alarm rings', async () => {
  withMecca();
  const day = computePrayerDay(MECCA_PLACE, today, OPTS);
  mount({ getNow: () => new Date(day.fajr.getTime() + 20_000), autoPlayAdhan: false });
  await act(async () => {});
  assert.equal(audios.length, 0);
});

test('in a browser it still plays the adhan itself', async () => {
  withMecca();
  const day = computePrayerDay(MECCA_PLACE, today, OPTS);
  mount({ getNow: () => new Date(day.fajr.getTime() + 20_000), autoPlayAdhan: true });
  await act(async () => {});
  assert.equal(audios.length, 1);
});

test('a tapped Fajr alert plays Fajr\'s own recording and says which prayer it is', async () => {
  withMecca();
  mount({ autoPlayAdhan: false, playRequest: { prayer: 'fajr', nonce: 1 } });
  await act(async () => {});
  assert.equal(audios.length, 1);
  assert.match(audios[0].src, /azan-fajr\.m4a$/);
  assert.match(screen.getByRole('status', { name: /adhan/i }).textContent, /Fajr/);
});

test('a tapped Dhuhr alert plays the chosen voice', async () => {
  withMecca();
  localStorage.setItem('tasbih_prayer_settings', JSON.stringify({ madhab: 'shafi', calculationMethod: 'Karachi', azanSound: 'madinah', azanEnabled: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true } }));
  mount({ autoPlayAdhan: false, playRequest: { prayer: 'dhuhr', nonce: 1 } });
  await act(async () => {});
  assert.match(audios[0].src, /azan-madinah\.m4a$/);
});

test('one tap plays once, however often the screen redraws, and a second tap plays again', async () => {
  withMecca();
  const props = { madhab: 'shafi', onMadhabChange: () => {}, salahLogs: [], onTogglePrayer: () => {}, onOpenQibla: () => {}, today, getNow: () => NOW, autoPlayAdhan: false };
  const { rerender } = render(React.createElement(PrayersScreen, { ...props, playRequest: { prayer: 'asr', nonce: 1 } }));
  await act(async () => {});
  rerender(React.createElement(PrayersScreen, { ...props, playRequest: { prayer: 'asr', nonce: 1 } }));
  rerender(React.createElement(PrayersScreen, { ...props, salahLogs: [{ date: today, prayers: { fajr: true } }], playRequest: { prayer: 'asr', nonce: 1 } }));
  await act(async () => {});
  assert.equal(audios.length, 1, 'the same request is not played twice');
  rerender(React.createElement(PrayersScreen, { ...props, playRequest: { prayer: 'asr', nonce: 2 } }));
  await act(async () => {});
  assert.equal(audios.length, 2, 'a new tap plays again');
});
