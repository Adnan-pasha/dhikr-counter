import type { AzanSound, PrayerAzanId } from './types';

export interface AzanSource {
  id: string;
  label: string;
  /** Path relative to the app base (a file in public/), so it works offline and under any base URL. */
  path: string;
  /** Absolute URL for the current deployment. */
  url: string;
}

const baseUrl = (): string => {
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL;
  return base ?? '/';
};

const makeSource = (id: string, label: string, path: string): AzanSource => ({
  id,
  label,
  path,
  get url() {
    return `${baseUrl()}${path}`;
  },
});

/** Fajr has its own adhan (it includes the line about prayer being better than sleep). It is not a choice. */
export const FAJR_AZAN: AzanSource = makeSource('fajr', 'Fajr adhan', 'audio/azan-fajr.m4a');

/** The voice for Dhuhr, Asr, Maghrib and Isha. Every adhan is bundled and precached; nothing is streamed from third parties. */
export const AZAN_SOURCES: Record<AzanSound, AzanSource> = {
  makkah: makeSource('makkah', 'Makkah', 'audio/azan-makkah.m4a'),
  madinah: makeSource('madinah', 'Madinah', 'audio/azan-madinah.m4a'),
};

export const DEFAULT_AZAN_SOUND: AzanSound = 'makkah';

/** Ids stored by earlier versions, mapped to the voice they stood for. */
const LEGACY_IDS: Record<string, AzanSound> = {
  standard: 'makkah',
  mecca: 'makkah',
  makkah: 'makkah',
  medina: 'madinah',
  madinah: 'madinah',
};

/** The voice a stored value stands for, including old ids, or null when it is not one we know. */
export const knownAzanSound = (id: unknown): AzanSound | null => (typeof id === 'string' && LEGACY_IDS[id]) || null;

/** The voice for any value. Unknown values give the default. */
export const normalizeAzanSound = (id?: string): AzanSound => knownAzanSound(id) ?? DEFAULT_AZAN_SOUND;

export const getAzanSource = (id?: string): AzanSource => AZAN_SOURCES[normalizeAzanSound(id)];

/** The recording for a prayer: Fajr's own, or the chosen voice for the other four. With no prayer, the chosen voice (a preview). */
export const azanSourceFor = (prayer: PrayerAzanId | undefined, voice?: string): AzanSource =>
  prayer === 'fajr' ? FAJR_AZAN : getAzanSource(voice);
