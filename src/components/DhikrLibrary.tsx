import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Check, X, Shield, BookOpen, Clock } from 'lucide-react';
import { Dhikr } from '../types';

interface DhikrLibraryProps {
  dhikrs: Dhikr[];
  currentDhikrId: string;
  onSelectDhikr: (id: string) => void;
  onAddDhikr: (dhikr: Omit<Dhikr, 'id' | 'isSystem'>) => void;
  onDeleteDhikr: (id: string) => void;
}

export default function DhikrLibrary({
  dhikrs,
  currentDhikrId,
  onSelectDhikr,
  onAddDhikr,
  onDeleteDhikr,
}: DhikrLibraryProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newEn, setNewEn] = useState('');
  const [newAr, setNewAr] = useState('');
  const [newMeaning, setNewMeaning] = useState('');
  const [newTarget, setNewTarget] = useState<number>(33);
  const [isInfinity, setIsInfinity] = useState(false);

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
      <div className="px-6 pt-5 pb-3 border-b border-slate-800/80 flex justify-between items-center bg-slate-900/50 backdrop-blur-md">
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-50 flex items-center gap-1.5 leading-none">
            <BookOpen className="w-5 h-5 text-amber-500" />
            Dhikr Library
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium select-none">Select a traditional prayer or create custom chants</p>
        </div>
        
        <button
          id="btn_add_dhikr_trigger"
          onClick={() => setIsAdding(true)}
          className="p-2 rounded-full cursor-pointer bg-slate-800 text-amber-400 border border-slate-700 hover:bg-slate-700 hover:scale-105 transition-all"
          title="Add Custom Prayer"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>

      {/* Prayers List */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3.5">
        {dhikrs.map((dhikr) => {
          const isActive = dhikr.id === currentDhikrId;
          return (
            <motion.div
              id={`dhikr_card_${dhikr.id}`}
              key={dhikr.id}
              whileTap={{ scale: 0.98 }}
              className={`relative p-4 rounded-2xl border transition-all cursor-pointer flex justify-between items-center group ${
                isActive
                  ? 'bg-slate-900 border-amber-500/50 shadow-[0_0_15px_rgba(242,158,11,0.08)]'
                  : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700'
              }`}
              onClick={() => onSelectDhikr(dhikr.id)}
            >
              <div className="flex-1 pr-3">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className={`font-bold text-base transition-colors ${
                    isActive ? 'text-amber-400' : 'text-slate-200'
                  }`}>
                    {dhikr.nameEn}
                  </h3>
                  {dhikr.isSystem ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 flex items-center gap-0.5">
                      <Shield className="w-2.5 h-2.5" /> Traditional
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Custom
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
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className="text-2xl font-arabic font-bold text-slate-100 select-none">
                  {dhikr.nameAr}
                </span>

                <div className="flex items-center gap-1">
                  {isActive && (
                    <span className="p-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </span>
                  )}
                  
                  {!dhikr.isSystem && (
                    <button
                      id={`btn_delete_dhikr_${dhikr.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteDhikr(dhikr.id);
                      }}
                      className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                      title="Delete Custom Dhikr"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
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
