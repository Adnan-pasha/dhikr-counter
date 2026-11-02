import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
const { default: AyahCard } = await import('../src/components/AyahCard.tsx');
const { default: ReaderSettingsSheet } = await import('../src/components/ReaderSettingsSheet.tsx');
const { DEFAULT_READER_SETTINGS } = await import('../src/quran/settings.ts');
const { EMPTY_PROGRESS } = await import('../src/quran/progress.ts');
const { clearIndopakCache, BASMALA_INDOPAK, INDOPAK_END_MARK } = await import('../src/quran/indopak.ts');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = JSON.parse(fs.readFileSync(path.join(root, 'src/quran/data/indopak-digitalkhatt.json'), 'utf8'));
const NO_ACTIONS = { addSeconds() {}, setGoal() {}, recordPosition() {}, startKhatam() {}, endKhatam() {}, reset() {} };
const indopakSettings = { ...DEFAULT_READER_SETTINGS, script: 'indopak' };

test.afterEach(() => { cleanup(); localStorage.clear(); clearIndopakCache(); });

// ── the ayah card ────────────────────────────────────────────────────────────

const ikhlas = FILE.surahs[111][0];
const mountCard = (props = {}) => render(React.createElement(AyahCard, {
  ayah: { number: 6222, numberInSurah: 1, arabic: ikhlas, arabicSegments: null, translation: null, footnotes: null, transliteration: null, juz: 30, page: 604 },
  surahName: 'Al-Ikhlas', surahNumber: 112, settings: indopakSettings, bookmarked: false,
  onToggleBookmark: () => {}, onCopy: () => {}, ...props,
}));

test('an IndoPak ayah uses the IndoPak font and its own numbered ornament, not a second number', () => {
  mountCard();
  const arabic = document.querySelector('p[lang="ar"]');
  assert.ok(arabic.className.includes('font-indopak'));
  assert.ok(!arabic.className.includes('font-quran'));
  assert.equal(arabic.querySelector('[aria-hidden="true"]').textContent, ikhlas, 'the text is shown exactly as in the file');
  assert.ok(!arabic.textContent.includes('\uFD3F'), 'no extra ornament is added');
});

test('a screen reader hears the words once, without the ornament and number the font draws', () => {
  mountCard();
  const arabic = document.querySelector('p[lang="ar"]');
  const spoken = [...arabic.children].filter((c) => c.getAttribute('aria-hidden') !== 'true').map((c) => c.textContent).join('');
  assert.ok(spoken.length > 0 && !spoken.includes(INDOPAK_END_MARK));
});

test('text that was built in one script keeps that script\'s font until the new text arrives', () => {
  // The reader keeps the old text on screen while a new script loads; the setting has already changed.
  mountCard({ ayah: { number: 6222, numberInSurah: 1, script: 'uthmani', arabic: '\u0642\u0644', arabicSegments: null, translation: null, footnotes: null, transliteration: null, juz: 30, page: 604 } });
  const arabic = document.querySelector('p[lang="ar"]');
  assert.ok(arabic.className.includes('font-quran') && !arabic.className.includes('font-indopak'));
  assert.ok(arabic.textContent.includes('\uFD3F'), 'its own number ornament stays');
});

test('copying Al-Fatiha 1:7 leaves out the direction override the file carries', () => {
  const copied = [];
  mountCard({ onCopy: (t) => copied.push(t), ayah: { number: 7, numberInSurah: 7, arabic: FILE.surahs[0][6], arabicSegments: null, translation: null, footnotes: null, transliteration: null, juz: 1, page: 1 }, surahNumber: 1, surahName: 'Al-Faatiha' });
  fireEvent.click(screen.getByRole('button', { name: /actions/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Copy ayah' }));
  assert.ok(!/[\u202A-\u202E\u2066-\u2069]/.test(copied[0]));
});

test('other scripts keep the Quran font and their own number', () => {
  mountCard({ settings: DEFAULT_READER_SETTINGS });
  const arabic = document.querySelector('p[lang="ar"]');
  assert.ok(arabic.className.includes('font-quran'));
  assert.ok(arabic.textContent.includes('﴿'));
});

test('copying an IndoPak ayah gives the words without the ornament', () => {
  const copied = [];
  mountCard({ onCopy: (t) => copied.push(t) });
  fireEvent.click(screen.getByRole('button', { name: /actions/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Copy ayah' }));
  assert.ok(!copied[0].includes(INDOPAK_END_MARK));
  assert.match(copied[0], /— Al-Ikhlas 112:1$/);
});

// ── choosing it ──────────────────────────────────────────────────────────────

test('the script cards offer IndoPak with a preview in its own font', () => {
  const patches = [];
  render(React.createElement(ReaderSettingsSheet, { open: true, onClose: () => {}, settings: DEFAULT_READER_SETTINGS, onChange: (p) => patches.push(p) }));
  fireEvent.click(screen.getByRole('button', { name: 'Text' }));
  const card = screen.getByRole('button', { name: /IndoPak/ });
  assert.ok(card.querySelector('.font-indopak'));
  fireEvent.click(card);
  assert.deepEqual(patches, [{ script: 'indopak' }]);
});

// ── the reader end to end ────────────────────────────────────────────────────

const SURAHS = { code: 200, data: [
  { number: 112, name: 'الإخلاص', englishName: 'Al-Ikhlas', englishNameTranslation: 'Sincerity', numberOfAyahs: 4, revelationType: 'Meccan' },
] };
const apiBody = { code: 200, data: [
  { edition: { identifier: 'quran-uthmani' }, ayahs: [1, 2, 3, 4].map((n) => ({ number: 6221 + n, numberInSurah: n, text: `uthmani-${n}`, juz: 30, page: 604 })) },
  { edition: { identifier: 'en.pickthall' }, ayahs: [1, 2, 3, 4].map((n) => ({ number: 6221 + n, numberInSurah: n, text: `Pickthall ${n}`, juz: 30, page: 604 })) },
] };

const open = async ({ indopakResponse }) => {
  localStorage.setItem('tasbih_reader_settings', JSON.stringify({ script: 'indopak' }));
  const urls = [];
  globalThis.fetch = async (url) => {
    const u = String(url);
    urls.push(u);
    if (u.includes('indopak-digitalkhatt')) return indopakResponse();
    if (u.includes('quranenc.com')) return { ok: true, json: async () => ({ translations: [] }) };
    return { ok: true, json: async () => (u.endsWith('/surah') ? SURAHS : apiBody) };
  };
  render(React.createElement(QuranReader, {
    bookmarkedAyahs: [], lastReadSurah: 0, onBookmarkToggle: () => {}, onUpdateLastRead: () => {}, onGoBack: () => {},
    progress: EMPTY_PROGRESS, progressActions: NO_ACTIONS, today: '2026-03-20',
  }));
  fireEvent.click(await screen.findByText('Al-Ikhlas'));
  return urls;
};

test('IndoPak text comes from the bundled file, and the Uthmani text is never shown', async () => {
  const urls = await open({ indopakResponse: async () => ({ ok: true, json: async () => FILE }) });
  await waitFor(() => assert.ok(document.body.textContent.includes('Pickthall 1')));
  const paragraphs = [...document.querySelectorAll('p[lang="ar"].font-indopak [aria-hidden="true"]')].map((s) => s.textContent);
  assert.ok(paragraphs.includes(FILE.surahs[111][0]));
  assert.ok(paragraphs.includes(FILE.surahs[111][3]));
  assert.ok(!document.body.textContent.includes('uthmani-1'));
  assert.ok(urls.some((u) => u.includes('indopak-digitalkhatt')));
});

test('surahs that open with the Bismillah show it in IndoPak, ahead of the first ayah', async () => {
  await open({ indopakResponse: async () => ({ ok: true, json: async () => FILE }) });
  await waitFor(() => assert.ok(document.body.textContent.includes('Pickthall 1')));
  const headers = [...document.querySelectorAll('p[lang="ar"]')].filter((p) => p.textContent === BASMALA_INDOPAK);
  assert.equal(headers.length, 1);
  assert.ok(headers[0].className.includes('font-indopak'));
});

test('if the IndoPak file cannot be loaded the reader says so and can retry, without showing another script', async () => {
  let fail = true;
  await open({ indopakResponse: async () => (fail ? { ok: false, status: 503, json: async () => ({}) } : { ok: true, json: async () => FILE }) });
  const retry = await screen.findByRole('button', { name: /retry|try again/i });
  assert.ok(!document.body.textContent.includes('uthmani-1'));
  fail = false;
  fireEvent.click(retry);
  await waitFor(() => assert.ok(document.body.textContent.includes('Pickthall 1')));
});
