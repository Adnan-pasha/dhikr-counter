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

const React = (await import('react')).default;
const { render, screen, fireEvent, cleanup, waitFor, act } = await import('@testing-library/react');
const { default: QuranReader } = await import('../src/components/QuranReader.tsx');
const { EMPTY_PROGRESS } = await import('../src/quran/progress.ts');
const { getBackStack } = await import('../src/backStack.ts');

const NO_ACTIONS = { addSeconds() {}, setGoal() {}, recordPosition() {}, startKhatam() {}, endKhatam() {}, reset() {} };
const SURAHS = { code: 200, data: [
  { number: 112, name: 'الإخلاص', englishName: 'Al-Ikhlas', englishNameTranslation: 'Sincerity', numberOfAyahs: 4, revelationType: 'Meccan' },
] };
const apiBody = { code: 200, data: [
  { edition: { identifier: 'quran-uthmani' }, ayahs: [{ number: 6222, numberInSurah: 1, text: 'قُلْ هُوَ', juz: 30, page: 604 }] },
  { edition: { identifier: 'en.pickthall' }, ayahs: [{ number: 6222, numberInSurah: 1, text: 'Say: He is Allah', juz: 30, page: 604 }] },
] };

test.afterEach(async () => {
  cleanup();
  localStorage.clear();
  // Let the history steps of the closed screens settle, then start the next case with a clean trail.
  await new Promise((resolve) => setTimeout(resolve, 30));
  getBackStack().reset();
});

const mount = () => {
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('quranenc.com')) return { ok: true, json: async () => ({ translations: [] }) };
    return { ok: true, json: async () => (u.endsWith('/surah') ? SURAHS : apiBody) };
  };
  const calls = { goBack: 0 };
  render(React.createElement(QuranReader, {
    bookmarkedAyahs: [], lastReadSurah: 0, onBookmarkToggle: () => {}, onUpdateLastRead: () => {}, onGoBack: () => { calls.goBack += 1; },
    progress: EMPTY_PROGRESS, progressActions: NO_ACTIONS, today: '2026-03-20',
  }));
  return calls;
};

const pressPhoneBack = async () => {
  await act(async () => {
    window.history.back();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

// ── reading settings on the Quran main screen ────────────────────────────────

test('the Quran main screen has a settings button that opens script, translation and theme', async () => {
  mount();
  await screen.findByText('Al-Ikhlas');
  fireEvent.click(screen.getByRole('button', { name: 'Reading settings' }));
  assert.ok(await screen.findByRole('dialog'));
  fireEvent.click(screen.getByRole('button', { name: 'Text' }));
  assert.ok(screen.getByRole('button', { name: /Tajweed/ }));
  assert.ok(screen.getByRole('button', { name: /Change translation/ }));
});

test('a script chosen on the main screen is the one the surah opens in', async () => {
  mount();
  await screen.findByText('Al-Ikhlas');
  fireEvent.click(screen.getByRole('button', { name: 'Reading settings' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Text' }));
  fireEvent.click(screen.getByRole('button', { name: /Simple/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Close settings' }));
  assert.equal(JSON.parse(localStorage.getItem('tasbih_reader_settings')).script, 'simple');
  fireEvent.click(screen.getByText('Al-Ikhlas'));
  assert.ok(await screen.findByRole('button', { name: /Script: Simple/ }));
});

// ── the phone's back button ──────────────────────────────────────────────────

test('back closes the settings sheet first, and the list is still there', async () => {
  const calls = mount();
  await screen.findByText('Al-Ikhlas');
  fireEvent.click(screen.getByRole('button', { name: 'Reading settings' }));
  await screen.findByRole('dialog');
  await pressPhoneBack();
  await waitFor(() => assert.equal(screen.queryByRole('dialog'), null));
  assert.ok(screen.getByText('Al-Ikhlas'));
  assert.equal(calls.goBack, 0);
});

test('back from a surah returns to the surah list, not out of the app', async () => {
  mount();
  fireEvent.click(await screen.findByText('Al-Ikhlas'));
  await screen.findByText('Say: He is Allah');
  await pressPhoneBack();
  await waitFor(() => assert.ok(screen.getByRole('button', { name: 'Reading settings' })));
  assert.equal(screen.queryByText('Say: He is Allah'), null);
});

test('back from the settings sheet inside a surah closes only the sheet', async () => {
  mount();
  fireEvent.click(await screen.findByText('Al-Ikhlas'));
  await screen.findByText('Say: He is Allah');
  fireEvent.click(screen.getByRole('button', { name: 'Reader settings' }));
  await screen.findByRole('dialog');
  await pressPhoneBack();
  await waitFor(() => assert.equal(screen.queryByRole('dialog'), null));
  assert.ok(screen.getByText('Say: He is Allah'), 'still reading');
});

test('closing the sheet with its own button does not leave a stray history step behind', async () => {
  mount();
  fireEvent.click(await screen.findByText('Al-Ikhlas'));
  await screen.findByText('Say: He is Allah');
  fireEvent.click(screen.getByRole('button', { name: 'Reader settings' }));
  await screen.findByRole('dialog');
  fireEvent.click(screen.getByRole('button', { name: 'Close settings' }));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
  await pressPhoneBack();
  await waitFor(() => assert.ok(screen.getByRole('button', { name: 'Reading settings' })), { timeout: 2000 });
  assert.equal(screen.queryByText('Say: He is Allah'), null, 'one back press leaves the surah');
});
