import React from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, ListOrdered, Loader2, RefreshCw, Settings2 } from 'lucide-react';
import AyahCard from './AyahCard';
import ReaderSettingsSheet from './ReaderSettingsSheet';
import type { ReaderAyah } from '../quran/editions';
import type { ReaderSettings } from '../quran/settings';
import { BASMALA, hasBasmalaHeader } from '../quran/text';
import { JUZ_STARTS, type Surah } from '../quran/types';

interface ReaderViewProps {
  surah: Surah;
  ayahs: ReaderAyah[];
  loading: boolean;
  error: boolean;
  settings: ReaderSettings;
  onChangeSettings: (patch: Partial<ReaderSettings>) => void;
  bookmarkedAyahs: string[];
  /** Receives "surah:ayah". Must be a stable function so memoised cards are not redrawn. */
  onBookmarkToggle: (key: string) => void;
  onBack: () => void;
  onRetry: () => void;
  onOpenSurah: (surahNumber: number) => void;
  onCopy: (text: string) => void;
  /** Short status such as "Copied", announced to screen readers. */
  notice: string;
  /** Changes with every notice so a repeated message is announced again. */
  noticeId: number;
}

const barButton = { background: 'var(--reader-surface)', border: '1px solid var(--reader-border)', color: 'var(--reader-ink)' } as const;

/** The reading page: header, Bismillah, one card per ayah, previous and next, and the settings sheet. */
export default function ReaderView({
  surah, ayahs, loading, error, settings, onChangeSettings, bookmarkedAyahs, onBookmarkToggle, onBack, onRetry, onOpenSurah, onCopy, notice, noticeId,
}: ReaderViewProps) {
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [juzOpen, setJuzOpen] = React.useState(false);
  const gearRef = React.useRef<HTMLButtonElement>(null);
  const bookmarked = React.useMemo(() => new Set(bookmarkedAyahs), [bookmarkedAyahs]);

  const closeSettings = () => {
    setSettingsOpen(false);
    gearRef.current?.focus();
  };

  return (
    <div
      className="screen relative"
      data-reader-theme={settings.theme}
      style={{ background: 'var(--reader-bg)', color: 'var(--reader-ink)' }}
    >
      <header className="shrink-0 px-4 pt-3 pb-3" style={{ borderBottom: '1px solid var(--reader-border)' }}>
        <div className="flex items-center gap-2">
          <button onClick={onBack} aria-label="Back to Surah list" className="tap-target flex items-center gap-1 rounded-xl px-2 text-sm font-bold cursor-pointer" style={{ color: 'var(--reader-accent)' }}>
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            <span>Surahs</span>
          </button>

          <div className="min-w-0 flex-1 text-center">
            <h1 className="truncate text-base font-bold">{surah.englishName}</h1>
            <p className="text-xs" style={{ color: 'var(--reader-muted)' }}>{surah.englishNameTranslation} · {surah.numberOfAyahs} ayahs</p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              aria-label="Jump to Juz"
              aria-expanded={juzOpen}
              onClick={() => setJuzOpen((v) => !v)}
              className="tap-target flex w-11 items-center justify-center rounded-xl cursor-pointer"
              style={barButton}
            >
              <ListOrdered className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              ref={gearRef}
              type="button"
              aria-label="Reader settings"
              aria-haspopup="dialog"
              onClick={() => setSettingsOpen(true)}
              className="tap-target flex w-11 items-center justify-center rounded-xl cursor-pointer"
              style={barButton}
            >
              <Settings2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {juzOpen && (
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide" role="group" aria-label="Jump to Juz">
            {JUZ_STARTS.map((j) => (
              <button
                key={j.juz}
                type="button"
                onClick={() => { onOpenSurah(j.surah); setJuzOpen(false); }}
                className="tap-target flex shrink-0 flex-col items-center justify-center rounded-xl px-3 cursor-pointer"
                style={barButton}
              >
                <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--reader-accent)' }}>Juz {j.juz}</span>
                <span className="text-xs" style={{ color: 'var(--reader-muted)' }}>{j.label}</span>
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto" aria-busy={loading}>
        {loading && ayahs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20" role="status">
            <Loader2 className="mb-3 h-8 w-8 animate-spin" aria-hidden="true" style={{ color: 'var(--reader-accent)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--reader-muted)' }}>Loading {surah.englishName}...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <AlertCircle className="mb-3 h-10 w-10" aria-hidden="true" style={{ color: 'var(--reader-accent)' }} />
            <p className="text-sm font-black">Could not load this surah</p>
            <p className="mt-1 text-xs" style={{ color: 'var(--reader-muted)' }}>Surahs you have opened before work offline.</p>
            <button
              type="button"
              onClick={onRetry}
              className="tap-target mt-4 flex items-center gap-1.5 rounded-xl px-4 text-xs font-black cursor-pointer"
              style={{ ...barButton, color: 'var(--reader-accent)' }}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Retry
            </button>
          </div>
        ) : ayahs.length > 0 ? (
          <div className="px-3 py-4">
            {hasBasmalaHeader(surah.number) && (
              <p lang="ar" dir="rtl" className="font-quran mb-4 py-3 text-center text-2xl" style={{ color: 'var(--reader-accent)', borderBottom: '1px solid var(--reader-border)' }}>
                {BASMALA}
              </p>
            )}

            {ayahs.map((ayah) => (
              // The Fragment carries the key: this project has no React type package, so a typed
              // component cannot accept `key` directly.
              <React.Fragment key={ayah.number}>
                <AyahCard
                  ayah={ayah}
                  surahName={surah.englishName}
                  surahNumber={surah.number}
                  settings={settings}
                  bookmarked={bookmarked.has(`${surah.number}:${ayah.numberInSurah}`)}
                  onToggleBookmark={onBookmarkToggle}
                  onCopy={onCopy}
                />
              </React.Fragment>
            ))}

            <nav className="mt-6 mb-4 flex gap-3" aria-label="Surah navigation">
              <button
                type="button"
                onClick={() => onOpenSurah(surah.number - 1)}
                disabled={surah.number <= 1}
                className="tap-target flex flex-1 items-center justify-center gap-2 rounded-2xl text-xs font-black cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                style={barButton}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous Surah
              </button>
              <button
                type="button"
                onClick={() => onOpenSurah(surah.number + 1)}
                disabled={surah.number >= 114}
                className="tap-target flex flex-1 items-center justify-center gap-2 rounded-2xl text-xs font-black cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                style={barButton}
              >
                Next Surah <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </nav>
          </div>
        ) : null}
      </div>

      <p key={noticeId} className="sr-only" role="status" aria-live="polite">{notice}</p>

      <ReaderSettingsSheet open={settingsOpen} onClose={closeSettings} settings={settings} onChange={onChangeSettings} />
    </div>
  );
}
