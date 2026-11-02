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
const { render, screen, fireEvent, cleanup, within, waitFor, act } = await import('@testing-library/react');
const { default: ReaderSettingsSheet } = await import('../src/components/ReaderSettingsSheet.tsx');
const { default: AyahCard } = await import('../src/components/AyahCard.tsx');
const { default: QuranReader } = await import('../src/components/QuranReader.tsx');
const { DEFAULT_READER_SETTINGS } = await import('../src/quran/settings.ts');
const { EMPTY_PROGRESS } = await import('../src/quran/progress.ts');
const { parseCatalog } = await import('../src/quran/translations.ts');

const entry = (key, language, title, version = '1.0.0', direction = 'ltr') => ({ key, language_iso_code: language, title, version, direction, last_update: 1 });
const CATALOG = parseCatalog({ translations: [
  entry('english_saheeh', 'en', 'English Translation - Noor International Center', '1.1.2'),
  entry('urdu_junagarhi', 'ur', 'Urdu Translation - Junagarhi', '1.0.5', 'rtl'),
  entry('hausa_gummi', 'ha', 'Hausa Translation - Gummi'),
] });

test.afterEach(() => { cleanup(); localStorage.clear(); });

// ── the picker inside the settings sheet ─────────────────────────────────────

const mountSheet = (over = {}) => {
  const calls = { patches: [], retry: 0 };
  render(React.createElement(ReaderSettingsSheet, {
    open: true, onClose: () => {}, settings: DEFAULT_READER_SETTINGS, onChange: (p) => calls.patches.push(p),
    catalog: { entries: CATALOG, status: 'ready', retry: () => { calls.retry += 1; } }, ...over,
  }));
  fireEvent.click(screen.getByRole('button', { name: 'Text' }));
  return calls;
};

test('the text tab names the current translation and offers to change it', () => {
  mountSheet();
  assert.match(document.body.textContent, /English: Pickthall/);
  assert.ok(screen.getByRole('button', { name: /Change translation/ }));
});

test('a QuranEnc translation is shown by its publisher\'s title', () => {
  mountSheet({ settings: { ...DEFAULT_READER_SETTINGS, translation: 'quranenc:urdu_junagarhi' } });
  assert.match(document.body.textContent, /Urdu Translation - Junagarhi/);
});

test('the picker lists the built-in translation and every language, grouped', () => {
  mountSheet();
  fireEvent.click(screen.getByRole('button', { name: /Change translation/ }));
  const dialog = screen.getByRole('dialog');
  assert.ok(within(dialog).getByRole('searchbox', { name: 'Search translations' }));
  assert.equal(within(dialog).getByRole('button', { name: /Pickthall/ }).getAttribute('aria-pressed'), 'true');
  for (const name of [/English/, /Urdu/, /Hausa/]) assert.ok(within(dialog).getByRole('heading', { name }), String(name));
  assert.ok(within(dialog).getByRole('button', { name: /Noor International Center/ }));
});

test('picking a translation reports it, turns the translation on and returns to the text tab', () => {
  const calls = mountSheet();
  fireEvent.click(screen.getByRole('button', { name: /Change translation/ }));
  fireEvent.click(screen.getByRole('button', { name: /Junagarhi/ }));
  assert.deepEqual(calls.patches.at(-1), { translation: 'quranenc:urdu_junagarhi', showTranslation: true });
  assert.ok(screen.getByRole('switch', { name: 'Show translation' }), 'back on the text tab');
});

test('going back from the picker changes nothing', () => {
  const calls = mountSheet();
  fireEvent.click(screen.getByRole('button', { name: /Change translation/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Back to text settings' }));
  assert.deepEqual(calls.patches, []);
  assert.ok(screen.getByRole('switch', { name: 'Show translation' }));
});

test('searching narrows the list and says so when nothing matches', () => {
  mountSheet();
  fireEvent.click(screen.getByRole('button', { name: /Change translation/ }));
  const box = screen.getByRole('searchbox', { name: 'Search translations' });
  fireEvent.change(box, { target: { value: 'juna' } });
  assert.ok(screen.getByRole('button', { name: /Junagarhi/ }));
  assert.equal(screen.queryByRole('button', { name: /Gummi/ }), null);
  fireEvent.change(box, { target: { value: 'zzzz' } });
  assert.match(document.body.textContent, /No translations match/);
});

test('while the list loads, offline with nothing saved, or showing a saved copy, the picker says which', () => {
  mountSheet({ catalog: { entries: [], status: 'loading', retry: () => {} } });
  fireEvent.click(screen.getByRole('button', { name: /Change translation/ }));
  assert.match(document.body.textContent, /Loading translations/);
  assert.ok(screen.getByRole('button', { name: /Pickthall/ }), 'the built-in one is always there');
  cleanup();

  const calls = mountSheet({ catalog: { entries: [], status: 'error', retry: () => {} } });
  fireEvent.click(screen.getByRole('button', { name: /Change translation/ }));
  assert.match(document.body.textContent, /Could not load the list/);
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  assert.equal(calls.retry, 0, 'this mount used its own retry');
  cleanup();

  mountSheet({ catalog: { entries: CATALOG, status: 'cached', retry: () => {} } });
  fireEvent.click(screen.getByRole('button', { name: /Change translation/ }));
  assert.match(document.body.textContent, /saved list/i);
});

test('the picker credits QuranEnc as the source', () => {
  mountSheet();
  fireEvent.click(screen.getByRole('button', { name: /Change translation/ }));
  assert.ok(document.querySelector('a[href="https://quranenc.com"]'));
});

test('the sheet never credits Pickthall for a QuranEnc translation the catalogue does not list', () => {
  mountSheet({ settings: { ...DEFAULT_READER_SETTINGS, translation: 'quranenc:urdu_junagarhi' }, catalog: { entries: [], status: 'error', retry: () => {} } });
  assert.doesNotMatch(document.body.textContent, /Pickthall/);
  assert.match(document.body.textContent, /urdu_junagarhi. Source: QuranEnc.com/);
});

test('a translation of unknown language is not tagged English', () => {
  mountCard({ translationDirection: 'auto' });
  const p = document.querySelector('p[dir="auto"]');
  assert.ok(p, 'direction left to the browser');
  assert.equal(p.hasAttribute('lang'), false);
});

test('reopening the sheet starts on the first tab, not inside the picker', () => {
  const props = (open) => ({ open, onClose: () => {}, settings: DEFAULT_READER_SETTINGS, onChange: () => {}, catalog: { entries: CATALOG, status: 'ready', retry: () => {} } });
  const view = render(React.createElement(ReaderSettingsSheet, props(true)));
  fireEvent.click(screen.getByRole('button', { name: 'Text' }));
  fireEvent.click(screen.getByRole('button', { name: /Change translation/ }));
  assert.ok(screen.getByRole('searchbox', { name: 'Search translations' }));
  view.rerender(React.createElement(ReaderSettingsSheet, props(false)));
  view.rerender(React.createElement(ReaderSettingsSheet, props(true)));
  assert.equal(screen.queryByRole('searchbox', { name: 'Search translations' }), null);
});

// ── an ayah with notes ────────────────────────────────────────────────────────

const ayah = { number: 6222, numberInSurah: 1, arabic: 'قُلْ', translation: 'Say: He is Allah[1]', footnotes: '[1] He is Alone.\n[2] Second note', transliteration: null, juz: 30, page: 604 };
const mountCard = (props = {}) => render(React.createElement(AyahCard, {
  ayah, surahName: 'Al-Ikhlas', surahNumber: 112, settings: DEFAULT_READER_SETTINGS, bookmarked: false,
  onToggleBookmark: () => {}, onCopy: () => {}, ...props,
}));

test('the publisher\'s notes are available under the translation, exactly as published', () => {
  mountCard();
  const notes = document.querySelector('details');
  assert.ok(notes);
  assert.match(notes.querySelector('summary').textContent, /Notes/);
  assert.equal(notes.querySelector('[data-notes]').textContent, '[1] He is Alone.\n[2] Second note');
});

test('an ayah without notes shows no notes control', () => {
  mountCard({ ayah: { ...ayah, footnotes: null } });
  assert.equal(document.querySelector('details'), null);
});

test('a right-to-left translation is laid out right to left and tagged with its language', () => {
  mountCard({ translationDirection: 'rtl', translationLanguage: 'ur' });
  const p = screen.getByText('Say: He is Allah[1]');
  assert.equal(p.getAttribute('dir'), 'rtl');
  assert.equal(p.getAttribute('lang'), 'ur');
});

test('copying includes the notes when the translation is copied, so nothing is dropped', () => {
  const copied = [];
  mountCard({ onCopy: (t) => copied.push(t) });
  fireEvent.click(screen.getByRole('button', { name: /Ayah 112:1/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Copy ayah' }));
  assert.match(copied[0], /Say: He is Allah\[1\]/);
  assert.match(copied[0], /\[1\] He is Alone\./);
});

// ── the whole reader ──────────────────────────────────────────────────────────

const surahList = { code: 200, data: [
  { number: 112, name: 'الإخلاص', englishName: 'Al-Ikhlas', englishNameTranslation: 'Sincerity', numberOfAyahs: 4, revelationType: 'Meccan' },
] };
const arabic = (editions) => ({ code: 200, data: [
  { edition: { identifier: editions[0] }, ayahs: [{ number: 6222, numberInSurah: 1, text: 'قُلْ هُوَ', juz: 30, page: 604 }, { number: 6223, numberInSurah: 2, text: 'ٱللَّهُ ٱلصَّمَدُ', juz: 30, page: 604 }] },
  ...(editions.includes('en.pickthall') ? [{ edition: { identifier: 'en.pickthall' }, ayahs: [{ number: 6222, numberInSurah: 1, text: 'PICKTHALL one', juz: 30, page: 604 }, { number: 6223, numberInSurah: 2, text: 'PICKTHALL two', juz: 30, page: 604 }] }] : []),
] });
const quranEnc = (key) => ({ result: [
  { aya: '1', translation: `${key} verse one[1]`, footnotes: '[1] publisher note' },
  { aya: '2', translation: `${key} verse two`, footnotes: '' },
] });

const fakeNetwork = ({ failTranslation = false } = {}) => {
  const urls = [];
  globalThis.fetch = async (url) => {
    const u = String(url);
    urls.push(u);
    if (u.endsWith('/surah')) return { ok: true, json: async () => surahList };
    if (u.includes('api.alquran.cloud')) return { ok: true, json: async () => arabic(u.split('/editions/')[1].split(',')) };
    if (u.endsWith('/translations/list')) return { ok: true, json: async () => ({ translations: [entry('english_saheeh', 'en', 'English Translation - Noor International Center', '1.1.2'), entry('urdu_junagarhi', 'ur', 'Urdu Translation - Junagarhi', '1.0.5', 'rtl')] }) };
    if (u.includes('quranenc.com/api/v1/translation/sura/')) {
      if (failTranslation) throw new TypeError('offline');
      return { ok: true, json: async () => quranEnc(u.split('/sura/')[1].split('/')[0]) };
    }
    throw new Error(`unexpected request: ${u}`);
  };
  return urls;
};

const NO_ACTIONS = { addSeconds() {}, setGoal() {}, recordPosition() {}, startKhatam() {}, endKhatam() {}, reset() {} };
const mountReader = async (stored) => {
  if (stored) localStorage.setItem('tasbih_reader_settings', JSON.stringify({ ...DEFAULT_READER_SETTINGS, ...stored }));
  render(React.createElement(QuranReader, {
    bookmarkedAyahs: [], lastReadSurah: 0, onBookmarkToggle: () => {}, onUpdateLastRead: () => {}, onGoBack: () => {},
    progress: EMPTY_PROGRESS, progressActions: NO_ACTIONS, today: '2026-03-20',
  }));
  fireEvent.click(await screen.findByText('Al-Ikhlas'));
};

test('a QuranEnc translation is shown with its notes, version and source, and the Arabic request leaves out Pickthall', async () => {
  const urls = fakeNetwork();
  await mountReader({ translation: 'quranenc:english_saheeh' });
  await screen.findByText('english_saheeh verse one[1]');
  assert.ok(urls.some((u) => u.endsWith('/editions/quran-uthmani')), 'Arabic requested alone');
  assert.ok(!urls.some((u) => u.includes('en.pickthall')));
  assert.equal(document.querySelector('[data-notes]').textContent, '[1] publisher note');
  const credit = document.querySelector('a[href="https://quranenc.com/en/browse/english_saheeh"]');
  assert.ok(credit, 'links to the translation at QuranEnc');
  assert.match(credit.closest('p').textContent, /Noor International Center.*v1\.1\.2.*QuranEnc\.com/);
});

test('a right-to-left translation gets its direction from the catalogue', async () => {
  fakeNetwork();
  await mountReader({ translation: 'quranenc:urdu_junagarhi' });
  const p = await screen.findByText('urdu_junagarhi verse one[1]');
  await waitFor(() => assert.equal(p.getAttribute('dir'), 'rtl'));
  assert.equal(p.getAttribute('lang'), 'ur');
});

test('the built-in translation still works and is credited as public domain', async () => {
  fakeNetwork();
  await mountReader();
  await screen.findByText('PICKTHALL one');
  assert.match(document.body.textContent, /Pickthall.*public domain/i);
});

test('choosing a translation in the picker loads it, and going back to Pickthall restores the built-in text', async () => {
  const urls = fakeNetwork();
  await mountReader();
  await screen.findByText('PICKTHALL one');
  fireEvent.click(screen.getByRole('button', { name: 'Reader settings' }));
  fireEvent.click(screen.getByRole('button', { name: 'Text' }));
  fireEvent.click(screen.getByRole('button', { name: /Change translation/ }));
  fireEvent.click(await screen.findByRole('button', { name: /Noor International Center/ }));
  await screen.findByText('english_saheeh verse one[1]');
  assert.equal(screen.queryByText('PICKTHALL one'), null, 'old text is gone');
  assert.equal(JSON.parse(localStorage.getItem('tasbih_reader_settings')).translation, 'quranenc:english_saheeh');

  fireEvent.click(screen.getByRole('button', { name: /Change translation/ }));
  fireEvent.click(screen.getByRole('button', { name: /Pickthall/ }));
  await screen.findByText('PICKTHALL one');
  assert.ok(urls.some((u) => u.includes('quran-uthmani,en.pickthall')), 'Pickthall is requested again');
});

test('while a translation loads, the page says so; when it fails, it offers a retry and the built-in text', async () => {
  fakeNetwork({ failTranslation: true });
  await mountReader({ translation: 'quranenc:english_saheeh' });
  assert.ok(await screen.findByText(/Could not load this translation/));
  assert.ok(screen.getByRole('button', { name: 'Retry' }));
  fireEvent.click(screen.getByRole('button', { name: /Use Pickthall instead/ }));
  await screen.findByText('PICKTHALL one');
  assert.equal(JSON.parse(localStorage.getItem('tasbih_reader_settings')).translation, 'pickthall');
});

test('the Arabic stays on screen while only the translation fails', async () => {
  fakeNetwork({ failTranslation: true });
  await mountReader({ translation: 'quranenc:english_saheeh' });
  await screen.findByText(/Could not load this translation/);
  assert.ok(document.querySelector('[lang="ar"]'), 'the Arabic is still readable');
});
