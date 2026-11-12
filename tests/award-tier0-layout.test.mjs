import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
const { render, cleanup } = await import('@testing-library/react');
test.after(() => { dom.window.close(); });

const { sanitizePreferences } = await import('../src/domain.ts');
const { DEFAULT_READER_SETTINGS, READER_THEMES, sanitizeReaderSettings } = await import('../src/quran/settings.ts');
const { showAlignSimulator } = await import('../src/qiblaPreview.ts');
const { surahDisplayName } = await import('../src/quran/surahs.ts');
const { default: PrayerRow } = await import('../src/components/prayers/PrayerRow.tsx');

const read = (file) => readFileSync(file, 'utf8');
const css = read('src/index.css');

// ── the colour theme picker is gone ───────────────────────────────────────────

test('Settings no longer offers colour themes that change almost nothing', () => {
  const settings = read('src/components/SettingsScreen.tsx');
  assert.doesNotMatch(settings, /Color Theme/);
  assert.doesNotMatch(settings, /theme_option_/);
  assert.doesNotMatch(settings, /Rose Desert|Tahajjud Blue|Obsidian Jet/);
});

test('a colour theme saved before the picker was removed falls back to the app colour', () => {
  const fallback = { soundOn: true, soundTone: 'wooden', vibrateOn: true, autoAdvance: true, theme: 'emerald', colorMode: 'dark', volume: 0.5, madhab: 'shafi', completionSoundOn: true, hapticStrength: 'medium', dailyGoal: 100, showTransliteration: true, showTranslation: true, leftHanded: false };
  for (const saved of ['amber', 'indigo', 'midnight', 'slate', 'emerald', 'nonsense']) {
    assert.equal(sanitizePreferences({ ...fallback, theme: saved }, fallback).theme, 'emerald');
  }
});

// ── the Quran reader follows the app's light or dark mode ─────────────────────

test('the reader starts on Auto, which follows the app', () => {
  assert.equal(DEFAULT_READER_SETTINGS.theme, 'auto');
  assert.deepEqual(READER_THEMES[0], { id: 'auto', label: 'Auto' });
});

test('Auto and every chosen reading theme survive being stored', () => {
  for (const id of ['auto', 'dark', 'paper', 'modern', 'contrast']) {
    assert.equal(sanitizeReaderSettings({ theme: id }).theme, id);
  }
});

test('Auto reads as the dark page in dark mode and as paper in light mode', () => {
  assert.match(css, /\[data-reader-theme="auto"\],\s*\[data-reader-theme="dark"\]\s*\{/);
  assert.match(css, /\[data-theme="light"\] \[data-reader-theme="auto"\],\s*\[data-reader-theme="paper"\]\s*\{/);
});

test('the paper rule for Auto comes after the dark one, so light mode wins', () => {
  assert.ok(css.indexOf('[data-theme="light"] [data-reader-theme="auto"]') > css.indexOf('[data-reader-theme="auto"],'));
});

// ── the Qibla test tool stays off phones ──────────────────────────────────────

test('the align simulator is only for a desktop preview with no compass', () => {
  assert.equal(showAlignSimulator({ liveSensors: false, coarsePointer: false }), true);
  assert.equal(showAlignSimulator({ liveSensors: false, coarsePointer: true }), false);
  assert.equal(showAlignSimulator({ liveSensors: true, coarsePointer: false }), false);
  assert.equal(showAlignSimulator({ liveSensors: true, coarsePointer: true }), false);
});

test('the Qibla screen asks before drawing the simulator or mentioning the desktop', () => {
  const qibla = read('src/components/QiblaScreen.tsx');
  assert.match(qibla, /showAlignSimulator\(/);
  assert.doesNotMatch(qibla, /\{!isLiveSensors && \(/);
  assert.match(qibla, /simulatorShown && <> Live dragging is simulated for desktop\.<\/>/);
});

// ── prayer rows do not collide on a narrow phone ──────────────────────────────

const row = (props) => render(React.createElement(PrayerRow, {
  id: 'asr', label: 'Asr', arabic: 'العصر', icon: 'asr', time: '03:37 PM', isCurrent: false, isPrayer: true, done: false, adhanOn: true,
  onToggleDone: () => {}, onToggleAdhan: () => {}, ...props,
}));

test('the name and its second line are stacked, so nothing shares a line with the time', () => {
  const { container } = row({});
  const name = container.querySelector('[data-prayer-name]');
  const second = container.querySelector('[data-prayer-sub]');
  assert.ok(name && second, 'the row has a name line and a second line');
  assert.notEqual(name.parentElement.className.includes('flex-col'), false);
  assert.equal(second.textContent, 'العصر');
  cleanup();
});

test('the prayer whose time it is says Now on the second line, in words', () => {
  const { container } = row({ isCurrent: true });
  assert.equal(container.querySelector('[data-prayer-sub]').textContent, 'Now');
  assert.equal(container.querySelector('[role="listitem"]').getAttribute('aria-current'), 'time');
  cleanup();
});

test('the time never wraps or shrinks', () => {
  const { container } = row({});
  const time = container.querySelector('[data-prayer-time]');
  assert.match(time.className, /whitespace-nowrap/);
  assert.match(time.className, /shrink-0/);
  cleanup();
});

// ── small overflows ───────────────────────────────────────────────────────────

test('Home stat cards share the row evenly and can shrink', () => {
  const home = read('src/components/HomeScreen.tsx');
  assert.match(home, /className="flex-1 min-w-0 rounded-2xl p-3"/);
});

test('a reminder shows its whole name and keeps its time on one line', () => {
  const settings = read('src/components/SettingsScreen.tsx');
  const rowSource = settings.slice(settings.indexOf('reminder_row_'), settings.indexOf('Actions (Toggle & Delete)'));
  assert.match(rowSource, /whitespace-nowrap/);
  assert.doesNotMatch(rowSource, /\{rem\.label\}<\/span>/);
  assert.match(rowSource, /break-words[^>]*>\{rem\.label\}/);
});

test('the count shortcuts in the new-dhikr form wrap instead of running off the screen', () => {
  const library = read('src/components/AdhkaarLibrary.tsx');
  const form = library.slice(library.indexOf('New Custom Dhikr'), library.indexOf('Save Dhikr'));
  assert.match(form, /flex flex-wrap gap-2 items-center/);
  assert.match(form, /min-w-0/);
});

test('a surah is named from the built-in table before the list has loaded', () => {
  assert.equal(surahDisplayName(1, []), 'Al-Faatiha');
  assert.equal(surahDisplayName(18, []), 'Al-Kahf');
  assert.equal(surahDisplayName(2, [{ number: 2, englishName: 'From the list' }]), 'From the list');
  assert.equal(surahDisplayName(999, []), 'Surah 999');
});
