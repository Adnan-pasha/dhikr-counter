/** The standard Bismillah, shown as a header above surahs that open with it. */
export const BASMALA = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';

const MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
const ALEF_FORMS = /[آأإٱ]/g;
const BASMALA_WORDS = 4;
const BASMALA_NORMALIZED = 'بسم الله الرحمن الرحيم';

/** Strips marks and unifies alef shapes, so Uthmani and Simple spellings of a word compare equal. */
export const normalizeArabic = (text: string): string =>
  text.replace(MARKS, '').replace(ALEF_FORMS, 'ا');

export const stripBom = (text: string): string => text.replace(/^﻿/, '');

/** Al-Fatiha has the Bismillah as its first ayah; At-Tawbah has none. Every other surah opens with a header. */
export const hasBasmalaHeader = (surahNumber: number): boolean => surahNumber !== 1 && surahNumber !== 9;

/**
 * The text service prepends the Bismillah to ayah 1 of most surahs. It is shown once, as the header,
 * so it is lifted off the ayah here. Only an exact four-word Bismillah is removed, and only when other
 * text follows it, so no Quran text is ever altered or lost.
 */
export const stripLeadingBasmala = (surahNumber: number, text: string): string => {
  if (!hasBasmalaHeader(surahNumber)) return text;
  const words = text.trim().split(/\s+/);
  if (words.length <= BASMALA_WORDS) return text;
  const opening = normalizeArabic(words.slice(0, BASMALA_WORDS).join(' '));
  return opening === BASMALA_NORMALIZED ? words.slice(BASMALA_WORDS).join(' ') : text;
};

const ARABIC_INDIC_ZERO = 0x0660;

/** 112 becomes ١١٢, the digits printed in Quran editions. */
export const toArabicDigits = (n: number): string =>
  String(Math.max(0, Math.trunc(n))).replace(/\d/g, (d) => String.fromCharCode(ARABIC_INDIC_ZERO + Number(d)));
