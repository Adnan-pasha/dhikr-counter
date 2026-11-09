import React from 'react';
import { motion } from 'motion/react';
import { AlertCircle, Bookmark, BookMarked, ChevronLeft, Loader2, RefreshCw, Search, SlidersHorizontal, Star, X } from 'lucide-react';
import type { Surah } from '../quran/types';
import { SUGGESTED_SURAHS, useFavouriteSurahs } from '../quran/favouriteSurahs';
import { searchSurahs } from '../quran/surahSearch';
import { surahByNumber } from '../quran/surahs';

interface SurahListProps {
  surahs: Surah[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  lastReadSurah: number;
  bookmarkedAyahs: string[];
  onSelect: (surah: Surah) => void;
  onGoBack: () => void;
  /** Opens the reading settings (script, translation, theme, text size) without opening a surah. */
  onOpenSettings?: () => void;
  /** Section switcher (Read / My Progress) shown under the title. */
  tabs?: React.ReactNode;
}

/** The 114 surahs, searchable, with the last-read surah and bookmarked surahs marked. */
export default function SurahList({ surahs, loading, error, onRetry, lastReadSurah, bookmarkedAyahs, onSelect, onGoBack, tabs, onOpenSettings }: SurahListProps) {
  const [query, setQuery] = React.useState('');
  const q = query.trim().toLowerCase();
  const { favourites, isFavourite, toggle } = useFavouriteSurahs();
  // Besides plain matches, the forgiving search finds a name however it is spelt ("yasin", "rahman").
  const spelledLike = q ? new Set(searchSurahs(query).map((s) => s.number)) : null;
  const visible = surahs.filter((s) =>
    !q
    || s.englishName.toLowerCase().includes(q)
    || s.englishNameTranslation.toLowerCase().includes(q)
    || s.name.includes(q)
    || String(s.number).includes(q)
    || spelledLike?.has(s.number));

  /** The loaded surah when there is one, else the built-in entry, so a favourite opens even when the list failed to load. */
  const surahOf = (n: number): Surah | undefined => surahs.find((s) => s.number === n) ?? surahByNumber(n);

  const lastRead = surahs.find((s) => s.number === lastReadSurah);

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="header-row">
          <button onClick={onGoBack} className="back-btn" aria-label="Go back to Home">
            <ChevronLeft className="w-5 h-5" />
            <span>Home</span>
          </button>
          <h1 className="screen-title text-center">Quran</h1>
          <div className="flex items-center gap-1.5">
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                aria-label="Reading settings"
                aria-haspopup="dialog"
                className="tap-target flex items-center justify-center px-3 rounded-xl text-sm font-bold bg-brand-500/15 text-brand-400 border border-brand-500/30 cursor-pointer hover:bg-brand-500/25 transition-all"
              >
                <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
            {lastRead ? (
              <button
                onClick={() => onSelect(lastRead)}
                aria-label={`Continue reading ${lastRead.englishName}`}
                className="tap-target flex items-center gap-1.5 px-3 rounded-xl text-sm font-bold bg-brand-500/15 text-brand-400 border border-brand-500/30 cursor-pointer hover:bg-brand-500/25 transition-all"
              >
                <BookMarked className="w-4 h-4" aria-hidden="true" />
              </button>
            ) : !onOpenSettings ? <div className="w-10" /> : null}
          </div>
        </div>
        <p className="caption">114 Surahs · Read with translation</p>
        {tabs}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" aria-hidden="true" />
          <input
            type="text"
            value={query}
            aria-label="Search surahs"
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or number..."
            className="w-full min-h-11 pl-9 pr-8 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500/50"
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-0 top-1/2 -translate-y-1/2 min-h-11 min-w-11 flex items-center justify-center text-slate-500 cursor-pointer">
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!q && favourites.length > 0 && (
          <section aria-label="My surahs" className="px-4 pt-3 pb-1">
            <h2 className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">My surahs</h2>
            <div className="flex flex-wrap gap-2">
              {favourites.map((n) => {
                const surah = surahOf(n);
                if (!surah) return null;
                return (
                  <div key={n} className="flex items-stretch overflow-hidden rounded-xl border border-brand-500/30 bg-brand-500/10">
                    <button
                      type="button"
                      aria-label={`Open ${surah.englishName}`}
                      onClick={() => onSelect(surah)}
                      className="min-h-11 flex items-center gap-2 pl-3 pr-2 text-sm font-black text-brand-400 cursor-pointer"
                    >
                      <span>{surah.englishName}</span>
                      <span className="text-base font-arabic text-slate-300" lang="ar" dir="rtl">{surah.name.replace(/^\S+\s+/, '')}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${surah.englishName} from My surahs`}
                      onClick={() => toggle(n)}
                      className="min-h-11 min-w-11 flex items-center justify-center text-slate-400 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}
        {!q && favourites.length === 0 && (
          <section aria-label="Suggested daily surahs" className="px-4 pt-3 pb-1">
            <p className="mb-2 text-xs text-slate-400">Keep the surahs you read every day here. Tap the star on any surah, or start with:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_SURAHS.map((n) => {
                const surah = surahByNumber(n);
                if (!surah) return null;
                return (
                  <button
                    key={n}
                    type="button"
                    aria-label={`Add ${surah.englishName} to My surahs`}
                    onClick={() => toggle(n)}
                    className="min-h-11 rounded-xl border border-slate-700 bg-slate-800 px-3 text-xs font-black text-slate-200 cursor-pointer"
                  >
                    + {surah.englishName}
                  </button>
                );
              })}
            </div>
          </section>
        )}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-brand-400 animate-spin mb-3" aria-hidden="true" />
            <p className="text-sm text-slate-400 font-medium">Loading Quran...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <AlertCircle className="w-10 h-10 text-rose-400 mb-3" aria-hidden="true" />
            <p className="text-sm font-black text-slate-300">Could not load Quran</p>
            <p className="text-xs text-slate-400 mt-1">Check your internet connection</p>
            <button
              onClick={onRetry}
              className="tap-target mt-4 flex items-center gap-1.5 px-4 rounded-xl bg-brand-500/15 text-brand-400 border border-brand-500/30 text-xs font-black cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> Retry
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {visible.map((surah, idx) => {
              const isLastRead = surah.number === lastReadSurah;
              const hasBookmark = bookmarkedAyahs.some((k) => k.startsWith(`${surah.number}:`));
              const favourite = isFavourite(surah.number);
              return (
                <motion.div
                  key={surah.number}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(idx * 0.01, 0.3) }}
                  className={`flex items-center transition-all hover:bg-slate-800/40 ${isLastRead ? 'bg-brand-500/5' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(surah)}
                    className="flex-1 min-w-0 flex items-center gap-4 pl-4 pr-2 py-3.5 text-left cursor-pointer"
                  >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-black border ${
                    isLastRead ? 'bg-brand-500/20 border-brand-500/40 text-brand-400' : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}>
                    {surah.number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black text-slate-100">{surah.englishName}</p>
                      {isLastRead && (
                        <span className="text-xs font-black px-1.5 py-0.5 rounded-full bg-brand-500/15 text-brand-400 border border-brand-500/25">Last Read</span>
                      )}
                      {hasBookmark && <Bookmark className="w-3 h-3 text-brand-400 fill-brand-400" aria-label="Has bookmarks" />}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{surah.englishNameTranslation} · {surah.numberOfAyahs} ayahs · {surah.revelationType}</p>
                  </div>
                  <p className="text-base font-arabic text-slate-300 shrink-0" lang="ar" dir="rtl">{surah.name}</p>
                  </button>
                  <button
                    type="button"
                    aria-pressed={favourite}
                    aria-label={favourite ? `Remove ${surah.englishName} from favourites` : `Add ${surah.englishName} to favourites`}
                    onClick={() => toggle(surah.number)}
                    className="min-h-11 min-w-11 shrink-0 flex items-center justify-center cursor-pointer"
                  >
                    <Star className={`w-5 h-5 ${favourite ? 'fill-brand-400 text-brand-400' : 'text-slate-500'}`} aria-hidden="true" />
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
