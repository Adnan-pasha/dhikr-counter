import React, { useState, useEffect, useCallback, useRef } from 'react';
import SurahList from './SurahList';
import ReaderView from './ReaderView';
import { API_BASE, buildReaderAyahs, editionsFor, surahUrl, type ReaderAyah } from '../quran/editions';
import { useReaderSettings } from '../quran/useReaderSettings';
import { useWakeLock } from '../quran/useWakeLock';
import { copyText } from '../quran/clipboard';
import type { Surah } from '../quran/types';

interface QuranReaderProps {
  bookmarkedAyahs: string[];   // "surahNum:ayahNum"
  lastReadSurah: number;
  /** Surah number to open straight away (e.g. Al-Kahf from the Friday card), once the list has loaded. */
  openSurah?: number | null;
  onOpenSurahHandled?: () => void;
  onBookmarkToggle: (key: string) => void;
  onUpdateLastRead: (surahNum: number) => void;
  onGoBack: () => void;
}

const NOTICE_MS = 2500;

/** Surah list and reading page. Data loading and preferences live here; the two views only draw. */
export default function QuranReader({
  bookmarkedAyahs,
  lastReadSurah,
  onBookmarkToggle,
  onUpdateLastRead,
  openSurah,
  onOpenSurahHandled,
  onGoBack,
}: QuranReaderProps) {
  const [settings, updateSettings] = useReaderSettings();
  const [view, setView] = useState<'list' | 'reader'>('list');
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [loadingSurahs, setLoadingSurahs] = useState(true);
  const [surahError, setSurahError] = useState(false);
  const [activeSurah, setActiveSurah] = useState<Surah | null>(null);
  const [ayahs, setAyahs] = useState<ReaderAyah[]>([]);
  const [loadingAyahs, setLoadingAyahs] = useState(false);
  const [ayahError, setAyahError] = useState(false);
  const [notice, setNotice] = useState({ message: '', id: 0 });
  const requestId = useRef(0);
  const noticeTimer = useRef<number | undefined>(undefined);
  /** The surah whose ayahs are on screen, so a script change can refresh them in place. */
  const shownSurah = useRef<number | null>(null);

  // One function for every ayah card, so memoised cards are not redrawn when the parent re-renders.
  const toggleRef = useRef(onBookmarkToggle);
  toggleRef.current = onBookmarkToggle;
  const toggleBookmark = useCallback((key: string) => toggleRef.current(key), []);

  useWakeLock(view === 'reader' && settings.keepScreenOn);

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
  const editionKey = editionsFor({ script: settings.script, showTranslation: true, showTransliteration: settings.showTransliteration }).join(',');

  const loadAyahs = useCallback((surah: Surah) => {
    const id = ++requestId.current;
    setLoadingAyahs(true);
    setAyahError(false);
    // Another surah starts empty. The same surah (a script change) keeps its text on screen until the
    // new text arrives, so the reader does not lose their place.
    if (shownSurah.current !== surah.number) setAyahs([]);
    fetch(surahUrl(API_BASE, surah.number, editionKey.split(',')))
      .then((r) => r.json())
      .then((body) => {
        if (id !== requestId.current) return;
        const built = buildReaderAyahs(surah.number, body, settings.script, true, settings.showTransliteration);
        if (built) {
          shownSurah.current = surah.number;
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
  }, [editionKey, settings.script, settings.showTransliteration]);

  useEffect(() => {
    if (view === 'reader' && activeSurah) loadAyahs(activeSurah);
  }, [view, activeSurah, loadAyahs]);

  const openSurahView = useCallback((surah: Surah) => {
    setActiveSurah(surah);
    setView('reader');
    onUpdateLastRead(surah.number);
  }, [onUpdateLastRead]);

  const openByNumber = useCallback((n: number) => {
    const target = surahs.find((s) => s.number === n);
    if (target) openSurahView(target);
  }, [surahs, openSurahView]);

  useEffect(() => {
    if (!openSurah || surahs.length === 0) return;
    openByNumber(openSurah);
    onOpenSurahHandled?.();
  }, [openSurah, surahs, openByNumber, onOpenSurahHandled]);

  const copy = useCallback((text: string) => {
    void copyText(text).then((ok) => {
      window.clearTimeout(noticeTimer.current);
      setNotice((prev) => ({ message: ok ? 'Copied' : 'Could not copy', id: prev.id + 1 }));
      noticeTimer.current = window.setTimeout(() => setNotice((prev) => ({ message: '', id: prev.id })), NOTICE_MS);
    });
  }, []);

  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  if (view === 'list' || !activeSurah) {
    return (
      <SurahList
        surahs={surahs}
        loading={loadingSurahs}
        error={surahError}
        onRetry={loadSurahList}
        lastReadSurah={lastReadSurah}
        bookmarkedAyahs={bookmarkedAyahs}
        onSelect={openSurahView}
        onGoBack={onGoBack}
      />
    );
  }

  return (
    <ReaderView
      surah={activeSurah}
      ayahs={ayahs}
      loading={loadingAyahs}
      error={ayahError}
      settings={settings}
      onChangeSettings={updateSettings}
      bookmarkedAyahs={bookmarkedAyahs}
      onBookmarkToggle={toggleBookmark}
      onBack={() => setView('list')}
      onRetry={() => loadAyahs(activeSurah)}
      onOpenSurah={openByNumber}
      onCopy={copy}
      notice={notice.message}
      noticeId={notice.id}
    />
  );
}
