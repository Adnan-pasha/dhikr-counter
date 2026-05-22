import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Check, X, Shield, BookOpen, Clock, CalendarCheck, CalendarDays, HelpCircle } from 'lucide-react';
import { Dhikr, DhikrHistory } from '../types';

interface DhikrLibraryProps {
  dhikrs: Dhikr[];
  currentDhikrId: string;
  history: DhikrHistory[];
  onSelectDhikr: (id: string) => void;
  onAddDhikr: (dhikr: Omit<Dhikr, 'id' | 'isSystem'>) => void;
  onDeleteDhikr: (id: string) => void;
  onToggleCompleteToday: (id: string) => void;
}

export default function DhikrLibrary({
  dhikrs,
  currentDhikrId,
  history,
  onSelectDhikr,
  onAddDhikr,
  onDeleteDhikr,
  onToggleCompleteToday,
}: DhikrLibraryProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newEn, setNewEn] = useState('');
  const [newAr, setNewAr] = useState('');
  const [newMeaning, setNewMeaning] = useState('');
  const [newTarget, setNewTarget] = useState<number>(33);
  const [isInfinity, setIsInfinity] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

  const checkIsCompletedToday = (dhikrId: string) => {
    const today = new Date();
    return history.some((log) => {
      if (log.dhikrId !== dhikrId) return false;
      const logDate = new Date(log.timestamp);
      return (
        logDate.getFullYear() === today.getFullYear() &&
        logDate.getMonth() === today.getMonth() &&
        logDate.getDate() === today.getDate()
      );
    });
  };

  const pendingCount = dhikrs.filter((d) => !checkIsCompletedToday(d.id)).length;
  const completedCount = dhikrs.filter((d) => checkIsCompletedToday(d.id)).length;

  const filteredDhikrs = dhikrs.filter((dhikr) => {
    const isCompleted = checkIsCompletedToday(dhikr.id);
    if (filter === 'pending') return !isCompleted;
    if (filter === 'completed') return isCompleted;
    return true;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEn) return;

    onAddDhikr({
      nameEn: newEn,
      nameAr: newAr || 'بِسْمِ ٱللَّٰهِ',
      meaning: newMeaning || 'In the name of Allah',
      targetCount: isInfinity ? 0 : Number(newTarget),
    });

    // Reset Form
    setNewEn('');
    setNewAr('');
    setNewMeaning('');
    setNewTarget(33);
    setIsInfinity(false);
    setIsAdding(false);
  };

  return (
    <div id="dhikr_library_container" className="flex flex-col h-full bg-[#0f172a] text-slate-100">
      
      {/* Search Header */}
      <div className="px-6 pt-5 pb-3 flex justify-between items-center bg-slate-900/50 backdrop-blur-md">
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-50 flex items-center gap-1.5 leading-none">
            <BookOpen className="w-5 h-5 text-amber-500" />
            Dhikr Library
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium select-none">Select a traditional prayer or create custom chants</p>
        </div>
        
        <button
  id="btn_add_dhikr_trigger"
  aria-label="Add custom prayer"
  onClick={() => setIsAdding(true)}
  className="p-2 rounded-full cursor-pointer bg-slate-800 text-amber-400 border border-slate-700 hover:bg-slate-700 hover:scale-105 transition-all"
  title="Add Custom Prayer"
>
          <Plus className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>

      {/* FILTER CONTROL SEGMENTS */}
      <div className="px-6 py-2.5 border-b border-slate-800/80 bg-slate-900/35 flex items-center justify-between gap-1 select-none">
        <button
          id="filter_trigger_all"
          onClick={() => setFilter('all')}
          className={`flex-1 py-1.5 px-2 rounded-xl text-2xs font-bold transition-all border cursor-pointer text-center ${
            filter === 'all'
              ? 'bg-slate-800 text-slate-100 border-slate-700'
              : 'bg-transparent text-slate-450 border-transparent hover:text-slate-200'
          }`}
        >
          All ({dhikrs.length})
        </button>
        <button
          id="filter_trigger_pending"
          onClick={() => setFilter('pending')}
          className={`flex-1 py-1.5 px-2 rounded-xl text-2xs font-bold transition-all border cursor-pointer text-center flex items-center justify-center gap-1 ${
            filter === 'pending'
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              : 'bg-transparent text-slate-450 border-transparent hover:text-slate-200'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-505 animate-pulse" />
          Pending ({pendingCount})
        </button>
        <button
          id="filter_trigger_completed"
          onClick={() => setFilter('completed')}
          className={`flex-1 py-1.5 px-2 rounded-xl text-2xs font-bold transition-all border cursor-pointer text-center flex items-center justify-center gap-1 ${
            filter === 'completed'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-transparent text-slate-450 border-transparent hover:text-slate-200'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Completed ({completedCount})
        </button>
      </div>

      {/* Prayers List */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3.5">
        {filteredDhikrs.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-12 px-4 border border-dashed border-slate-800 rounded-3xl bg-slate-900/10">
            <HelpCircle className="w-8 h-8 text-slate-600 mb-3 animate-pulse" />
            <h4 className="text-sm font-bold text-slate-350">
              {filter === 'completed' ? 'No Completed Dhikrs' : filter === 'pending' ? 'All Completed! 🎉' : 'No Prayers Found'}
            </h4>
            <p className="text-2xs text-slate-400 mt-1 max-w-[200px] leading-relaxed select-none">
              {filter === 'completed'
                ? 'Chant prayer beads to the target goal or check them off as completed!'
                : filter === 'pending'
                ? 'All of today’s prayers are complete. May Allah accept your dhikr.'
                : 'Add custom prayers using the top plus icon.'}
            </p>
          </div>
        ) : (
          filteredDhikrs.map((dhikr) => {
            const isActive = dhikr.id === currentDhikrId;
            const isCompleted = checkIsCompletedToday(dhikr.id);
            
            return (
              <motion.div
                id={`dhikr_card_${dhikr.id}`}
                key={dhikr.id}
                whileTap={{ scale: 0.98 }}
                className={`relative p-4 rounded-2xl border transition-all cursor-pointer flex justify-between items-start gap-3 overflow-hidden group ${
                  isActive
                    ? 'bg-slate-900 border-amber-500/50 shadow-[0_0_15px_rgba(242,158,11,0.08)]'
                    : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700'
                }`}
                onClick={() => onSelectDhikr(dhikr.id)}
              >
                <div className="flex-1 min-w-0 pr-3">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                    <h3 className={`font-bold text-base transition-colors ${
                      isActive ? 'text-amber-400' : 'text-slate-200'
                    }`}>
                      {dhikr.nameEn}
                    </h3>
                    
                    {dhikr.isSystem ? (
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-slate-800/60 text-slate-400 flex items-center gap-0.5">
                        <Shield className="w-2.5 h-2.5" /> Traditional
                      </span>
                    ) : (
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/15">
                        Custom
                      </span>
                    )}

                    {/* Completion Status Badge */}
                    {isCompleted ? (
                      <span className="text-[8px] leading-none font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center gap-0.5 shadow-xs">
                        <Check className="w-2.5 h-2.5 stroke-[3]" /> Completed Today
                      </span>
                    ) : (
                      <span className="text-[8px] leading-none font-semibold px-2 py-0.5 rounded-full bg-slate-800/90 text-slate-400 border border-slate-700/50 flex items-center gap-0.5">
                        <span className="w-1 h-1 rounded-full bg-amber-500" /> Pending
                      </span>
                    )}
                  </div>
                  
                  <p className="text-xs text-slate-400 font-medium italic line-clamp-1">
                    "{dhikr.meaning}"
                  </p>

                  <div className="flex items-center gap-1.5 mt-2.5 text-[11px] font-semibold text-slate-400">
                    <Clock className="w-3 h-3 text-amber-500" />
                    Target Count: <span className="text-slate-300">{dhikr.targetCount > 0 ? `${dhikr.targetCount} beads` : 'Infinite Cycle'}</span>
                  </div>
                </div>

                {/* Arabic script & action delete */}
                <div className="flex flex-col items-end gap-2.5 shrink-0 w-[42%] max-w-[180px] select-none">
                  <span className="text-lg sm:text-xl font-arabic font-bold text-slate-100 select-none leading-tight text-right max-w-full truncate">
                    {dhikr.nameAr}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {/* Active target check indicator */}
                    {isActive && (
                      <span className="p-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/15" title="Active selection">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </span>
                    )}

                    {/* Direct check completion switch */}
                    <button
                      id={`btn_toggle_complete_${dhikr.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleCompleteToday(dhikr.id);
                      }}
                      className={`p-1 rounded-md border transition-all cursor-pointer ${
                        isCompleted
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-505/25'
                          : 'bg-slate-800/80 text-slate-500 border-slate-700/80 hover:text-amber-400 hover:border-amber-500/30'
                      }`}
                      title={isCompleted ? "Mark as Pending" : "Mark as Completed today"}
aria-label={isCompleted ? "Mark as Pending" : "Mark as Completed today"}
>
                    >
                      <Check className={`w-3.5 h-3.5 stroke-[3] transition-transform ${isCompleted ? 'scale-100' : 'scale-90 opacity-60'}`} />
                    </button>
                    
                    {!dhikr.isSystem && (
                      <button
                        id={`btn_delete_dhikr_${dhikr.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteDhikr(dhikr.id);
                        }}
                        className="p-1.5 rounded-md text-slate-450 hover:text-red-400 hover:bg-slate-800 transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
title="Delete Custom Dhikr"
aria-label="Delete custom dhikr"
>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Add Custom Dhikr Modal Sheet */}
      <AnimatePresence>
        {isAdding && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-neutral-950 z-30"
            />

            {/* Modal Bottom Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="absolute bottom-0 inset-x-0 bg-slate-900 rounded-t-3xl border-t border-slate-800 shadow-2xl p-6 pb-12 z-40 max-h-[90%] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-lg font-black text-slate-50 tracking-tight leading-none">Add Custom Prayer</h2>
                <button
  id="btn_add_dhikr_close"
  aria-label="Close add prayer form"
  onClick={() => setIsAdding(false)}
  className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-slate-100 cursor-pointer"
>
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* English Name */}
                <div>
                  <label htmlFor="input_name_en" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Chant Name (English) *
                  </label>
                  <input
                    id="input_name_en"
                    type="text"
                    required
                    placeholder="e.g. SubhanAllah, Al-Khaliq"
                    value={newEn}
                    onChange={(e) => setNewEn(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 focus:outline-none focus:border-amber-500 text-slate-100 placeholder-slate-500"
                  />
                </div>

                {/* Arabic Calligraphy Name */}
                <div>
                  <label htmlFor="input_name_ar" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Arabic Script (Optional)
                  </label>
                  <input
                    id="input_name_ar"
                    type="text"
                    placeholder="e.g. سُبْحَانَ ٱللَّٰهِ"
                    value={newAr}
                    onChange={(e) => setNewAr(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-right focus:outline-none focus:border-amber-500 font-arabic text-xl text-slate-100 placeholder-slate-500"
                  />
                </div>

                {/* Meaning / Translations */}
                <div>
                  <label htmlFor="input_meaning" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Translation / Intention (Optional)
                  </label>
                  <input
                    id="input_meaning"
                    type="text"
                    placeholder="e.g. Glory be to Allah, My creator"
                    value={newMeaning}
                    onChange={(e) => setNewMeaning(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 focus:outline-none focus:border-amber-500 text-slate-100 placeholder-slate-500"
                  />
                </div>

                {/* Target Configuration choices */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Target Goal
                    </label>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-350 cursor-pointer">
                      <input
                        id="checkbox_unlimited_target"
                        type="checkbox"
                        checked={isInfinity}
                        onChange={(e) => setIsInfinity(e.target.checked)}
                        className="rounded border-slate-800 focus:border-amber-500 text-amber-500 focus:ring-0 accent-amber-500"
                      />
                      Unlimited / Infinity
                    </label>
                  </div>

                  {!isInfinity && (
                    <div className="grid grid-cols-4 gap-2">
                      {[33, 99, 100].map((val) => (
                        <button
                          id={`btn_preset_target_${val}`}
                          key={val}
                          type="button"
                          onClick={() => setNewTarget(val)}
                          className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            newTarget === val
                              ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
                              : 'bg-slate-800 border-slate-700/80 text-slate-300 hover:bg-slate-705'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                      <input
                        id="input_custom_target"
                        type="number"
                        min="1"
                        placeholder="Other"
                        value={newTarget === 33 || newTarget === 99 || newTarget === 100 ? '' : newTarget}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (val > 0) setNewTarget(val);
                        }}
                        className="rounded-xl border border-slate-800 bg-slate-950 text-xs text-center font-bold focus:outline-none focus:border-amber-500 text-slate-100"
                      />
                    </div>
                  )}
                </div>

                {/* Action Form buttons */}
                <div className="pt-3">
                  <button
                    id="btn_submit_new_dhikr"
                    type="submit"
                    className="w-full py-4 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 hover:brightness-110 active:scale-98 text-slate-950 font-black text-xs uppercase tracking-widest shadow-lg shadow-amber-950/20 cursor-pointer flex items-center justify-center gap-2 transition-all"
                  >
                    Save Prayer
                  </button>
                </div>
                {/* Extra safe scroll spacing height below submit button */}
                <div className="h-8 shrink-0" />
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
