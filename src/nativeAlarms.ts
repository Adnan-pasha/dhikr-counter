import type { DhikrReminder, PrayerAzanId } from './types';
import { SALAH_META } from './types';
import { FARD_EVENTS, addDaysToKey, computePrayerDay, todayKeyIn, type PrayerCalcOptions, type PrayerLocation } from './prayerTimes';

/** How far ahead alarms are scheduled. They are topped up whenever the app opens, so this is the longest it can go unopened. */
export const HORIZON_DAYS = 10;
/** The most alarms handed to Android at once. Phones limit how many one app may hold. */
export const MAX_ALARMS = 300;

/** Android fixes a channel's sound when it is created, so a new sound needs a new id: bump the suffix. */
/** Reserved for the "send me a test" notification: the planner never hands this id to a real alarm. */
export const TEST_ALARM_ID = 2_147_483_000;

export const ADHAN_CHANNEL = 'adhan-hayya-v1';
export const REMINDER_CHANNEL = 'reminders-v1';

export type AlarmExtra =
  | { kind: 'adhan'; prayer: PrayerAzanId; dateKey: string }
  | { kind: 'reminder'; dhikrId: string; reminderId: string }
  | { kind: 'refresh' };

export interface PlannedAlarm {
  /** A whole number Android accepts, the same for the same alarm on every run. */
  id: number;
  kind: 'adhan' | 'reminder' | 'refresh';
  at: Date;
  title: string;
  body: string;
  channelId: string;
  /** What a tap on the notification should do. */
  extra: AlarmExtra;
}

export interface AlarmPlanInput {
  /** Where prayer times are for. Null until chosen: then no adhan is scheduled (a place is never guessed). */
  place: PrayerLocation | null;
  options: PrayerCalcOptions;
  adhanEnabled: Readonly<Record<PrayerAzanId, boolean>>;
  reminders: readonly DhikrReminder[];
  now: Date;
  /** Defaults to HORIZON_DAYS. */
  days?: number;
  /** Defaults to MAX_ALARMS. */
  cap?: number;
}

const DAY_MS = 86_400_000;
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const DEFAULT_REMINDER_TITLE = 'Time for dhikr';
const TIME_OF_DAY = /^([01]?\d|2[0-3]):([0-5]\d)$/;

type Candidate = Omit<PlannedAlarm, 'id'> & { key: string };

const adhanCandidates = (input: AlarmPlanInput, from: number, until: number): Candidate[] => {
  const { place, options, adhanEnabled, now } = input;
  if (!place) return [];
  const today = todayKeyIn(place.timeZone, now);
  const days = input.days ?? HORIZON_DAYS;
  const found: Candidate[] = [];
  // One day either side of the window: a night prayer after midnight belongs to the date before it.
  for (let offset = -1; offset <= days + 1; offset += 1) {
    const dateKey = addDaysToKey(today, offset);
    const day = computePrayerDay(place, dateKey, options);
    for (const prayer of FARD_EVENTS) {
      if (!adhanEnabled[prayer]) continue;
      const at = day[prayer];
      if (!(at.getTime() > from && at.getTime() <= until)) continue;
      const label = SALAH_META[prayer].label;
      found.push({
        key: `adhan|${dateKey}|${prayer}`,
        kind: 'adhan',
        at,
        title: label,
        body: `It is time for ${label} prayer.`,
        channelId: ADHAN_CHANNEL,
        extra: { kind: 'adhan', prayer, dateKey },
      });
    }
  }
  return found;
};

const reminderCandidates = (input: AlarmPlanInput, from: number, until: number): Candidate[] => {
  const found: Candidate[] = [];
  const days = input.days ?? HORIZON_DAYS;
  for (const reminder of input.reminders) {
    if (!reminder.isEnabled || reminder.days.length === 0) continue;
    const time = TIME_OF_DAY.exec(reminder.timeString.trim());
    if (!time) continue;
    const [hours, minutes] = [Number(time[1]), Number(time[2])];
    const weekdays = new Set(reminder.days);
    for (let offset = 0; offset <= days + 1; offset += 1) {
      // Reminders are set in the phone's own clock, so the phone's calendar day is the right one.
      const at = new Date(input.now.getFullYear(), input.now.getMonth(), input.now.getDate() + offset, hours, minutes, 0, 0);
      if (!weekdays.has(WEEKDAYS[at.getDay()])) continue;
      if (!(at.getTime() > from && at.getTime() <= until)) continue;
      found.push({
        key: `reminder|${reminder.id}|${at.getFullYear()}-${at.getMonth() + 1}-${at.getDate()}`,
        kind: 'reminder',
        at,
        title: reminder.label.trim() || DEFAULT_REMINDER_TITLE,
        body: `${reminder.dhikrName}. Tap to begin.`,
        channelId: REMINDER_CHANNEL,
        extra: { kind: 'reminder', dhikrId: reminder.dhikrId, reminderId: reminder.id },
      });
    }
  }
  return found;
};

/** One gentle nudge on the last full day, because alarms are only set ten days ahead: opening the app tops them up. */
const nudgeCandidates = (input: AlarmPlanInput, from: number, until: number): Candidate[] => {
  const days = input.days ?? HORIZON_DAYS;
  const at = new Date(input.now.getFullYear(), input.now.getMonth(), input.now.getDate() + days - 1, 9, 0, 0, 0);
  if (!(at.getTime() > from && at.getTime() <= until)) return [];
  return [{
    key: `refresh|${at.getFullYear()}-${at.getMonth() + 1}-${at.getDate()}`,
    kind: 'refresh',
    at,
    title: 'Keep your prayer alerts going',
    body: `Open Muneeb so your alerts are set for the next ${days} days.`,
    channelId: REMINDER_CHANNEL,
    extra: { kind: 'refresh' },
  }];
};

const byTime = (a: Candidate, b: Candidate): number => a.at.getTime() - b.at.getTime() || a.key.localeCompare(b.key);

/** A stable 31-bit number for a key (FNV-1a), never 0. */
const hashId = (key: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) & 0x7fffffff) || 1;
};

/**
 * Every notification to schedule from now until the horizon: each enabled prayer at its time for the place,
 * and each enabled reminder on its weekdays at its local time. In time order, soonest kept if there are too many.
 * Pure: the same input gives the same plan, so it can be compared and tested without a phone.
 */
export const planAlarms = (input: AlarmPlanInput): PlannedAlarm[] => {
  const from = input.now.getTime();
  const until = from + (input.days ?? HORIZON_DAYS) * DAY_MS;
  const cap = input.cap ?? MAX_ALARMS;
  // The prayers come first: a long list of reminders may use up the rest, but never the prayers' places.
  const adhan = adhanCandidates(input, from, until).sort(byTime).slice(0, cap);
  const nudge = nudgeCandidates(input, from, until).slice(0, Math.max(0, cap - adhan.length));
  const room = Math.max(0, cap - adhan.length - nudge.length);
  const reminders = reminderCandidates(input, from, until).sort(byTime).slice(0, room);
  const ordered = [...adhan, ...nudge, ...reminders].sort(byTime);

  const used = new Set<number>([TEST_ALARM_ID]);
  return ordered.map(({ key, ...alarm }) => {
    let id = hashId(key);
    while (used.has(id)) id = (id % 0x7fffffff) + 1;
    used.add(id);
    return { id, ...alarm };
  });
};

/** The soonest real alert still ahead of `now` (not the "keep your alerts going" nudge), or null. */
export const nextAlarmAfter = (alarms: readonly PlannedAlarm[], now: Date): PlannedAlarm | null =>
  alarms.find((alarm) => alarm.kind !== 'refresh' && alarm.at.getTime() > now.getTime()) ?? null;

/** A request for the Prayers screen to play one prayer's adhan, as when its notification was tapped. A new nonce is a new request. */
export interface AdhanPlayRequest {
  prayer: PrayerAzanId;
  nonce: number;
}

export type TapRoute =
  | { action: 'open-dhikr'; dhikrId: string }
  | { action: 'play-adhan'; prayer: PrayerAzanId }
  | { action: 'open-prayers' };

const MAX_DHIKR_ID_LENGTH = 80;
const isPrayer = (value: unknown): value is PrayerAzanId => FARD_EVENTS.includes(value as PrayerAzanId);

/**
 * What a tap on a notification should do. What the notification carried comes from outside the app, so anything
 * that is not exactly one of our own shapes is ignored.
 */
export const routeNotificationTap = (extra: unknown): TapRoute | null => {
  if (typeof extra !== 'object' || extra === null) return null;
  const { kind, dhikrId, prayer } = extra as Record<string, unknown>;
  if (kind === 'reminder' && typeof dhikrId === 'string' && dhikrId.length > 0 && dhikrId.length <= MAX_DHIKR_ID_LENGTH) {
    return { action: 'open-dhikr', dhikrId };
  }
  if (kind === 'adhan' && isPrayer(prayer)) return { action: 'play-adhan', prayer };
  if (kind === 'test' || kind === 'refresh') return { action: 'open-prayers' };
  return null;
};
