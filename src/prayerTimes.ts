import { Coordinates, CalculationMethod, PrayerTimes, Madhab as AdhanMadhab, HighLatitudeRule } from 'adhan';
import type { Madhab, PrayerCalculationMethod } from './types';

/** Everything that happens on the prayer clock, in the order it happens. Sunrise has no prayer of its own. */
export const PRAYER_EVENTS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type PrayerEvent = typeof PRAYER_EVENTS[number];

export const FARD_EVENTS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;

export const CALCULATION_METHODS: ReadonlyArray<{ id: PrayerCalculationMethod; label: string }> = [
  { id: 'Karachi', label: 'University of Islamic Sciences, Karachi' },
  { id: 'MWL', label: 'Muslim World League' },
  { id: 'UmmAlQura', label: 'Umm al-Qura, Makkah' },
  { id: 'ISNA', label: 'Islamic Society of North America' },
  { id: 'Egypt', label: 'Egyptian General Authority of Survey' },
  { id: 'Dubai', label: 'Dubai' },
  { id: 'MoonsightingCommittee', label: 'Moonsighting Committee' },
  { id: 'Kuwait', label: 'Kuwait' },
  { id: 'Qatar', label: 'Qatar' },
  { id: 'Singapore', label: 'Singapore' },
  { id: 'Tehran', label: 'Institute of Geophysics, Tehran' },
  { id: 'Turkey', label: 'Diyanet, Turkey' },
];
export type CalculationMethodId = PrayerCalculationMethod;

export const HIGH_LATITUDE_RULES = ['auto', 'middleOfTheNight', 'seventhOfTheNight', 'twilightAngle'] as const;
export type HighLatitude = typeof HIGH_LATITUDE_RULES[number];

/** Most a user can nudge a time by hand, either way. */
export const MAX_OFFSET_MINUTES = 30;

export interface PrayerLocation {
  lat: number;
  lng: number;
  /** IANA zone of the place, so its calendar day is right whatever zone the phone is in. */
  timeZone: string;
  label?: string;
}

export interface PrayerCalcOptions {
  method: CalculationMethodId;
  madhab: Madhab;
  highLatitude?: HighLatitude;
  offsets?: Partial<Record<PrayerEvent, number>>;
}

export type PrayerDay = Readonly<Record<PrayerEvent, Date>> & { readonly dateKey: string };

export interface PrayerMoment {
  event: PrayerEvent;
  time: Date;
  dateKey: string;
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export const deviceTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

const isValidZone = (zone: unknown): zone is string => {
  if (typeof zone !== 'string' || zone.length === 0) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
};

/** The calendar date ("2026-03-10") it is in a zone at an instant. A bad zone falls back to the phone's. */
export const todayKeyIn = (timeZone: string, now: Date = new Date()): string => {
  const zone = isValidZone(timeZone) ? timeZone : deviceTimeZone();
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};

export const addDaysToKey = (dateKey: string, days: number): string => {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

const methodParams = (id: CalculationMethodId) => {
  switch (id) {
    case 'MWL': return CalculationMethod.MuslimWorldLeague();
    case 'UmmAlQura': return CalculationMethod.UmmAlQura();
    case 'ISNA': return CalculationMethod.NorthAmerica();
    case 'Egypt': return CalculationMethod.Egyptian();
    case 'Dubai': return CalculationMethod.Dubai();
    case 'MoonsightingCommittee': return CalculationMethod.MoonsightingCommittee();
    case 'Kuwait': return CalculationMethod.Kuwait();
    case 'Qatar': return CalculationMethod.Qatar();
    case 'Singapore': return CalculationMethod.Singapore();
    case 'Tehran': return CalculationMethod.Tehran();
    case 'Turkey': return CalculationMethod.Turkey();
    case 'Karachi':
    default: return CalculationMethod.Karachi();
  }
};

/** "auto" is the twilight-angle rule: it keeps the true Fajr and Isha wherever they exist and only scales them when the sky never gets dark enough. */
const highLatitudeRule = (rule: HighLatitude | undefined) => {
  switch (rule) {
    case 'middleOfTheNight': return HighLatitudeRule.MiddleOfTheNight;
    case 'seventhOfTheNight': return HighLatitudeRule.SeventhOfTheNight;
    default: return HighLatitudeRule.TwilightAngle;
  }
};

const RAMADAN_ISHA_INTERVAL_MINUTES = 120;

/**
 * Whether a date falls in Ramadan on the Umm al-Qura calendar. False when the phone cannot tell:
 * a phone without that calendar quietly formats in the Gregorian one, where month 9 is September,
 * so the calendar actually used is checked before the month is trusted.
 */
const isRamadan = (dateKey: string): boolean => {
  try {
    const [y, m, d] = dateKey.split('-').map(Number);
    const format = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { month: 'numeric', timeZone: 'UTC' });
    if (!format.resolvedOptions().calendar.startsWith('islamic-umalqura')) return false;
    const month = format.formatToParts(new Date(Date.UTC(y, m - 1, d, 12))).find((p) => p.type === 'month')?.value;
    return month === '9';
  } catch {
    return false;
  }
};

const clampOffset = (minutes: number | undefined): number => {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes)) return 0;
  return Math.max(-MAX_OFFSET_MINUTES, Math.min(MAX_OFFSET_MINUTES, Math.round(minutes)));
};

/** Beyond this latitude the sun can fail to set or twilight can last all night, and the library gives no time. */
const POLAR_FALLBACK_LATITUDE = 48.5;

const buildDay = (lat: number, lng: number, dateKey: string, options: PrayerCalcOptions): PrayerDay => {
  const coordinates = new Coordinates(lat, lng);
  const params = methodParams(options.method);
  params.madhab = options.madhab === 'hanafi' ? AdhanMadhab.Hanafi : AdhanMadhab.Shafi;
  params.highLatitudeRule = highLatitudeRule(options.highLatitude);
  if (options.method === 'UmmAlQura' && isRamadan(dateKey)) params.ishaInterval = RAMADAN_ISHA_INTERVAL_MINUTES;
  for (const event of PRAYER_EVENTS) {
    params.adjustments = { ...params.adjustments, [event]: (params.adjustments[event] ?? 0) + clampOffset(options.offsets?.[event]) };
  }
  // Noon keeps the library on the right calendar day even where the phone's zone is a day away from the place's.
  const [y, m, d] = dateKey.split('-').map(Number);
  const times = new PrayerTimes(coordinates, new Date(y, m - 1, d, 12), params);
  return {
    dateKey,
    fajr: times.fajr,
    sunrise: times.sunrise,
    dhuhr: times.dhuhr,
    asr: times.asr,
    maghrib: times.maghrib,
    isha: times.isha,
  };
};

const isComplete = (day: PrayerDay): boolean => PRAYER_EVENTS.every((e) => !Number.isNaN(day[e].getTime()));

/**
 * The six times for one calendar day at a place. Pure: the same inputs always give the same instants.
 * Where the sun does not rise or set (polar summer and winter), it uses the times of the nearest latitude
 * that does, the usual fallback for prayer apps.
 */
export const computePrayerDay = (location: PrayerLocation, dateKey: string, options: PrayerCalcOptions): PrayerDay => {
  if (!DATE_KEY.test(dateKey)) throw new RangeError(`Bad date key: ${dateKey}`);
  const day = buildDay(location.lat, location.lng, dateKey, options);
  if (isComplete(day) || Math.abs(location.lat) <= POLAR_FALLBACK_LATITUDE) return day;
  const clamped = Math.sign(location.lat) * POLAR_FALLBACK_LATITUDE;
  return buildDay(clamped, location.lng, dateKey, options);
};

/**
 * Every event of yesterday, today and tomorrow in time order. A prayer belongs to the day it is counted for,
 * not the calendar day it lands on: at high latitudes Isha can fall after midnight, so "now" has to be
 * looked up in a span that crosses day boundaries rather than inside one date.
 */
export const eventWindow = (location: PrayerLocation, options: PrayerCalcOptions, dateKey: string): PrayerMoment[] => {
  const moments: PrayerMoment[] = [];
  for (const offset of [-1, 0, 1]) {
    const day = computePrayerDay(location, addDaysToKey(dateKey, offset), options);
    for (const event of PRAYER_EVENTS) moments.push({ event, time: day[event], dateKey: day.dateKey });
  }
  return moments.sort((a, b) => a.time.getTime() - b.time.getTime());
};

const keep = (moments: readonly PrayerMoment[], fardOnly: boolean): PrayerMoment[] =>
  fardOnly ? moments.filter((m) => m.event !== 'sunrise') : [...moments];

/** The first event after `now` in a window from eventWindow. */
export const pickNext = (moments: readonly PrayerMoment[], now: Date, fardOnly = false): PrayerMoment =>
  keep(moments, fardOnly).find((m) => m.time.getTime() > now.getTime()) ?? moments[moments.length - 1];

/** The latest event that has started by `now` in a window from eventWindow. */
export const pickCurrent = (moments: readonly PrayerMoment[], now: Date, fardOnly = false): PrayerMoment => {
  const started = keep(moments, fardOnly).filter((m) => m.time.getTime() <= now.getTime());
  return started.length > 0 ? started[started.length - 1] : moments[0];
};

/** The first event still to come, rolling over to tomorrow's Fajr after Isha. */
export const nextEvent = (
  location: PrayerLocation,
  options: PrayerCalcOptions,
  now: Date = new Date(),
  { fardOnly = false }: { fardOnly?: boolean } = {},
): PrayerMoment => pickNext(eventWindow(location, options, todayKeyIn(location.timeZone, now)), now, fardOnly);

/** The latest event already started: last night's Isha counts until today's Fajr. */
export const currentEvent = (
  location: PrayerLocation,
  options: PrayerCalcOptions,
  now: Date = new Date(),
  { fardOnly = false }: { fardOnly?: boolean } = {},
): PrayerMoment => pickCurrent(eventWindow(location, options, todayKeyIn(location.timeZone, now)), now, fardOnly);

/** A clock time in the place's zone ("03:30 PM" or "15:30"). */
export const formatClock = (date: Date, timeZone: string, hour12 = true): string => {
  const zone = isValidZone(timeZone) ? timeZone : deviceTimeZone();
  return new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hourCycle: hour12 ? 'h12' : 'h23', timeZone: zone }).format(date);
};

/** "1h 20m", "12m" or "45s". Never negative. */
export const formatCountdown = (milliseconds: number): string => {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${total}s`;
};

/** A stored place, or null when it is not a usable one. A bad zone name falls back to the phone's zone. */
export const sanitizeLocation = (value: unknown): PrayerLocation | null => {
  if (typeof value !== 'object' || value === null) return null;
  const { lat, lng, timeZone, label } = value as Record<string, unknown>;
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  const location: PrayerLocation = { lat, lng, timeZone: isValidZone(timeZone) ? timeZone : deviceTimeZone() };
  return typeof label === 'string' && label.trim() ? { ...location, label: label.trim().slice(0, 80) } : location;
};
