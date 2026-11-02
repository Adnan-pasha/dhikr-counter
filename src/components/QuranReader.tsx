import React, { useState, useEffect, useCallback, useRef } from 'react';
import SurahList from './SurahList';
import ReaderView from './ReaderView';
import QuranProgressView from './QuranProgressView';
import QuranTabs, { type QuranTab } from './QuranTabs';
import { API_BASE, buildReaderAyahs, editionsFor, scriptOption, surahUrl, type ReaderAyah } from '../quran/editions';
import { minutesOn, type QuranProgress, type ReadingPosition } from '../quran/progress';
import { useReaderSettings } from '../quran/useReaderSettings';
import { useWakeLock } from '../quran/useWakeLock';
import { useReadingClock } from '../quran/useReadingClock';
import type { useQuranProgress } from '../quran/useQuranProgress';
import { copyText } from '../quran/clipboard';
import { useTranslationCatalog } from '../quran/useTranslationCatalog';
import { useQuranEncSurah } from '../quran/useQuranEncSurah';
import { loadIndopak, indopakAyahs } from '../quran/indopak';
import { useBackLayer } from '../useBackLayer';
import ReaderSettingsSheet from './ReaderSettingsSheet';
import { PICKTHALL_ID, applyTranslation, parseTranslationId, translationCredit } from '../quran/translations';
import type { TranslationView } from './ReaderView';
import type { Surah } from '../quran/types';

type ProgressActions = ReturnType<typeof useQuranProgress>['actions'];

/** What another screen is asking the Quran screen to do on arrival. */
export type QuranIntent = 'continue' | 'progress';

interface QuranReaderProps {
  bookmarkedAyahs: string[];   // "surahNum:ayahNum"
  lastReadSurah: number;
  /** Surah number to open straight away (e.g. Al-Kahf from the Friday card), once the list has loaded. */
  openSurah?: number | null;
  onOpenSurahHandled?: () => void;
  onBookmarkToggle: (key: string) => void;
  onUpdateLastRead: (surahNum: number) => void;
  onGoBack: () => void;
  progress: QuranProgress;
  progressActions: ProgressActions;
  /** Today's local date, which changes at midnight. */
  today: string;
  intent?: QuranIntent | null;
  onIntentHandled?: () => void;
}

const NOTICE_MS = 2500;
const NO_AYAHS: ReaderAyah[] = [];

/** Surah list, My Progress and the reading page. Data loading and preferences live here; the views only draw. */
export default function QuranReader({
  bookmarkedAyahs,
  lastReadSurah,
  onBookmarkToggle,
  onUpdateLastRead,
  openSurah,
  onOpenSurahHandled,
  onGoBack,
  progress,
  progressActions,
  today,
  intent,
  onIntentHandled,
}: QuranReaderProps) {
  const [settings, updateSettings] = useReaderSettings();
  const [view, setView] = useState<'list' | 'reader'>('list');
  const [tab, setTab] = useState<QuranTab>('read');
  /** Where the open surah was entered from, so Back returns there. */
  const [cameFrom, setCameFrom] = useState<QuranTab>('read');
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [loadingSurahs, setLoadingSurahs] = useState(true);
  const [surahError, setSurahError] = useState(false);
  const [activeSurah, setActiveSurah] = useState<Surah | null>(null);
  const [scrollToAyah, setScrollToAyah] = useState<number | null>(null);
  const [ayahs, setAyahs] = useState<ReaderAyah[]>([]);
  /** Which surah the ayahs in state belong to, so a new surah never briefly shows the old one's text. */
  const [ayahsFor, setAyahsFor] = useState<number | null>(null);
  const [loadingAyahs, setLoadingAyahs] = useState(false);
  const [ayahError, setAyahError] = useState(false);
  const [notice, setNotice] = useState({ message: '', id: 0 });
  const [listSettingsOpen, setListSettingsOpen] = useState(false);
  const requestId = useRef(0);
  const noticeTimer = useRef<number | undefined>(undefined);
  /** The surah whose ayahs are on screen, so a script change can refresh them in place. */
  const shownSurah = useRef<number | null>(null);

  // One function for every ayah card, so memoised cards are not redrawn when the parent re-renders.
  const toggleRef = useRef(onBookmarkToggle);
  toggleRef.current = onBookmarkToggle;
  const toggleBookmark = useCallback((key: string) => toggleRef.current(key), []);

  const tabRef = useRef(tab);
  tabRef.current = tab;

  const reading = view === 'reader' && activeSurah !== null;
  useWakeLock(reading && settings.keepScreenOn);
  useReadingClock({ active: reading, onCredit: (seconds, date) => progressActions.addSeconds(date, seconds) });

  const loadSurahList = useCallback(() => {
    setLoadingSurahs(true);
    setSurahError(false);
    fetch(`${API_BASE}/surah`)
      .then((r) => r.json())
      .then((data) => {
        if (data.code === 200 && Array.isArray(data.data)) setSurahs(data.data);
        else setSurahError(true);
      })
      .catch(() => setSurahError(true))
      .finally(() => setLoadingSurahs(false));
  }, []);

  useEffect(() => { loadSurahList(); }, [loadSurahList]);

  // Both the Arabic and the translation arrive in one request, so switching the translation on or off
  // is display-only. Changing the script is the only thing that fetches again.
  const editionKey = editionsFor({
    script: settings.script, showTranslation: true, showTransliteration: settings.showTransliteration, translation: settings.translation,
  }).join(',');

  const builtIn = parseTranslationId(settings.translation)?.source !== 'quranenc';

  const loadAyahs = useCallback((surah: Surah) => {
    const id = ++requestId.current;
    setLoadingAyahs(true);
    setAyahError(false);
    // Another surah starts empty. The same surah (a script change) keeps its text on screen until the
    // new text arrives, so the reader does not lose their place.
    if (shownSurah.current !== surah.number) {
      setAyahs([]);
      setAyahsFor(null);
    }
    // A bundled script (IndoPak) is read from the app's own file, alongside the request for ayah numbers.
    const bundledArabic = scriptOption(settings.script).bundled
      ? loadIndopak().then((data) => indopakAyahs(data, surah.number))
      : Promise.resolve(null);
    Promise.all([
      fetch(surahUrl(API_BASE, surah.number, editionKey.split(','))).then((r) => r.json()),
      bundledArabic,
    ])
      .then(([body, bundled]) => {
        if (id !== requestId.current) return;
        const built = buildReaderAyahs(surah.number, body, settings.script, true, settings.showTransliteration, builtIn ? PICKTHALL_ID : settings.translation, bundled);
        if (built) {
          shownSurah.current = surah.number;
          setAyahsFor(surah.number);
          setAyahs(built);
        } else {
          shownSurah.current = null;
          setAyahError(true);
        }
      })
      .catch(() => {
        if (id !== requestId.current) return;
        shownSurah.current = null;
        setAyahError(true);
      })
      .finally(() => { if (id === requestId.current) setLoadingAyahs(false); });
    // Only whether the translation is built in matters here (it rides along in this request), so moving
    // between QuranEnc translations does not fetch the Arabic again.
  }, [editionKey, builtIn, settings.script, settings.showTransliteration]);

  useEffect(() => {
    if (view === 'reader' && activeSurah) loadAyahs(activeSurah);
  }, [view, activeSurah, loadAyahs]);

  const openSurahView = useCallback((surah: Surah, ayah: number | null = null) => {
    setScrollToAyah(ayah);
    setCameFrom(tabRef.current);
    setActiveSurah(surah);
    setView('reader');
    onUpdateLastRead(surah.number);
  }, [onUpdateLastRead]);

  const openByNumber = useCallback((n: number, ayah: number | null = null) => {
    const target = surahs.find((s) => s.number === n);
    if (target) openSurahView(target, ayah);
  }, [surahs, openSurahView]);

  const continueFrom = useCallback((position: ReadingPosition | null) => {
    if (position) openByNumber(position.surah, position.ayah);
    else openByNumber(1);
  }, [openByNumber]);

  useEffect(() => {
    if (!openSurah || surahs.length === 0) return;
    openByNumber(openSurah);
    onOpenSurahHandled?.();
  }, [openSurah, surahs, openByNumber, onOpenSurahHandled]);

  // Another screen (Home) can ask to land on My Progress or to continue reading.
  useEffect(() => {
    if (!intent) return;
    if (intent === 'progress' || !progress.position) {
      setTab('progress');
      onIntentHandled?.();
      return;
    }
    if (surahs.length === 0) return;
    continueFrom(progress.position);
    onIntentHandled?.();
  }, [intent, surahs, progress.position, continueFrom, onIntentHandled]);

  const copy = useCallback((text: string) => {
    void copyText(text).then((ok) => {
      window.clearTimeout(noticeTimer.current);
      setNotice((prev) => ({ message: ok ? 'Copied' : 'Could not copy', id: prev.id + 1 }));
      noticeTimer.current = window.setTimeout(() => setNotice((prev) => ({ message: '', id: prev.id })), NOTICE_MS);
    });
  }, []);

  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  const surahName = useCallback((n: number) => surahs.find((s) => s.number === n)?.englishName ?? `Surah ${n}`, [surahs]);

  const savePosition = useCallback((surah: number, ayah: ReaderAyah, seen: { from: number; to: number }) => {
    progressActions.recordPosition({ surah, ayah: ayah.numberInSurah, global: ayah.number }, seen);
  }, [progressActions]);

  const clearScrollTarget = useCallback(() => setScrollToAyah(null), []);

  // A QuranEnc translation is fetched on its own, so choosing another one never refetches the Arabic.
  const catalog = useTranslationCatalog();

  // The phone's back button: from a surah to the list, and from My Progress to the surah list.
  useBackLayer(view === 'reader', () => { setTab(cameFrom); setView('list'); });
  useBackLayer(tab !== 'read', () => setTab('read'));
  const chosen = parseTranslationId(settings.translation);
  const quranEncKey = settings.showTranslation && chosen?.source === 'quranenc' ? chosen.key : null;
  const surahTranslation = useQuranEncSurah(quranEncKey, reading && activeSurah ? activeSurah.number : null);
  const entry = chosen?.source === 'quranenc' ? catalog.entries.find((e) => e.key === chosen.key) ?? null : null;

  const shownAyahs = activeSurah && ayahsFor === activeSurah.number ? ayahs : NO_AYAHS;
  const displayAyahs = React.useMemo(
    () => (chosen?.source === 'quranenc' ? applyTranslation(shownAyahs, surahTranslation.map) : shownAyahs),
    [shownAyahs, surahTranslation.map, chosen?.source],
  );

  const translationView: TranslationView = {
    credit: translationCredit(entry, chosen?.source === 'quranenc' ? chosen.key : undefined),
    // Without a catalogue entry the language is unknown: let the browser decide the direction.
    direction: entry?.direction ?? (chosen?.source === 'quranenc' ? 'auto' : 'ltr'),
    language: entry?.language ?? (chosen?.source === 'quranenc' ? undefined : 'en'),
    status: !quranEncKey ? 'ready' : surahTranslation.status === 'ready' ? 'ready' : surahTranslation.status === 'error' ? 'error' : 'loading',
    onRetry: surahTranslation.retry,
    onUseDefault: () => updateSettings({ translation: PICKTHALL_ID }),
  };

  if (view === 'list' || !activeSurah) {
    if (tab === 'progress') {
      return (
        <QuranProgressView
          onGoBack={onGoBack}
          tabs={<QuranTabs tab={tab} onChange={setTab} />}
          progress={progress}
          today={today}
          surahName={surahName}
          onSetGoal={progressActions.setGoal}
          onContinue={continueFrom}
          onStartKhatam={(days) => progressActions.startKhatam(today, days)}
          onEndKhatam={progressActions.endKhatam}
        />
      );
    }

    return (
      <>
      <SurahList
        surahs={surahs}
        loading={loadingSurahs}
        error={surahError}
        onRetry={loadSurahList}
        lastReadSurah={lastReadSurah}
        bookmarkedAyahs={bookmarkedAyahs}
        onSelect={(s) => openSurahView(s)}
        onGoBack={onGoBack}
        tabs={<QuranTabs tab={tab} onChange={setTab} />}
        onOpenSettings={() => setListSettingsOpen(true)}
      />
      {/* The sheet takes its colours from the reading theme, so it carries the theme on its own wrapper. */}
      <div data-reader-theme={settings.theme}>
        <ReaderSettingsSheet open={listSettingsOpen} onClose={() => setListSettingsOpen(false)} settings={settings} onChange={updateSettings} catalog={catalog} />
      </div>
      </>
    );
  }

  return (
    <ReaderView
      surah={activeSurah}
      ayahs={displayAyahs}
      loading={loadingAyahs}
      error={ayahError}
      settings={settings}
      onChangeSettings={updateSettings}
      bookmarkedAyahs={bookmarkedAyahs}
      onBookmarkToggle={toggleBookmark}
      onBack={() => { setTab(cameFrom); setView('list'); }}
      backTo={cameFrom === 'progress' ? 'progress' : 'surahs'}
      onRetry={() => loadAyahs(activeSurah)}
      onOpenSurah={(n) => openByNumber(n)}
      onCopy={copy}
      notice={notice.message}
      noticeId={notice.id}
      goal={progress.goalMinutes ? { minutes: minutesOn(progress, today), goalMinutes: progress.goalMinutes } : null}
      scrollToAyah={scrollToAyah}
      onScrolledToAyah={clearScrollTarget}
      onPosition={savePosition}
      translation={translationView}
      catalog={catalog}
    />
  );
}
