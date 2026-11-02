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
const { render, screen, fireEvent, cleanup, waitFor } = await import('@testing-library/react');
const { default: QuranReader } = await import('../src/components/QuranReader.tsx');
const { EMPTY_PROGRESS } = await import('../src/quran/progress.ts');

const NO_ACTIONS = { addSeconds() {}, setGoal() {}, recordPosition() {}, startKhatam() {}, endKhatam() {}, reset() {} };
const SURAHS = { code: 200, data: [
  { number: 112, name: 'الإخلاص', englishName: 'Al-Ikhlas', englishNameTranslation: 'Sincerity', numberOfAyahs: 4, revelationType: 'Meccan' },
] };

const surahBody = (url) => ({ code: 200, data: [
  { edition: { identifier: 'quran-uthmani' }, ayahs: [{ number: 6222, numberInSurah: 1, text: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ', juz: 30, page: 604 }] },
  ...(String(url).includes('quran-simple') ? [{ edition: { identifier: 'quran-simple' }, ayahs: [{ number: 6222, numberInSurah: 1, text: 'قل هو الله أحد', juz: 30, page: 604 }] }] : []),
  { edition: { identifier: 'en.pickthall' }, ayahs: [{ number: 6222, numberInSurah: 1, text: 'Say: He is Allah, the One!', juz: 30, page: 604 }] },
] });

test.afterEach(() => { cleanup(); localStorage.clear(); });

const open = async () => {
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    if (String(url).includes('quranenc.com')) return { ok: true, json: async () => ({ translations: [] }) };
    return { ok: true, json: async () => (String(url).endsWith('/surah') ? SURAHS : surahBody(url)) };
  };
  render(React.createElement(QuranReader, {
    bookmarkedAyahs: [], lastReadSurah: 0, onBookmarkToggle: () => {}, onUpdateLastRead: () => {}, onGoBack: () => {},
    progress: EMPTY_PROGRESS, progressActions: NO_ACTIONS, today: '2026-03-20',
  }));
  fireEvent.click(await screen.findByText('Al-Ikhlas'));
  await screen.findByText('Say: He is Allah, the One!');
  return urls;
};

test('the reader header shows the current script and translation', async () => {
  await open();
  assert.ok(screen.getByRole('button', { name: /Script: Uthmani/ }));
  assert.ok(screen.getByRole('button', { name: /Translation: English: Pickthall/ }));
});

test('one tap on the script chip moves to the next script, and it wraps around', async () => {
  await open();
  fireEvent.click(screen.getByRole('button', { name: /Script: Uthmani/ }));
  assert.ok(await screen.findByRole('button', { name: /Script: Simple/ }));
  fireEvent.click(screen.getByRole('button', { name: /Script: Simple/ }));
  assert.ok(await screen.findByRole('button', { name: /Script: Tajweed/ }));
  fireEvent.click(screen.getByRole('button', { name: /Script: Tajweed/ }));
  assert.ok(await screen.findByRole('button', { name: /Script: Uthmani/ }));
});

test('the script chip reloads the text in the new script', async () => {
  const urls = await open();
  fireEvent.click(screen.getByRole('button', { name: /Script: Uthmani/ }));
  await waitFor(() => assert.ok(urls.some((u) => u.includes('quran-simple'))));
});

test('the translation chip opens the translation list straight away', async () => {
  await open();
  fireEvent.click(screen.getByRole('button', { name: /Translation: English: Pickthall/ }));
  assert.ok(await screen.findByRole('searchbox', { name: 'Search translations' }));
});
