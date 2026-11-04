import React from 'react';
import { Bookmark, BookOpen, ChevronLeft, ChevronRight, Copy, Loader2, RefreshCw, Settings2, X } from 'lucide-react';
import ReaderSettingsSheet from './ReaderSettingsSheet';
import PageJumpSheet from './PageJumpSheet';
import LayoutPageView from './LayoutPageView';
import { formatAyahForCopy } from '../quran/editions';
import { plainForCopy } from '../quran/indopak';
import {
  LAYOUT_PAGES, ayahsOnPage, clampLayoutPage, firstPageOfJuz, juzOfAyah,
} from '../quran/indopak-layout';
import { swipeDirection } from '../quran/pages';
import type { ReaderSettings } from '../quran/settings';
import type { Surah } from '../quran/types';
import { useAyahTranslation } from '../quran/useAyahTranslation';
import { useIndopakLayout } from '../quran/useIndopakLayout';
import type { CatalogState } from './TranslationPicker';

interface IndopakPagesReaderProps {
  initialPage: number;
  settings: ReaderSettings;
  onChangeSettings: (patch: Partial<ReaderSettings>) => void;
  catalog?: CatalogState;
  surahs: readonly Surah[];
  bookmarkedAyahs: string[];
  onBookmarkToggle: (key: string) => void;
  onBack: () => void;
  onOpenSurah: (surah: number, ayah: number) => void;
  /** Where the reader is after a few seconds on a page: the first ayah on it and the span it holds. */
  onPosition: (position: { surah: number; ayah: number; global: number }, range: { from: number; to: number }) => void;
  onPageChange: (page: number) => void;
  onCopy: (text: string) => void;
  notice?: string;
  noticeId?: number;
  canOpenSurah?: boolean;
  /** How long a page is on screen, after a touch, before it counts as read. */
  dwellMs?: number;
}

const barButton = { background: 'var(--reader-surface)', border: '1px solid var(--reader-border)', color: 'var(--reader-ink)' } as const;
const DEFAULT_DWELL_MS = 4000;
/** Shown for the juz buttons only until the layout has loaded. */
const JUZ_PLACEHOLDER: readonly number[] = Array.from({ length: 30 }, () => 1);

/** The 15-line IndoPak mushaf: 610 printed pages, each seen whole. Swipe or tap to turn, tap a word for its ayah. */
export default function IndopakPagesReader({
  initialPage, settings, onChangeSettings, catalog, surahs, bookmarkedAyahs, onBookmarkToggle, onBack, onOpenSurah,
  onPosition, onPageChange, onCopy, notice = '', noticeId = 0, canOpenSurah = true, dwellMs = DEFAULT_DWELL_MS,
}: IndopakPagesReaderProps) {
  const { status, data, retry } = useIndopakLayout();
  const [pageNumber, setPageNumber] = React.useState(() => clampLayoutPage(initialPage));
  const [selected, setSelected] = React.useState<number | null>(null);
  const [jumpOpen, setJumpOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const bookmarked = React.useMemo(() => new Set(bookmarkedAyahs), [bookmarkedAyahs]);

  const ayahsHere = React.useMemo(() => (data ? ayahsOnPage(data.layout, data.words, pageNumber) : []), [data, pageNumber]);
  const firstIndex = ayahsHere[0];
  const lastIndex = ayahsHere[ayahsHere.length - 1];
  const refOf = (index: number | undefined) => (data && index !== undefined ? data.words.refs[index] : undefined);
  const surahName = (n: number | undefined) => (n === undefined ? '' : surahs.find((s) => s.number === n)?.englishName ?? `Surah ${n}`);

  const stats = React.useRef({ dwelled: false, touched: false, recorded: false });
  const arrivedByTurn = React.useRef(false);
  const start = React.useRef<{ x: number; y: number } | null>(null);

  const pageRef = React.useRef(pageNumber);
  pageRef.current = pageNumber;
  const goTo = React.useCallback((target: number) => {
    const next = clampLayoutPage(target);
    if (next === pageRef.current) return;
    arrivedByTurn.current = Math.abs(next - pageRef.current) === 1;
    setSelected(null);
    setPageNumber(next);
  }, []);

  React.useEffect(() => { onPageChange(pageNumber); }, [pageNumber, onPageChange]);

  // A page counts as read after a few seconds on screen, once the reader has touched the screen.
  const positionRef = React.useRef(onPosition);
  positionRef.current = onPosition;
  const hereRef = React.useRef({ first: firstIndex, last: lastIndex, data });
  hereRef.current = { first: firstIndex, last: lastIndex, data };
  const recordIfRead = React.useCallback(() => {
    const s = stats.current;
    const { first, last, data: bundle } = hereRef.current;
    if (!bundle || first === undefined || last === undefined || !s.dwelled || !s.touched || s.recorded) return;
    s.recorded = true;
    const ref = bundle.words.refs[first];
    positionRef.current({ surah: ref.surah, ayah: ref.ayah, global: first + 1 }, { from: first + 1, to: last + 1 });
  }, []);
  React.useEffect(() => {
    if (!data) return;
    stats.current = { dwelled: false, touched: arrivedByTurn.current, recorded: false };
    arrivedByTurn.current = false;
    const timer = window.setTimeout(() => {
      stats.current.dwelled = true;
      recordIfRead();
    }, dwellMs);
    return () => window.clearTimeout(timer);
  }, [data, pageNumber, dwellMs, recordIfRead]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (jumpOpen || settingsOpen || e.altKey || e.ctrlKey || e.metaKey) return;
      // The Quran reads right to left, so the left arrow moves on.
      if (e.key === 'ArrowLeft') goTo(pageNumber + 1);
      else if (e.key === 'ArrowRight') goTo(pageNumber - 1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [goTo, pageNumber, jumpOpen, settingsOpen]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.isPrimary === false) return;
    stats.current.touched = true;
    recordIfRead();
    start.current = e.pointerType === 'mouse' ? null : { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const from = start.current;
    start.current = null;
    if (!from || e.isPrimary === false) return;
    const direction = swipeDirection(e.clientX - from.x, e.clientY - from.y);
    if (direction === 'next') goTo(pageNumber + 1);
    else if (direction === 'prev') goTo(pageNumber - 1);
  };

  const chosenRef = refOf(selected ?? undefined);
  const translation = useAyahTranslation(chosenRef?.surah ?? null, chosenRef?.ayah ?? null, settings.showTranslation);
  const chosenText = data && selected !== null
    ? data.words.words.slice(data.words.ayahStart[selected] - 1, (data.words.ayahStart[selected + 1] ?? data.words.words.length + 1) - 1).join(' ')
    : '';
  const chosenKey = chosenRef ? `${chosenRef.surah}:${chosenRef.ayah}` : '';

  const first = refOf(firstIndex);
  const last = refOf(lastIndex);
  const title = first ? `${surahName(first.surah)}${last && last.surah !== first.surah ? ` – ${surahName(last.surah)}` : ''}` : '';
  const juzPages = React.useMemo(
    () => (data ? Array.from({ length: 30 }, (_, i) => firstPageOfJuz(data.layout, data.words, i + 1)) : undefined),
    [data],
  );

  return (
    <div className="screen relative" data-reader-theme={settings.theme} style={{ background: 'var(--reader-bg)', color: 'var(--reader-ink)' }}>
      <header className="shrink-0 px-4 pt-3 pb-3" style={{ borderBottom: '1px solid var(--reader-border)' }}>
        <div className="flex items-center gap-2">
          <button onClick={onBack} aria-label="Back to Surah list" className="tap-target flex items-center gap-1 rounded-xl px-2 text-sm font-bold cursor-pointer" style={{ color: 'var(--reader-accent)' }}>
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            <span>Surahs</span>
          </button>
          <div className="min-w-0 flex-1 text-center">
            <h1 className="truncate text-base font-bold">{title || 'Pages'}</h1>
            <p className="text-xs" style={{ color: 'var(--reader-muted)' }}>
              {data && firstIndex !== undefined ? `Juz ${juzOfAyah(data.words, firstIndex)} · 15-line IndoPak` : '15-line IndoPak'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button type="button" aria-label="Go to page or juz" aria-haspopup="dialog" onClick={() => setJumpOpen(true)} className="tap-target flex w-11 items-center justify-center rounded-xl cursor-pointer" style={barButton}>
              <BookOpen className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" aria-label="Reader settings" aria-haspopup="dialog" onClick={() => setSettingsOpen(true)} className="tap-target flex w-11 items-center justify-center rounded-xl cursor-pointer" style={barButton}>
              <Settings2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <div
        data-page-area
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { start.current = null; }}
        className="flex min-h-0 flex-1 flex-col"
        style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}
      >
        {status === 'loading' && (
          <p role="status" className="flex items-center justify-center gap-2 py-16 text-sm" style={{ color: 'var(--reader-muted)' }}>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading the 15-line pages…
          </p>
        )}
        {status === 'error' && (
          <div className="py-16 text-center">
            <p className="text-sm" style={{ color: 'var(--reader-muted)' }}>Could not load the 15-line pages.</p>
            <button type="button" onClick={retry} className="tap-target mt-3 inline-flex items-center gap-2 rounded-xl px-4 text-sm font-bold cursor-pointer" style={barButton}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Retry
            </button>
          </div>
        )}
        {status === 'ready' && data && (
          <LayoutPageView layout={data.layout} words={data.words} page={pageNumber} surahs={surahs} selected={selected} onSelect={(i) => setSelected((c) => (c === i ? null : i))} />
        )}
      </div>

      {chosenRef && (
        <div className="shrink-0 space-y-2 px-4 py-3" style={{ background: 'var(--reader-surface)', borderTop: '1px solid var(--reader-border)' }}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold">{surahName(chosenRef.surah)} {chosenKey}</p>
            <button type="button" aria-label="Close ayah details" onClick={() => setSelected(null)} className="tap-target flex w-11 items-center justify-center rounded-xl cursor-pointer" style={barButton}>
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          {settings.showTranslation && translation && (
            <p className="text-base leading-relaxed" style={{ color: 'var(--reader-muted)' }}>{translation}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-label="Copy ayah"
              onClick={() => onCopy(formatAyahForCopy({
                surahName: surahName(chosenRef.surah),
                surahNumber: chosenRef.surah,
                ayahNumber: chosenRef.ayah,
                arabic: plainForCopy(chosenText),
                translation: settings.showTranslation ? translation : null,
              }))}
              className="tap-target flex items-center gap-1.5 rounded-xl px-4 text-xs font-bold cursor-pointer"
              style={barButton}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copy
            </button>
            <button
              type="button"
              aria-label="Bookmark ayah"
              aria-pressed={bookmarked.has(chosenKey)}
              onClick={() => onBookmarkToggle(chosenKey)}
              className="tap-target flex items-center gap-1.5 rounded-xl px-4 text-xs font-bold cursor-pointer"
              style={barButton}
            >
              <Bookmark className={`h-3.5 w-3.5 ${bookmarked.has(chosenKey) ? 'fill-current' : ''}`} aria-hidden="true" /> Bookmark
            </button>
            <button type="button" aria-label="Read in surah view" disabled={!canOpenSurah} onClick={() => onOpenSurah(chosenRef.surah, chosenRef.ayah)} className="tap-target disabled:opacity-40 flex items-center gap-1.5 rounded-xl px-4 text-xs font-bold cursor-pointer" style={barButton}>
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" /> Read in surah view
            </button>
          </div>
        </div>
      )}

      <footer className="shrink-0 px-4 py-2" style={{ borderTop: '1px solid var(--reader-border)' }}>
        <div className="flex items-center justify-between gap-2">
          {/* Next sits on the left because the Quran reads right to left. */}
          <button type="button" aria-label="Next page" disabled={pageNumber >= LAYOUT_PAGES} onClick={() => goTo(pageNumber + 1)} className="tap-target flex w-12 items-center justify-center rounded-xl cursor-pointer disabled:opacity-40" style={barButton}>
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <p className="text-sm font-bold" aria-live="polite">Page {pageNumber} <span style={{ color: 'var(--reader-muted)' }}>of {LAYOUT_PAGES}</span></p>
          <button type="button" aria-label="Previous page" disabled={pageNumber <= 1} onClick={() => goTo(pageNumber - 1)} className="tap-target flex w-12 items-center justify-center rounded-xl cursor-pointer disabled:opacity-40" style={barButton}>
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </footer>

      <p key={noticeId} className="sr-only" role="status" aria-live="polite">{notice}</p>

      <PageJumpSheet open={jumpOpen} onClose={() => setJumpOpen(false)} page={pageNumber} total={LAYOUT_PAGES} juzFirstPages={juzPages ?? JUZ_PLACEHOLDER} onGo={(target) => { goTo(target); setJumpOpen(false); }} />
      <ReaderSettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} onChange={onChangeSettings} catalog={catalog} />
    </div>
  );
}
