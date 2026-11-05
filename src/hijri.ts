import { HIJRI_MONTHS } from './types';
import { deviceTimeZone } from './prayerTimes';

export interface HijriParts {
  day: number;
  month: number;
  year: number;
}

const read = (instant: Date, timeZone: string): HijriParts | null => {
  const format = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone });
  // A phone without the calendar quietly formats in the Gregorian one.
  if (!format.resolvedOptions().calendar.startsWith('islamic')) return null;
  const parts = format.formatToParts(instant);
  const number = (type: string): number => Number(parts.find((part) => part.type === type)?.value);
  const found = { day: number('day'), month: number('month'), year: number('year') };
  const sane = found.day >= 1 && found.day <= 30 && found.month >= 1 && found.month <= 12 && found.year >= 1300 && found.year <= 1700;
  return sane ? found : null;
};

/**
 * The Islamic date (Umm al-Qura) at an instant on a place's clock, as numbers, or null when the phone cannot say.
 * Only the numbers are taken from the phone: some phones know the Islamic calendar's numbers but not its month or era
 * names, and print things like "May 25, 1448 BC".
 */
export const hijriParts = (instant: Date, timeZone: string): HijriParts | null => {
  if (Number.isNaN(instant.getTime())) return null;
  try {
    return read(instant, timeZone);
  } catch {
    try {
      return read(instant, deviceTimeZone());
    } catch {
      return null;
    }
  }
};

/** "25 Jumada al-Awwal 1448 AH", with the month named by this app, or an empty string when the date cannot be worked out. */
export const hijriLabel = (instant: Date, timeZone: string): string => {
  const parts = hijriParts(instant, timeZone);
  return parts ? `${parts.day} ${HIJRI_MONTHS[parts.month - 1]} ${parts.year} AH` : '';
};
