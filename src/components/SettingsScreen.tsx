import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Volume2, Sparkles, Sliders, Smartphone, HelpCircle, User, Clock, Plus, Trash2, Bell } from 'lucide-react';
import { UserPreferences, SoundTone, AppTheme, DhikrReminder, Dhikr } from '../types';
import { playBeadSound, playCompletionSound } from '../audio';

interface SettingsScreenProps {
  preferences: UserPreferences;
  onChangePreferences: (prefs: Partial<UserPreferences>) => void;
  onResetAllData: () => void;
  reminders: DhikrReminder[];
  onUpdateReminders: React.Dispatch<React.SetStateAction<DhikrReminder[]>>;
  dhikrs: Dhikr[];
}

export default function SettingsScreen({
  preferences,
  onChangePreferences,
  onResetAllData,
  reminders = [],
  onUpdateReminders,
  dhikrs = [],
}: SettingsScreenProps) {
  
  // Scheduler Editor Form States
  const [isAddingReminder, setIsAddingReminder] = useState(false);
  const [newReminderDhikrId, setNewReminderDhikrId] = useState(dhikrs[0]?.id || 'subhanallah');
  const [newReminderTime, setNewReminderTime] = useState('08:00');
  const [newReminderDays, setNewReminderDays] = useState<string[]>(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
  const [newReminderLabel, setNewReminderLabel] = useState('Daily Tasbih Duty');

  const handleToggleReminder = (id: string, isEnabled: boolean) => {
    onUpdateReminders(prev => prev.map(rem => rem.id === id ? { ...rem, isEnabled } : rem));
  };

  const handleDeleteReminder = (id: string) => {
    onUpdateReminders(prev => prev.filter(rem => rem.id !== id));
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

    const fresh: DhikrReminder = {
      id: 'rem_' + Math.random().toString(36).substring(2, 9),
      dhikrId: newReminderDhikrId,
      dhikrName: itemEnName,
      timeString: newReminderTime,
      days: newReminderDays.length > 0 ? newReminderDays : ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      label: newReminderLabel.trim(),
      isEnabled: true
    };

    onUpdateReminders(prev => [...prev, fresh]);
    setIsAddingReminder(false);
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

  return (
    <div id="settings_screen_container" className="flex flex-col h-full bg-[#0f172a] text-slate-100">
      
      {/* Header */}
      <div className="px-6 pt-5 pb-3 border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md flex justify-between items-center">
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-50 flex items-center gap-1.5 leading-none select-none">
            <Settings className="w-5 h-5 text-amber-400" />
            Preferences
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium select-none">Haptics, sounds, and appearance settings</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        
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
              <p className="text-[10px] text-slate-400 font-medium">Hear a feedback click when chanting</p>
            </div>
            <Switch
              id="switch_sound_feedback"
              checked={preferences.soundOn}
              onChange={(val) => onChangePreferences({ soundOn: val })}
            />
          </div>

          {preferences.soundOn && (
            <div className="pt-2 animate-fade-in space-y-3">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tone Style</label>
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
                    className={`py-2 rounded-xl text-2xs font-bold border capitalize transition-all cursor-pointer ${
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
                <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1.5 uppercase">
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
                className="w-full py-1.5 text-2xs font-bold bg-slate-950 border border-slate-800 text-amber-450 rounded-xl hover:bg-slate-900 transition-colors cursor-pointer"
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
              <p className="text-[10px] text-slate-400 font-medium">Pulse device haptics on tap feedback</p>
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
              <p className="text-[10px] text-slate-400 font-medium">Switch to next prayer in sequence on goal complete</p>
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
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 select-none">
              <Bell className="w-3.5 h-3.5 text-amber-400" /> Schedules & Reminders
            </h3>
            {!isAddingReminder && (
              <button
                id="btn_open_reminder_creator"
                onClick={() => setIsAddingReminder(true)}
                className="py-1 px-2.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-450 border border-amber-500/15 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Add New
              </button>
            )}
          </div>

          {/* Form Creator Drawer */}
          <AnimatePresence>
            {isAddingReminder && (
              <motion.form
                id="form_reminder_creator"
                onSubmit={handleAddReminder}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-3.5 rounded-xl bg-slate-950 border border-slate-850 space-y-3.5 overflow-hidden"
              >
                <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                  <span className="text-[10px] font-black uppercase text-amber-500 tracking-wider">Configure New Auto-Reminder</span>
                  <button
                    type="button"
                    onClick={() => setIsAddingReminder(false)}
                    className="text-[10px] text-slate-500 hover:text-slate-350 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                {/* Input: Label string */}
                <div className="space-y-1">
                  <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Reminder Name</label>
                  <input
                    id="input_reminder_label"
                    type="text"
                    required
                    value={newReminderLabel}
                    onChange={(e) => setNewReminderLabel(e.target.value)}
                    placeholder="e.g. Morning Prayer, Bedtime Dhikr"
                    className="w-full text-xs py-2 px-3 rounded-xl bg-slate-900/50 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 font-medium font-sans"
                  />
                </div>

                {/* Dropdown Selection: Dhikr items */}
                <div className="space-y-1">
                  <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Choose Dhikr</label>
                  <select
                    id="select_reminder_dhikr"
                    value={newReminderDhikrId}
                    onChange={(e) => setNewReminderDhikrId(e.target.value)}
                    className="w-full text-xs font-bold py-2 px-3 rounded-xl bg-slate-900/50 border border-slate-800 text-slate-100 focus:outline-none focus:border-amber-500 cursor-pointer font-sans"
                  >
                    {dhikrs.map((d) => (
                      <option key={d.id} value={d.id} className="bg-slate-950 text-slate-200">
                        {d.nameEn} (Ar: {d.nameAr.slice(0, 10)}...)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Time picker */}
                <div className="space-y-1">
                  <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Reminder Time</label>
                  <input
                    id="input_reminder_time"
                    type="time"
                    required
                    value={newReminderTime}
                    onChange={(e) => setNewReminderTime(e.target.value)}
                    className="w-full text-xs font-mono py-2 px-3 rounded-xl bg-slate-900/50 border border-slate-800 text-slate-100 focus:outline-none focus:border-amber-500 cursor-pointer"
                  />
                </div>

                {/* Weekdays pickers */}
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Repeat Days</label>
                  <div className="flex justify-between">
                    {[
                      { key: 'sun', label: 'S' },
                      { key: 'mon', label: 'M' },
                      { key: 'tue', label: 'T' },
                      { key: 'wed', label: 'W' },
                      { key: 'thu', label: 'T' },
                      { key: 'fri', label: 'F' },
                      { key: 'sat', label: 'S' },
                    ].map((day) => {
                      const active = newReminderDays.includes(day.key);
                      return (
                        <button
                          key={day.key}
                          type="button"
                          onClick={() => handleToggleDaySelection(day.key)}
                          className={`w-7 h-7 rounded-lg text-2xs font-extrabold transition-all cursor-pointer ${
                            active
                              ? 'bg-amber-500 text-slate-950 shadow-sm'
                              : 'bg-slate-900 text-slate-500 border border-slate-800'
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* CTA Submit */}
                <button
                  id="btn_submit_reminder_schedule"
                  type="submit"
                  className="w-full py-2 bg-gradient-to-tr from-amber-500 to-orange-400 text-slate-950 font-black text-2xs uppercase tracking-wider rounded-xl hover:opacity-95 transition-all shadow-md shadow-amber-950/20 cursor-pointer font-sans"
                >
                  Create Schedule 🔔
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* List of Scheduled Items */}
          <div className="space-y-2.5">
            {reminders.length === 0 ? (
              <div className="text-center py-5 rounded-xl bg-slate-950/20 border border-dashed border-slate-800">
                <Clock className="w-5 h-5 text-slate-650 mx-auto opacity-40 mb-1.5" />
                <p className="text-[10px] text-slate-500 font-bold select-none font-sans">No auto reminder schedules active</p>
                <p className="text-[9px] text-slate-600 mt-0.5 px-6 font-sans">Add specific fajr, asr or bedtime prayer reminders above to chant automatically</p>
              </div>
            ) : (
              reminders.map((rem) => (
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
                      <span className="text-xs font-black font-mono text-amber-450">{rem.timeString}</span>
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 truncate font-sans">{rem.label}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <p className="text-[9px] text-slate-400 font-bold truncate font-sans">
                        Praise: <span className="text-slate-200 font-black">{rem.dhikrName}</span>
                      </p>
                      <p className="text-[8px] text-slate-500 lowercase font-medium tracking-tight font-sans">
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
              ))
            )}
          </div>
        </div>

        {/* Card: Danger Zone */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-md space-y-3.5">
          <div>
            <p className="text-xs font-bold text-red-500 uppercase tracking-wider select-none">Danger Settings</p>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Clear records and options permanently</p>
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
          <p className="text-[10px] text-slate-400 uppercase tracking-wider select-none flex items-center justify-center gap-1 font-semibold">
            <Smartphone className="w-3.5 h-3.5 text-amber-400 animate-pulse" /> Tasbih Companion Hub
          </p>
          <p className="text-[10px] text-slate-500 select-none">Designed and engineered in high-fidelity sandbox context</p>
        </div>
      </div>
    </div>
  );
}
