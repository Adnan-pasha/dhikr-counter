export type SoundTone = 'wooden' | 'chime' | 'digital' | 'bowl';

export type AppTheme = 'slate' | 'emerald' | 'amber' | 'indigo' | 'midnight';

export interface Dhikr {
  id: string;
  nameAr: string;
  nameEn: string;
  meaning: string;
  targetCount: number; // e.g., 33, 99, 100, 0 for infinite
  isSystem?: boolean;
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

