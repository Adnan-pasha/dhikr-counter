import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen, Star, ChevronDown, ChevronUp,
  Clock, BookMarked, Tag, Sparkles, Play, Heart, Search, X
} from 'lucide-react';
import { Dhikr, AdhkaarCategory, CATEGORY_META } from '../types';
import { ADHKAAR_LIBRARY } from '../adhkaar-data';

interface AdhkaarLibraryProps {
  currentDhikrId: string;
  favouriteIds: string[];
  onToggleFavourite: (id: string) => void;
  onSelectDhikr: (id: string) => void;
  onNavigateToRoutine: () => void;
}
const DIFFICULTY_META = {
  easy:   { label: 'Short',  color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  medium: { label: 'Medium', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  long:   { label: 'Long',   color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
};

const ALL_CATEGORIES: AdhkaarCategory[] = [
  'morning', 'evening', 'daily', 'istighfar',
  'salawat', 'protection', 'sleep', 'quranic', 'motivation',
];

export default function AdhkaarLibrary({ currentDhikrId, favouriteIds, onToggleFavourite, onSelectDhikr, onNavigateToRoutine }: AdhkaarLibraryProps) {
  const [activeCategory, setActiveCategory] = useState<AdhkaarCategory | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);
  const [showFavouritesOnly, setShowFavouritesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDhikrs = ADHKAAR_LIBRARY.filter((d) => {
    if (showFavouritesOnly && !favouriteIds.includes(d.id)) return false;
    if (showFeaturedOnly && !d.isFeatured) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matches =
        d.nameEn.toLowerCase().includes(q) ||
        d.meaning.toLowerCase().includes(q) ||
        d.nameAr.includes(q) ||
        d.transliteration?.toLowerCase().includes(q) ||
        d.benefits?.toLowerCase().includes(q) ||
        d.tags?.some((t) => t.toLowerCase().includes(q));
      if (!matches) return false;
    }
    if (activeCategory === 'all') return true;
    return d.category?.includes(activeCategory);
  });

  const toggleExpand = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id));

  return (
    <div className="flex flex-col h-full bg-[#0f172a] text-slate-100 overflow-hidden">

      {/* Header */}
      <div className="px-5 pt-5 pb-3 bg-slate-900/60 backdrop-blur-md border-b border-slate-800/60">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-50 flex items-center gap-2 leading-none">
              <BookOpen className="w-5 h-5 text-amber-500" />
              Adhkaar Library
            </h1>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">
              {filteredDhikrs.length} duas &amp; adhkaar from authentic sources
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              aria-label={showFavouritesOnly ? 'Show all adhkaar' : 'Show favourites only'}
              onClick={() => { setShowFavouritesOnly((v) => !v); setShowFeaturedOnly(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black border transition-all cursor-pointer ${
                showFavouritesOnly
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-rose-400'
              }`}
            >
              <Heart className="w-3 h-3" />
              {favouriteIds.length > 0 ? favouriteIds.length : ''}
            </button>
            <button
              aria-label={showFeaturedOnly ? 'Show all adhkaar' : 'Show featured only'}
              onClick={() => { setShowFeaturedOnly((v) => !v); setShowFavouritesOnly(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black border transition-all cursor-pointer ${
                showFeaturedOnly
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-amber-400'
              }`}
            >
              <Star className="w-3 h-3" />
              Featured
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setActiveCategory('all');
              setShowFeaturedOnly(false);
              setShowFavouritesOnly(false);
            }}
            placeholder="Search by name, meaning, tag..."
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition-colors"
          />
          {searchQuery && (
            <button
              aria-label="Clear search"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category filter pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setActiveCategory('all')}
            className={`shrink-0 px-3 py-1 rounded-full text-[10px] font-black border transition-all cursor-pointer ${
              activeCategory === 'all'
                ? 'bg-amber-500 text-slate-950 border-amber-500'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            All
          </button>
          {ALL_CATEGORIES.map((cat) => {
            const meta = CATEGORY_META[cat];
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 border-amber-500'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
              >
                <span>{meta.emoji}</span>
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dhikr Cards */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <AnimatePresence mode="popLayout">
          {filteredDhikrs.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 text-slate-500"
            >
              <BookMarked className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm font-bold">No adhkaar found</p>
              <p className="text-xs mt-1">Try a different category</p>
            </motion.div>
          ) : (
            filteredDhikrs.map((dhikr, idx) => (
              <AdhkaarCard
                key={dhikr.id}
                dhikr={dhikr}
                idx={idx}
                isActive={dhikr.id === currentDhikrId}
                isFavourite={favouriteIds.includes(dhikr.id)}
                isExpanded={expandedId === dhikr.id}
                onToggleExpand={() => toggleExpand(dhikr.id)}
                onToggleFavourite={() => onToggleFavourite(dhikr.id)}
                onSelect={() => onSelectDhikr(dhikr.id)}
                onAddToRoutine={onNavigateToRoutine}
              />
            ))
          )}
        </AnimatePresence>
        <div className="h-4" />
      </div>
    </div>
  );
}

interface AdhkaarCardProps {
  dhikr: Dhikr;
  idx: number;
  isActive: boolean;
  isFavourite: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleFavourite: () => void;
  onSelect: () => void;
  onAddToRoutine: () => void;
}

function AdhkaarCard({ dhikr, idx, isActive, isFavourite, isExpanded, onToggleExpand, onToggleFavourite, onSelect, onAddToRoutine }: AdhkaarCardProps) {
  const diffMeta = dhikr.difficulty ? DIFFICULTY_META[dhikr.difficulty] : null;
  const primaryCategory = dhikr.category?.[0];
  const catMeta = primaryCategory ? CATEGORY_META[primaryCategory] : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ delay: idx * 0.03, duration: 0.2 }}
      className={`rounded-2xl border overflow-hidden transition-colors ${
        isActive
          ? 'border-amber-500/40 bg-amber-500/5'
          : 'border-slate-800 bg-slate-900/60'
      }`}
    >
      {/* Card main row */}
      <div className="p-4">
        {/* Top: badges row */}
        <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
          {catMeta && (
            <span className={`text-[8px] font-black px-2 py-0.5 rounded-full border ${catMeta.color}`}>
              {catMeta.emoji} {catMeta.label}
            </span>
          )}
          {diffMeta && (
            <span className={`text-[8px] font-black px-2 py-0.5 rounded-full border ${diffMeta.color}`}>
              {diffMeta.label}
            </span>
          )}
          {dhikr.isFeatured && (
            <span className="text-[8px] font-black px-2 py-0.5 rounded-full border text-yellow-400 bg-yellow-500/10 border-yellow-500/20 flex items-center gap-0.5">
              <Star className="w-2 h-2" /> Featured
            </span>
          )}
          {isActive && (
            <span className="text-[8px] font-black px-2 py-0.5 rounded-full border text-amber-400 bg-amber-500/15 border-amber-500/30">
              ✓ Active
            </span>
          )}
        </div>

        {/* Middle: info + Arabic */}
        <div className="flex gap-3 items-start">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-black text-slate-100 leading-tight">{dhikr.nameEn}</h3>
            {dhikr.transliteration && (
              <p className="text-[10px] text-amber-400/80 font-medium italic mt-0.5 leading-tight">
                {dhikr.transliteration}
              </p>
            )}
            <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
              {dhikr.meaning}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <span className="flex items-center gap-1 text-[9px] text-slate-500 font-semibold">
                <Clock className="w-2.5 h-2.5 text-amber-500/60" />
                {dhikr.targetCount > 0 ? `${dhikr.targetCount}×` : '∞'}
              </span>
              {dhikr.sourceBook && (
                <span className="flex items-center gap-1 text-[9px] text-slate-500 font-semibold truncate">
                  <BookMarked className="w-2.5 h-2.5 text-amber-500/60 shrink-0" />
                  {dhikr.sourceBook}
                </span>
              )}
            </div>
          </div>
          <div className="shrink-0 text-right max-w-[45%]">
            <p className="text-base font-arabic font-bold text-slate-100 leading-relaxed text-right line-clamp-3">
              {dhikr.nameAr}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-800/60">
          <button
            aria-label={`Start reciting ${dhikr.nameEn}`}
            onClick={onSelect}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer flex-1 justify-center ${
              isActive
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-gradient-to-tr from-amber-500 to-orange-400 text-slate-950 shadow-md shadow-amber-950/20 hover:opacity-90'
            }`}
          >
            <Play className="w-3 h-3" />
            {isActive ? 'Currently Active' : 'Start Reciting'}
          </button>
          <button
            aria-label={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
            onClick={onToggleFavourite}
            className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
              isFavourite
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-rose-400'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${isFavourite ? 'fill-rose-400' : ''}`} />
          </button>
          <button
            aria-label="Add to routine"
            onClick={onAddToRoutine}
            className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-[10px] font-black border border-slate-700 text-slate-400 hover:text-amber-400 hover:border-amber-500/30 hover:bg-slate-800 transition-all cursor-pointer"
          >
            🌅
          </button>
          <button
            aria-label={isExpanded ? 'Hide details' : 'Show benefits and reference'}
            onClick={onToggleExpand}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-black border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all cursor-pointer"
          >
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {isExpanded ? 'Less' : 'Fazail'}
          </button>
        </div>
      </div>

      {/* Expandable detail */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden border-t border-slate-800/60"
          >
            <div className="px-4 py-4 space-y-3 bg-slate-950/40">
              {dhikr.benefits && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-500">
                      Fazail &amp; Benefits
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                    {dhikr.benefits}
                  </p>
                </div>
              )}
              {dhikr.reference && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <BookMarked className="w-3 h-3 text-teal-400" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-teal-400">
                      Reference
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">{dhikr.reference}</p>
                </div>
              )}
              {dhikr.tags && dhikr.tags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Tag className="w-3 h-3 text-slate-500 shrink-0" />
                  {dhikr.tags.map((tag) => (
                    <span key={tag} className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="pt-1">
                <p className="text-right text-sm font-arabic text-slate-200 leading-loose border-t border-slate-800/60 pt-3">
                  {dhikr.nameAr}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
