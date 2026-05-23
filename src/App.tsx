import React, { useState, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Trophy, Settings as SettingsIcon, CircleDot, Compass, WifiOff } from 'lucide-react';
import { Dhikr, DhikrHistory, UserPreferences, AppTheme, DhikrReminder } from './types';
import { playCompletionSound } from './audio';
import CounterScreen from './components/CounterScreen';
import DhikrLibrary from './components/DhikrLibrary';
import StatsScreen from './components/StatsScreen';
import SettingsScreen from './components/SettingsScreen';
import ReminderBanner from './components/ReminderBanner';
import ConfirmModal from './components/ConfirmModal';
import AdhkaarLibrary from './components/AdhkaarLibrary';
import RoutineBuilder from './components/RoutineBuilder';
import { getMorningRoutine, getEveningRoutine, ADHKAAR_LIBRARY } from './adhkaar-data';
import { useConnectivityStatus, useReminderScheduler, usePersistentAppState, useDhikrActions, useCounterFlow, useHistoryActions } from './hooks';

const QiblaScreen = lazy(() => import('./components/QiblaScreen'));
// Use the full rich ADHKAAR_LIBRARY as system dhikrs
const SYSTEM_DHIKRS: Dhikr[] = ADHKAAR_LIBRARY;

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
  const [activeTab, setActiveTab] = useState<'counter' | 'library' | 'adhkaar' | 'routine' | 'stats' | 'settings' | 'qibla'>('counter');
  const [streak, setStreak] = useState<number>(0);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [favouriteIds, setFavouriteIds] = useState<string[]>([]);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  useConnectivityStatus(setIsOnline);

  usePersistentAppState(
    { defaultDhikrs: SYSTEM_DHIKRS, defaultPreferences: DEFAULT_PREFERENCES, defaultReminders: DEFAULT_REMINDERS },
    { setDhikrs, setCurrentDhikrId, setCurrentCount, setHistory, setPreferences, setReminders, setStreak, setFavouriteIds },
    { dhikrs, currentDhikrId, currentCount, history, preferences, reminders, favouriteIds },
  );

  const { dismissReminder } = useReminderScheduler(reminders, preferences, setActiveReminderTriggered);


  const activeDhikr = dhikrs.find((d) => d.id === currentDhikrId) || SYSTEM_DHIKRS[0];







  const activeRoutine = React.useMemo(() => {
    const morningIds = getMorningRoutine().map((d) => d.id);
    const eveningIds = getEveningRoutine().map((d) => d.id);
    if (morningIds.includes(currentDhikrId)) return getMorningRoutine();
    if (eveningIds.includes(currentDhikrId)) return getEveningRoutine();
    return null;
  }, [currentDhikrId]);

  const { handleIncrement, handleReset } = useCounterFlow({
    activeDhikr,
    currentCount,
    preferences,
    dhikrs,
    currentDhikrId,
    activeRoutine,
    setCurrentCount,
    setCurrentDhikrId,
    setHistory,
    setConfirmModal,
  });

  const handleEditDhikr = (id: string, nameEn: string, nameAr: string, meaning: string, targetCount: number) => {
    setDhikrs((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, nameEn, nameAr, meaning, targetCount } : d
      )
    );
  };

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
          <ReminderBanner
            reminder={activeReminderTriggered}
            preferences={preferences}
            onDismiss={dismissReminder}
            onStartChanting={(dhikrId) => {
              setCurrentDhikrId(dhikrId);
              setCurrentCount(0);
              setActiveTab('counter');
              dismissReminder();
            }}
          />

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
                onEditDhikr={handleEditDhikr}
                onDeleteDhikr={handleDeleteDhikr}
                onToggleCompleteToday={handleToggleCompleteToday}
                onNavigateToAdhkaar={() => setActiveTab('adhkaar')}
              />
            )}

            {activeTab === 'adhkaar' && (
              <AdhkaarLibrary
                currentDhikrId={currentDhikrId}
                favouriteIds={favouriteIds}
                onToggleFavourite={(id) =>
                  setFavouriteIds((prev) =>
                    prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
                  )
                }
                onSelectDhikr={(id) => {
                  setCurrentDhikrId(id);
                  setCurrentCount(0);
                  setActiveTab('counter');
                }}
                onNavigateToRoutine={() => setActiveTab('routine')}
              />
            )}
            
            {activeTab === 'routine' && (
              <RoutineBuilder
                currentDhikrId={currentDhikrId}
                completedTodayIds={history
                  .filter((h) => {
                    const today = new Date();
                    const d = new Date(h.timestamp);
                    return (
                      d.getFullYear() === today.getFullYear() &&
                      d.getMonth() === today.getMonth() &&
                      d.getDate() === today.getDate()
                    );
                  })
                  .map((h) => h.dhikrId)}
                onStartDhikr={(id) => {
                  setCurrentDhikrId(id);
                  setCurrentCount(0);
                  setActiveTab('counter');
                }}
                onNavigateToAdhkaar={() => setActiveTab('adhkaar')}
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
              <Suspense fallback={
                <div className="flex-1 flex items-center justify-center bg-[#0f172a]">
                  <span className="text-amber-400 text-xs font-bold animate-pulse">Loading Qibla...</span>
                </div>
              }>
                <QiblaScreen theme={preferences.theme} />
              </Suspense>
            )}
          </div>

          {/* BOTTOM NAVIGATION TAB BAR */}
          <div className="h-16 shrink-0 border-t border-slate-100 dark:border-neutral-900 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-md flex items-center overflow-x-auto px-1 select-none z-30 scrollbar-hide gap-1">
            {/* Tab: Counter */}
            <button
              id="tab_trigger_counter"
              aria-label="Bead counter"
              onClick={() => setActiveTab('counter')}
              className={`flex flex-col items-center gap-1 py-1.5 px-2.5 transition-colors cursor-pointer focus:outline-none ${activeTabClass('counter')}`}
            >
              <CircleDot className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Bead</span>
            </button>

            {/* Tab: Library */}
            <button
              id="tab_trigger_library"
              aria-label="Dhikr library"
              onClick={() => setActiveTab('library')}
              className={`flex flex-col items-center gap-1 py-1.5 px-2.5 transition-colors cursor-pointer focus:outline-none ${activeTabClass('library')}`}
            >
              <BookOpen className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Library</span>
            </button>

            {/* Tab: Adhkaar */}
            <button
              id="tab_trigger_adhkaar"
              aria-label="Adhkaar library"
              onClick={() => setActiveTab('adhkaar')}
              className={`flex flex-col items-center gap-1 py-1.5 px-2.5 transition-colors cursor-pointer focus:outline-none ${activeTabClass('adhkaar')}`}
            >
              <span className="text-lg leading-none">📖</span>
              <span className="text-[10px] font-bold uppercase tracking-wider">Adhkaar</span>
            </button>

            {/* Tab: Routine */}
            <button
              id="tab_trigger_routine"
              aria-label="Daily routines"
              onClick={() => setActiveTab('routine')}
              className={`flex flex-col items-center gap-1 py-1.5 px-2.5 transition-colors cursor-pointer focus:outline-none ${activeTabClass('routine')}`}
            >
              <span className="text-lg leading-none">🌅</span>
              <span className="text-[10px] font-bold uppercase tracking-wider">Routine</span>
            </button>

            {/* Tab: Qibla */}
            <button
              id="tab_trigger_qibla"
              aria-label="Qibla compass"
              onClick={() => setActiveTab('qibla')}
              className={`flex flex-col items-center gap-1 py-1.5 px-2.5 transition-colors cursor-pointer focus:outline-none ${activeTabClass('qibla')}`}
            >
              <Compass className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Qibla</span>
            </button>

            {/* Tab: Stats */}
            <button
              id="tab_trigger_stats"
              aria-label="Stats"
              onClick={() => setActiveTab('stats')}
              className={`flex flex-col items-center gap-1 py-1.5 px-2.5 transition-colors cursor-pointer focus:outline-none ${activeTabClass('stats')}`}
            >
              <Trophy className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Stats</span>
            </button>

            {/* Tab: Settings */}
            <button
              id="tab_trigger_settings"
              aria-label="Options"
              onClick={() => setActiveTab('settings')}
              className={`flex flex-col items-center gap-1 py-1.5 px-2.5 transition-colors cursor-pointer focus:outline-none ${activeTabClass('settings')}`}
            >
              <SettingsIcon className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Options</span>
            </button>
          </div>

          {/* CONFIRM MODAL */}
          <ConfirmModal
            modal={confirmModal}
            onCancel={() => setConfirmModal(null)}
          />
        </div>

      </div>
    </div>
  );
}
