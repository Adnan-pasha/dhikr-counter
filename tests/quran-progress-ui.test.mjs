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
dom.window.Element.prototype.scrollIntoView = function scrollIntoView() { scrolled.push(this.id); };
const scrolled = [];

const React = (await import('react')).default;
const { render, screen, fireEvent, cleanup, act, within } = await import('@testing-library/react');
const { default: QuranProgressView } = await import('../src/components/QuranProgressView.tsx');
const { default: QuranGoalCard } = await import('../src/components/QuranGoalCard.tsx');
const { default: QuranReader } = await import('../src/components/QuranReader.tsx');
const P = await import('../src/quran/progress.ts');
const { FLUSH_SECONDS } = await import('../src/quran/useReadingClock.ts');

const TODAY = '2026-03-20';
const readTo = (p, count) => ({ ...p, read: count > 0 ? [[1, count]] : [] });
const names = { 1: 'Al-Faatiha', 2: 'Al-Baqara' };
const surahName = (n) => names[n] ?? `Surah ${n}`;

test.afterEach(() => { cleanup(); localStorage.clear(); mock.timers.reset(); scrolled.length = 0; });

const withGoal = (minutes, seconds = 0) => {
  let p = P.setGoal(P.EMPTY_PROGRESS, minutes);
  if (seconds) p = P.addReadingSeconds(p, TODAY, seconds);
  return p;
};

// A stateful wrapper, for tests that need the screen to react to its own actions.
const Live = ({ start }) => {
  const [progress, setProgress] = React.useState(start);
  return React.createElement(QuranProgressView, {
    progress, today: TODAY, surahName, onGoBack: () => {}, onContinue: () => {},
    onSetGoal: (m) => setProgress((p) => P.setGoal(p, m)),
    onStartKhatam: (d) => setProgress((p) => P.startKhatam(p, TODAY, d)),
    onEndKhatam: () => setProgress((p) => P.endKhatam(p)),
  });
};

const mountProgress = (progress = P.EMPTY_PROGRESS, over = {}) => {
  const calls = { goal: [], continue: [], khatam: [], end: 0 };
  render(React.createElement(QuranProgressView, {
    progress, today: TODAY, surahName, onGoBack: () => {},
    onSetGoal: (m) => calls.goal.push(m),
    onContinue: (pos) => calls.continue.push(pos),
    onStartKhatam: (d) => calls.khatam.push(d),
    onEndKhatam: () => { calls.end += 1; },
    ...over,
  }));
  return calls;
};

// ── reading tab ───────────────────────────────────────────────────────────────

test('with no goal the screen invites one instead of showing an empty ring', () => {
  mountProgress();
  assert.match(document.body.textContent, /Set a daily reading goal/);
  assert.ok(screen.getByRole('button', { name: 'Set reading goal' }));
});

test('minutes read today and the goal are shown, with the finishing estimate', () => {
  mountProgress(withGoal(5, 150));
  const ring = screen.getByRole('progressbar', { name: 'Today\'s reading' });
  assert.equal(ring.getAttribute('aria-valuenow'), '2');
  assert.equal(ring.getAttribute('aria-valuemax'), '5');
  assert.match(ring.getAttribute('aria-valuetext'), /2 of 5 minutes/);
  assert.match(document.body.textContent, /about 208 days/);
});

test('reaching the goal is said plainly', () => {
  mountProgress(withGoal(5, 300));
  assert.match(document.body.textContent, /Goal reached today/);
});

test('the week is seven days with today marked', () => {
  mountProgress(withGoal(5, 300));
  const days = within(screen.getByRole('list', { name: 'This week' })).getAllByRole('listitem');
  assert.equal(days.length, 7);
  assert.equal(days.filter((d) => d.getAttribute('aria-current') === 'date').length, 1);
  assert.match(days.at(-1).textContent, /goal reached/i, 'the detail is real text, not only an attribute');
});

test('continue opens where reading stopped, or the start when nothing has been read', () => {
  const calls = mountProgress(P.recordPosition(withGoal(5), { surah: 2, ayah: 5, global: 12 }));
  fireEvent.click(screen.getByRole('button', { name: /Continue reading Al-Baqara 2:5/ }));
  assert.deepEqual(calls.continue, [{ surah: 2, ayah: 5, global: 12 }]);
  cleanup();
  const fresh = mountProgress(withGoal(5));
  fireEvent.click(screen.getByRole('button', { name: /Start reading Al-Faatiha 1:1/ }));
  assert.deepEqual(fresh.continue, [null]);
});

test('the goal sheet shows the finishing estimate for each choice and saves the one picked', () => {
  const calls = mountProgress(withGoal(5));
  fireEvent.click(screen.getByRole('button', { name: 'Edit reading goal' }));
  const dialog = screen.getByRole('dialog', { name: 'Reading goal' });
  assert.match(dialog.textContent, /208 days/);
  fireEvent.click(within(dialog).getByRole('button', { name: /10 minutes/ }));
  assert.match(dialog.textContent, /104 days/);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save goal' }));
  assert.deepEqual(calls.goal, [10]);
  assert.equal(screen.queryByRole('dialog'), null, 'the sheet closes after saving');
});

test('cancelling the goal sheet changes nothing', () => {
  const calls = mountProgress(withGoal(5));
  fireEvent.click(screen.getByRole('button', { name: 'Edit reading goal' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  assert.deepEqual(calls.goal, []);
});

// ── khatam tab ────────────────────────────────────────────────────────────────

test('with no plan, a khatam can be started over a chosen number of days', () => {
  const calls = mountProgress();
  fireEvent.click(screen.getByRole('button', { name: 'Khatam' }));
  assert.match(document.body.textContent, /Start your khatam/);
  fireEvent.click(screen.getByRole('button', { name: /60 days/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Start plan' }));
  assert.deepEqual(calls.khatam, [60]);
});

test('a running plan shows the day, the share read and what is left for today, without scolding', () => {
  let p = P.startKhatam(P.EMPTY_PROGRESS, '2026-03-10', 30);
  mountProgress(p);
  fireEvent.click(screen.getByRole('button', { name: 'Khatam' }));
  assert.match(document.body.textContent, /Day 11 of 30/);
  assert.match(document.body.textContent, /\d+ ayat to read today|To stay on plan/i);
  assert.doesNotMatch(document.body.textContent, /behind|late|missed|failed/i);
});

test('being ahead is said kindly, and finishing is celebrated', () => {
  let p = P.startKhatam(P.EMPTY_PROGRESS, '2026-03-10', 30);
  const target = P.khatamStatus(p, TODAY).targetToday;
  p = readTo(p, target + 40);
  mountProgress(p);
  fireEvent.click(screen.getByRole('button', { name: 'Khatam' }));
  assert.match(document.body.textContent, /40 ayat ahead/);
  cleanup();
  const done = readTo(p, P.AYAT_IN_QURAN);
  mountProgress(done);
  fireEvent.click(screen.getByRole('button', { name: 'Khatam' }));
  assert.match(document.body.textContent, /Khatam complete/);
});

test('ending a plan asks first', () => {
  const calls = mountProgress(P.startKhatam(P.EMPTY_PROGRESS, TODAY, 30));
  fireEvent.click(screen.getByRole('button', { name: 'Khatam' }));
  fireEvent.click(screen.getByRole('button', { name: 'End plan' }));
  assert.equal(calls.end, 0, 'not yet');
  fireEvent.click(screen.getByRole('button', { name: 'Yes, end plan' }));
  assert.equal(calls.end, 1);
});

// ── focus ─────────────────────────────────────────────────────────────────────

test('focus lands on the new content when a plan starts, and on the invitation when it ends', () => {
  render(React.createElement(Live, { start: P.EMPTY_PROGRESS }));
  fireEvent.click(screen.getByRole('button', { name: 'Khatam' }));
  fireEvent.click(screen.getByRole('button', { name: 'Start plan' }));
  assert.match(document.activeElement.textContent, /Day 1 of 30/);
  fireEvent.click(screen.getByRole('button', { name: 'End plan' }));
  assert.equal(document.activeElement, screen.getByRole('button', { name: 'Keep plan' }), 'the safe choice is focused first');
  fireEvent.click(screen.getByRole('button', { name: 'Keep plan' }));
  assert.equal(document.activeElement, screen.getByRole('button', { name: 'End plan' }), 'back where it was');
  fireEvent.click(screen.getByRole('button', { name: 'End plan' }));
  fireEvent.click(screen.getByRole('button', { name: 'Yes, end plan' }));
  assert.match(document.activeElement.textContent, /Start your khatam/);
});

test('closing the goal sheet returns focus to the button that opened it', () => {
  render(React.createElement(Live, { start: withGoal(5) }));
  const opener = screen.getByRole('button', { name: 'Edit reading goal' });
  opener.focus();
  fireEvent.click(opener);
  assert.notEqual(document.activeElement, opener, 'focus moved into the sheet');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  assert.equal(document.activeElement, screen.getByRole('button', { name: 'Edit reading goal' }));
});

// ── home card ─────────────────────────────────────────────────────────────────

test('the home card shows today\'s reading and a continue button, or invites a goal', () => {
  const calls = { open: 0, cont: 0 };
  const mount = (progress) => render(React.createElement(QuranGoalCard, {
    progress, today: TODAY, onOpenProgress: () => { calls.open += 1; }, onContinue: () => { calls.cont += 1; },
  }));
  mount(withGoal(10, 180));
  assert.match(document.body.textContent, /3 \/ 10 min/);
  fireEvent.click(screen.getByRole('button', { name: /Continue reading/ }));
  assert.equal(calls.cont, 1);
  cleanup();
  mount(P.EMPTY_PROGRESS);
  fireEvent.click(screen.getByRole('button', { name: /Set a reading goal/ }));
  assert.equal(calls.open, 1);
});

// ── inside the reader screen ──────────────────────────────────────────────────

const surahList = { code: 200, data: [
  { number: 1, name: 'الفاتحة', englishName: 'Al-Faatiha', englishNameTranslation: 'The Opening', numberOfAyahs: 7, revelationType: 'Meccan' },
  { number: 2, name: 'البقرة', englishName: 'Al-Baqara', englishNameTranslation: 'The Cow', numberOfAyahs: 286, revelationType: 'Medinan' },
] };
const surahBody = { code: 200, data: [
  { edition: { identifier: 'quran-uthmani' }, ayahs: [
    { number: 8, numberInSurah: 1, text: 'الٓمٓ', juz: 1, page: 2 },
    { number: 9, numberInSurah: 2, text: 'ذَٰلِكَ ٱلْكِتَٰبُ', juz: 1, page: 2 },
    { number: 12, numberInSurah: 5, text: 'أُو۟لَٰٓئِكَ', juz: 1, page: 2 },
  ] },
  { edition: { identifier: 'en.pickthall' }, ayahs: [
    { number: 8, numberInSurah: 1, text: 'Alif. Lam. Mim.', juz: 1, page: 2 },
    { number: 9, numberInSurah: 2, text: 'This is the Scripture.', juz: 1, page: 2 },
    { number: 12, numberInSurah: 5, text: 'Such have guidance.', juz: 1, page: 2 },
  ] },
] };

const mountReader = (progress, over = {}) => {
  globalThis.fetch = async (url) => ({ ok: true, json: async () => (String(url).endsWith('/surah') ? surahList : surahBody) });
  const actions = { added: [], positions: [], goals: [], khatam: [], ended: 0 };
  const progressActions = {
    addSeconds: (date, s) => actions.added.push([date, s]),
    setGoal: (m) => actions.goals.push(m),
    recordPosition: (p) => actions.positions.push(p),
    startKhatam: (d, n) => actions.khatam.push([d, n]),
    endKhatam: () => { actions.ended += 1; },
    reset: () => {},
  };
  render(React.createElement(QuranReader, {
    bookmarkedAyahs: [], lastReadSurah: 0, onBookmarkToggle: () => {}, onUpdateLastRead: () => {}, onGoBack: () => {},
    progress, progressActions, today: TODAY, ...over,
  }));
  return actions;
};

test('the Quran screen has Read and My Progress sections', async () => {
  mountReader(withGoal(5));
  await screen.findByText('Al-Baqara');
  assert.equal(screen.getByRole('button', { name: 'Read' }).getAttribute('aria-pressed'), 'true');
  fireEvent.click(screen.getByRole('button', { name: 'My Progress' }));
  assert.ok(screen.getByRole('progressbar', { name: 'Today\'s reading' }));
  fireEvent.click(screen.getByRole('button', { name: 'Read' }));
  assert.ok(screen.getByText('Al-Baqara'));
});

test('the reader shows a goal strip while reading', async () => {
  mountReader(withGoal(5, 120));
  fireEvent.click(await screen.findByText('Al-Baqara'));
  await screen.findByText('This is the Scripture.');
  assert.match(document.body.textContent, /Reading goal: 2\/5 mins/);
});

test('no goal means no strip', async () => {
  mountReader(P.EMPTY_PROGRESS);
  fireEvent.click(await screen.findByText('Al-Baqara'));
  await screen.findByText('This is the Scripture.');
  assert.doesNotMatch(document.body.textContent, /Reading goal:/);
});

test('reading time is reported while a surah is open', async () => {
  // Timers must be faked before the reader starts its clock, or it would keep a real one.
  mock.timers.enable({ apis: ['setInterval', 'Date'], now: 5_000_000 });
  const actions = mountReader(withGoal(5));
  fireEvent.click(await screen.findByText('Al-Baqara'));
  await screen.findByText('Such have guidance.');
  await act(async () => {});
  act(() => { mock.timers.tick(FLUSH_SECONDS * 1000); });
  assert.equal(actions.added.reduce((s, [, n]) => s + n, 0), FLUSH_SECONDS);
});

test('continuing from the progress screen opens that surah and scrolls to the ayah', async () => {
  const progress = P.recordPosition(withGoal(5), { surah: 2, ayah: 5, global: 12 });
  mountReader(progress);
  await screen.findByText('Al-Baqara');
  fireEvent.click(screen.getByRole('button', { name: 'My Progress' }));
  fireEvent.click(screen.getByRole('button', { name: /Continue reading Al-Baqara 2:5/ }));
  await screen.findByText('Such have guidance.');
  await act(async () => {});
  assert.ok(scrolled.includes('ayah-2-5'), `scrolled to ${scrolled.join(',')}`);
});

test('back from a surah goes to where you came from, and the button says so', async () => {
  const progress = P.recordPosition(withGoal(5), { surah: 2, ayah: 5, global: 12 });
  mountReader(progress);
  await screen.findByText('Al-Baqara');
  fireEvent.click(screen.getByText('Al-Baqara'));
  await screen.findByText('Such have guidance.');
  assert.ok(screen.getByRole('button', { name: 'Back to Surah list' }), 'opened from the list');
  fireEvent.click(screen.getByRole('button', { name: 'Back to Surah list' }));
  fireEvent.click(screen.getByRole('button', { name: 'My Progress' }));
  fireEvent.click(screen.getByRole('button', { name: /Continue reading Al-Baqara 2:5/ }));
  await screen.findByText('Such have guidance.');
  fireEvent.click(screen.getByRole('button', { name: 'Back to My Progress' }));
  assert.ok(screen.getByRole('progressbar', { name: 'Today\'s reading' }), 'back on My Progress');
});

test('the home card can ask the reader to continue', async () => {
  const progress = P.recordPosition(withGoal(5), { surah: 2, ayah: 5, global: 12 });
  let handled = 0;
  mountReader(progress, { intent: 'continue', onIntentHandled: () => { handled += 1; } });
  await screen.findByText('Such have guidance.');
  await act(async () => {});
  assert.ok(handled >= 1);
  assert.ok(scrolled.includes('ayah-2-5'));
});

test('the home card can ask for the progress screen', async () => {
  mountReader(withGoal(5), { intent: 'progress', onIntentHandled: () => {} });
  assert.ok(await screen.findByRole('progressbar', { name: 'Today\'s reading' }));
});
