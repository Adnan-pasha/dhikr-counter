import React from 'react';
import { motion } from 'motion/react';
import { AlertCircle, Bookmark, BookMarked, ChevronLeft, Loader2, RefreshCw, Search, X } from 'lucide-react';
import type { Surah } from '../quran/types';

interface SurahListProps {
  surahs: Surah[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  lastReadSurah: number;
  bookmarkedAyahs: string[];
  onSelect: (surah: Surah) => void;
  onGoBack: () => void;
  /** Section switcher (Read / My Progress) shown under the title. */
  tabs?: React.ReactNode;
}

/** The 114 surahs, searchable, with the last-read surah and bookmarked surahs marked. */
export default function SurahList({ surahs, loading, error, onRetry, lastReadSurah, bookmarkedAyahs, onSelect, onGoBack, tabs }: SurahListProps) {
  const [query, setQuery] = React.useState('');
  const q = query.trim().toLowerCase();
  const visible = surahs.filter((s) =>
    !q
    || s.englishName.toLowerCase().includes(q)
    || s.englishNameTranslation.toLowerCase().includes(q)
    || s.name.includes(q)
    || String(s.number).includes(q));

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
          {lastRead ? (
            <button
              onClick={() => onSelect(lastRead)}
              aria-label={`Continue reading ${lastRead.englishName}`}
              className="tap-target flex items-center gap-1.5 px-3 rounded-xl text-sm font-bold bg-brand-500/15 text-brand-400 border border-brand-500/30 cursor-pointer hover:bg-brand-500/25 transition-all"
            >
              <BookMarked className="w-4 h-4" aria-hidden="true" />
            </button>
          ) : <div className="w-10" />}
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
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500/50"
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 cursor-pointer">
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-brand-500 animate-spin mb-3" aria-hidden="true" />
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
              return (
                <motion.button
                  key={surah.number}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(idx * 0.01, 0.3) }}
                  onClick={() => onSelect(surah)}
                  className={`w-full flex items-center gap-4 px-4 py-3.5 text-left cursor-pointer transition-all hover:bg-slate-800/40 ${isLastRead ? 'bg-brand-500/5' : ''}`}
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
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
