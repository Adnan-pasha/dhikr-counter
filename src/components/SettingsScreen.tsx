import React from 'react';
import { motion } from 'motion/react';
import { Settings, Volume2, Sparkles, Sliders, Smartphone, HelpCircle, User } from 'lucide-react';
import { UserPreferences, SoundTone, AppTheme } from '../types';
import { playBeadSound, playCompletionSound } from '../audio';

interface SettingsScreenProps {
  preferences: UserPreferences;
  onChangePreferences: (prefs: Partial<UserPreferences>) => void;
  onResetAllData: () => void;
}

export default function SettingsScreen({
  preferences,
  onChangePreferences,
  onResetAllData,
}: SettingsScreenProps) {
  
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
