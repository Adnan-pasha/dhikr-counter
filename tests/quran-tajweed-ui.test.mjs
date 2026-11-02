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
const { render, screen, fireEvent, cleanup } = await import('@testing-library/react');
const { default: ReaderSettingsSheet } = await import('../src/components/ReaderSettingsSheet.tsx');
const { default: AyahCard } = await import('../src/components/AyahCard.tsx');
const { default: TajweedLegend } = await import('../src/components/TajweedLegend.tsx');
const { DEFAULT_READER_SETTINGS } = await import('../src/quran/settings.ts');
const { parseTajweed, TAJWEED_RULES } = await import('../src/quran/tajweed.ts');

const MARKED = 'قُلْ هُوَ [h:8078[ٱ]للَّهُ أَحَ[q[د]ٌ';
const tajweedSettings = { ...DEFAULT_READER_SETTINGS, script: 'tajweed' };

test.afterEach(() => { cleanup(); localStorage.clear(); });

const mountCard = (props = {}) => render(React.createElement(AyahCard, {
  ayah: { number: 6222, numberInSurah: 1, arabic: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ', arabicSegments: null, translation: null, footnotes: null, transliteration: null, juz: 30, page: 604 },
  surahName: 'Al-Ikhlas', surahNumber: 112, settings: DEFAULT_READER_SETTINGS, bookmarked: false,
  onToggleBookmark: () => {}, onCopy: () => {}, ...props,
}));

test('a tajweed ayah draws each rule in its colour and keeps the letters in order', () => {
  mountCard({ settings: tajweedSettings, ayah: { number: 6222, numberInSurah: 1, arabic: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ', arabicSegments: parseTajweed(MARKED), translation: null, footnotes: null, transliteration: null, juz: 30, page: 604 } });
  const arabic = document.querySelector('p[lang="ar"]');
  const coloured = [...arabic.querySelectorAll('span[data-rule]')];
  assert.deepEqual(coloured.map((s) => s.dataset.rule), ['h', 'q']);
  assert.equal(coloured[1].style.color, 'var(--tj-q)');
  assert.match(arabic.textContent, /^قُلْ هُوَ ٱللَّهُ أَحَدٌ/);
});

test('without coloured pieces the plain text is shown, so other scripts are unchanged', () => {
  mountCard();
  assert.equal(document.querySelectorAll('span[data-rule]').length, 0);
  assert.match(document.querySelector('p[lang="ar"]').textContent, /قُلْ هُوَ ٱللَّهُ أَحَدٌ/);
});

test('copying a tajweed ayah gives the plain text with no markers', () => {
  const copied = [];
  mountCard({ settings: tajweedSettings, onCopy: (t) => copied.push(t), ayah: { number: 6222, numberInSurah: 1, arabic: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ', arabicSegments: parseTajweed(MARKED), translation: null, footnotes: null, transliteration: null, juz: 30, page: 604 } });
  fireEvent.click(screen.getByRole('button', { name: /actions/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Copy ayah' }));
  assert.match(copied[0], /^قُلْ هُوَ ٱللَّهُ أَحَدٌ/);
  assert.ok(!/[\[\]]/.test(copied[0].split('—')[0]));
});

// ── the legend ───────────────────────────────────────────────────────────────

test('the legend names every rule with its Arabic name and a colour swatch', () => {
  render(React.createElement(TajweedLegend, { defaultOpen: true }));
  for (const rule of TAJWEED_RULES) {
    assert.ok(document.body.textContent.includes(rule.name), rule.name);
    assert.ok(document.body.textContent.includes(rule.arabic), rule.arabic);
  }
  assert.equal(document.querySelectorAll('[data-swatch]').length, TAJWEED_RULES.length);
});

test('the legend can be opened and closed', () => {
  render(React.createElement(TajweedLegend, {}));
  const summary = screen.getByText(/Tajweed colour guide/);
  assert.equal(summary.closest('details').open, false);
  fireEvent.click(summary);
});

// ── choosing the script ──────────────────────────────────────────────────────

const mountSheet = (settings, onChange = () => {}) => render(React.createElement(ReaderSettingsSheet, {
  open: true, onClose: () => {}, settings, onChange,
}));

test('the script cards offer Tajweed, with a coloured preview', () => {
  mountSheet(DEFAULT_READER_SETTINGS);
  fireEvent.click(screen.getByRole('button', { name: 'Text' }));
  const card = screen.getByRole('button', { name: /Tajweed/ });
  assert.ok(card.querySelector('span[data-rule="h"]'), 'the preview shows a rule colour');
  assert.ok(!/[\[\]]/.test(card.textContent), 'no markers in the preview');
});

test('choosing Tajweed reports the script', () => {
  const patches = [];
  mountSheet(DEFAULT_READER_SETTINGS, (p) => patches.push(p));
  fireEvent.click(screen.getByRole('button', { name: 'Text' }));
  fireEvent.click(screen.getByRole('button', { name: /Tajweed/ }));
  assert.deepEqual(patches, [{ script: 'tajweed' }]);
});

test('the colour guide is offered under the script cards only while Tajweed is chosen', () => {
  mountSheet(DEFAULT_READER_SETTINGS);
  fireEvent.click(screen.getByRole('button', { name: 'Text' }));
  assert.equal(screen.queryByText(/Tajweed colour guide/), null);
  cleanup();
  mountSheet(tajweedSettings);
  fireEvent.click(screen.getByRole('button', { name: 'Text' }));
  assert.ok(screen.getByText(/Tajweed colour guide/));
});
