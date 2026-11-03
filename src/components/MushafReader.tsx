import React from 'react';
import { Bookmark, BookOpen, ChevronLeft, ChevronRight, Copy, Loader2, RefreshCw, Settings2, X } from 'lucide-react';
import ReaderSettingsSheet from './ReaderSettingsSheet';
import TajweedText from './TajweedText';
import PageJumpSheet from './PageJumpSheet';
import { scriptOption } from '../quran/editions';
import { formatAyahForCopy } from '../quran/editions';
import { plainForCopy, BASMALA_INDOPAK } from '../quran/indopak';
import { clampPage, swipeDirection, TOTAL_PAGES, type PageAyah, type PageSurahStart } from '../quran/pages';
import { arabicFontSize, type ReaderSettings } from '../quran/settings';
import { BASMALA, toArabicDigits } from '../quran/text';
import { useMushafPage } from '../quran/useMushafPage';
import type { CatalogState } from './TranslationPicker';

interface MushafReaderProps {
  initialPage: number;
  settings: ReaderSettings;
  onChangeSettings: (patch: Partial<ReaderSettings>) => void;
  catalog?: CatalogState;
  bookmarkedAyahs: string[];
  onBookmarkToggle: (key: string) => void;
  onBack: () => void;
  /** Opens the surah reader at an ayah, where every translation is available. */
  onOpenSurah: (surah: number, ayah: number) => void;
  /** Where the reader is after a few seconds on a page: the first ayah on it and the span it holds. */
  onPosition: (position: { surah: number; ayah: number; global: number }, range: { from: number; to: number }) => void;
  onPageChange: (page: number) => void;
  onCopy: (text: string) => void;
  /** The result of the last copy ("Copied"), announced to screen readers. */
  notice?: string;
  /** Changes with every notice so a repeated message is announced again. */
  noticeId?: number;
  /** False until the surah list has loaded, which "Read in surah view" needs. */
  canOpenSurah?: boolean;
  /** How long a page is on screen, after a touch, before it counts as read. */
  dwellMs?: number;
}

const barButton = { background: 'var(--reader-surface)', border: '1px solid var(--reader-border)', color: 'var(--reader-ink)' } as const;
const DEFAULT_DWELL_MS = 4000;

/** Splits a page's ayahs where a surah begins, so each surah gets its banner and its own run of text. */
const runsOf = (ayahs: readonly PageAyah[]): PageAyah[][] => {
  const runs: PageAyah[][] = [];
  for (const ayah of ayahs) {
    if (runs.length === 0 || ayah.numberInSurah === 1) runs.push([]);
    runs[runs.length - 1].push(ayah);
  }
  return runs;
};

/** The mushaf as 604 pages: swipe or tap to turn, jump to a page or juz, tap an ayah for its translation. */
export default function MushafReader({
  initialPage, settings, onChangeSettings, catalog, bookmarkedAyahs, onBookmarkToggle, onBack, onOpenSurah,
  onPosition, onPageChange, onCopy, notice = '', noticeId = 0, canOpenSurah = true, dwellMs = DEFAULT_DWELL_MS,
}: MushafReaderProps) {
  const [pageNumber, setPageNumber] = React.useState(() => clampPage(initialPage));
  const [selected, setSelected] = React.useState<number | null>(null);
  const [jumpOpen, setJumpOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const script = scriptOption(settings.script);
  const wantTranslation = settings.showTranslation;
  const { status, page, retry } = useMushafPage(pageNumber, settings.script, wantTranslation);

  /**
   * What counts a page as read: it has been on screen for the dwell time, and the reader has touched the screen
   * while it was there. Opening a page, or landing on one by a jump, is not reading it.
   */
  const stats = React.useRef({ dwelled: false, touched: false, recorded: false });
  /** Set when the reader turned to the page next door, which is reading on from the last one. */
  const arrivedByTurn = React.useRef(false);
  const start = React.useRef<{ x: number; y: number } | null>(null);
  const areaRef = React.useRef<HTMLDivElement>(null);
  const bookmarked = React.useMemo(() => new Set(bookmarkedAyahs), [bookmarkedAyahs]);

  const pageRef = React.useRef(pageNumber);
  pageRef.current = pageNumber;
  const goTo = React.useCallback((target: number) => {
    const next = clampPage(target);
    if (next === pageRef.current) return;
    arrivedByTurn.current = Math.abs(next - pageRef.current) === 1;
    setSelected(null);
    setPageNumber(next);
  }, []);

  React.useEffect(() => { onPageChange(pageNumber); }, [pageNumber, onPageChange]);

  // A page counts as read after a few seconds on screen, once the reader has touched the screen.
  const positionRef = React.useRef(onPosition);
  positionRef.current = onPosition;
  const shownRef = React.useRef(page);
  shownRef.current = page;
  const recordIfRead = React.useCallback(() => {
    const s = stats.current;
    const shown = shownRef.current;
    if (!shown || !s.dwelled || !s.touched || s.recorded) return;
    s.recorded = true;
    const first = shown.ayahs[0];
    positionRef.current({ surah: first.surah, ayah: first.numberInSurah, global: first.number }, shown.range);
  }, []);
  React.useEffect(() => {
    if (!page) return;
    stats.current = { dwelled: false, touched: arrivedByTurn.current, recorded: false };
    arrivedByTurn.current = false;
    const timer = window.setTimeout(() => {
      stats.current.dwelled = true;
      recordIfRead();
    }, dwellMs);
    return () => window.clearTimeout(timer);
  }, [page, dwellMs, recordIfRead]);

  // A page opens at its top, whatever the last one was scrolled to.
  React.useEffect(() => { if (areaRef.current) areaRef.current.scrollTop = 0; }, [pageNumber]);

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
    // A mouse drag selects text; only a finger turns the page.
    start.current = e.pointerType === 'mouse' ? null : { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const from = start.current;
    start.current = null;
    if (!from || e.isPrimary === false) return;
    if (window.getSelection()?.toString()) return;
    const direction = swipeDirection(e.clientX - from.x, e.clientY - from.y);
    if (direction === 'next') goTo(pageNumber + 1);
    else if (direction === 'prev') goTo(pageNumber - 1);
  };

  const chosen = page?.ayahs.find((a) => a.number === selected) ?? null;
  const fontClass = script.font === 'indopak' ? 'font-indopak' : 'font-quran';
  const lastAyah = page?.ayahs[page.ayahs.length - 1];
  const title = page && lastAyah ? `${page.ayahs[0].surahName}${lastAyah.surah !== page.ayahs[0].surah ? ` – ${lastAyah.surahName}` : ''}` : '';

  const toggle = (number: number) => setSelected((current) => (current === number ? null : number));

  const banner = (start: PageSurahStart) => (
    <div key={`banner-${start.number}`} className="mb-3 mt-2 text-center">
      <p className="rounded-xl py-1 text-sm font-bold" style={{ background: 'var(--reader-surface)', border: '1px solid var(--reader-border)', color: 'var(--reader-accent)' }}>
        <span lang="ar" dir="rtl" className="font-quran text-lg">{start.name}</span>
        <span className="mx-2" aria-hidden="true">·</span>
        <span>{start.englishName}</span>
      </p>
      {start.hasBasmala && (
        <p lang="ar" dir="rtl" className={`${fontClass} mt-2 text-2xl`} style={{ color: 'var(--reader-accent)' }}>
          {settings.script === 'indopak' ? BASMALA_INDOPAK : BASMALA}
        </p>
      )}
    </div>
  );

  const ayahText = (ayah: PageAyah) => (
    <span
      key={ayah.number}
      data-ayah={ayah.number}
      role="button"
      tabIndex={0}
      aria-pressed={selected === ayah.number}
      onClick={() => toggle(ayah.number)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(ayah.number); } }}
      className="cursor-pointer rounded-md"
      style={{ background: selected === ayah.number ? 'color-mix(in srgb, var(--reader-accent) 22%, transparent)' : undefined }}
    >
      {script.selfNumbered ? (
        <>
          <span className="sr-only">{plainForCopy(ayah.arabic)}</span>
          <span aria-hidden="true">{ayah.arabic}</span>
        </>
      ) : (
        <>
          {ayah.segments ? <TajweedText segments={ayah.segments} /> : ayah.arabic}{' '}
          <span aria-hidden="true" style={{ color: 'var(--reader-accent)' }}>&#xFD3F;{toArabicDigits(ayah.numberInSurah)}&#xFD3E;</span>
        </>
      )}{' '}
    </span>
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
            <p className="text-xs" style={{ color: 'var(--reader-muted)' }}>{page ? `Juz ${page.juz}` : 'Mushaf pages'}</p>
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
        ref={areaRef}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { start.current = null; }}
        className="flex-1 overflow-y-auto px-4 py-4"
        style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}
      >
        {status === 'loading' && (
          <p role="status" className="flex items-center justify-center gap-2 py-16 text-sm" style={{ color: 'var(--reader-muted)' }}>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading page {pageNumber}…
          </p>
        )}
        {status === 'error' && (
          <div className="py-16 text-center">
            <p className="text-sm" style={{ color: 'var(--reader-muted)' }}>Could not load this page.</p>
            <button type="button" onClick={retry} className="tap-target mt-3 inline-flex items-center gap-2 rounded-xl px-4 text-sm font-bold cursor-pointer" style={barButton}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Retry
            </button>
          </div>
        )}
        {status === 'ready' && page && runsOf(page.ayahs).map((run, i) => {
          const starts = page.surahStarts.find((s) => s.number === run[0].surah && run[0].numberInSurah === 1);
          return (
            <section key={`${run[0].number}-${i}`}>
              {starts && banner(starts)}
              <p
                lang="ar"
                dir="rtl"
                className={`${fontClass} text-justify`}
                style={{ fontSize: arabicFontSize(settings.textSize), lineHeight: 2.3, unicodeBidi: 'isolate', textAlignLast: 'center' }}
              >
                {run.map(ayahText)}
              </p>
            </section>
          );
        })}
      </div>

      {chosen && (
        <div className="shrink-0 space-y-2 px-4 py-3" style={{ background: 'var(--reader-surface)', borderTop: '1px solid var(--reader-border)' }}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold">{chosen.surahName} {chosen.surah}:{chosen.numberInSurah}</p>
            <button type="button" aria-label="Close ayah details" onClick={() => setSelected(null)} className="tap-target flex w-11 items-center justify-center rounded-xl cursor-pointer" style={barButton}>
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          {settings.showTranslation && chosen.translation && (
            <p className="text-base leading-relaxed" style={{ color: 'var(--reader-muted)' }}>{chosen.translation}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-label="Copy ayah"
              onClick={() => onCopy(formatAyahForCopy({
                surahName: chosen.surahName,
                surahNumber: chosen.surah,
                ayahNumber: chosen.numberInSurah,
                arabic: script.selfNumbered ? plainForCopy(chosen.arabic) : chosen.arabic,
                translation: settings.showTranslation ? chosen.translation : null,
              }))}
              className="tap-target flex items-center gap-1.5 rounded-xl px-4 text-xs font-bold cursor-pointer"
              style={barButton}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copy
            </button>
            <button
              type="button"
              aria-label="Bookmark ayah"
              aria-pressed={bookmarked.has(`${chosen.surah}:${chosen.numberInSurah}`)}
              onClick={() => onBookmarkToggle(`${chosen.surah}:${chosen.numberInSurah}`)}
              className="tap-target flex items-center gap-1.5 rounded-xl px-4 text-xs font-bold cursor-pointer"
              style={barButton}
            >
              <Bookmark className={`h-3.5 w-3.5 ${bookmarked.has(`${chosen.surah}:${chosen.numberInSurah}`) ? 'fill-current' : ''}`} aria-hidden="true" /> Bookmark
            </button>
            <button type="button" aria-label="Read in surah view" disabled={!canOpenSurah} onClick={() => onOpenSurah(chosen.surah, chosen.numberInSurah)} className="tap-target disabled:opacity-40 flex items-center gap-1.5 rounded-xl px-4 text-xs font-bold cursor-pointer" style={barButton}>
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" /> Read in surah view
            </button>
          </div>
        </div>
      )}

      <footer className="shrink-0 px-4 py-2" style={{ borderTop: '1px solid var(--reader-border)' }}>
        <div className="flex items-center justify-between gap-2">
          {/* Next sits on the left because the Quran reads right to left. */}
          <button type="button" aria-label="Next page" disabled={pageNumber >= TOTAL_PAGES} onClick={() => goTo(pageNumber + 1)} className="tap-target flex w-12 items-center justify-center rounded-xl cursor-pointer disabled:opacity-40" style={barButton}>
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <p className="text-sm font-bold" aria-live="polite">Page {pageNumber} <span style={{ color: 'var(--reader-muted)' }}>of {TOTAL_PAGES}</span></p>
          <button type="button" aria-label="Previous page" disabled={pageNumber <= 1} onClick={() => goTo(pageNumber - 1)} className="tap-target flex w-12 items-center justify-center rounded-xl cursor-pointer disabled:opacity-40" style={barButton}>
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-1 text-center text-xs" style={{ color: 'var(--reader-muted)' }}>Swipe right for the next page</p>
      </footer>

      <p key={noticeId} className="sr-only" role="status" aria-live="polite">{notice}</p>

      <PageJumpSheet open={jumpOpen} onClose={() => setJumpOpen(false)} page={pageNumber} onGo={(target) => { goTo(target); setJumpOpen(false); }} />
      <ReaderSettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} onChange={onChangeSettings} catalog={catalog} />
    </div>
  );
}
