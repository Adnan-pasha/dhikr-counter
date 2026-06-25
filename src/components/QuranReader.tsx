import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen, Search, X, ChevronLeft, ChevronRight,
  Loader2, AlertCircle, Bookmark, BookMarked, Star,
  List, AlignJustify, RefreshCw
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Surah {
  number: number;
  name: string;           // Arabic name
  englishName: string;    // e.g. "Al-Fatihah"
  englishNameTranslation: string; // e.g. "The Opening"
  numberOfAyahs: number;
  revelationType: 'Meccan' | 'Medinan';
}

interface Ayah {
  number: number;         // Global ayah number
  numberInSurah: number;
  text: string;           // Arabic or English depending on edition
  juz: number;
  page: number;
}

interface QuranReaderProps {
  bookmarkedAyahs: string[];   // "surahNum:ayahNum"
  lastReadSurah: number;
  onBookmarkToggle: (key: string) => void;
  onUpdateLastRead: (surahNum: number) => void;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const API = 'https://api.alquran.cloud/v1';
const BASMALA = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';

// Juz start surahs for quick navigation
const JUZ_STARTS: { juz: number; surah: number; ayah: number; label: string }[] = [
  { juz: 1,  surah: 1,  ayah: 1,  label: 'Al-Fatihah' },
  { juz: 2,  surah: 2,  ayah: 142, label: 'Al-Baqarah 142' },
  { juz: 3,  surah: 2,  ayah: 253, label: 'Al-Baqarah 253' },
  { juz: 4,  surah: 3,  ayah: 92,  label: 'Aal-Imran 92' },
  { juz: 5,  surah: 4,  ayah: 24,  label: 'An-Nisa 24' },
  { juz: 6,  surah: 4,  ayah: 148, label: 'An-Nisa 148' },
  { juz: 7,  surah: 5,  ayah: 82,  label: 'Al-Ma\'idah 82' },
  { juz: 8,  surah: 6,  ayah: 111, label: 'Al-An\'am 111' },
  { juz: 9,  surah: 7,  ayah: 87,  label: 'Al-A\'raf 87' },
  { juz: 10, surah: 8,  ayah: 41,  label: 'Al-Anfal 41' },
];

// Arabic font sizes
const FONT_SIZES = ['text-lg', 'text-xl', 'text-2xl', 'text-3xl'];
const FONT_LABELS = ['S', 'M', 'L', 'XL'];

// ─── Main Component ────────────────────────────────────────────────────────────

export default function QuranReader({
  bookmarkedAyahs,
  lastReadSurah,
  onBookmarkToggle,
  onUpdateLastRead,
}: QuranReaderProps) {
  const [view, setView] = useState<'list' | 'reader'>('list');
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [loadingSurahs, setLoadingSurahs] = useState(true);
  const [surahError, setSurahError] = useState(false);
  const [activeSurah, setActiveSurah] = useState<Surah | null>(null);
  const [arabicAyahs, setArabicAyahs] = useState<Ayah[]>([]);
  const [englishAyahs, setEnglishAyahs] = useState<Ayah[]>([]);
  const [loadingAyahs, setLoadingAyahs] = useState(false);
  const [ayahError, setAyahError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showTranslation, setShowTranslation] = useState(true);
  const [fontSize, setFontSize] = useState(1); // index into FONT_SIZES
  const [showJuzMenu, setShowJuzMenu] = useState(false);
  const readerRef = useRef<HTMLDivElement>(null);

  // Load surah list
  useEffect(() => {
    setLoadingSurahs(true);
    setSurahError(false);
    fetch(`${API}/surah`)
      .then(r => r.json())
      .then(data => {
        if (data.code === 200) setSurahs(data.data);
        else setSurahError(true);
      })
      .catch(() => setSurahError(true))
      .finally(() => setLoadingSurahs(false));
  }, []);

  // Load ayahs for a surah
  const loadSurah = useCallback((surah: Surah) => {
    setActiveSurah(surah);
    setView('reader');
    setLoadingAyahs(true);
    setAyahError(false);
    setArabicAyahs([]);
    setEnglishAyahs([]);
    onUpdateLastRead(surah.number);

    fetch(`${API}/surah/${surah.number}/editions/quran-uthmani,en.sahih`)
      .then(r => r.json())
      .then(data => {
        if (data.code === 200 && data.data?.length >= 2) {
          setArabicAyahs(data.data[0].ayahs);
          setEnglishAyahs(data.data[1].ayahs);
        } else {
          setAyahError(true);
        }
      })
      .catch(() => setAyahError(true))
      .finally(() => setLoadingAyahs(false));
  }, [onUpdateLastRead]);

  // Navigate to prev/next surah
  const goToSurah = (dir: -1 | 1) => {
    if (!activeSurah || surahs.length === 0) return;
    const next = surahs.find(s => s.number === activeSurah.number + dir);
    if (next) loadSurah(next);
  };

  // Filter surahs by search
  const filteredSurahs = surahs.filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.englishName.toLowerCase().includes(q) ||
      s.englishNameTranslation.toLowerCase().includes(q) ||
      s.name.includes(q) ||
      String(s.number).includes(q)
    );
  });

  // Render surah list
  if (view === 'list') {
    return (
      <div className="flex flex-col h-full bg-[#0f172a] text-slate-100 overflow-hidden">

        {/* Header */}
        <div className="px-4 pt-5 pb-3 bg-slate-900/60 backdrop-blur-md border-b border-slate-800/60">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-50 flex items-center gap-2 leading-none">
                <BookOpen className="w-5 h-5 text-amber-500" />
                Al-Quran
              </h1>
              <p className="text-[10px] text-slate-400 mt-1">114 Surahs · Read with translation</p>
            </div>
            {lastReadSurah > 0 && surahs.length > 0 && (
              <button
                onClick={() => {
                  const s = surahs.find(s => s.number === lastReadSurah);
                  if (s) loadSurah(s);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-400 border border-amber-500/30 cursor-pointer hover:bg-amber-500/25 transition-all"
              >
                <BookMarked className="w-3 h-3" />
                Continue
              </button>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name or number..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* List body */}
        <div className="flex-1 overflow-y-auto">
          {loadingSurahs ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-3" />
              <p className="text-sm text-slate-400 font-medium">Loading Quran...</p>
            </div>
          ) : surahError ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <AlertCircle className="w-10 h-10 text-rose-400 mb-3" />
              <p className="text-sm font-black text-slate-300">Could not load Quran</p>
              <p className="text-xs text-slate-500 mt-1">Check your internet connection</p>
              <button
                onClick={() => { setSurahError(false); setLoadingSurahs(true); }}
                className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs font-black cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {filteredSurahs.map((surah, idx) => {
                const isLastRead = surah.number === lastReadSurah;
                const hasBookmark = bookmarkedAyahs.some(k => k.startsWith(`${surah.number}:`));
                return (
                  <motion.button
                    key={surah.number}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(idx * 0.01, 0.3) }}
                    onClick={() => loadSurah(surah)}
                    className={`w-full flex items-center gap-4 px-4 py-3.5 text-left cursor-pointer transition-all hover:bg-slate-800/40 ${isLastRead ? 'bg-amber-500/5' : ''}`}
                  >
                    {/* Number circle */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-black border ${
                      isLastRead ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}>
                      {surah.number}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-black text-slate-100">{surah.englishName}</p>
                        {isLastRead && (
                          <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
                            Last Read
                          </span>
                        )}
                        {hasBookmark && <Bookmark className="w-3 h-3 text-amber-400 fill-amber-400" />}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">{surah.englishNameTranslation} · {surah.numberOfAyahs} ayahs · {surah.revelationType}</p>
                    </div>

                    {/* Arabic name */}
                    <p className="text-base font-arabic text-slate-300 shrink-0">{surah.name}</p>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Reader view ───────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-[#0f172a] text-slate-100 overflow-hidden">

      {/* Reader header */}
      <div className="px-4 pt-4 pb-3 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          {/* Back */}
          <button
            onClick={() => setView('list')}
            aria-label="Back to surah list"
            className="p-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 cursor-pointer transition-all shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Surah title */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-slate-100 truncate">{activeSurah?.englishName}</p>
            <p className="text-[10px] text-slate-400">{activeSurah?.englishNameTranslation} · {activeSurah?.numberOfAyahs} ayahs</p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Font size */}
            <button
              onClick={() => setFontSize(f => (f + 1) % FONT_SIZES.length)}
              className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 text-[10px] font-black flex items-center justify-center cursor-pointer hover:text-amber-400 transition-all"
            >
              {FONT_LABELS[fontSize]}
            </button>

            {/* Translation toggle */}
            <button
              onClick={() => setShowTranslation(v => !v)}
              aria-label="Toggle translation"
              className={`p-1.5 rounded-lg border cursor-pointer transition-all ${
                showTranslation ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              <AlignJustify className="w-3.5 h-3.5" />
            </button>

            {/* Juz jump */}
            <button
              onClick={() => setShowJuzMenu(v => !v)}
              aria-label="Jump to Juz"
              className={`p-1.5 rounded-lg border cursor-pointer transition-all ${
                showJuzMenu ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Juz dropdown */}
        <AnimatePresence>
          {showJuzMenu && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex gap-1.5 overflow-x-auto pb-1 pt-2 scrollbar-hide">
                {JUZ_STARTS.map(j => (
                  <button
                    key={j.juz}
                    onClick={() => {
                      const s = surahs.find(s => s.number === j.surah);
                      if (s) { loadSurah(s); setShowJuzMenu(false); }
                    }}
                    className="shrink-0 flex flex-col items-center px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 cursor-pointer hover:border-amber-500/40 hover:text-amber-400 transition-all"
                  >
                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-500">Juz {j.juz}</span>
                    <span className="text-[9px] text-slate-400 mt-0.5">{j.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Ayahs */}
      <div ref={readerRef} className="flex-1 overflow-y-auto">
        {loadingAyahs ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-3" />
            <p className="text-sm text-slate-400 font-medium">Loading {activeSurah?.englishName}...</p>
          </div>
        ) : ayahError ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <AlertCircle className="w-10 h-10 text-rose-400 mb-3" />
            <p className="text-sm font-black text-slate-300">Could not load ayahs</p>
            <button
              onClick={() => activeSurah && loadSurah(activeSurah)}
              className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/15 text-amber-400 text-xs font-black cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        ) : arabicAyahs.length > 0 ? (
          <div className="px-4 py-4">

            {/* Bismillah (all except Al-Fatihah (1) and At-Tawbah (9)) */}
            {activeSurah && activeSurah.number !== 9 && (
              <div className="text-center mb-6 py-3 border-b border-slate-800/60">
                <p className="text-xl font-arabic text-amber-400/90 leading-loose">{BASMALA}</p>
              </div>
            )}

            {/* Ayahs */}
            {arabicAyahs.map((ayah, idx) => {
              const engAyah = englishAyahs[idx];
              const bookmarkKey = `${activeSurah?.number}:${ayah.numberInSurah}`;
              const isBookmarked = bookmarkedAyahs.includes(bookmarkKey);

              return (
                <motion.div
                  key={ayah.number}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(idx * 0.02, 0.5) }}
                  className={`mb-4 pb-4 border-b border-slate-800/40 last:border-0 ${isBookmarked ? 'bg-amber-500/5 -mx-2 px-2 rounded-xl' : ''}`}
                >
                  {/* Ayah number + bookmark */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400 text-[10px] font-black flex items-center justify-center">
                        {ayah.numberInSurah}
                      </span>
                      <span className="text-[9px] text-slate-500">Juz {ayah.juz} · Page {ayah.page}</span>
                    </div>
                    <button
                      onClick={() => onBookmarkToggle(bookmarkKey)}
                      aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark ayah'}
                      className={`p-1.5 rounded-lg border cursor-pointer transition-all ${
                        isBookmarked ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-slate-800/50 text-slate-600 border-slate-700/50 hover:text-amber-400'
                      }`}
                    >
                      <Bookmark className={`w-3 h-3 ${isBookmarked ? 'fill-amber-400' : ''}`} />
                    </button>
                  </div>

                  {/* Arabic text */}
                  <p className={`font-arabic text-slate-100 leading-loose text-right mb-3 ${FONT_SIZES[fontSize]}`} dir="rtl">
                    {ayah.text} ﴿{ayah.numberInSurah}﴾
                  </p>

                  {/* English translation */}
                  <AnimatePresence>
                    {showTranslation && engAyah && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="text-[11px] text-slate-400 leading-relaxed italic overflow-hidden"
                      >
                        {engAyah.text}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}

            {/* Prev / Next surah navigation */}
            <div className="flex gap-3 mt-6 mb-4">
              <button
                onClick={() => goToSurah(-1)}
                disabled={!activeSurah || activeSurah.number <= 1}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border border-slate-700 bg-slate-800/60 text-slate-300 text-xs font-black cursor-pointer hover:border-amber-500/30 hover:text-amber-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous Surah
              </button>
              <button
                onClick={() => goToSurah(1)}
                disabled={!activeSurah || activeSurah.number >= 114}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border border-slate-700 bg-slate-800/60 text-slate-300 text-xs font-black cursor-pointer hover:border-amber-500/30 hover:text-amber-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Next Surah
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
