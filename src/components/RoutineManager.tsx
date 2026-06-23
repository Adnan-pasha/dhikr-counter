import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  RefreshCw, Plus, Play, Check, ChevronRight, Clock,
  BookMarked, Trash2, Edit3, X, GripVertical, ChevronDown,
  ChevronUp, Sparkles
} from 'lucide-react';
import { Dhikr, Routine } from '../types';
import { ADHKAAR_LIBRARY } from '../adhkaar-data';

// ─── Props ────────────────────────────────────────────────────────────────────

interface RoutineManagerProps {
  routines: Routine[];
  customDhikrs: Dhikr[];
  currentDhikrId: string;
  completedTodayIds: string[];
  onStartDhikr: (id: string) => void;
  onAddRoutine: (routine: Omit<Routine, 'id' | 'createdAt'>) => void;
  onEditRoutine: (id: string, name: string, emoji: string, dhikrIds: string[]) => void;
  onDeleteRoutine: (id: string) => void;
  onNavigateToAdhkaar: () => void;
}

// ─── Emoji picker options ────────────────────────────────────────────────────
const ROUTINE_EMOJIS = ['🌅','🌙','🤲','📿','✨','🕌','💚','🌟','☀️','🌙','🌿','💎'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const allDhikrs = (customDhikrs: Dhikr[]) => [...ADHKAAR_LIBRARY, ...customDhikrs];

const getDhikr = (id: string, customDhikrs: Dhikr[]): Dhikr | undefined =>
  allDhikrs(customDhikrs).find(d => d.id === id);

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RoutineManager({
  routines,
  customDhikrs,
  currentDhikrId,
  completedTodayIds,
  onStartDhikr,
  onAddRoutine,
  onEditRoutine,
  onDeleteRoutine,
  onNavigateToAdhkaar,
}: RoutineManagerProps) {
  const [activeRoutineId, setActiveRoutineId] = useState<string | null>(
    routines.length > 0 ? routines[0].id : null
  );
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('🌅');
  const [newDhikrIds, setNewDhikrIds] = useState<string[]>([]);
  const [showDhikrPicker, setShowDhikrPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState('🌅');
  const [editDhikrIds, setEditDhikrIds] = useState<string[]>([]);
  const [showEditPicker, setShowEditPicker] = useState(false);
  const [editPickerSearch, setEditPickerSearch] = useState('');

  const activeRoutine = routines.find(r => r.id === activeRoutineId) ?? routines[0] ?? null;

  const handleCreate = () => {
    if (!newName.trim() || newDhikrIds.length === 0) return;
    onAddRoutine({ name: newName.trim(), emoji: newEmoji, dhikrIds: newDhikrIds });
    setNewName(''); setNewEmoji('🌅'); setNewDhikrIds([]);
    setShowCreateForm(false); setShowDhikrPicker(false);
  };

  const handleSaveEdit = (routineId: string) => {
    if (!editName.trim() || editDhikrIds.length === 0) return;
    onEditRoutine(routineId, editName.trim(), editEmoji, editDhikrIds);
    setEditingRoutineId(null);
  };

  const startEdit = (routine: Routine) => {
    setEditingRoutineId(routine.id);
    setEditName(routine.name);
    setEditEmoji(routine.emoji);
    setEditDhikrIds([...routine.dhikrIds]);
    setShowCreateForm(false);
  };

  const pickedDhikrs = allDhikrs(customDhikrs).filter(d => {
    if (!pickerSearch.trim()) return true;
    const q = pickerSearch.toLowerCase();
    return d.nameEn.toLowerCase().includes(q) || d.meaning.toLowerCase().includes(q);
  });

  const editPickedDhikrs = allDhikrs(customDhikrs).filter(d => {
    if (!editPickerSearch.trim()) return true;
    const q = editPickerSearch.toLowerCase();
    return d.nameEn.toLowerCase().includes(q) || d.meaning.toLowerCase().includes(q);
  });

  return (
    <div className="flex flex-col h-full bg-[#0f172a] text-slate-100 overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="px-4 pt-5 pb-3 bg-slate-900/60 backdrop-blur-md border-b border-slate-800/60">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-50 flex items-center gap-2 leading-none">
              <RefreshCw className="w-5 h-5 text-amber-500" />
              My Routines
            </h1>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">
              {routines.length} routine{routines.length !== 1 ? 's' : ''} · Build your daily practice
            </p>
          </div>
          <button
            aria-label="Create new routine"
            onClick={() => { setShowCreateForm(v => !v); setEditingRoutineId(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black border transition-all cursor-pointer ${
              showCreateForm ? 'bg-amber-500 text-slate-950 border-amber-500' : 'bg-slate-800 text-amber-400 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </button>
        </div>

        {/* Routine tabs */}
        {routines.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 mt-3 scrollbar-hide">
            {routines.map(r => (
              <button
                key={r.id}
                onClick={() => { setActiveRoutineId(r.id); setEditingRoutineId(null); }}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black border transition-all cursor-pointer ${
                  activeRoutineId === r.id
                    ? 'bg-amber-500 text-slate-950 border-amber-500'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
              >
                <span>{r.emoji}</span>
                {r.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Create Form ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-amber-500/20 bg-slate-900/80"
          >
            <div className="px-4 py-4 space-y-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-500">➕ Create New Routine</p>

              {/* Emoji + Name */}
              <div className="flex gap-2">
                <div className="flex gap-1 flex-wrap">
                  {ROUTINE_EMOJIS.map(e => (
                    <button key={e} onClick={() => setNewEmoji(e)} className={`text-lg w-8 h-8 rounded-lg flex items-center justify-center border cursor-pointer transition-all ${newEmoji === e ? 'border-amber-500 bg-amber-500/20' : 'border-slate-700 bg-slate-800 hover:border-amber-500/50'}`}>{e}</button>
                  ))}
                </div>
              </div>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Routine name (e.g. Fajr Routine, Night Prayers)"
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
              />

              {/* Selected dhikrs */}
              {newDhikrIds.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Selected ({newDhikrIds.length})</p>
                  {newDhikrIds.map((id, i) => {
                    const d = getDhikr(id, customDhikrs);
                    if (!d) return null;
                    return (
                      <div key={id} className="flex items-center gap-2 bg-slate-800 rounded-xl px-3 py-2">
                        <span className="text-[9px] font-black text-slate-500 w-4">{i + 1}</span>
                        <span className="flex-1 text-xs font-bold text-slate-200 truncate">{d.nameEn}</span>
                        <span className="text-[9px] text-slate-500">{d.targetCount}×</span>
                        <button onClick={() => setNewDhikrIds(prev => prev.filter(x => x !== id))} className="text-slate-500 hover:text-red-400 cursor-pointer ml-1"><X className="w-3 h-3" /></button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Dhikr picker */}
              <button
                onClick={() => setShowDhikrPicker(v => !v)}
                className="w-full py-2 rounded-xl border border-dashed border-slate-600 text-slate-400 text-xs font-black hover:border-amber-500/50 hover:text-amber-400 cursor-pointer transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Adhkaar from Library
              </button>

              <AnimatePresence>
                {showDhikrPicker && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                    <div className="space-y-2 pt-1">
                      <input value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} placeholder="Search adhkaar..." className="w-full px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50" />
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {pickedDhikrs.map(d => {
                          const added = newDhikrIds.includes(d.id);
                          return (
                            <button
                              key={d.id}
                              onClick={() => setNewDhikrIds(prev => added ? prev.filter(x => x !== d.id) : [...prev, d.id])}
                              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left cursor-pointer transition-all border ${added ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-amber-500/30'}`}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-black truncate">{d.nameEn}</p>
                                <p className="text-[9px] text-slate-500 truncate">{d.meaning}</p>
                              </div>
                              <span className="text-[9px] text-slate-500 shrink-0">{d.targetCount}×</span>
                              {added && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex gap-2 pt-1">
                <button onClick={() => { setShowCreateForm(false); setNewDhikrIds([]); setNewName(''); }} className="flex-1 py-2 rounded-xl border border-slate-700 text-slate-400 font-black text-xs cursor-pointer hover:bg-slate-800">Cancel</button>
                <button onClick={handleCreate} disabled={!newName.trim() || newDhikrIds.length === 0} className="flex-[2] py-2 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 text-slate-950 font-black text-xs cursor-pointer hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed">Create Routine ✓</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Routine Detail ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {routines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <span className="text-5xl mb-4">🌅</span>
            <h3 className="text-sm font-black text-slate-300">No routines yet</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">Create your first routine by tapping <strong className="text-amber-400">+ New</strong> above. Add adhkaar from the library and build your daily practice.</p>
            <button onClick={onNavigateToAdhkaar} className="mt-4 text-[10px] font-black text-amber-400 hover:text-amber-300 cursor-pointer">
              📖 Browse Adhkaar Library →
            </button>
          </div>
        ) : activeRoutine && (
          <RoutineDetail
            routine={activeRoutine}
            customDhikrs={customDhikrs}
            currentDhikrId={currentDhikrId}
            completedTodayIds={completedTodayIds}
            isEditing={editingRoutineId === activeRoutine.id}
            editName={editName}
            editEmoji={editEmoji}
            editDhikrIds={editDhikrIds}
            editPickerSearch={editPickerSearch}
            showEditPicker={showEditPicker}
            editPickedDhikrs={editPickedDhikrs}
            onEditNameChange={setEditName}
            onEditEmojiChange={setEditEmoji}
            onEditDhikrIdsChange={setEditDhikrIds}
            onEditPickerSearchChange={setEditPickerSearch}
            onToggleEditPicker={() => setShowEditPicker(v => !v)}
            onStartDhikr={onStartDhikr}
            onStartEdit={() => startEdit(activeRoutine)}
            onCancelEdit={() => setEditingRoutineId(null)}
            onSaveEdit={() => handleSaveEdit(activeRoutine.id)}
            onDelete={() => {
              onDeleteRoutine(activeRoutine.id);
              setActiveRoutineId(routines.find(r => r.id !== activeRoutine.id)?.id ?? null);
            }}
            onNavigateToAdhkaar={onNavigateToAdhkaar}
          />
        )}
      </div>
    </div>
  );
}

// ─── Routine Detail ────────────────────────────────────────────────────────────

interface RoutineDetailProps {
  routine: Routine;
  customDhikrs: Dhikr[];
  currentDhikrId: string;
  completedTodayIds: string[];
  isEditing: boolean;
  editName: string;
  editEmoji: string;
  editDhikrIds: string[];
  editPickerSearch: string;
  showEditPicker: boolean;
  editPickedDhikrs: Dhikr[];
  onEditNameChange: (v: string) => void;
  onEditEmojiChange: (v: string) => void;
  onEditDhikrIdsChange: (ids: string[]) => void;
  onEditPickerSearchChange: (v: string) => void;
  onToggleEditPicker: () => void;
  onStartDhikr: (id: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  onNavigateToAdhkaar: () => void;
}

function RoutineDetail({
  routine, customDhikrs, currentDhikrId, completedTodayIds,
  isEditing, editName, editEmoji, editDhikrIds, editPickerSearch, showEditPicker, editPickedDhikrs,
  onEditNameChange, onEditEmojiChange, onEditDhikrIdsChange, onEditPickerSearchChange,
  onToggleEditPicker, onStartDhikr, onStartEdit, onCancelEdit, onSaveEdit, onDelete, onNavigateToAdhkaar,
}: RoutineDetailProps) {
  const dhikrs = routine.dhikrIds.map(id => getDhikr(id, customDhikrs)).filter(Boolean) as Dhikr[];
  const completedCount = dhikrs.filter(d => completedTodayIds.includes(d.id)).length;
  const progressPct = dhikrs.length > 0 ? Math.round((completedCount / dhikrs.length) * 100) : 0;
  const firstPending = dhikrs.find(d => !completedTodayIds.includes(d.id));
  const allComplete = completedCount === dhikrs.length && dhikrs.length > 0;

  return (
    <div className="px-4 py-4 space-y-4">

      {/* Progress card */}
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-base font-black text-amber-400 flex items-center gap-2">
              <span className="text-xl">{routine.emoji}</span>
              {routine.name}
            </h2>
            <p className="text-[10px] text-slate-400 mt-0.5">{dhikrs.length} adhkaar in sequence</p>
          </div>
          <div className="flex items-center gap-1.5">
            {!routine.isSystem && (
              <>
                <button
                  aria-label="Edit routine"
                  onClick={onStartEdit}
                  className={`p-1.5 rounded-xl border cursor-pointer transition-all ${isEditing ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-amber-400'}`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  aria-label="Delete routine"
                  onClick={onDelete}
                  className="p-1.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-400 hover:text-red-400 hover:border-red-500/30 cursor-pointer transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
          <span className="text-xs font-black text-amber-400 shrink-0">{completedCount}/{dhikrs.length}</span>
        </div>

        {/* Action button */}
        {allComplete ? (
          <div className="w-full py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 font-black text-xs flex items-center justify-center gap-2">
            <Check className="w-3.5 h-3.5" />
            Complete! Masha'Allah 🎉
          </div>
        ) : (
          <button
            onClick={() => firstPending && onStartDhikr(firstPending.id)}
            className="w-full py-2.5 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 cursor-pointer hover:opacity-90 shadow-md shadow-amber-950/20"
          >
            <Play className="w-3.5 h-3.5" />
            {completedCount === 0 ? `Begin ${routine.name}` : `Continue — ${firstPending?.nameEn}`}
          </button>
        )}
      </div>

      {/* Edit form */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border border-amber-500/30 bg-slate-900 p-4 space-y-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-500">✏️ Editing Routine</p>

              {/* Emoji picker */}
              <div className="flex gap-1 flex-wrap">
                {ROUTINE_EMOJIS.map(e => (
                  <button key={e} onClick={() => onEditEmojiChange(e)} className={`text-lg w-8 h-8 rounded-lg flex items-center justify-center border cursor-pointer ${editEmoji === e ? 'border-amber-500 bg-amber-500/20' : 'border-slate-700 bg-slate-800'}`}>{e}</button>
                ))}
              </div>

              <input
                value={editName}
                onChange={e => onEditNameChange(e.target.value)}
                placeholder="Routine name"
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
              />

              {/* Selected dhikrs in edit */}
              {editDhikrIds.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Sequence ({editDhikrIds.length})</p>
                  {editDhikrIds.map((id, i) => {
                    const d = getDhikr(id, customDhikrs);
                    if (!d) return null;
                    return (
                      <div key={id} className="flex items-center gap-2 bg-slate-800 rounded-xl px-3 py-2">
                        <span className="text-[9px] text-slate-500 w-4">{i + 1}</span>
                        <span className="flex-1 text-xs font-bold truncate">{d.nameEn}</span>
                        <span className="text-[9px] text-slate-500">{d.targetCount}×</span>
                        <button onClick={() => onEditDhikrIdsChange(editDhikrIds.filter(x => x !== id))} className="text-slate-500 hover:text-red-400 cursor-pointer"><X className="w-3 h-3" /></button>
                      </div>
                    );
                  })}
                </div>
              )}

              <button onClick={onToggleEditPicker} className="w-full py-2 rounded-xl border border-dashed border-slate-600 text-slate-400 text-xs font-black hover:border-amber-500/50 cursor-pointer flex items-center justify-center gap-2">
                <Plus className="w-3.5 h-3.5" /> Add / Remove Adhkaar
              </button>

              <AnimatePresence>
                {showEditPicker && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                    <div className="space-y-2 pt-1">
                      <input value={editPickerSearch} onChange={e => onEditPickerSearchChange(e.target.value)} placeholder="Search..." className="w-full px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50" />
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {editPickedDhikrs.map(d => {
                          const added = editDhikrIds.includes(d.id);
                          return (
                            <button
                              key={d.id}
                              onClick={() => onEditDhikrIdsChange(added ? editDhikrIds.filter(x => x !== d.id) : [...editDhikrIds, d.id])}
                              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left cursor-pointer border ${added ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-amber-500/30'}`}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-black truncate">{d.nameEn}</p>
                                <p className="text-[9px] text-slate-500 truncate">{d.meaning}</p>
                              </div>
                              <span className="text-[9px] text-slate-500 shrink-0">{d.targetCount}×</span>
                              {added && <Check className="w-3 h-3 text-amber-400 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex gap-2">
                <button onClick={onCancelEdit} className="flex-1 py-2 rounded-xl border border-slate-700 text-slate-400 font-black text-xs cursor-pointer hover:bg-slate-800">Cancel</button>
                <button onClick={onSaveEdit} className="flex-[2] py-2 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 text-slate-950 font-black text-xs cursor-pointer hover:opacity-90">Save Changes ✓</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dhikr sequence */}
      <div>
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2.5 px-1">
          Sequence — {dhikrs.length} adhkaar
        </h3>
        <div className="space-y-2">
          {dhikrs.map((dhikr, idx) => {
            const isCompleted = completedTodayIds.includes(dhikr.id);
            const isPending = !isCompleted && dhikr.id === firstPending?.id;
            return (
              <motion.div
                key={dhikr.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  isCompleted ? 'bg-emerald-500/5 border-emerald-500/20'
                  : isPending ? 'bg-amber-500/8 border-amber-500/25'
                  : 'bg-slate-900/60 border-slate-800'
                }`}
              >
                {/* Step indicator */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black border ${
                  isCompleted ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                  : isPending ? 'bg-gradient-to-br from-amber-500 to-orange-400 border-transparent text-slate-950'
                  : 'bg-slate-800 border-slate-700 text-slate-500'
                }`}>
                  {isCompleted ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-black leading-tight ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-100'}`}>
                    {dhikr.nameEn}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-0.5 text-[9px] text-slate-500">
                      <Clock className="w-2.5 h-2.5" />
                      {dhikr.targetCount > 0 ? `${dhikr.targetCount}×` : '∞'}
                    </span>
                    {dhikr.sourceBook && (
                      <span className="text-[9px] text-slate-500 truncate flex items-center gap-0.5">
                        <BookMarked className="w-2.5 h-2.5 shrink-0" />
                        {dhikr.sourceBook}
                      </span>
                    )}
                  </div>
                </div>

                {/* Arabic + tap to start */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-arabic text-slate-300 max-w-[70px] truncate text-right">{dhikr.nameAr}</span>
                  {!isCompleted && (
                    <button
                      aria-label={`Start reciting ${dhikr.nameEn}`}
                      onClick={() => onStartDhikr(dhikr.id)}
                      className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-amber-400 hover:border-amber-500/30 transition-all cursor-pointer"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Browse library link */}
      <button onClick={onNavigateToAdhkaar} className="w-full py-3 rounded-xl border border-dashed border-slate-700 text-slate-400 text-xs font-black hover:border-amber-500/30 hover:text-amber-400 cursor-pointer transition-all flex items-center justify-center gap-2">
        📖 Browse Adhkaar Library to discover more
      </button>

      <div className="h-4" />
    </div>
  );
}
