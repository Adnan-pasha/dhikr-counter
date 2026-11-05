import { deviceTimeZone, sanitizeLocation, type PrayerLocation } from './prayerTimes';
import { announcePrayerConfigChange } from './prayerConfigEvents';

export const PRAYER_LOCATION_KEY = 'tasbih_prayer_location';

/** How the place was chosen: from the phone's GPS (worth refreshing) or picked from the city list. */
export type LocationSource = 'gps' | 'city';

export type SavedPrayerLocation = PrayerLocation & { source: LocationSource };

export interface CityPreset extends PrayerLocation {
  name: string;
  /** Compass bearing from the city to the Kaaba, in whole degrees. */
  direction: number;
}

const KAABA = { lat: 21.4225, lng: 39.8262 };

/** Great-circle bearing from a place to the Kaaba, in whole degrees clockwise from true north. */
export const qiblaBearing = (lat: number, lng: number): number => {
  const rad = Math.PI / 180;
  const meccaLat = KAABA.lat * rad;
  const dLng = (KAABA.lng - lng) * rad;
  const uLat = lat * rad;
  const y = Math.sin(dLng);
  const x = Math.cos(uLat) * Math.tan(meccaLat) - Math.sin(uLat) * Math.cos(dLng);
  return Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360) % 360;
};

const RAW_CITIES: ReadonlyArray<{ name: string; lat: number; lng: number; timeZone: string }> = [
  { name: 'Mecca (Haram), Saudi Arabia', lat: 21.4225, lng: 39.8262, timeZone: 'Asia/Riyadh' },
  { name: 'Medina, Saudi Arabia', lat: 24.4672, lng: 39.6111, timeZone: 'Asia/Riyadh' },
  { name: 'Riyadh, Saudi Arabia', lat: 24.7136, lng: 46.6753, timeZone: 'Asia/Riyadh' },
  { name: 'Jeddah, Saudi Arabia', lat: 21.4858, lng: 39.1925, timeZone: 'Asia/Riyadh' },
  { name: 'Dubai, United Arab Emirates', lat: 25.2048, lng: 55.2708, timeZone: 'Asia/Dubai' },
  { name: 'Abu Dhabi, United Arab Emirates', lat: 24.4539, lng: 54.3773, timeZone: 'Asia/Dubai' },
  { name: 'Doha, Qatar', lat: 25.2854, lng: 51.531, timeZone: 'Asia/Qatar' },
  { name: 'Kuwait City, Kuwait', lat: 29.3759, lng: 47.9774, timeZone: 'Asia/Kuwait' },
  { name: 'Muscat, Oman', lat: 23.588, lng: 58.3829, timeZone: 'Asia/Muscat' },
  { name: 'Manama, Bahrain', lat: 26.2285, lng: 50.586, timeZone: 'Asia/Bahrain' },
  { name: 'Baghdad, Iraq', lat: 33.3152, lng: 44.3661, timeZone: 'Asia/Baghdad' },
  { name: 'Tehran, Iran', lat: 35.6892, lng: 51.389, timeZone: 'Asia/Tehran' },
  { name: 'Amman, Jordan', lat: 31.9522, lng: 35.9106, timeZone: 'Asia/Amman' },
  { name: 'Damascus, Syria', lat: 33.5138, lng: 36.2765, timeZone: 'Asia/Damascus' },
  { name: 'Beirut, Lebanon', lat: 33.8938, lng: 35.5018, timeZone: 'Asia/Beirut' },
  { name: 'Jerusalem, Palestine', lat: 31.7683, lng: 35.2137, timeZone: 'Asia/Gaza' },
  { name: 'Istanbul, Turkey', lat: 41.0082, lng: 28.9784, timeZone: 'Europe/Istanbul' },
  { name: 'Ankara, Turkey', lat: 39.9334, lng: 32.8597, timeZone: 'Europe/Istanbul' },
  { name: 'Cairo, Egypt', lat: 30.0444, lng: 31.2357, timeZone: 'Africa/Cairo' },
  { name: 'Casablanca, Morocco', lat: 33.5731, lng: -7.5898, timeZone: 'Africa/Casablanca' },
  { name: 'Algiers, Algeria', lat: 36.7538, lng: 3.0588, timeZone: 'Africa/Algiers' },
  { name: 'Tunis, Tunisia', lat: 36.8065, lng: 10.1815, timeZone: 'Africa/Tunis' },
  { name: 'Khartoum, Sudan', lat: 15.5007, lng: 32.5599, timeZone: 'Africa/Khartoum' },
  { name: 'Lagos, Nigeria', lat: 6.5244, lng: 3.3792, timeZone: 'Africa/Lagos' },
  { name: 'Nairobi, Kenya', lat: -1.2921, lng: 36.8219, timeZone: 'Africa/Nairobi' },
  { name: 'Dar es Salaam, Tanzania', lat: -6.7924, lng: 39.2083, timeZone: 'Africa/Dar_es_Salaam' },
  { name: 'Cape Town, South Africa', lat: -33.9249, lng: 18.4241, timeZone: 'Africa/Johannesburg' },
  { name: 'Karachi, Pakistan', lat: 24.8607, lng: 67.0011, timeZone: 'Asia/Karachi' },
  { name: 'Lahore, Pakistan', lat: 31.5204, lng: 74.3587, timeZone: 'Asia/Karachi' },
  { name: 'Islamabad, Pakistan', lat: 33.6844, lng: 73.0479, timeZone: 'Asia/Karachi' },
  { name: 'Kabul, Afghanistan', lat: 34.5553, lng: 69.2075, timeZone: 'Asia/Kabul' },
  { name: 'Mumbai, India', lat: 19.076, lng: 72.8777, timeZone: 'Asia/Kolkata' },
  { name: 'Delhi, India', lat: 28.6139, lng: 77.209, timeZone: 'Asia/Kolkata' },
  { name: 'Hyderabad, India', lat: 17.385, lng: 78.4867, timeZone: 'Asia/Kolkata' },
  { name: 'Bengaluru, India', lat: 12.9716, lng: 77.5946, timeZone: 'Asia/Kolkata' },
  { name: 'Chennai, India', lat: 13.0827, lng: 80.2707, timeZone: 'Asia/Kolkata' },
  { name: 'Kolkata, India', lat: 22.5726, lng: 88.3639, timeZone: 'Asia/Kolkata' },
  { name: 'Dhaka, Bangladesh', lat: 23.8103, lng: 90.4125, timeZone: 'Asia/Dhaka' },
  { name: 'Colombo, Sri Lanka', lat: 6.9271, lng: 79.8612, timeZone: 'Asia/Colombo' },
  { name: 'Jakarta, Indonesia', lat: -6.2088, lng: 106.8456, timeZone: 'Asia/Jakarta' },
  { name: 'Kuala Lumpur, Malaysia', lat: 3.139, lng: 101.6869, timeZone: 'Asia/Kuala_Lumpur' },
  { name: 'Singapore, Singapore', lat: 1.3521, lng: 103.8198, timeZone: 'Asia/Singapore' },
  { name: 'Bangkok, Thailand', lat: 13.7563, lng: 100.5018, timeZone: 'Asia/Bangkok' },
  { name: 'Manila, Philippines', lat: 14.5995, lng: 120.9842, timeZone: 'Asia/Manila' },
  { name: 'Tokyo, Japan', lat: 35.6762, lng: 139.6503, timeZone: 'Asia/Tokyo' },
  { name: 'Tashkent, Uzbekistan', lat: 41.2995, lng: 69.2401, timeZone: 'Asia/Tashkent' },
  { name: 'Samarkand, Uzbekistan', lat: 39.6542, lng: 66.9597, timeZone: 'Asia/Samarkand' },
  { name: 'London, United Kingdom', lat: 51.5074, lng: -0.1278, timeZone: 'Europe/London' },
  { name: 'Manchester, United Kingdom', lat: 53.4808, lng: -2.2426, timeZone: 'Europe/London' },
  { name: 'Birmingham, United Kingdom', lat: 52.4862, lng: -1.8904, timeZone: 'Europe/London' },
  { name: 'Paris, France', lat: 48.8566, lng: 2.3522, timeZone: 'Europe/Paris' },
  { name: 'Berlin, Germany', lat: 52.52, lng: 13.405, timeZone: 'Europe/Berlin' },
  { name: 'Amsterdam, Netherlands', lat: 52.3676, lng: 4.9041, timeZone: 'Europe/Amsterdam' },
  { name: 'Seville, Spain', lat: 37.3891, lng: -5.9845, timeZone: 'Europe/Madrid' },
  { name: 'Prague, Czech Republic', lat: 50.0755, lng: 14.4378, timeZone: 'Europe/Prague' },
  { name: 'Bucharest, Romania', lat: 44.4268, lng: 26.1025, timeZone: 'Europe/Bucharest' },
  { name: 'Sarajevo, Bosnia & Herzegovina', lat: 43.8563, lng: 18.4131, timeZone: 'Europe/Sarajevo' },
  { name: 'Moscow, Russia', lat: 55.7558, lng: 37.6173, timeZone: 'Europe/Moscow' },
  { name: 'Reykjavik, Iceland', lat: 64.1466, lng: -21.9426, timeZone: 'Atlantic/Reykjavik' },
  { name: 'New York, United States', lat: 40.7128, lng: -74.006, timeZone: 'America/New_York' },
  { name: 'Chicago, United States', lat: 41.8781, lng: -87.6298, timeZone: 'America/Chicago' },
  { name: 'Houston, United States', lat: 29.7604, lng: -95.3698, timeZone: 'America/Chicago' },
  { name: 'Los Angeles, United States', lat: 34.0522, lng: -118.2437, timeZone: 'America/Los_Angeles' },
  { name: 'Toronto, Canada', lat: 43.6532, lng: -79.3832, timeZone: 'America/Toronto' },
  { name: 'Sydney, Australia', lat: -33.8688, lng: 151.2093, timeZone: 'Australia/Sydney' },
  { name: 'Melbourne, Australia', lat: -37.8136, lng: 144.9631, timeZone: 'Australia/Melbourne' },
  { name: 'Auckland, New Zealand', lat: -36.8485, lng: 174.7633, timeZone: 'Pacific/Auckland' },
];

/** Major cities with their Qibla bearing, so a place can be chosen with no network and no GPS. */
export const CITY_PRESETS: ReadonlyArray<CityPreset> = RAW_CITIES.map((city) => ({
  ...city,
  label: city.name,
  direction: qiblaBearing(city.lat, city.lng),
}));

/** The place the user chose, or null when none has been chosen yet. Never guesses a default. */
export const readPrayerLocation = (): SavedPrayerLocation | null => {
  try {
    const raw = localStorage.getItem(PRAYER_LOCATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { source?: unknown };
    const location = sanitizeLocation(parsed);
    if (!location) return null;
    return { ...location, source: parsed.source === 'gps' ? 'gps' : 'city' };
  } catch {
    return null;
  }
};

/** Saves a place. Returns what was stored, or null when the place is unusable or storage is blocked. */
export const writePrayerLocation = (value: unknown, source: LocationSource): SavedPrayerLocation | null => {
  const location = sanitizeLocation(value);
  if (!location) return null;
  const saved: SavedPrayerLocation = { ...location, source };
  try {
    localStorage.setItem(PRAYER_LOCATION_KEY, JSON.stringify(saved));
    announcePrayerConfigChange();
    return saved;
  } catch {
    return null;
  }
};

/** A saved GPS place is where the phone was; the zone it is in now is the phone's zone. */
export const withCurrentZone = (saved: SavedPrayerLocation | null): SavedPrayerLocation | null =>
  saved && saved.source === 'gps' ? { ...saved, timeZone: deviceTimeZone() } : saved;

/** The place to work prayer times out for, in the zone it is in now. Null until one has been chosen. */
export const readPrayerPlace = (): SavedPrayerLocation | null => withCurrentZone(readPrayerLocation());

export const clearPrayerLocation = (): void => {
  try {
    localStorage.removeItem(PRAYER_LOCATION_KEY);
    announcePrayerConfigChange();
  } catch {
    // storage blocked: nothing was kept anyway
  }
};
