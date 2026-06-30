import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Volume2, Sparkles, Sliders, Smartphone, HelpCircle, User, Clock, Plus, Trash2, Bell, BookOpenText, Check, ChevronLeft } from 'lucide-react';
import { UserPreferences, SoundTone, AppTheme, DhikrReminder, Dhikr, Madhab } from '../types';
import { playBeadSound, playCompletionSound } from '../audio';

interface SettingsScreenProps {
  preferences: UserPreferences;
  onChangePreferences: (prefs: Partial<UserPreferences>) => void;
  onResetAllData: () => void;
  reminders: DhikrReminder[];
  onUpdateReminders: React.Dispatch<React.SetStateAction<DhikrReminder[]>>;
  dhikrs: Dhikr[];
  onGoBack: () => void;
}

export default function SettingsScreen({
  preferences,
  onChangePreferences,
  onResetAllData,
  reminders = [],
  onUpdateReminders,
  dhikrs = [],
  onGoBack,
}: SettingsScreenProps) {
  
  // Scheduler Editor Form States
  const [isAddingReminder, setIsAddingReminder] = useState(false);
  const [newReminderDhikrId, setNewReminderDhikrId] = useState(dhikrs[0]?.id || 'subhanallah');
  
  // Custom interactive 12-hour AM/PM clock states
  const [timeHour, setTimeHour] = useState('08');
  const [timeMinute, setTimeMinute] = useState('00');
  const [timePeriod, setTimePeriod] = useState<'AM' | 'PM'>('AM');
  const [newReminderDays, setNewReminderDays] = useState<string[]>(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
  const [newReminderLabel, setNewReminderLabel] = useState('Daily Tasbih Duty');

  // Success Feedbacks and Notifications inside card
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const triggerFeedback = (message: string) => {
    setFeedbackMessage(message);
    setTimeout(() => {
      setFeedbackMessage(prev => prev === message ? null : prev);
    }, 4500);
  };

  const get24HourString = (h: string, m: string, period: 'AM' | 'PM') => {
    let hr = parseInt(h, 10);
    if (period === 'PM' && hr < 12) hr += 12;
    if (period === 'AM' && hr === 12) hr = 0;
    return `${String(hr).padStart(2, '0')}:${m}`;
  };

  const handleToggleReminder = (id: string, isEnabled: boolean) => {
    onUpdateReminders(prev => prev.map(rem => {
      if (rem.id === id) {
        triggerFeedback(`Saved: "${rem.label}" is now ${isEnabled ? 'Active 🔔' : 'Muted 🔕'}`);
        return { ...rem, isEnabled };
      }
      return rem;
    }));
  };

  const handleDeleteReminder = (id: string) => {
    onUpdateReminders(prev => {
      const match = prev.find(rem => rem.id === id);
      if (match) {
        triggerFeedback(`Deleted: "${match.label}" has been removed`);
      }
      return prev.filter(rem => rem.id !== id);
    });
  };

  const handleToggleDaySelection = (day: string) => {
    setNewReminderDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day) 
        : [...prev, day]
    );
  };

  const handleAddReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReminderLabel.trim()) return;
    
    // Find dhikr
    const matchingDhikr = dhikrs.find(d => d.id === newReminderDhikrId) || dhikrs[0];
    const itemEnName = matchingDhikr ? matchingDhikr.nameEn : 'SubhanAllah';

    // Construct real time string in 24-hours format
    const time24Str = get24HourString(timeHour, timeMinute, timePeriod);

    const fresh: DhikrReminder = {
      id: 'rem_' + Math.random().toString(36).substring(2, 9),
      dhikrId: newReminderDhikrId,
      dhikrName: itemEnName,
      timeString: time24Str,
      days: newReminderDays.length > 0 ? newReminderDays : ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      label: newReminderLabel.trim(),
      isEnabled: true
    };

    onUpdateReminders(prev => [...prev, fresh]);
    setIsAddingReminder(false);
    triggerFeedback(`Success: Added reminder "${fresh.label}" for ${timeHour}:${timeMinute} ${timePeriod}! 🔔`);
    
    // Reset inputs
    setNewReminderLabel('Daily Tasbih Duty');
    setTimeHour('08');
    setTimeMinute('00');
    setTimePeriod('AM');
    setNewReminderDays(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
  };
  
  // Custom switch component wrapper
  const Switch = ({ 
    checked, 
    onChange 
  }: { 
    id: string; 
    checked: boolean; 
    onChange: (val: boolean) => void 
  }) => (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full p-0.5 transition-colors focus:outline-none cursor-pointer ${
        checked ? 'bg-amber-500' : 'bg-slate-800'
      }`}
    >
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="w-5 h-5 rounded-full bg-slate-100 shadow-sm"
        style={{ x: checked ? 20 : 0 }}
      />
    </button>
  );

  const testSound = (tone: SoundTone) => {
    playBeadSound(tone, preferences.volume);
  };

  const testCompletion = () => {
    playCompletionSound(preferences.volume);
  };

  const themes: { id: AppTheme; label: string; color: string; border: string }[] = [
    { id: 'slate', label: 'Slate Gray', color: 'bg-slate-600', border: 'border-slate-500' },
    { id: 'emerald', label: 'Emerald Mosque', color: 'bg-emerald-600', border: 'border-emerald-500' },
    { id: 'amber', label: 'Rose Desert', color: 'bg-amber-600', border: 'border-amber-500' },
    { id: 'indigo', label: 'Tahajjud Blue', color: 'bg-indigo-600', border: 'border-indigo-500' },
    { id: 'midnight', label: 'Obsidian Jet', color: 'bg-[#030712] border border-slate-800', border: 'border-red-500' },
  ];

  const madhabs: Array<{ id: Madhab; label: string; note: string }> = [
    { id: 'hanafi', label: 'Hanafi', note: 'Later Asr calculation' },
    { id: 'shafi', label: "Shafi'i", note: 'Standard Asr calculation' },
    { id: 'maliki', label: 'Maliki', note: 'Standard Asr calculation' },
    { id: 'hanbali', label: 'Hanbali', note: 'Standard Asr calculation' },
  ];

  return (
    <div id="settings_screen_container" className="screen">

      {/* Header */}
      <div className="screen-header">
        <div className="header-row">
          <button onClick={onGoBack} className="back-btn" aria-label="Go back to Home">
            <ChevronLeft className="w-5 h-5" />
            <span>Home</span>
          </button>
          <h1 className="screen-title text-center select-none">Settings</h1>
          <div className="w-[44px]" />
        </div>
        <p className="caption select-none">Haptics, sounds, and appearance settings</p>
      </div>

      <div className="scroll-area space-y-6">
        
        <div className="space-y-3">
          <div>
            <h3 className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-slate-400">
              <BookOpenText className="h-3.5 w-3.5" /> Prayer calculation
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Your madhab preference determines the Asr calculation used by prayer-time features.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {madhabs.map((madhab) => {
              const selected = preferences.madhab === madhab.id;
              return (
                <button
                  key={madhab.id}
                  type="button"
                  onClick={() => onChangePreferences({ madhab: madhab.id })}
                  aria-pressed={selected}
                  className={`relative rounded-2xl border p-3 text-left transition-all ${
                    selected
                      ? 'border-emerald-500/50 bg-emerald-500/10'
                      : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                  }`}
                >
                  {selected && (
                    <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 text-emerald-950">
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                  )}
                  <p className={`text-xs font-black ${selected ? 'text-emerald-300' : 'text-slate-200'}`}>{madhab.label}</p>
                  <p className="mt-1 pr-3 text-xs leading-relaxed text-slate-500">{madhab.note}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Card: Dark / Light Mode */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 select-none">
            <Sparkles className="w-3.5 h-3.5" /> Appearance
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {([
              { id: 'dark' as const, label: 'Dark Mode', icon: '🌙' },
              { id: 'light' as const, label: 'Light Mode', icon: '☀️' },
            ]).map((mode) => {
              const matches = preferences.colorMode === mode.id;
              return (
                <button
                  id={`color_mode_option_${mode.id}`}
                  key={mode.id}
                  onClick={() => onChangePreferences({ colorMode: mode.id })}
                  className="p-4 rounded-2xl border flex items-center gap-2.5 cursor-pointer text-left transition-all"
                  style={{
                    background: matches ? 'var(--color-brand-dim)' : 'var(--color-bg-raised)',
                    borderColor: matches ? 'var(--color-brand-border)' : 'var(--color-border)',
                  }}
                >
                  <span className="text-xl shrink-0">{mode.icon}</span>
                  <span className="text-sm font-bold" style={{ color: matches ? 'var(--color-text-brand)' : 'var(--color-text-primary)' }}>
                    {mode.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Card: Themes Selection */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 select-none">
            <Sparkles className="w-3.5 h-3.5" /> Color Theme
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {themes.map((theme) => {
              const matches = preferences.theme === theme.id;
              return (
                <button
                  id={`theme_option_${theme.id}`}
                  key={theme.id}
                  onClick={() => onChangePreferences({ theme: theme.id })}
                  className={`p-3 rounded-2xl border bg-slate-900/40 flex items-center gap-2.5 cursor-pointer text-left transition-all ${
                    matches 
                      ? 'border-amber-500 shadow-md bg-slate-900/80' 
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full ${theme.color} shrink-0`} />
                  <span className="text-xs font-bold text-slate-200">{theme.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Card: Audio Preferences */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-md space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 select-none">
            <Volume2 className="w-3.5 h-3.5 text-amber-400" /> Audio & Tone Settings
          </h3>

          <div className="flex justify-between items-center bg-transparent">
            <div>
              <p className="text-xs font-bold text-slate-200">Sound Feedback</p>
              <p className="text-xs text-slate-400 font-medium">Hear a feedback click when chanting</p>
            </div>
            <Switch
              id="switch_sound_feedback"
              checked={preferences.soundOn}
              onChange={(val) => onChangePreferences({ soundOn: val })}
            />
          </div>

          {preferences.soundOn && (
            <div className="pt-2 animate-fade-in space-y-3">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Tone Style</label>
              <div className="grid grid-cols-4 gap-2">
                {(['wooden', 'chime', 'digital', 'bowl'] as SoundTone[]).map((t) => (
                  <button
                    id={`btn_test_tone_${t}`}
                    key={t}
                    type="button"
                    onClick={() => {
                      onChangePreferences({ soundTone: t });
                      testSound(t);
                    }}
                    className={`py-2 rounded-xl text-xs font-bold border capitalize transition-all cursor-pointer ${
                      preferences.soundTone === t
                        ? 'bg-amber-500 text-slate-950 border-amber-500 font-black'
                        : 'bg-slate-800 border-slate-700 text-slate-350 hover:bg-slate-750'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Volume Slider */}
              <div className="pt-2 bg-transparent">
                <div className="flex justify-between text-xs font-bold text-slate-400 mb-1.5 uppercase">
                  <span>Volume Level</span>
                  <span>{Math.round(preferences.volume * 100)}%</span>
                </div>
                <input
                  id="range_volume_slider"
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={preferences.volume}
                  onChange={(e) => onChangePreferences({ volume: Number(e.target.value) })}
                  className="w-full accent-amber-500"
                />
              </div>

              {/* Play trial completion sound */}
              <button
                id="btn_test_celebration"
                onClick={testCompletion}
                className="w-full py-1.5 text-xs font-bold bg-slate-950 border border-slate-800 text-amber-450 rounded-xl hover:bg-slate-900 transition-colors cursor-pointer"
              >
                🔊 Play Goal Complete Chime Trial
              </button>
            </div>
          )}
        </div>

        {/* Card: Tap Behavior & Automation */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-md space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 select-none">
            <Sliders className="w-3.5 h-3.5 text-amber-400" /> Beads Behavior
          </h3>

          {/* Haptics Switch */}
          <div className="flex justify-between items-center bg-transparent">
            <div>
              <p className="text-xs font-bold text-slate-200">Physical Haptic Vibration</p>
              <p className="text-xs text-slate-400 font-medium">Pulse device haptics on tap feedback</p>
            </div>
            <Switch
              id="switch_haptics"
              checked={preferences.vibrateOn}
              onChange={(val) => {
                onChangePreferences({ vibrateOn: val });
                if (val && window.navigator && window.navigator.vibrate) {
                  window.navigator.vibrate(60);
                }
              }}
            />
          </div>

          {/* Auto advance */}
          <div className="flex justify-between items-center pt-2 bg-transparent">
            <div>
              <p className="text-xs font-bold text-slate-200">Auto-Advance Sequence</p>
              <p className="text-xs text-slate-400 font-medium">Switch to next prayer in sequence on goal complete</p>
            </div>
            <Switch
              id="switch_auto_advance"
              checked={preferences.autoAdvance}
              onChange={(val) => onChangePreferences({ autoAdvance: val })}
            />
          </div>
        </div>

        {/* Card: Schedules and Gentle Reminders */}
        <div id="reminders_section_card" className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-md space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 select-none font-sans">
              <Bell className="w-3.5 h-3.5 text-amber-400" /> Schedules & Reminders
            </h3>
            {!isAddingReminder && (
              <button
                id="btn_open_reminder_creator"
                onClick={() => setIsAddingReminder(true)}
                className="py-1 px-2.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-450 border border-amber-500/15 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Add New
              </button>
            )}
          </div>

          {/* Action Feedback Banner */}
          <AnimatePresence>
            {feedbackMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-350 rounded-2xl px-4 py-3 flex items-start gap-3 shadow-lg shadow-emerald-950/20 select-none"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/40 text-emerald-400 shrink-0 mt-0.5">
                  <span className="text-sm">✔</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-extrabold text-emerald-400 uppercase tracking-widest leading-none">Settings Notification</p>
                  <p className="text-xs font-semibold text-slate-200 mt-1 leading-normal">{feedbackMessage}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
 
          {/* Form Creator Drawer */}
          <AnimatePresence>
            {isAddingReminder && (
              <motion.form
                id="form_reminder_creator"
                onSubmit={handleAddReminder}
                initial={{ opacity: 0, y: 15, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: 15, height: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="p-4 rounded-2xl bg-slate-950 border border-slate-850 space-y-4 overflow-hidden shadow-2xl"
              >
                <div className="flex justify-between items-center border-b border-slate-900 pb-2.5">
                  <div className="flex items-center gap-1.5 bg-transparent">
                    <span className="text-xs shrink-0">🔔</span>
                    <span className="text-xs font-black uppercase text-amber-500 tracking-wider">New Auto-Tasbih Duty</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
  setIsAddingReminder(false);
  setNewReminderLabel('Daily Tasbih Duty');
  setTimeHour('08');
  setTimeMinute('00');
  setTimePeriod('AM');
  setNewReminderDays(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
}}
                    className="text-xs text-slate-500 hover:text-red-400 font-bold transition-colors cursor-pointer"
                  >
                    Close Form
                  </button>
                </div>
 
                {/* Input: Label string */}
                <div className="space-y-1 bg-transparent">
                  <label className="block text-xs font-black uppercase text-slate-400 tracking-wider">Duty Label / Title</label>
                  <input
                    id="input_reminder_label"
                    type="text"
                    required
                    maxLength={32}
                    value={newReminderLabel}
                    onChange={(e) => setNewReminderLabel(e.target.value)}
                    placeholder="e.g. Astaghfirullah 100x"
                    className="w-full text-xs py-2 px-3.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-150 placeholder-slate-600 focus:outline-none focus:border-amber-500/80 font-bold font-sans transition-all"
                  />
                </div>
 
                {/* Choose Dhikr items */}
                <div className="space-y-1 bg-transparent">
                  <label className="block text-xs font-black uppercase text-slate-400 tracking-wider">Preset Target Praise</label>
                  <select
                    id="select_reminder_dhikr"
                    value={newReminderDhikrId}
                    onChange={(e) => setNewReminderDhikrId(e.target.value)}
                    className="w-full text-xs font-bold py-2 px-3.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer font-sans"
                  >
                    {dhikrs.map((d) => (
  <option key={d.id} value={d.id} className="bg-slate-950 text-slate-200">
    {d.nameEn} — {d.meaning}
  </option>
))}
                  </select>
                </div>
 
                {/* Interactive Time Dial (Chevrons + Spin Select) */}
                <div className="space-y-1 bg-transparent">
                  <label className="block text-xs font-black uppercase text-slate-400 tracking-wider">Set Reminder Time</label>
                  
                  <div className="flex items-center gap-4 bg-slate-900/60 border border-slate-850 rounded-2xl p-3.5 justify-center relative">
                    {/* Hour control column */}
                    <div className="flex flex-col items-center bg-transparent">
                      {/* Plus button */}
                      <button
                        type="button"
                        onClick={() => {
                          const list = ['12', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11'];
                          const currIdx = list.indexOf(timeHour);
                          const nextIdx = (currIdx + 1) % list.length;
                          setTimeHour(list[nextIdx]);
                        }}
                        className="w-6 h-5 rounded hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer select-none"
                      >
                        ▲
                      </button>
                      <select
                        id="select_time_hour"
                        value={timeHour}
                        onChange={(e) => setTimeHour(e.target.value)}
                        className="bg-slate-950 text-slate-100 font-mono font-black text-sm px-3 py-1.5 rounded-xl border border-slate-850 focus:outline-none focus:border-amber-500 cursor-pointer text-center"
                      >
                        {['12', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11'].map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                      {/* Minus button */}
                      <button
                        type="button"
                        onClick={() => {
                          const list = ['12', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11'];
                          const currIdx = list.indexOf(timeHour);
                          const nextIdx = (currIdx - 1 + list.length) % list.length;
                          setTimeHour(list[nextIdx]);
                        }}
                        className="w-6 h-5 rounded hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer select-none"
                      >
                        ▼
                      </button>
                    </div>
 
                    <span className="text-amber-500 font-black text-lg select-none mb-1 animate-pulse">:</span>
 
                    {/* Minute control column */}
                    <div className="flex flex-col items-center bg-transparent">
                      {/* Plus button */}
                      <button
                        type="button"
                        onClick={() => {
                          const currentM = parseInt(timeMinute, 10);
                          const nextM = (currentM + 5) % 60; // steps of 5 for convenience!
                          setTimeMinute(String(nextM).padStart(2, '0'));
                        }}
                        className="w-6 h-5 rounded hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer select-none"
                      >
                        ▲
                      </button>
                      <select
                        id="select_time_minute"
                        value={timeMinute}
                        onChange={(e) => setTimeMinute(e.target.value)}
                        className="bg-slate-950 text-slate-100 font-mono font-black text-sm px-3 py-1.5 rounded-xl border border-slate-850 focus:outline-none focus:border-amber-500 cursor-pointer text-center"
                      >
                        {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      {/* Minus button */}
                      <button
                        type="button"
                        onClick={() => {
                          const currentM = parseInt(timeMinute, 10);
                          const nextM = (currentM - 5 + 60) % 60;
                          setTimeMinute(String(nextM).padStart(2, '0'));
                        }}
                        className="w-6 h-5 rounded hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer select-none"
                      >
                        ▼
                      </button>
                    </div>
 
                    {/* Period selection */}
                    <div className="flex flex-col items-center bg-transparent ml-2">
                      <div className="flex bg-slate-950 rounded-xl p-0.5 border border-slate-850">
                        {(['AM', 'PM'] as const).map(p => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setTimePeriod(p)}
                            className={`px-3 py-1.5 text-xs font-black tracking-wider rounded-lg transition-all cursor-pointer ${
                              timePeriod === p 
                                ? 'bg-amber-500 text-slate-950 shadow-md font-black' 
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
 
                  <p className="text-xs text-slate-500 font-semibold text-center select-none">
                    * Tap arrows for quick increments or click fields directly to access the standard dial spinner.
                  </p>
                </div>
 
                {/* Weekdays pickers (High art circles!) */}
                <div className="space-y-2 bg-transparent">
                  <div className="flex justify-between items-center bg-transparent">
                    <label className="block text-xs font-black uppercase text-slate-400 tracking-wider">Recurrent Intervals</label>
                    <div className="flex gap-1 bg-transparent">
                      <button
                        type="button"
                        onClick={() => setNewReminderDays(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])}
                        className="text-[7.5px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-900 hover:bg-amber-500/10 hover:text-amber-450 border border-slate-800 text-slate-400 cursor-pointer transition-colors"
                      >
                        Every day
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewReminderDays(['mon', 'tue', 'wed', 'thu', 'fri'])}
                        className="text-[7.5px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-900 hover:bg-amber-500/10 hover:text-amber-450 border border-slate-800 text-slate-400 cursor-pointer transition-colors"
                      >
                        Weekdays
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewReminderDays(['sat', 'sun'])}
                        className="text-[7.5px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-900 hover:bg-amber-500/10 hover:text-amber-450 border border-slate-800 text-slate-400 cursor-pointer transition-colors"
                      >
                        Weekends
                      </button>
                    </div>
                  </div>
                  
                  {/* Days circular buttons wrap */}
                  <div className="flex justify-between gap-1 mt-1 bg-transparent">
                    {[
                      { key: 'sun', label: 'S', day: 'Sun', color: 'bg-amber-500' },
                      { key: 'mon', label: 'M', day: 'Mon', color: 'bg-orange-400' },
                      { key: 'tue', label: 'T', day: 'Tue', color: 'bg-yellow-400' },
                      { key: 'wed', label: 'W', day: 'Wed', color: 'bg-emerald-400' },
                      { key: 'thu', label: 'T', day: 'Thu', color: 'bg-teal-400' },
                      { key: 'fri', label: 'F', day: 'Fri', color: 'bg-sky-400' },
                      { key: 'sat', label: 'S', day: 'Sat', color: 'bg-indigo-400' },
                    ].map((day) => {
                      const active = newReminderDays.includes(day.key);
                      return (
                        <button
                          key={day.key}
                          type="button"
                          onClick={() => handleToggleDaySelection(day.key)}
                          className={`relative w-8.5 h-8.5 rounded-full text-xs font-bold transition-all flex flex-col items-center justify-center cursor-pointer border ${
                            active
                              ? 'bg-slate-900 text-amber-400 border-amber-500/50 shadow-md shadow-amber-950/20 font-black scale-105'
                              : 'bg-slate-950 text-slate-500 border-slate-900 hover:border-slate-800'
                          }`}
                          title={`Repeat on ${day.day}`}
                        >
                          <span className="leading-none">{day.label}</span>
                          {/* Active status indicator dot below letter */}
                          {active && (
                            <span className="absolute bottom-1 w-1 h-1 rounded-full bg-amber-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
 
                {/* CTA Submit */}
                <button
                  id="btn_submit_reminder_schedule"
                  type="submit"
                  className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl hover:brightness-110 active:scale-98 transition-all shadow-lg shadow-amber-950/20 cursor-pointer font-sans"
                >
                  Save Active Dhikr Schedule 🔔
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* List of Scheduled Items */}
          <div className="space-y-2.5">
            {reminders.length === 0 ? (
              <div className="text-center py-5 rounded-xl bg-slate-950/20 border border-dashed border-slate-800">
                <Clock className="w-5 h-5 text-slate-650 mx-auto opacity-40 mb-1.5" />
                <p className="text-xs text-slate-500 font-bold select-none font-sans">No auto reminder schedules active</p>
                <p className="text-xs text-slate-600 mt-0.5 px-6 font-sans">Add specific fajr, asr or bedtime prayer reminders above to chant automatically</p>
              </div>
            ) : (
              reminders.map((rem) => {
                // Inline helper to convert 24h to 12h representation for visual alignment
                const format12Hour = (time24: string) => {
                  try {
                    const [hrs, mins] = time24.split(':');
                    let h = parseInt(hrs, 10);
                    const period = h >= 12 ? 'PM' : 'AM';
                    h = h % 12;
                    if (h === 0) h = 12;
                    return `${String(h).padStart(2, '0')}:${mins} ${period}`;
                  } catch {
                    return time24;
                  }
                };

                return (
                  <div
                    id={`reminder_row_${rem.id}`}
                    key={rem.id}
                    className={`p-3 rounded-xl border flex justify-between items-center transition-all ${
                      rem.isEnabled
                        ? 'bg-slate-900/40 border-slate-800'
                        : 'bg-slate-900/15 border-slate-900/40 opacity-60'
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 mb-1 bg-transparent">
                        <span className="text-xs font-black font-mono text-amber-450">{format12Hour(rem.timeString)}</span>
                        <span className="text-xs font-black uppercase tracking-wider text-slate-400 truncate font-sans">{rem.label}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <p className="text-xs text-slate-400 font-bold truncate font-sans">
                          Praise: <span className="text-slate-200 font-black">{rem.dhikrName}</span>
                        </p>
                        <p className="text-xs text-slate-500 lowercase font-medium tracking-tight font-sans">
                          repeat: {rem.days.length === 7 ? 'Every day' : rem.days.join(', ')}
                        </p>
                      </div>
                    </div>

                    {/* Actions (Toggle & Delete) */}
                    <div className="flex items-center gap-2.5 shrink-0 bg-transparent">
                      <Switch
                        id={`switch_rem_${rem.id}`}
                        checked={rem.isEnabled}
                        onChange={(checked) => handleToggleReminder(rem.id, checked)}
                      />
                      <button
                        id={`btn_delete_reminder_${rem.id}`}
                        onClick={() => handleDeleteReminder(rem.id)}
                        className="p-1 rounded-lg text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Card: Danger Zone */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-md space-y-3.5">
          <div>
            <p className="text-xs font-bold text-red-500 uppercase tracking-wider select-none">Danger Settings</p>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Clear records and options permanently</p>
          </div>
          <button
            id="btn_erase_everything"
            onClick={onResetAllData}
            className="w-full py-2.5 rounded-xl text-xs font-bold border border-red-500/30 text-red-400 hover:bg-red-500/10 cursor-pointer text-center select-none shadow-sm transition-colors hover:border-red-500"
          >
            Reset All Preferences & Data
          </button>
        </div>

        {/* Brand Information Footer */}
        <div className="text-center py-4 space-y-1 opacity-70">
          <p className="text-xs text-slate-400 uppercase tracking-wider select-none flex items-center justify-center gap-1 font-semibold">
            <Smartphone className="w-3.5 h-3.5 text-amber-400 animate-pulse" /> Tasbih Companion Hub
          </p>
          <p className="text-xs text-slate-500 select-none">Designed and engineered in high-fidelity sandbox context</p>
        </div>
      </div>
    </div>
  );
}
