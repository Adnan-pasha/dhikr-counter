import React from 'react';
import { Bookmark, ChevronDown, Copy } from 'lucide-react';
import { formatAyahForCopy, type ReaderAyah } from '../quran/editions';
import { arabicFontSize, type ReaderSettings } from '../quran/settings';
import { toArabicDigits } from '../quran/text';

interface AyahCardProps {
  ayah: ReaderAyah;
  surahName: string;
  surahNumber: number;
  settings: ReaderSettings;
  bookmarked: boolean;
  /** Called with "surah:ayah". One stable function can serve every card. */
  onToggleBookmark: (key: string) => void;
  onCopy: (text: string) => void;
}

/** One ayah: Arabic, then transliteration and translation when switched on, with copy and bookmark under its number. */
function AyahCard({ ayah, surahName, surahNumber, settings, bookmarked, onToggleBookmark, onCopy }: AyahCardProps) {
  const [open, setOpen] = React.useState(false);
  const actionsId = `ayah-actions-${surahNumber}-${ayah.numberInSurah}`;
  const showTranslation = settings.showTranslation && ayah.translation;
  const showTransliteration = settings.showTransliteration && ayah.transliteration;

  const buttonStyle = { background: 'var(--reader-surface)', border: '1px solid var(--reader-border)', color: 'var(--reader-ink)' } as const;

  return (
    <article
      className="rounded-2xl px-3 py-4"
      style={{
        background: bookmarked ? 'var(--reader-surface)' : 'transparent',
        borderBottom: '1px solid var(--reader-border)',
        borderInlineStart: bookmarked ? '3px solid var(--reader-accent)' : '3px solid transparent',
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={actionsId}
          aria-label={`Ayah ${surahNumber}:${ayah.numberInSurah}, actions`}
          onClick={() => setOpen((v) => !v)}
          className="tap-target flex items-center gap-1.5 rounded-full px-3 text-xs font-bold cursor-pointer"
          style={buttonStyle}
        >
          <span aria-hidden="true">Aya {surahNumber}:{ayah.numberInSurah}</span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        <span className="flex items-center gap-2 text-xs" style={{ color: 'var(--reader-muted)' }}>
          {bookmarked && <Bookmark className="h-4 w-4 fill-current" aria-label="Bookmarked" role="img" style={{ color: 'var(--reader-accent)' }} />}
          {ayah.juz > 0 && <span>Juz {ayah.juz}{ayah.page > 0 ? ` · Page ${ayah.page}` : ''}</span>}
        </span>
      </div>

      {open && (
        <div id={actionsId} className="mb-3 flex gap-2">
          <button
            type="button"
            aria-label="Copy ayah"
            onClick={() => onCopy(formatAyahForCopy({
              surahName,
              surahNumber,
              ayahNumber: ayah.numberInSurah,
              arabic: ayah.arabic,
              translation: showTranslation ? ayah.translation : null,
            }))}
            className="tap-target flex items-center gap-1.5 rounded-xl px-4 text-xs font-bold cursor-pointer"
            style={buttonStyle}
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copy
          </button>
          <button
            type="button"
            aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark ayah'}
            aria-pressed={bookmarked}
            onClick={() => onToggleBookmark(`${surahNumber}:${ayah.numberInSurah}`)}
            className="tap-target flex items-center gap-1.5 rounded-xl px-4 text-xs font-bold cursor-pointer"
            style={buttonStyle}
          >
            <Bookmark className={`h-3.5 w-3.5 ${bookmarked ? 'fill-current' : ''}`} aria-hidden="true" /> {bookmarked ? 'Saved' : 'Bookmark'}
          </button>
        </div>
      )}

      <p
        lang="ar"
        dir="rtl"
        className="font-quran text-right"
        style={{ fontSize: arabicFontSize(settings.textSize), lineHeight: 2.2, color: 'var(--reader-ink)', overflowWrap: 'anywhere' }}
      >
        {ayah.arabic}{' '}
        <span aria-hidden="true" style={{ color: 'var(--reader-accent)' }}>&#xFD3F;{toArabicDigits(ayah.numberInSurah)}&#xFD3E;</span>
      </p>

      {showTransliteration && (
        <p className="mt-2 text-sm italic leading-relaxed" style={{ color: 'var(--reader-accent)' }}>{ayah.transliteration}</p>
      )}
      {showTranslation && (
        <p lang="en" className="mt-2 text-base leading-relaxed" style={{ color: 'var(--reader-muted)' }}>{ayah.translation}</p>
      )}
    </article>
  );
}

/** Memoised so copying or bookmarking one ayah does not redraw the other hundreds on the page. */
export default React.memo(AyahCard);
