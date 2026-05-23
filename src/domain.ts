import { Dhikr, DhikrHistory, DhikrReminder, UserPreferences, SoundTone, AppTheme } from './types';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const SOUND_TONES: SoundTone[] = ['wooden', 'chime', 'digital', 'bowl'];
const THEMES: AppTheme[] = ['slate', 'emerald', 'amber', 'indigo', 'midnight'];

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isString = (v: unknown): v is string => typeof v === 'string';
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export const safeParseJSON = <T>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const sanitizeDhikrs = (value: unknown, fallback: Dhikr[]): Dhikr[] => {
  if (!Array.isArray(value)) return fallback;
  const VALID_CATEGORIES = ['morning','evening','daily','istighfar','salawat','protection','sleep','quranic','motivation'];
  const VALID_DIFFICULTIES = ['easy', 'medium', 'long'];
  const VALID_TIMES = ['morning', 'evening', 'after-salah', 'anytime', 'sleep'];
  const cleaned = value.filter((d): d is Dhikr => {
    if (!isObject(d)) return false;
    if (!isString(d.id)) return false;
    if (!isString(d.nameAr)) return false;
    if (!isString(d.nameEn)) return false;
    if (!isString(d.meaning)) return false;
    if (!isNumber(d.targetCount)) return false;
    if (d.isSystem !== undefined && !isBool(d.isSystem)) return false;
    // Optional extended fields — drop silently if malformed
    if (d.transliteration !== undefined && !isString(d.transliteration)) return false;
    if (d.benefits !== undefined && !isString(d.benefits)) return false;
    if (d.reference !== undefined && !isString(d.reference)) return false;
    if (d.sourceBook !== undefined && !isString(d.sourceBook)) return false;
    if (d.notes !== undefined && !isString(d.notes)) return false;
    if (d.audioUrl !== undefined && !isString(d.audioUrl)) return false;
    if (d.isFeatured !== undefined && !isBool(d.isFeatured)) return false;
    if (d.difficulty !== undefined && !VALID_DIFFICULTIES.includes(d.difficulty as string)) return false;
    if (d.time !== undefined && !VALID_TIMES.includes(d.time as string)) return false;
    if (d.category !== undefined) {
      if (!Array.isArray(d.category)) return false;
      if (!(d.category as unknown[]).every((c) => isString(c) && VALID_CATEGORIES.includes(c))) return false;
    }
    if (d.tags !== undefined) {
      if (!Array.isArray(d.tags)) return false;
      if (!(d.tags as unknown[]).every(isString)) return false;
    }
    return true;
  });
  return cleaned.length > 0 ? cleaned : fallback;
};

export const sanitizeHistory = (value: unknown): DhikrHistory[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((h): h is DhikrHistory => isObject(h)
    && isString(h.id)
    && isString(h.dhikrId)
    && isString(h.dhikrName)
    && isNumber(h.count)
    && isString(h.timestamp));
};

export const sanitizePreferences = (value: unknown, fallback: UserPreferences): UserPreferences => {
  if (!isObject(value)) return fallback;
  const soundTone = SOUND_TONES.includes(value.soundTone as SoundTone) ? value.soundTone as SoundTone : fallback.soundTone;
  const theme = THEMES.includes(value.theme as AppTheme) ? value.theme as AppTheme : fallback.theme;
  const volume = isNumber(value.volume) ? Math.min(1, Math.max(0, value.volume)) : fallback.volume;
  return {
    soundOn: isBool(value.soundOn) ? value.soundOn : fallback.soundOn,
    soundTone,
    vibrateOn: isBool(value.vibrateOn) ? value.vibrateOn : fallback.vibrateOn,
    autoAdvance: isBool(value.autoAdvance) ? value.autoAdvance : fallback.autoAdvance,
    theme,
    volume,
  };
};

export const sanitizeReminders = (value: unknown, fallback: DhikrReminder[]): DhikrReminder[] => {
  if (!Array.isArray(value)) return fallback;
  const cleaned = value.filter((r): r is DhikrReminder => isObject(r)
    && isString(r.id)
    && isString(r.dhikrId)
    && isString(r.dhikrName)
    && isString(r.timeString)
    && /^\d{2}:\d{2}$/.test(r.timeString)
    && Array.isArray(r.days)
    && r.days.every((d) => isString(d) && DAY_KEYS.includes(d))
    && isString(r.label)
    && isBool(r.isEnabled));
  return cleaned.length > 0 ? cleaned : fallback;
};

export const sanitizeAzanSettings = (value: unknown): Record<string, boolean> => {
  const fallback = { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true };
  if (!isObject(value)) return fallback;
  return {
    fajr: isBool(value.fajr) ? value.fajr : true,
    dhuhr: isBool(value.dhuhr) ? value.dhuhr : true,
    asr: isBool(value.asr) ? value.asr : true,
    maghrib: isBool(value.maghrib) ? value.maghrib : true,
    isha: isBool(value.isha) ? value.isha : true,
  };
};

export const computeStreak = (histLogs: DhikrHistory[]): number => {
  if (histLogs.length === 0) return 0;
  const uniqueDates = Array.from(new Set(histLogs.map((log) => log.timestamp.split('T')[0])))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  if (uniqueDates.length === 0) return 0;

  const todayStr = new Date().toISOString().split('T')[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const latestDate = uniqueDates[0];
  if (latestDate !== todayStr && latestDate !== yesterdayStr) return 0;

  let activeStreak = 1;
  let expectedDate = new Date(latestDate);

  for (let i = 1; i < uniqueDates.length; i++) {
    expectedDate.setDate(expectedDate.getDate() - 1);
    const expectedStr = expectedDate.toISOString().split('T')[0];
    if (uniqueDates[i] === expectedStr) activeStreak++;
    else break;
  }

  return activeStreak;
};


export const STORAGE_SCHEMA_VERSION = 1;

interface MigrationDefaults {
  defaultDhikrs: Dhikr[];
  defaultPreferences: UserPreferences;
  defaultReminders: DhikrReminder[];
}

interface HydratedStorage {
  dhikrs: Dhikr[];
  currentDhikrId: string;
  currentCount: number;
  history: DhikrHistory[];
  preferences: UserPreferences;
  reminders: DhikrReminder[];
}

const readSchemaVersion = (): number => {
  const versionRaw = localStorage.getItem('tasbih_schema_version');
  const version = Number(versionRaw);
  return Number.isInteger(version) && version >= 1 ? version : 0;
};

export const migrateAndHydrateStorage = (defaults: MigrationDefaults): HydratedStorage => {
  const schemaVersion = readSchemaVersion();

  const dhikrs = sanitizeDhikrs(safeParseJSON(localStorage.getItem('tasbih_dhikrs'), defaults.defaultDhikrs), defaults.defaultDhikrs);
  localStorage.setItem('tasbih_dhikrs', JSON.stringify(dhikrs));

  const currentDhikrIdRaw = localStorage.getItem('tasbih_current_id');
  const currentDhikrId = currentDhikrIdRaw && dhikrs.some((d) => d.id === currentDhikrIdRaw)
    ? currentDhikrIdRaw
    : dhikrs[0]?.id || defaults.defaultDhikrs[0]?.id || 'subhanallah';
  localStorage.setItem('tasbih_current_id', currentDhikrId);

  const count = Number(localStorage.getItem('tasbih_current_count'));
  const currentCount = Number.isFinite(count) && count >= 0 ? count : 0;
  localStorage.setItem('tasbih_current_count', String(currentCount));

  const history = sanitizeHistory(safeParseJSON(localStorage.getItem('tasbih_history'), []));
  localStorage.setItem('tasbih_history', JSON.stringify(history));

  const preferences = sanitizePreferences(safeParseJSON(localStorage.getItem('tasbih_preferences'), defaults.defaultPreferences), defaults.defaultPreferences);
  localStorage.setItem('tasbih_preferences', JSON.stringify(preferences));

  const reminders = sanitizeReminders(safeParseJSON(localStorage.getItem('tasbih_reminders'), defaults.defaultReminders), defaults.defaultReminders);
  localStorage.setItem('tasbih_reminders', JSON.stringify(reminders));

  if (schemaVersion < STORAGE_SCHEMA_VERSION) {
    localStorage.setItem('tasbih_schema_version', String(STORAGE_SCHEMA_VERSION));
  }

  return { dhikrs, currentDhikrId, currentCount, history, preferences, reminders };
};


const REMINDER_TRIGGER_KEY = 'tasbih_reminder_trigger_log';

interface ReminderRuntimeInfo {
  dayName: string;
  dateStr: string;
  timeStr: string;
}

export const getLocalDateString = (now: Date): string => {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const getDayKey = (now: Date): string => DAY_KEYS[now.getDay()];

const getReminderRuntimeInfo = (now: Date): ReminderRuntimeInfo => {
  const dayName = getDayKey(now);
  const dateStr = getLocalDateString(now);
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return { dayName, dateStr, timeStr };
};

export const buildReminderOccurrenceKey = (reminderId: string, scheduledTime: string, now: Date): string => {
  const { dayName, dateStr } = getReminderRuntimeInfo(now);
  return `${reminderId}|${scheduledTime}|${dayName}|${dateStr}`;
};

export const findDueReminders = (reminders: DhikrReminder[], now: Date): DhikrReminder[] => {
  const { dayName, timeStr } = getReminderRuntimeInfo(now);
  return reminders.filter((rem) => rem.isEnabled && rem.timeString === timeStr && rem.days.includes(dayName));
};

export const shouldTriggerReminderOccurrence = (reminderId: string, scheduledTime: string, now: Date): boolean => {
  const key = buildReminderOccurrenceKey(reminderId, scheduledTime, now);
  const raw = safeParseJSON(localStorage.getItem(REMINDER_TRIGGER_KEY), [] as string[]);
  const existing = Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [];
  if (existing.includes(key)) return false;

  const today = getLocalDateString(now);
  const retained = existing.filter((item) => item.endsWith(today));
  retained.push(key);
  localStorage.setItem(REMINDER_TRIGGER_KEY, JSON.stringify(retained));
  return true;
};


export interface ReminderPolicy {
  catchUpWindowMinutes: number;
}

export const DEFAULT_REMINDER_POLICY: ReminderPolicy = {
  // Policy: trigger reminders missed while app is backgrounded only within this recent window.
  catchUpWindowMinutes: 10,
};

export const shouldTriggerCatchUpReminder = (
  reminderTime: string,
  now: Date,
  policy: ReminderPolicy = DEFAULT_REMINDER_POLICY,
): boolean => {
  const [hh, mm] = reminderTime.split(':').map((v) => Number(v));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return false;

  const reminderAt = new Date(now);
  reminderAt.setHours(hh, mm, 0, 0);
  const deltaMs = now.getTime() - reminderAt.getTime();
  if (deltaMs < 0) return false;

  const deltaMinutes = Math.floor(deltaMs / 60000);
  return deltaMinutes <= policy.catchUpWindowMinutes;
};


export const findCatchUpReminderCandidates = (
  reminders: DhikrReminder[],
  now: Date,
  policy: ReminderPolicy = DEFAULT_REMINDER_POLICY,
): DhikrReminder[] => {
  const dayName = getDayKey(now);
  return reminders.filter((rem) => rem.isEnabled && rem.days.includes(dayName) && shouldTriggerCatchUpReminder(rem.timeString, now, policy));
};


export const minutesSinceReminderTime = (reminderTime: string, now: Date): number | null => {
  const [hh, mm] = reminderTime.split(':').map((v) => Number(v));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;

  const reminderAt = new Date(now);
  reminderAt.setHours(hh, mm, 0, 0);
  return Math.floor((now.getTime() - reminderAt.getTime()) / 60000);
};

export const findMissedReminderCandidates = (
  reminders: DhikrReminder[],
  now: Date,
  lastActiveAt: Date | null,
  policy: ReminderPolicy = DEFAULT_REMINDER_POLICY,
): DhikrReminder[] => {
  if (!lastActiveAt) return [];

  const dayName = getDayKey(now);
  const nowDate = getLocalDateString(now);
  const lastDate = getLocalDateString(lastActiveAt);

  // Deterministic policy: only catch up missed reminders from the same local day.
  if (nowDate !== lastDate) return [];

  const sleptMinutes = Math.floor((now.getTime() - lastActiveAt.getTime()) / 60000);
  if (sleptMinutes <= 0) return [];

  return reminders.filter((rem) => {
    if (!rem.isEnabled || !rem.days.includes(dayName)) return false;
    const mins = minutesSinceReminderTime(rem.timeString, now);
    if (mins === null) return false;
    return mins > 0 && mins <= policy.catchUpWindowMinutes && mins <= sleptMinutes;
  });
};

// ─── Motivational Messages ───────────────────────────────────────────────────

export const getMotivationalMessage = (streak: number): { arabic: string; english: string; note: string } => {
  const hour = new Date().getHours();

  if (hour >= 4 && hour < 9) {
    return {
      arabic: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً',
      english: 'Our Lord, give us good in this world',
      note: streak > 0
        ? `Masha'Allah! ${streak}-day streak 🌅 The early morning is the most blessed time for dhikr.`
        : 'Beautiful — you are remembering Allah in the blessed morning hours.',
    };
  }
  if (hour >= 9 && hour < 12) {
    return {
      arabic: 'سُبْحَانَ ٱللَّٰهِ وَبِحَمْدِهِ',
      english: 'Glory be to Allah and praise belongs to Him',
      note: streak > 0
        ? `${streak} days strong! Keep going — consistency is beloved to Allah.`
        : 'Every bead counts. Start your streak today!',
    };
  }
  if (hour >= 12 && hour < 15) {
    return {
      arabic: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ',
      english: 'O Allah, send blessings upon Muhammad ﷺ',
      note: streak > 0
        ? `${streak}-day streak! Send Salawat on the Prophet ﷺ between your tasks.`
        : 'The afternoon is a great time to build your dhikr habit.',
    };
  }
  if (hour >= 15 && hour < 18) {
    return {
      arabic: 'أَسْتَغْفِرُ ٱللَّٰهَ',
      english: 'I seek forgiveness from Allah',
      note: streak > 0
        ? `${streak} days of remembrance! Asr time — the witnessed hour.`
        : 'The Prophet ﷺ said seek forgiveness often. Begin your journey.',
    };
  }
  if (hour >= 18 && hour < 21) {
    return {
      arabic: 'أَعُوذُ بِكَلِمَاتِ ٱللَّٰهِ ٱلتَّامَّاتِ',
      english: 'I seek refuge in the perfect words of Allah',
      note: streak > 0
        ? `${streak}-day streak! Evening adhkaar protect you through the night.`
        : 'Evening is the perfect time to start your adhkaar routine.',
    };
  }
  return {
    arabic: 'حَسْبِيَ ٱللَّٰهُ لَا إِلَٰهَ إِلَّا هُوَ',
    english: 'Allah is sufficient for me, there is no god but Him',
    note: streak > 0
      ? `${streak} nights of devotion! The night remembrance is precious.`
      : 'The night is a time of peace — remember Allah before sleep.',
  };
};

// ─── Achievements ─────────────────────────────────────────────────────────────

export interface Achievement {
  id: string;
  title: string;
  desc: string;
  req: string;
  isUnlocked: boolean;
  colorClass: string;
}

export const computeAchievements = (
  history: { dhikrId: string; count: number; timestamp: string }[],
  streak: number,
  allTimeCount: number,
  dhikrs: { id: string; isSystem?: boolean }[],
): Achievement[] => {
  const totalForDhikr = (id: string) =>
    history.filter((h) => h.dhikrId === id).reduce((s, h) => s + h.count, 0);

  const hasRecitedInHours = (from: number, to: number) =>
    history.some((h) => {
      const hr = new Date(h.timestamp).getHours();
      return to > from ? hr >= from && hr < to : hr >= from || hr < to;
    });

  return [
    {
      id: 'sayyidul_master',
      title: 'Master of Forgiveness',
      req: 'Recite Sayyidul Istighfar at least once',
      desc: 'Recited the Master of Forgiveness — the key to Jannah in the morning.',
      isUnlocked: totalForDhikr('sayyidul-istighfar') >= 1,
      colorClass: 'bg-rose-500/20 border-rose-500/30 text-rose-300',
    },
    {
      id: 'ayatul_kursi',
      title: 'Throne Verse Guardian',
      req: 'Recite Ayatul Kursi 10+ times total',
      desc: 'Sought protection through the greatest verse in the Quran.',
      isUnlocked: totalForDhikr('ayatul-kursi') >= 10,
      colorClass: 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300',
    },
    {
      id: 'three_quls',
      title: '3 Quls Shield',
      req: 'Recite all 3 Quls (Ikhlas, Falaq, Naas)',
      desc: 'Surrounded yourself with the complete shield of the 3 Quls.',
      isUnlocked:
        totalForDhikr('surah-ikhlas') >= 1 &&
        totalForDhikr('surah-falaq') >= 1 &&
        totalForDhikr('surah-naas') >= 1,
      colorClass: 'bg-teal-500/20 border-teal-500/30 text-teal-300',
    },
    {
      id: 'darood_lover',
      title: 'Lover of the Prophet ﷺ',
      req: 'Send 100+ Salawat (Darood Ibrahim)',
      desc: 'Allah sends 10 blessings for every Salawat. 100 sent — 1000 received!',
      isUnlocked: totalForDhikr('darood-ibrahim') >= 100,
      colorClass: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300',
    },
    {
      id: 'streak_7',
      title: 'Week Warrior',
      req: 'Maintain a 7-day streak',
      desc: 'Seven consecutive days of remembrance. The angels record your devotion.',
      isUnlocked: streak >= 7,
      colorClass: 'bg-orange-500/20 border-orange-500/30 text-orange-300',
    },
    {
      id: 'streak_30',
      title: 'Blessed Month',
      req: 'Maintain a 30-day streak',
      desc: 'A full month of consistent dhikr. SubhanAllah — this is true steadfastness.',
      isUnlocked: streak >= 30,
      colorClass: 'bg-amber-500/20 border-amber-500/30 text-amber-300',
    },
    {
      id: 'morning_warrior',
      title: 'Morning Warrior',
      req: 'Recite dhikr between 4 AM and 9 AM',
      desc: 'Greeted the day with Allah\'s remembrance in the blessed Fajr hours.',
      isUnlocked: hasRecitedInHours(4, 9),
      colorClass: 'bg-amber-500/20 border-amber-500/30 text-amber-300',
    },
    {
      id: 'ten_thousand',
      title: 'Ten Thousand Beads',
      req: 'Reach 10,000 total beads all-time',
      desc: 'Ten thousand beads of remembrance! You have truly made dhikr a way of life.',
      isUnlocked: allTimeCount >= 10000,
      colorClass: 'bg-purple-500/20 border-purple-500/30 text-purple-300',
    },
  ];
};
