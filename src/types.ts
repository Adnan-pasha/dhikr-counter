export type SoundTone = 'wooden' | 'chime' | 'digital' | 'bowl';

export type AppTheme = 'slate' | 'emerald' | 'amber' | 'indigo' | 'midnight';

export type AdhkaarCategory =
  | 'morning'
  | 'evening'
  | 'daily'
  | 'istighfar'
  | 'salawat'
  | 'protection'
  | 'sleep'
  | 'quranic'
  | 'motivation';

export type AdhkaarDifficulty = 'easy' | 'medium' | 'long';

export type AdhkaarTime = 'morning' | 'evening' | 'after-salah' | 'anytime' | 'sleep';

export interface Dhikr {
  id: string;
  nameAr: string;
  nameEn: string;
  meaning: string;
  targetCount: number;
  isSystem?: boolean;
  // Extended Adhkaar Library fields (optional for backwards compat)
  transliteration?: string;
  benefits?: string;
  reference?: string;
  category?: AdhkaarCategory[];
  time?: AdhkaarTime;
  isFeatured?: boolean;
  difficulty?: AdhkaarDifficulty;
  tags?: string[];
  sourceBook?: string;
  notes?: string;
  audioUrl?: string;
}

export interface DhikrHistory {
  id: string;
  dhikrId: string;
  dhikrName: string;
  count: number;
  timestamp: string; // ISO string
}

export interface UserPreferences {
  soundOn: boolean;
  soundTone: SoundTone;
  vibrateOn: boolean;
  autoAdvance: boolean;
  theme: AppTheme;
  volume: number; // 0 to 1
}

export interface DailyLog {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface DhikrReminder {
  id: string;
  dhikrId: string;
  dhikrName: string;
  timeString: string; // e.g., "05:30"
  days: string[]; // ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  label: string; // e.g., "Fajr Morning", "Asr Afternoon", "Tahajjud"
  isEnabled: boolean;
}

export interface Routine {
  id: string;
  name: string;            // e.g. "My Fajr Routine"
  emoji: string;           // e.g. "🌅"
  dhikrIds: string[];      // ordered list of dhikr IDs from Adhkaar Library
  reminderTime?: string;   // optional HH:MM
  reminderDays?: string[]; // ['mon','tue',...] optional
  isSystem?: boolean;      // true for pre-seeded Morning/Evening defaults
  createdAt: string;       // ISO string
}

// Adhkaar category metadata for UI display
export const CATEGORY_META: Record<AdhkaarCategory, { label: string; emoji: string; color: string }> = {
  morning:    { label: 'Morning',    emoji: '🌅', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  evening:    { label: 'Evening',    emoji: '🌙', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  daily:      { label: 'Daily',      emoji: '📿', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  istighfar:  { label: 'Istighfar',  emoji: '🤲', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
  salawat:    { label: 'Salawat',    emoji: '☀️', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
  protection: { label: 'Protection', emoji: '🛡️', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
  sleep:      { label: 'Sleep',      emoji: '😴', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  quranic:    { label: 'Quranic',    emoji: '📖', color: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
  motivation: { label: 'Motivation', emoji: '✨', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
};
