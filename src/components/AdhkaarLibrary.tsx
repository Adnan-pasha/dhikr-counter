import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen, Star, ChevronDown, ChevronUp, Clock, BookMarked,
  Tag, Sparkles, Play, Heart, Search, X, Plus, Trash2, Check,
  Shield, Edit3
} from 'lucide-react';
import { Dhikr, AdhkaarCategory, CATEGORY_META } from '../types';
import { ADHKAAR_LIBRARY } from '../adhkaar-data';

// ─── Props ────────────────────────────────────────────────────────────────────

interface AdhkaarLibraryProps {
  // All dhikrs (system from ADHKAAR_LIBRARY + user custom)
  customDhikrs: Dhikr[];
  currentDhikrId: string;
  history: { dhikrId: string; timestamp: string }[];
  favouriteIds: string[];
  onToggleFavourite: (id: string) => void;
  onSelectDhikr: (id: string) => void;
  onAddCustomDhikr: (dhikr: Omit<Dhikr, 'id' | 'isSystem'>) => void;
  onEditCustomDhikr: (id: string, nameEn: string, nameAr: string, meaning: string, targetCount: number) => void;
  onDeleteCustomDhikr: (id: string) => void;
  onToggleCompleteToday: (id: string) => void;
  onNavigateToRoutine: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DIFFICULTY_META = {
  easy:   { label: 'Short',  color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  medium: { label: 'Medium', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  long:   { label: 'Long',   color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
};

const ALL_CATEGORIES: AdhkaarCategory[] = [
  'morning','evening','daily','istighfar','salawat','protection','sleep','quranic','motivation',
];

const isCompletedToday = (dhikrId: string, history: { dhikrId: string; timestamp: string }[]) => {
  const today = new Date();
  return history.some((h) => {
    if (h.dhikrId !== dhikrId) return false;
    const d = new Date(h.timestamp);
    return d.getFullYear() === today.getFullYear()
      && d.getMonth() === today.getMonth()
      && d.getDate() === today.getDate();
  });
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdhkaarLibrary({
  customDhikrs,
  currentDhikrId,
  history,
  favouriteIds,
  onToggleFavourite,
  onSelectDhikr,
  onAddCustomDhikr,
  onEditCustomDhikr,
  onDeleteCustomDhikr,
  onToggleCompleteToday,
  onNavigateToRoutine,
}: AdhkaarLibraryProps) {
  const [activeCategory, setActiveCategory] = useState<AdhkaarCategory | 'all' | 'custom'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);
  const [showFavouritesOnly, setShowFavouritesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingDhikr, setEditingDhikr] = useState<Dhikr | null>(null);

  // Add form state
  const [newEn, setNewEn] = useState('');
  const [newAr, setNewAr] = useState('');
  const [newMeaning, setNewMeaning] = useState('');
  const [newCount, setNewCount] = useState('33');

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editNameAr, setEditNameAr] = useState('');
  const [editMeaning, setEditMeaning] = useState('');
  const [editCount, setEditCount] = useState('33');

  // Merge system + custom dhikrs
  const allDhikrs = [...ADHKAAR_LIBRARY, ...customDhikrs];

  const filteredDhikrs = allDhikrs.filter((d) => {
    if (showFavouritesOnly && !favouriteIds.includes(d.id)) return false;
    if (showFeaturedOnly && !d.isFeatured) return false;
    if (activeCategory === 'custom') return !d.isSystem;
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

  const handleAddSubmit = () => {
    if (!newEn.trim()) return;
    onAddCustomDhikr({
      nameEn: newEn.trim(),
      nameAr: newAr.trim() || 'بِسْمِ ٱللَّٰهِ',
      meaning: newMeaning.trim() || 'In the name of Allah',
      targetCount: Math.max(1, parseInt(newCount) || 33),
    });
    setNewEn(''); setNewAr(''); setNewMeaning(''); setNewCount('33');
    setShowAddForm(false);
  };

  return (
    <div className="screen">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="screen-header">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="font-display font-black text-xl flex items-center gap-2 leading-none" style={{ color: 'var(--color-text-primary)' }}>
              <BookOpen className="w-5 h-5" style={{ color: 'var(--color-text-brand)' }} />
              Adhkaar Library
            </h1>
            <p className="text-[10px] mt-1 font-medium" style={{ color: 'var(--color-text-muted)' }}>
              {filteredDhikrs.length} duas &amp; adhkaar · {customDhikrs.length} custom
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Favourites toggle */}
            <button
              aria-label="Show favourites"
              onClick={() => { setShowFavouritesOnly(v => !v); setShowFeaturedOnly(false); }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-black border transition-all cursor-pointer ${
                showFavouritesOnly ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-rose-400'
              }`}
            >
              <Heart className="w-3 h-3" />
              {favouriteIds.length > 0 && <span>{favouriteIds.length}</span>}
            </button>
            {/* Featured toggle */}
            <button
              aria-label="Show featured"
              onClick={() => { setShowFeaturedOnly(v => !v); setShowFavouritesOnly(false); }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-black border transition-all cursor-pointer ${
                showFeaturedOnly ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-amber-400'
              }`}
            >
              <Star className="w-3 h-3" />
            </button>
            {/* Add custom dhikr */}
            <button
              aria-label="Add custom dhikr"
              onClick={() => { setShowAddForm(v => !v); setEditingDhikr(null); }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-black border transition-all cursor-pointer ${
                showAddForm ? 'bg-amber-500 text-slate-950 border-amber-500' : 'bg-slate-800 text-amber-400 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setActiveCategory('all'); setShowFeaturedOnly(false); setShowFavouritesOnly(false); }}
            placeholder="Search by name, meaning, tag..."
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition-colors"
          />
          {searchQuery && (
            <button aria-label="Clear search" onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category filter pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {(['all', 'custom', ...ALL_CATEGORIES] as const).map((cat) => {
            const meta = cat === 'all' ? null : cat === 'custom' ? null : CATEGORY_META[cat];
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black border transition-all cursor-pointer ${
                  isActive ? 'bg-amber-500 text-slate-950 border-amber-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
              >
                {meta ? <span>{meta.emoji}</span> : cat === 'custom' ? '✏️' : null}
                {cat === 'all' ? 'All' : cat === 'custom' ? 'Custom' : meta!.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Add Custom Form ────────────────────────────────────────── */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-amber-500/20 bg-slate-900/80"
          >
            <div className="px-4 py-4 space-y-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-500 mb-2">➕ New Custom Dhikr</p>
              <input value={newEn} onChange={(e) => setNewEn(e.target.value)} placeholder="English name *" className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50" />
              <input value={newAr} onChange={(e) => setNewAr(e.target.value)} placeholder="Arabic text (optional)" dir="rtl" className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 text-right" />
              <input value={newMeaning} onChange={(e) => setNewMeaning(e.target.value)} placeholder="Meaning / description" className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50" />
              <div className="flex gap-2 items-center">
                <input type="number" value={newCount} onChange={(e) => setNewCount(e.target.value)} placeholder="Count" min="1" className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50" />
                {[33, 99, 100].map(n => (
                  <button key={n} onClick={() => setNewCount(String(n))} className={`px-2.5 py-2 rounded-xl text-[10px] font-black border cursor-pointer transition-all ${newCount === String(n) ? 'bg-amber-500 text-slate-950 border-amber-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-amber-400'}`}>{n}</button>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowAddForm(false)} className="flex-1 py-2 rounded-xl border border-slate-700 text-slate-400 font-black text-xs cursor-pointer hover:bg-slate-800">Cancel</button>
                <button onClick={handleAddSubmit} className="flex-[2] py-2 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 text-slate-950 font-black text-xs cursor-pointer hover:opacity-90">Save Dhikr ✓</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Cards List ─────────────────────────────────────────────── */}
      <div className="scroll-area space-y-3">
        <AnimatePresence mode="popLayout">
          {filteredDhikrs.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-16 text-slate-500">
              <BookMarked className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm font-bold">No adhkaar found</p>
              <p className="text-xs mt-1">Try a different filter or search</p>
            </motion.div>
          ) : (
            filteredDhikrs.map((dhikr, idx) => (
              <AdhkaarCard
                key={dhikr.id}
                dhikr={dhikr}
                idx={idx}
                isActive={dhikr.id === currentDhikrId}
                isFavourite={favouriteIds.includes(dhikr.id)}
                isCompleted={isCompletedToday(dhikr.id, history)}
                isEditing={editingDhikr?.id === dhikr.id}
                isExpanded={expandedId === dhikr.id}
                editName={editName}
                editNameAr={editNameAr}
                editMeaning={editMeaning}
                editCount={editCount}
                onEditNameChange={setEditName}
                onEditNameArChange={setEditNameAr}
                onEditMeaningChange={setEditMeaning}
                onEditCountChange={setEditCount}
                onToggleExpand={() => setExpandedId(prev => prev === dhikr.id ? null : dhikr.id)}
                onToggleFavourite={() => onToggleFavourite(dhikr.id)}
                onToggleComplete={() => onToggleCompleteToday(dhikr.id)}
                onSelect={() => onSelectDhikr(dhikr.id)}
                onAddToRoutine={onNavigateToRoutine}
                onStartEdit={() => {
                  setEditingDhikr(dhikr);
                  setEditName(dhikr.nameEn);
                  setEditNameAr(dhikr.nameAr);
                  setEditMeaning(dhikr.meaning);
                  setEditCount(String(dhikr.targetCount));
                  setShowAddForm(false);
                }}
                onCancelEdit={() => setEditingDhikr(null)}
                onSaveEdit={() => {
                  if (!editName.trim()) return;
                  onEditCustomDhikr(dhikr.id, editName.trim(), editNameAr.trim(), editMeaning.trim(), Math.max(1, parseInt(editCount) || 33));
                  setEditingDhikr(null);
                }}
                onDelete={() => onDeleteCustomDhikr(dhikr.id)}
              />
            ))
          )}
        </AnimatePresence>
        <div className="h-4" />
      </div>
    </div>
  );
}

// ─── Card Component ───────────────────────────────────────────────────────────

interface AdhkaarCardProps {
  key?: React.Key;
  dhikr: Dhikr;
  idx: number;
  isActive: boolean;
  isFavourite: boolean;
  isCompleted: boolean;
  isEditing: boolean;
  isExpanded: boolean;
  editName: string;
  editNameAr: string;
  editMeaning: string;
  editCount: string;
  onEditNameChange: (v: string) => void;
  onEditNameArChange: (v: string) => void;
  onEditMeaningChange: (v: string) => void;
  onEditCountChange: (v: string) => void;
  onToggleExpand: () => void;
  onToggleFavourite: () => void;
  onToggleComplete: () => void;
  onSelect: () => void;
  onAddToRoutine: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
}

function AdhkaarCard({
  dhikr, idx, isActive, isFavourite, isCompleted, isEditing, isExpanded,
  editName, editNameAr, editMeaning, editCount,
  onEditNameChange, onEditNameArChange, onEditMeaningChange, onEditCountChange,
  onToggleExpand, onToggleFavourite, onToggleComplete,
  onSelect, onAddToRoutine, onStartEdit, onCancelEdit, onSaveEdit, onDelete,
}: AdhkaarCardProps) {
  const diffMeta = dhikr.difficulty ? DIFFICULTY_META[dhikr.difficulty] : null;
  const primaryCategory = dhikr.category?.[0];
  const catMeta = primaryCategory ? CATEGORY_META[primaryCategory] : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ delay: idx * 0.02, duration: 0.2 }}
      className={`rounded-2xl border overflow-hidden transition-colors ${
        isActive ? 'border-amber-500/40 bg-amber-500/5'
        : isEditing ? 'border-amber-500/30 bg-slate-900'
        : isCompleted ? 'border-emerald-500/20 bg-emerald-500/3'
        : 'border-slate-800 bg-slate-900/60'
      }`}
    >
      {/* Main card content */}
      <div
        className="p-4 cursor-pointer"
        onClick={() => { if (!isEditing) onSelect(); }}
      >
        {/* Badge row */}
        <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
          {dhikr.isSystem ? (
            <span className="text-[8px] font-black px-2 py-0.5 rounded-full border text-slate-400 bg-slate-800 border-slate-700 flex items-center gap-0.5">
              <Shield className="w-2.5 h-2.5" /> Authentic
            </span>
          ) : (
            <span className="text-[8px] font-black px-2 py-0.5 rounded-full border text-amber-400 bg-amber-500/10 border-amber-500/20">
              ✏️ Custom
            </span>
          )}
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
          {isActive && <span className="text-[8px] font-black px-2 py-0.5 rounded-full border text-amber-400 bg-amber-500/15 border-amber-500/30">✓ Active</span>}
          {isCompleted && <span className="text-[8px] font-black px-2 py-0.5 rounded-full border text-emerald-400 bg-emerald-500/10 border-emerald-500/20">✓ Done Today</span>}
        </div>

        {/* Content row */}
        <div className="flex gap-3 items-start">
          <div className="flex-1 min-w-0">
            <h3 className={`text-sm font-black leading-tight ${isActive ? 'text-amber-400' : 'text-slate-100'}`}>
              {dhikr.nameEn}
            </h3>
            {dhikr.transliteration && (
              <p className="text-[10px] text-amber-400/80 font-medium italic mt-0.5 leading-tight">{dhikr.transliteration}</p>
            )}
            <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">{dhikr.meaning}</p>
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
          <div className="shrink-0 max-w-[42%] text-right">
            <p className="text-base font-arabic font-bold text-slate-100 leading-relaxed line-clamp-3 text-right">
              {dhikr.nameAr}
            </p>
          </div>
        </div>

        {/* Action row */}
        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-800/60" onClick={e => e.stopPropagation()}>
          {/* Start reciting */}
          <button
            aria-label={`Start reciting ${dhikr.nameEn}`}
            onClick={onSelect}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer flex-1 justify-center ${
              isActive ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-gradient-to-tr from-amber-500 to-orange-400 text-slate-950 shadow-md shadow-amber-950/20 hover:opacity-90'
            }`}
          >
            <Play className="w-3 h-3" />
            {isActive ? 'Active' : 'Recite'}
          </button>

          {/* Complete today */}
          <button
            aria-label={isCompleted ? 'Mark pending' : 'Mark complete'}
            onClick={onToggleComplete}
            className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
              isCompleted ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-emerald-400'
            }`}
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>

          {/* Favourite */}
          <button
            aria-label={isFavourite ? 'Remove favourite' : 'Add favourite'}
            onClick={onToggleFavourite}
            className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
              isFavourite ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
              : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-rose-400'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${isFavourite ? 'fill-rose-400' : ''}`} />
          </button>

          {/* Add to routine */}
          <button
            aria-label="Add to routine"
            onClick={onAddToRoutine}
            className="p-1.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-500 hover:text-amber-400 hover:border-amber-500/30 transition-all cursor-pointer"
          >
            🌅
          </button>

          {/* Custom-only: edit + delete */}
          {!dhikr.isSystem && (
            <>
              <button
                aria-label="Edit dhikr"
                onClick={onStartEdit}
                className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                  isEditing ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-amber-400'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                aria-label="Delete dhikr"
                onClick={onDelete}
                className="p-1.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-500 hover:text-red-400 hover:border-red-500/30 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {/* Fazail expand */}
          {dhikr.isSystem && (
            <button
              aria-label={isExpanded ? 'Hide details' : 'Show fazail'}
              onClick={onToggleExpand}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-black border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all cursor-pointer"
            >
              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {isExpanded ? 'Less' : 'Fazail'}
            </button>
          )}
        </div>
      </div>

      {/* Inline edit form */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-amber-500/20"
          >
            <div className="px-4 py-3 bg-slate-950/40 space-y-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-500">Editing — {dhikr.nameEn}</p>
              <input value={editName} onChange={e => onEditNameChange(e.target.value)} placeholder="English name" className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50" />
              <input value={editNameAr} onChange={e => onEditNameArChange(e.target.value)} placeholder="Arabic text" dir="rtl" className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 text-right" />
              <input value={editMeaning} onChange={e => onEditMeaningChange(e.target.value)} placeholder="Meaning" className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50" />
              <input type="number" value={editCount} onChange={e => onEditCountChange(e.target.value)} placeholder="Count" min="1" className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50" />
              <div className="flex gap-2">
                <button onClick={onCancelEdit} className="flex-1 py-2 rounded-xl border border-slate-700 text-slate-400 font-black text-xs cursor-pointer hover:bg-slate-800">Cancel</button>
                <button onClick={onSaveEdit} className="flex-[2] py-2 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 text-slate-950 font-black text-xs cursor-pointer hover:opacity-90">Save ✓</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expandable Fazail (system dhikrs only) */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-slate-800/60"
          >
            <div className="px-4 py-4 space-y-3 bg-slate-950/40">
              {dhikr.benefits && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-500">Fazail &amp; Benefits</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed font-medium">{dhikr.benefits}</p>
                </div>
              )}
              {dhikr.reference && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <BookMarked className="w-3 h-3 text-teal-400" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-teal-400">Reference</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">{dhikr.reference}</p>
                </div>
              )}
              {dhikr.tags && dhikr.tags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Tag className="w-3 h-3 text-slate-500 shrink-0" />
                  {dhikr.tags.map(tag => (
                    <span key={tag} className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">#{tag}</span>
                  ))}
                </div>
              )}
              <p className="text-right text-sm font-arabic text-slate-200 leading-loose border-t border-slate-800/60 pt-3">{dhikr.nameAr}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
