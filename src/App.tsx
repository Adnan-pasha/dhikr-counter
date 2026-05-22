import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Circle, Trophy, Settings as SettingsIcon, Heart, Landmark, CircleDot, HelpCircle, Compass, RotateCcw, AlertTriangle, WifiOff, Cloud, Clock } from 'lucide-react';
import { Dhikr, DhikrHistory, UserPreferences, AppTheme, DhikrReminder } from './types';

import { playCompletionSound } from './audio';
import CounterScreen from './components/CounterScreen';
import DhikrLibrary from './components/DhikrLibrary';
import StatsScreen from './components/StatsScreen';
import SettingsScreen from './components/SettingsScreen';
import QiblaScreen from './components/QiblaScreen';
import { useConnectivityStatus, useReminderScheduler, usePersistentAppState, useDhikrActions, useCounterFlow, useHistoryActions } from './hooks';

// Default Traditional System Dhikrs
const SYSTEM_DHIKRS: Dhikr[] = [
  {
    id: 'subhanallah',
    nameAr: 'سُبْحَانَ ٱللَّٰهِ',
    nameEn: 'SubhanAllah',
    meaning: 'Glory be to Allah',
    targetCount: 33,
    isSystem: true,
  },
  {
    id: 'alhamdulillah',
    nameAr: 'ٱلْحَمْدُ لِلَّٰهِ',
    nameEn: 'Alhamdulillah',
    meaning: 'All praise is due to Allah',
    targetCount: 33,
    isSystem: true,
  },
  {
    id: 'allahuakbar',
    nameAr: 'ٱللَّٰهُ أَكْبَرُ',
    nameEn: 'Allahu Akbar',
    meaning: 'Allah is the Greatest',
    targetCount: 34,
    isSystem: true,
  },
  {
    id: 'astaghfirullah',
    nameAr: 'أَسْتَغْفِرُ ٱللَّٰهَ',
    nameEn: 'Astaghfirullah',
    meaning: 'I seek forgiveness from Allah',
    targetCount: 100,
    isSystem: true,
  },
  {
    id: 'lailahaillallah',
    nameAr: 'لَا إِلَٰهَ إِلَّا ٱللَّٰهُ',
    nameEn: 'La ilaha illa Allah',
    meaning: 'There is no god but Allah',
    targetCount: 100,
    isSystem: true,
  },
];

// Default Preferences
const DEFAULT_PREFERENCES: UserPreferences = {
  soundOn: true,
  soundTone: 'wooden',
  vibrateOn: true,
  autoAdvance: true,
  theme: 'emerald',
  volume: 0.5,
};

// Default Dhikr Reminders Preset
const DEFAULT_REMINDERS: DhikrReminder[] = [
  {
    id: 'rem_fajr',
    dhikrId: 'subhanallah',
    dhikrName: 'SubhanAllah',
    timeString: '05:15',
    days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    label: 'Fajr Morning Remembrance',
    isEnabled: true,
  },
  {
    id: 'rem_asr',
    dhikrId: 'alhamdulillah',
    dhikrName: 'Alhamdulillah',
    timeString: '16:30',
    days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    label: 'Asr Afternoon Gratitude',
    isEnabled: true,
  },
  {
    id: 'rem_bedtime',
    dhikrId: 'astaghfirullah',
    dhikrName: 'Astaghfirullah',
    timeString: '22:00',
    days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    label: 'Bedtime Forgiveness Ask',
    isEnabled: true,
  }
];

export default function App() {
  const [dhikrs, setDhikrs] = useState<Dhikr[]>([]);
  const [currentDhikrId, setCurrentDhikrId] = useState<string>('subhanallah');
  const [currentCount, setCurrentCount] = useState<number>(0);
  const [history, setHistory] = useState<DhikrHistory[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [reminders, setReminders] = useState<DhikrReminder[]>([]);
  const [activeReminderTriggered, setActiveReminderTriggered] = useState<DhikrReminder | null>(null);
  const [activeTab, setActiveTab] = useState<'counter' | 'library' | 'stats' | 'settings' | 'qibla'>('counter');
  const [streak, setStreak] = useState<number>(0);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  useConnectivityStatus(setIsOnline);

  usePersistentAppState(
    { defaultDhikrs: SYSTEM_DHIKRS, defaultPreferences: DEFAULT_PREFERENCES, defaultReminders: DEFAULT_REMINDERS },
    { setDhikrs, setCurrentDhikrId, setCurrentCount, setHistory, setPreferences, setReminders, setStreak },
    { dhikrs, currentDhikrId, currentCount, history, preferences, reminders },
  );

  const { dismissReminder } = useReminderScheduler(reminders, preferences, setActiveReminderTriggered);


  const activeDhikr = dhikrs.find((d) => d.id === currentDhikrId) || SYSTEM_DHIKRS[0];







  const { handleIncrement, handleReset } = useCounterFlow({
    activeDhikr,
    currentCount,
    preferences,
    dhikrs,
    currentDhikrId,
    setCurrentCount,
    setCurrentDhikrId,
    setHistory,
    setConfirmModal,
  });

  const { handleAddDhikr, handleDeleteDhikr, handleToggleCompleteToday } = useDhikrActions({
    dhikrs,
    currentDhikrId,
    history,
    preferences,
    systemDhikrs: SYSTEM_DHIKRS,
    setDhikrs,
    setCurrentDhikrId,
    setCurrentCount,
    setActiveTab,
    setHistory,
    setConfirmModal,
  });


  // Dynamic Theme Base background styles

  const { handleClearHistory, handleResetAllData } = useHistoryActions({
    setHistory,
    setStreak,
    setDhikrs,
    setCurrentDhikrId,
    setCurrentCount,
    setPreferences,
    setReminders,
    setActiveTab,
    setConfirmModal,
    systemDhikrs: SYSTEM_DHIKRS,
    defaultPreferences: DEFAULT_PREFERENCES,
    defaultReminders: DEFAULT_REMINDERS,
  });

  const getThemeBg = () => {
    if (preferences.theme === 'midnight') return 'bg-neutral-950 dark';
    return 'bg-slate-100';
  };

  const activeTabClass = (tab: typeof activeTab) => {
    if (activeTab === tab) {
      return preferences.theme === 'emerald'
        ? 'text-emerald-700 dark:text-emerald-400'
        : preferences.theme === 'amber'
        ? 'text-amber-700 dark:text-amber-400'
        : preferences.theme === 'indigo'
        ? 'text-indigo-700 dark:text-indigo-400'
        : 'text-slate-900 dark:text-white';
    }
    return 'text-slate-400 dark:text-neutral-500 hover:text-slate-650';
  };

  return (
    <div id="app_root_viewport" className={`min-h-screen w-screen flex items-center justify-center transition-colors duration-500 overflow-y-auto ${getThemeBg()} py-6 px-4 md:py-10`}>
      
      {/* PHONE WRAP MOMENT FOR DESKTOP WORKSPACE */}
      {/* Adapts beautifully on screens less than md by hiding the simulated physical frame */}
      <div 
        id="phone_simulator_frame"
        className="w-full max-w-sm h-[780px] md:rounded-[40px] md:border-[12px] md:border-neutral-900 md:shadow-2xl md:bg-white dark:md:bg-neutral-950 overflow-hidden flex flex-col relative"
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0,0,0,0.1)'
        }}
      >
        
        {/* PHYSICAL SIMULATED PHONE STATUS BAR AND CAMERA NOTCH (Desktop Only) */}
        <div className="hidden md:flex bg-neutral-950 text-white h-7 shrink-0 relative items-center justify-between px-6 select-none z-50">
          <span className="text-[10px] font-bold font-mono text-neutral-400">9:41</span>
          <div className="absolute left-1/2 -translate-x-1/2 top-1 w-24 h-4.5 bg-neutral-900 rounded-b-xl border border-neutral-850" />
          <div className="flex items-center gap-1 text-[10px] font-bold text-neutral-400">
            <span>5G</span>
            <div className="w-4 h-2 rounded-xs border border-neutral-400 p-0.5 flex bg-emerald-500" />
          </div>
        </div>

        {/* INNER SCREEN CONTAINER (THE ACTUAL APPLET CORES) */}
        <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-neutral-950 relative overflow-hidden">
          
          {/* OFFLINE STATUS PILLED BANNER (PWA CAPABLE) */}
          <AnimatePresence>
            {!isOnline && (
              <motion.div
                initial={{ opacity: 0, y: -20, x: '-50%' }}
                animate={{ opacity: 1, y: 0, x: '-50%' }}
                exit={{ opacity: 0, y: -20, x: '-50%' }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="absolute top-3 left-1/2 -translate-x-1/2 z-45 bg-slate-900/95 border border-amber-500/30 text-amber-400 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-xl shadow-amber-950/30 backdrop-blur-md select-none pointer-events-none"
              >
                <WifiOff className="w-3 h-3 text-amber-400 animate-pulse" />
                <span>Offline Mode Active</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* GENTLE SCHEDULER REMINDER ALERTS */}
          <AnimatePresence>
            {activeReminderTriggered && (
              <motion.div
                initial={{ opacity: 0, y: -80, x: '-50%' }}
                animate={{ opacity: 1, y: 0, x: '-50%' }}
                exit={{ opacity: 0, y: -80, x: '-50%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 w-[92%] z-50 bg-slate-900 border border-amber-500/40 text-slate-100 p-4 rounded-3xl shadow-2xl flex flex-col gap-3.5"
              >
                <div className="flex gap-2.5 items-start">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/15 animate-pulse shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest block">Gentle Remembrance Alert</span>
                    <h4 className="text-xs font-black truncate leading-tight text-slate-50">{activeReminderTriggered.label}</h4>
                    <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Time to chant: <span className="text-slate-200 font-bold">{activeReminderTriggered.dhikrName}</span></span>
                  </div>
                </div>

                <div className="flex gap-2 border-t border-slate-800/60 pt-3">
                  <button
  onClick={() => dismissReminder()}
  className="flex-1 py-1.5 rounded-xl border border-slate-800 text-slate-400 font-black text-2xs hover:bg-slate-800 hover:text-white transition-all cursor-pointer"
>
  Skip
</button>
<button
  onClick={() => {
    setCurrentDhikrId(activeReminderTriggered.dhikrId);
    setCurrentCount(0);
    setActiveTab('counter');
    dismissReminder();
    if (preferences.soundOn) {
      playCompletionSound(preferences.volume);
    }
  }}
                    className="flex-[2] py-1.5 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 text-slate-950 font-black text-2xs shadow-md shadow-amber-950/20 hover:opacity-95 transition-all text-center flex items-center justify-center gap-1 cursor-pointer"
                  >
                    Start Chanting Now 📿
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1 min-h-0 relative">
            {activeTab === 'counter' && (
              <CounterScreen
                currentDhikr={activeDhikr}
                currentCount={currentCount}
                history={history}
                preferences={preferences}
                onIncrement={handleIncrement}
                onReset={handleReset}
                onToggleSound={() => setPreferences(prev => ({ ...prev, soundOn: !prev.soundOn }))}
                onNavigateToLibrary={() => setActiveTab('library')}
              />
            )}

            {activeTab === 'library' && (
              <DhikrLibrary
                dhikrs={dhikrs}
                currentDhikrId={currentDhikrId}
                history={history}
                onSelectDhikr={(id) => {
                  setCurrentDhikrId(id);
                  setCurrentCount(0);
                  setActiveTab('counter');
                }}
                onAddDhikr={handleAddDhikr}
                onDeleteDhikr={handleDeleteDhikr}
                onToggleCompleteToday={handleToggleCompleteToday}
              />
            )}

            {activeTab === 'stats' && (
              <StatsScreen
                history={history}
                streak={streak}
                allTimeCount={history.reduce((sum, current) => sum + current.count, 0) + currentCount}
                onClearHistory={handleClearHistory}
                dhikrs={dhikrs}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsScreen
                preferences={preferences}
                onChangePreferences={(diff) => setPreferences((prev) => ({ ...prev, ...diff }))}
                onResetAllData={handleResetAllData}
                reminders={reminders}
                onUpdateReminders={setReminders}
                dhikrs={dhikrs}
              />
            )}

            {activeTab === 'qibla' && (
              <QiblaScreen theme={preferences.theme} />
            )}
          </div>

          {/* BOTTOM NAVIGATION TAB BAR */}
          <div className="h-16 shrink-0 border-t border-slate-100 dark:border-neutral-900 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-md flex items-center justify-around px-2 select-none z-30">
            {/* Tab: Counter */}
            <button
              id="tab_trigger_counter"
              onClick={() => setActiveTab('counter')}
              className={`flex flex-col items-center gap-1 py-1.5 px-2.5 transition-colors cursor-pointer focus:outline-none ${activeTabClass('counter')}`}
            >
              <CircleDot className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Bead</span>
            </button>

            {/* Tab: Library */}
            <button
              id="tab_trigger_library"
              onClick={() => setActiveTab('library')}
              className={`flex flex-col items-center gap-1 py-1.5 px-2.5 transition-colors cursor-pointer focus:outline-none ${activeTabClass('library')}`}
            >
              <BookOpen className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Library</span>
            </button>

            {/* Tab: Qibla */}
            <button
              id="tab_trigger_qibla"
              onClick={() => setActiveTab('qibla')}
              className={`flex flex-col items-center gap-1 py-1.5 px-2.5 transition-colors cursor-pointer focus:outline-none ${activeTabClass('qibla')}`}
            >
              <Compass className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Qibla</span>
            </button>

            {/* Tab: Stats */}
            <button
              id="tab_trigger_stats"
              onClick={() => setActiveTab('stats')}
              className={`flex flex-col items-center gap-1 py-1.5 px-2.5 transition-colors cursor-pointer focus:outline-none ${activeTabClass('stats')}`}
            >
              <Trophy className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Stats</span>
            </button>

            {/* Tab: Settings */}
            <button
              id="tab_trigger_settings"
              onClick={() => setActiveTab('settings')}
              className={`flex flex-col items-center gap-1 py-1.5 px-2.5 transition-colors cursor-pointer focus:outline-none ${activeTabClass('settings')}`}
            >
              <SettingsIcon className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Options</span>
            </button>
          </div>

          {/* BEAUTIFUL STATEFUL CUSTOM DIALOG MODAL OVERLAY */}
          <AnimatePresence>
            {confirmModal && (
              <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xs">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="w-full max-w-xs p-5 rounded-3xl bg-slate-900 border border-slate-800 text-slate-100 shadow-2xl flex flex-col items-center text-center"
                >
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
                    <AlertTriangle className="w-6 h-6 animate-pulse" />
                  </div>
                  
                  <h3 className="text-sm font-black tracking-tight mb-2 select-none">
                    {confirmModal.title}
                  </h3>
                  
                  <p className="text-2xs text-slate-400 font-medium leading-relaxed mb-6 px-1 select-none">
                    {confirmModal.message}
                  </p>
                  
                  <div className="flex w-full gap-3">
                    <button
                      id="btn_confirm_cancel"
                      onClick={() => setConfirmModal(null)}
                      className="flex-1 py-2 rounded-xl border border-slate-800 text-slate-300 font-bold text-2xs select-none hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      id="btn_confirm_action"
                      onClick={confirmModal.onConfirm}
                      className="flex-1 py-2 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 text-slate-950 font-black text-2xs select-none hover:opacity-95 shadow-md shadow-amber-950/20 cursor-pointer"
                    >
                      Confirm
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
