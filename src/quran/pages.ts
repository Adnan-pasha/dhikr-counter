/**
 * The mushaf page view: the Quran as 604 pages, read one page at a time. Each page comes from the text
 * service one edition at a time (the Arabic, the tajweed colours, the translation), and is built here into
 * the ayahs to show. The Arabic is never altered: a bundled script (IndoPak) is read from the app's own
 * file, and tajweed only colours the Uthmani text.
 */

import { colourText, type TajweedSegment } from './tajweed';
import { stripBom, stripLeadingBasmala, hasBasmalaHeader } from './text';
import { scriptOption, type ScriptId } from './editions';
import type { IndopakData } from './indopak';

export const TOTAL_PAGES = 604;

/** The page each juz begins on, in the Madani mushaf. */
export const JUZ_FIRST_PAGE: readonly number[] = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282,
  302, 322, 342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582,
];

export const clampPage = (n: number): number => {
  if (!Number.isFinite(n)) return 1;
  return Math.min(TOTAL_PAGES, Math.max(1, Math.trunc(n)));
};

export const pageForJuz = (juz: number): number => JUZ_FIRST_PAGE[Math.min(30, Math.max(1, Math.trunc(juz))) - 1];

const EDITION_ID = /^[a-z0-9._-]{2,60}$/i;

/** The text service takes one edition per page request. */
export const pageUrl = (base: string, page: number, edition: string): string => {
  if (!Number.isInteger(page) || page < 1 || page > TOTAL_PAGES) throw new Error(`Page ${page} does not exist`);
  if (!EDITION_ID.test(edition)) throw new Error('Not a valid edition');
  return `${base}/page/${page}/${edition}`;
};

export interface PageSurahStart {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  /** True when the surah opens with the Bismillah header (every surah except Al-Fatiha and At-Tawbah). */
  hasBasmala: boolean;
}

export interface PageAyah {
  /** Global ayah number: unique across the Quran, so it keys everything on a page that crosses surahs. */
  number: number;
  surah: number;
  surahName: string;
  numberInSurah: number;
  juz: number;
  arabic: string;
  /** Tajweed colours, for the Tajweed script only. */
  segments: TajweedSegment[] | null;
  translation: string | null;
}

export interface MushafPage {
  page: number;
  juz: number;
  ayahs: PageAyah[];
  /** Surahs whose first ayah is on this page, in order. */
  surahStarts: PageSurahStart[];
  /** First and last global ayah number on the page, for reading progress. */
  range: { from: number; to: number };
  /** True when the translation or tajweed colours were asked for but did not arrive, so the page is fetched again next visit. */
  partial?: boolean;
}

interface RawPageAyah {
  number: number;
  text: string;
  numberInSurah: number;
  juz: number;
  surah: { number: number; name: string; englishName: string; englishNameTranslation: string };
}

const isText = (v: unknown): v is string => typeof v === 'string';
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

/** The ayahs of one edition's response, or null unless every one has what a page needs. */
const readAyahs = (body: unknown): RawPageAyah[] | null => {
  if (typeof body !== 'object' || body === null) return null;
  const response = body as { code?: number; data?: { ayahs?: unknown } };
  if (response.code !== 200 || !response.data || !Array.isArray(response.data.ayahs) || response.data.ayahs.length === 0) return null;
  const out: RawPageAyah[] = [];
  for (const raw of response.data.ayahs as unknown[]) {
    const a = raw as Partial<RawPageAyah> | null;
    const s = a?.surah as Partial<RawPageAyah['surah']> | undefined;
    if (!a || !s || !isInt(a.number) || !isInt(a.numberInSurah) || !isText(a.text) || !isInt(s.number)) return null;
    out.push({
      number: a.number,
      text: a.text,
      numberInSurah: a.numberInSurah,
      juz: isInt(a.juz) ? a.juz : 0,
      surah: {
        number: s.number,
        name: isText(s.name) ? s.name : '',
        englishName: isText(s.englishName) ? s.englishName : `Surah ${s.number}`,
        englishNameTranslation: isText(s.englishNameTranslation) ? s.englishNameTranslation : '',
      },
    });
  }
  return out;
};

export interface BuildOptions {
  script: ScriptId;
  /** The tajweed edition's response, for the Tajweed script. */
  overlayBody?: unknown;
  translationBody?: unknown;
  /** The bundled IndoPak text, for the IndoPak script. */
  indopak?: IndopakData | null;
}

/**
 * Builds one page from the responses. Returns null when the Arabic is missing or damaged, so the screen can
 * offer a retry, and never falls back to another script's text.
 */
export const buildMushafPage = (page: number, arabicBody: unknown, options: BuildOptions): MushafPage | null => {
  const arabic = readAyahs(arabicBody);
  if (!arabic) return null;
  const script = scriptOption(options.script);

  const overlay = script.overlay ? readAyahs(options.overlayBody) : null;
  const overlayText = new Map((overlay ?? []).map((a) => [a.number, a.text]));
  const translations = new Map((readAyahs(options.translationBody) ?? []).map((a) => [a.number, a.text]));

  const ayahs: PageAyah[] = [];
  for (const raw of arabic) {
    let text: string;
    if (script.bundled) {
      const bundled = options.indopak?.surahs[raw.surah.number - 1]?.[raw.numberInSurah - 1];
      if (!bundled) return null;
      text = bundled;
    } else {
      const cleaned = stripBom(raw.text);
      text = raw.numberInSurah === 1 ? stripLeadingBasmala(raw.surah.number, cleaned) : cleaned;
    }
    const marked = overlayText.get(raw.number);
    ayahs.push({
      number: raw.number,
      surah: raw.surah.number,
      surahName: raw.surah.englishName,
      numberInSurah: raw.numberInSurah,
      juz: raw.juz,
      arabic: text,
      segments: marked ? colourText(marked, text) : null,
      translation: translations.get(raw.number) ?? null,
    });
  }

  const surahStarts: PageSurahStart[] = arabic
    .filter((a) => a.numberInSurah === 1)
    .map((a) => ({ ...a.surah, hasBasmala: hasBasmalaHeader(a.surah.number) }));

  return {
    page,
    juz: ayahs[0].juz,
    ayahs,
    surahStarts,
    range: { from: ayahs[0].number, to: ayahs[ayahs.length - 1].number },
  };
};

const SWIPE_MIN_PX = 60;

/**
 * Which way a horizontal drag turns the page. The Quran reads right to left, so dragging the page to the
 * right turns to the next one, like turning a mushaf. Short or mostly vertical drags are scrolling.
 */
export const swipeDirection = (dx: number, dy: number): 'next' | 'prev' | null => {
  if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return null;
  return dx > 0 ? 'next' : 'prev';
};
