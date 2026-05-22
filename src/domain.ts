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
  const cleaned = value.filter((d): d is Dhikr => {
    return isObject(d)
      && isString(d.id)
      && isString(d.nameAr)
      && isString(d.nameEn)
      && isString(d.meaning)
      && isNumber(d.targetCount)
      && (d.isSystem === undefined || isBool(d.isSystem));
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
