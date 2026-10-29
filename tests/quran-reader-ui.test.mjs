import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

process.env.NODE_ENV = 'development';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://app.test/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.localStorage = dom.window.localStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import('react')).default;
const { render, screen, fireEvent, cleanup, act, waitFor } = await import('@testing-library/react');
const { default: ReaderSettingsSheet } = await import('../src/components/ReaderSettingsSheet.tsx');
const { default: AyahCard } = await import('../src/components/AyahCard.tsx');
const { default: QuranReader } = await import('../src/components/QuranReader.tsx');
const { DEFAULT_READER_SETTINGS } = await import('../src/quran/settings.ts');

const { EMPTY_PROGRESS } = await import('../src/quran/progress.ts');
const NO_ACTIONS = { addSeconds() {}, setGoal() {}, recordPosition() {}, startKhatam() {}, endKhatam() {}, reset() {} };
const BISMILLAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';

test.afterEach(() => { cleanup(); localStorage.clear(); });

// ── settings sheet ────────────────────────────────────────────────────────────

const mountSheet = (over = {}) => {
  const calls = { close: 0, patches: [] };
  render(React.createElement(ReaderSettingsSheet, {
    open: true, onClose: () => { calls.close += 1; }, settings: DEFAULT_READER_SETTINGS, onChange: (p) => calls.patches.push(p), ...over,
  }));
  return calls;
};

test('the sheet is a labelled modal dialog that closes on Escape and on its close button', () => {
  const calls = mountSheet();
  const dialog = screen.getByRole('dialog', { name: 'Reader settings' });
  assert.equal(dialog.getAttribute('aria-modal'), 'true');
  fireEvent.keyDown(dialog, { key: 'Escape' });
  fireEvent.click(screen.getByRole('button', { name: 'Close settings' }));
  assert.equal(calls.close, 2);
});

test('nothing renders while closed', () => {
  mountSheet({ open: false });
  assert.equal(screen.queryByRole('dialog'), null);
});

test('display tab: picking a theme and a text size reports the change', () => {
  const calls = mountSheet();
  fireEvent.click(screen.getByRole('button', { name: /Paper/ }));
  assert.deepEqual(calls.patches.at(-1), { theme: 'paper' });
  fireEvent.change(screen.getByRole('slider', { name: 'Text size' }), { target: { value: '4' } });
  assert.deepEqual(calls.patches.at(-1), { textSize: 4 });
  assert.equal(screen.getByRole('button', { name: /Dark/ }).getAttribute('aria-pressed'), 'true');
});

test('text tab: scripts show a live sample, and choosing one reports it', () => {
  const calls = mountSheet();
  fireEvent.click(screen.getByRole('button', { name: 'Text' }));
  assert.equal(screen.getByRole('button', { name: /Uthmani/ }).getAttribute('aria-pressed'), 'true');
  fireEvent.click(screen.getByRole('button', { name: /Simple/ }));
  assert.deepEqual(calls.patches.at(-1), { script: 'simple' });
  assert.equal(screen.queryByRole('button', { name: /IndoPak/ }), null, 'IndoPak is not offered until its text is cleared');
});

test('text tab: translation can be switched, transliteration is not offered, credits are shown', () => {
  const calls = mountSheet();
  fireEvent.click(screen.getByRole('button', { name: 'Text' }));
  fireEvent.click(screen.getByRole('switch', { name: 'Show translation' }));
  assert.deepEqual(calls.patches.at(-1), { showTranslation: false });
  assert.equal(screen.queryByRole('switch', { name: 'Show transliteration' }), null);
  assert.ok(document.querySelector('a[href="https://tanzil.net"]'), 'links to the text source');
  assert.match(document.body.textContent, /Pickthall/);
});

// ── ayah card ─────────────────────────────────────────────────────────────────

const ayah = { number: 6231, numberInSurah: 1, arabic: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ', translation: 'Say: He is Allah, the One!', transliteration: null, juz: 30, page: 604 };
const mountCard = (over = {}) => {
  const calls = { copied: [], bookmarked: 0 };
  render(React.createElement(AyahCard, {
    ayah, surahName: 'Al-Ikhlas', surahNumber: 112, settings: DEFAULT_READER_SETTINGS, bookmarked: false,
    onToggleBookmark: () => { calls.bookmarked += 1; }, onCopy: (t) => calls.copied.push(t), ...over,
  }));
  return calls;
};

test('a card shows the Arabic and, when switched on, the translation', () => {
  mountCard();
  assert.ok(screen.getByText('Say: He is Allah, the One!'));
  const arabic = document.querySelector('[lang="ar"]');
  assert.equal(arabic.getAttribute('dir'), 'rtl');
  assert.match(arabic.textContent, /قُلْ هُوَ/);
});

test('the translation is hidden when the setting is off', () => {
  mountCard({ settings: { ...DEFAULT_READER_SETTINGS, showTranslation: false } });
  assert.equal(screen.queryByText('Say: He is Allah, the One!'), null);
});

test('the ayah chip opens copy and bookmark actions', () => {
  const calls = mountCard();
  const chip = screen.getByRole('button', { name: /Ayah 112:1/ });
  assert.equal(chip.getAttribute('aria-expanded'), 'false');
  fireEvent.click(chip);
  assert.equal(chip.getAttribute('aria-expanded'), 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Copy ayah' }));
  assert.match(calls.copied[0], /— Al-Ikhlas 112:1$/);
  fireEvent.click(screen.getByRole('button', { name: 'Bookmark ayah' }));
  assert.equal(calls.bookmarked, 1);
});

// ── the reader end to end, with the network faked ─────────────────────────────

const surahList = { code: 200, data: [
  { number: 1, name: 'الفاتحة', englishName: 'Al-Fatihah', englishNameTranslation: 'The Opening', numberOfAyahs: 7, revelationType: 'Meccan' },
  { number: 2, name: 'البقرة', englishName: 'Al-Baqarah', englishNameTranslation: 'The Cow', numberOfAyahs: 286, revelationType: 'Medinan' },
] };

const surahBody = (script) => ({ code: 200, data: [
  { edition: { identifier: script }, ayahs: [
    { number: 8, numberInSurah: 1, text: `${BISMILLAH} الٓمٓ`, juz: 1, page: 2 },
    { number: 9, numberInSurah: 2, text: 'ذَٰلِكَ ٱلْكِتَٰبُ', juz: 1, page: 2 },
  ] },
  { edition: { identifier: 'en.pickthall' }, ayahs: [
    { number: 8, numberInSurah: 1, text: 'Alif. Lam. Mim.', juz: 1, page: 2 },
    { number: 9, numberInSurah: 2, text: 'This is the Scripture.', juz: 1, page: 2 },
  ] },
] });

const mountReader = async () => {
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    const body = String(url).endsWith('/surah') ? surahList : surahBody(String(url).includes('quran-simple') ? 'quran-simple' : 'quran-uthmani');
    return { ok: true, json: async () => body };
  };
  render(React.createElement(QuranReader, {
    bookmarkedAyahs: [], lastReadSurah: 0, onBookmarkToggle: () => {}, onUpdateLastRead: () => {}, onGoBack: () => {}, progress: EMPTY_PROGRESS, progressActions: NO_ACTIONS, today: '2026-03-20',
  }));
  await screen.findByText('Al-Baqarah');
  fireEvent.click(screen.getByText('Al-Baqarah'));
  await screen.findByText('This is the Scripture.');
  return urls;
};

test('opening a surah asks for the Arabic and the public-domain translation together', async () => {
  const urls = await mountReader();
  assert.ok(urls.at(-1).endsWith('/surah/2/editions/quran-uthmani,en.pickthall'), urls.at(-1));
});

test('the Bismillah is shown once, as the header, not repeated inside ayah 1', async () => {
  await mountReader();
  const matches = (document.body.textContent.match(/بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ/g) ?? []).length;
  assert.equal(matches, 1);
});

test('turning the translation off hides it without another request; changing script fetches the new edition', async () => {
  const urls = await mountReader();
  const before = urls.length;
  fireEvent.click(screen.getByRole('button', { name: 'Reader settings' }));
  fireEvent.click(screen.getByRole('button', { name: 'Text' }));
  fireEvent.click(screen.getByRole('switch', { name: 'Show translation' }));
  assert.equal(screen.queryByText('This is the Scripture.'), null);
  assert.equal(urls.length, before, 'toggling is display-only');
  fireEvent.click(screen.getByRole('button', { name: /Simple/ }));
  await waitFor(() => assert.ok(urls.at(-1).includes('quran-simple,en.pickthall'), urls.at(-1)));
});

test('settings are remembered between visits', async () => {
  await mountReader();
  fireEvent.click(screen.getByRole('button', { name: 'Reader settings' }));
  fireEvent.click(screen.getByRole('button', { name: /Paper/ }));
  await act(async () => {});
  assert.equal(JSON.parse(localStorage.getItem('tasbih_reader_settings')).theme, 'paper');
  assert.equal(document.querySelector('[data-reader-theme]').getAttribute('data-reader-theme'), 'paper');
});

test('a failed request shows a retry instead of an empty page', async () => {
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/surah')) return { ok: true, json: async () => surahList };
    throw new Error('offline');
  };
  render(React.createElement(QuranReader, {
    bookmarkedAyahs: [], lastReadSurah: 0, onBookmarkToggle: () => {}, onUpdateLastRead: () => {}, onGoBack: () => {}, progress: EMPTY_PROGRESS, progressActions: NO_ACTIONS, today: '2026-03-20',
  }));
  await screen.findByText('Al-Baqarah');
  fireEvent.click(screen.getByText('Al-Baqarah'));
  assert.ok(await screen.findByRole('button', { name: /Retry/ }));
});

test('display tab: keep-screen-on is a switch that reports the change', () => {
  const calls = mountSheet();
  fireEvent.click(screen.getByRole('switch', { name: 'Keep screen on while reading' }));
  assert.deepEqual(calls.patches.at(-1), { keepScreenOn: true });
});


// ── review fixes ──────────────────────────────────────────────────────────────

test('changing the script keeps the page on screen while the new text loads', async () => {
  await mountReader();
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('quran-simple')) { await pending; }
    return original(url);
  };
  fireEvent.click(screen.getByRole('button', { name: 'Reader settings' }));
  fireEvent.click(screen.getByRole('button', { name: 'Text' }));
  fireEvent.click(screen.getByRole('button', { name: /Simple/ }));
  await act(async () => {});
  assert.ok(screen.getByText('This is the Scripture.'), 'the surah stays visible, so the reading position is kept');
  assert.equal(screen.queryByText(/Loading Al-Baqara/), null, 'no full-page spinner');
  release();
  await act(async () => {});
});

test('a bookmarked ayah is marked even when its actions are collapsed', () => {
  mountCard({ bookmarked: true });
  assert.ok(screen.getByLabelText('Bookmarked'));
  cleanup();
  mountCard({ bookmarked: false });
  assert.equal(screen.queryByLabelText('Bookmarked'), null);
});

test('the bookmark button reports which ayah it is for', () => {
  const keys = [];
  render(React.createElement(AyahCard, {
    ayah, surahName: 'Al-Ikhlas', surahNumber: 112, settings: DEFAULT_READER_SETTINGS, bookmarked: false,
    onToggleBookmark: (key) => keys.push(key), onCopy: () => {},
  }));
  fireEvent.click(screen.getByRole('button', { name: /Ayah 112:1/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Bookmark ayah' }));
  assert.deepEqual(keys, ['112:1']);
});

test('cards are memoised so copying or bookmarking one does not redraw the other 285', () => {
  assert.equal(AyahCard.$$typeof, Symbol.for('react.memo'));
});

test('the settings dialog traps Tab in both directions', () => {
  mountSheet();
  const dialog = screen.getByRole('dialog');
  const focusable = [...dialog.querySelectorAll('button, input, a[href]')];
  const first = focusable[0];
  const last = focusable.at(-1);
  last.focus();
  fireEvent.keyDown(last, { key: 'Tab' });
  assert.equal(document.activeElement, first, 'Tab from the last control wraps to the first');
  first.focus();
  fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
  assert.equal(document.activeElement, last, 'Shift+Tab from the first control wraps to the last');
});

test('Escape closes the dialog even when focus has moved outside it', () => {
  const calls = mountSheet();
  fireEvent.keyDown(document.body, { key: 'Escape' });
  assert.equal(calls.close, 1);
});

test('the switch is a 44px target and its off state has visible contrast', async () => {
  const { default: ToggleSwitch } = await import('../src/components/ToggleSwitch.tsx');
  render(React.createElement(ToggleSwitch, { id: 't', label: 'Test', checked: false, onChange: () => {} }));
  const button = screen.getByRole('switch', { name: 'Test' });
  assert.match(button.className, /h-11/);
  assert.ok(document.body.innerHTML.includes('--reader-muted'), 'off track uses the muted ink, not the faint border colour');
});
