import React, { useState, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { WifiOff } from 'lucide-react';
import { Dhikr, DhikrHistory, UserPreferences, DhikrReminder, Routine, SalahLog, SalahName, Madhab } from './types';
import { playCompletionSound } from './audio';
import CounterScreen from './components/CounterScreen';
import HomeScreen from './components/HomeScreen';
import SalahTracker from './components/SalahTracker';
import QuranReader from './components/QuranReader';
import StatsScreen from './components/StatsScreen';
import SettingsScreen from './components/SettingsScreen';
import ReminderBanner from './components/ReminderBanner';
import ConfirmModal from './components/ConfirmModal';
import AdhkaarLibrary from './components/AdhkaarLibrary';
import RoutineManager from './components/RoutineManager';
import BottomNav from './components/BottomNav';
import OnboardingFlow from './components/OnboardingFlow';
import { ADHKAAR_LIBRARY } from './adhkaar-data';
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
  madhab: 'shafi',
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
  const [onboardingCompleted, setOnboardingCompleted] = useState(
    () => localStorage.getItem('tasbih_onboarding_completed') === 'true',
  );
  const [dhikrs, setDhikrs] = useState<Dhikr[]>([]);
  const [currentDhikrId, setCurrentDhikrId] = useState<string>('subhanallah');
  const [currentCount, setCurrentCount] = useState<number>(0);
  const [history, setHistory] = useState<DhikrHistory[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [reminders, setReminders] = useState<DhikrReminder[]>([]);
  const [activeReminderTriggered, setActiveReminderTriggered] = useState<DhikrReminder | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'counter' | 'adhkaar' | 'routine' | 'salah' | 'quran' | 'stats' | 'settings' | 'qibla'>('home');
  const [streak, setStreak] = useState<number>(0);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [favouriteIds, setFavouriteIds] = useState<string[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [salahLogs, setSalahLogs] = useState<SalahLog[]>([]);
  const [quranBookmarks, setQuranBookmarks] = useState<string[]>([]);
  const [lastReadSurah, setLastReadSurah] = useState<number>(0);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  useConnectivityStatus(setIsOnline);

  usePersistentAppState(
    { defaultDhikrs: SYSTEM_DHIKRS, defaultPreferences: DEFAULT_PREFERENCES, defaultReminders: DEFAULT_REMINDERS },
    { setDhikrs, setCurrentDhikrId, setCurrentCount, setHistory, setPreferences, setReminders, setStreak, setFavouriteIds, setRoutines, setSalahLogs },
    { dhikrs, currentDhikrId, currentCount, history, preferences, reminders, favouriteIds, routines, salahLogs },
  );

  // Quran bookmarks & last read persistence
  React.useEffect(() => {
    const saved = localStorage.getItem('tasbih_quran_bookmarks');
    if (saved) setQuranBookmarks(JSON.parse(saved));
    const lastRead = localStorage.getItem('tasbih_quran_last_read');
    if (lastRead) setLastReadSurah(parseInt(lastRead));
  }, []);
  React.useEffect(() => {
    localStorage.setItem('tasbih_quran_bookmarks', JSON.stringify(quranBookmarks));
  }, [quranBookmarks]);
  React.useEffect(() => {
    if (lastReadSurah > 0) localStorage.setItem('tasbih_quran_last_read', String(lastReadSurah));
  }, [lastReadSurah]);

  const { dismissReminder } = useReminderScheduler(reminders, preferences, setActiveReminderTriggered);


  const activeDhikr = dhikrs.find((d) => d.id === currentDhikrId) || SYSTEM_DHIKRS[0];







  // Find active routine based on current dhikr — use persisted routines for auto-advance
  const activeRoutine = React.useMemo(() => {
    const matched = routines.find(r => r.dhikrIds.includes(currentDhikrId));
    if (!matched) return null;
    const allAvailable = [...ADHKAAR_LIBRARY, ...dhikrs];
    return matched.dhikrIds
      .map((id: string) => allAvailable.find((d: Dhikr) => d.id === id))
      .filter(Boolean) as Dhikr[];
  }, [currentDhikrId, routines, dhikrs]);

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
    onResetOnboarding: () => setOnboardingCompleted(false),
  });

  const handleOnboardingComplete = (
    madhab: Madhab,
    notificationChoice: NotificationPermission | 'unsupported' | 'skipped',
  ) => {
    setPreferences((prev) => ({ ...prev, madhab }));
    localStorage.setItem('tasbih_notification_choice', notificationChoice);
    localStorage.setItem('tasbih_onboarding_completed', 'true');
    setOnboardingCompleted(true);
    setActiveTab('home');
  };

  if (!onboardingCompleted) {
    return <OnboardingFlow defaultMadhab={preferences.madhab} onComplete={handleOnboardingComplete} />;
  }

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
    <div
      id="app_root_viewport"
      className="min-h-screen w-screen flex items-center justify-center overflow-y-auto py-0 md:py-8 md:px-4"
      style={{ background: 'var(--color-bg-deep)' }}
    >
      {/* Phone simulator frame (desktop only) */}
      <div
        id="phone_simulator_frame"
        className="w-full max-w-[390px] h-screen md:h-[820px] md:rounded-[48px] overflow-hidden flex flex-col relative"
        style={{
          background: 'var(--color-bg-base)',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 32px 80px -12px rgba(0,0,0,0.8), 0 0 120px rgba(245,158,11,0.04)',
        }}
      >
        {/* Status bar (desktop only) */}
        <div className="hidden md:flex bg-[#090E1A] h-8 shrink-0 items-center justify-between px-7 select-none z-50">
          <span className="text-[11px] font-bold font-mono text-slate-400">9:41</span>
          <div className="absolute left-1/2 -translate-x-1/2 w-28 h-5 bg-[#090E1A] rounded-b-2xl border-x border-b border-slate-800/60 flex items-center justify-center gap-1.5">
            <div className="w-1 h-1 rounded-full bg-slate-700" />
            <div className="w-3 h-3 rounded-full border border-slate-700" />
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
            <span>5G</span>
            <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
              <rect x="0" y="4" width="3" height="6" rx="1" fill="currentColor" opacity="0.4"/>
              <rect x="4.5" y="2.5" width="3" height="7.5" rx="1" fill="currentColor" opacity="0.6"/>
              <rect x="9" y="0.5" width="3" height="9.5" rx="1" fill="currentColor"/>
              <rect x="13.5" y="2" width="2" height="6" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1"/>
              <rect x="14" y="3.5" width="1" height="3" rx="0.3" fill="currentColor"/>
            </svg>
          </div>
        </div>

        {/* Inner screen container */}
        <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden" style={{ background: 'var(--color-bg-base)' }}>

          {/* GENTLE SCHEDULER REMINDER ALERTS — outside overflow-hidden */}
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

   <div className="flex-1 min-h-0 relative">
            {activeTab === 'home' && (
              <HomeScreen
                streak={streak}
                history={history}
                routines={routines}
                currentDhikrId={currentDhikrId}
                preferences={preferences}
                favouriteIds={favouriteIds}
                customDhikrs={dhikrs.filter(d => !d.isSystem)}
                onNavigateTo={(tab) => setActiveTab(tab)}
                onStartDhikr={(id) => {
                  setCurrentDhikrId(id);
                  setCurrentCount(0);
                  setActiveTab('counter');
                }}
                onStartRoutine={(routineId, firstDhikrId) => {
                  setCurrentDhikrId(firstDhikrId);
                  setCurrentCount(0);
                  setActiveTab('counter');
                }}
              />
            )}

            {activeTab === 'counter' && (
              <CounterScreen
                currentDhikr={activeDhikr}
                currentCount={currentCount}
                history={history}
                preferences={preferences}
                onIncrement={handleIncrement}
                onReset={handleReset}
                onToggleSound={() => setPreferences(prev => ({ ...prev, soundOn: !prev.soundOn }))}
                onNavigateToLibrary={() => setActiveTab('adhkaar')}
              />
            )}

            {activeTab === 'adhkaar' && (
              <AdhkaarLibrary
                customDhikrs={dhikrs.filter(d => !d.isSystem)}
                currentDhikrId={currentDhikrId}
                history={history}
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
                onAddCustomDhikr={handleAddDhikr}
                onEditCustomDhikr={handleEditDhikr}
                onDeleteCustomDhikr={handleDeleteDhikr}
                onToggleCompleteToday={handleToggleCompleteToday}
                onNavigateToRoutine={() => setActiveTab('routine')}
              />
            )}
            
            {activeTab === 'routine' && (
              <RoutineManager
                routines={routines}
                customDhikrs={dhikrs.filter(d => !d.isSystem)}
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
                onAddRoutine={(routine) => {
                  const newRoutine = {
                    ...routine,
                    id: `routine-${Date.now()}`,
                    createdAt: new Date().toISOString(),
                  };
                  setRoutines(prev => [...prev, newRoutine]);
                }}
                onEditRoutine={(id, name, emoji, dhikrIds) => {
                  setRoutines(prev =>
                    prev.map(r => r.id === id ? { ...r, name, emoji, dhikrIds } : r)
                  );
                }}
                onDeleteRoutine={(id) => {
                  setRoutines(prev => prev.filter(r => r.id !== id));
                }}
                onNavigateToAdhkaar={() => setActiveTab('adhkaar')}
              />
            )}

            {activeTab === 'salah' && (
              <SalahTracker
                salahLogs={salahLogs}
                onTogglePrayer={(date, prayer) => {
                  setSalahLogs(prev => {
                    const existing = prev.find(l => l.date === date);
                    if (existing) {
                      return prev.map(l =>
                        l.date === date
                          ? { ...l, prayers: { ...l.prayers, [prayer]: !l.prayers[prayer as SalahName] } }
                          : l
                      );
                    }
                    return [...prev, { date, prayers: { [prayer]: true } }];
                  });
                }}
              />
            )}

            {activeTab === 'quran' && (
              <QuranReader
                bookmarkedAyahs={quranBookmarks}
                lastReadSurah={lastReadSurah}
                onBookmarkToggle={(key) =>
                  setQuranBookmarks(prev =>
                    prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
                  )
                }
                onUpdateLastRead={setLastReadSurah}
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

          {/* ── BOTTOM NAVIGATION ───────────────────────────────────────── */}
          <BottomNav
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />

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
