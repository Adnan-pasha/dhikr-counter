import { stripBom, stripLeadingBasmala } from './text';

export type ScriptId = 'uthmani' | 'simple';

export interface ScriptOption {
  id: ScriptId;
  label: string;
  /** Edition id at the text service. */
  edition: string;
  blurb: string;
  /** Shown on the option card as a live preview. */
  sample: string;
}

/**
 * Arabic scripts we can show today. Both come from the Tanzil text (CC BY 3.0, shown unaltered).
 * IndoPak is not here: its text has no cleared licence yet (see docs/ROADMAP.md).
 */
export const SCRIPTS: readonly ScriptOption[] = [
  { id: 'uthmani', label: 'Uthmani', edition: 'quran-uthmani', blurb: 'Full marks, the Madani mushaf style', sample: 'بِسْمِ ٱللَّهِ' },
  { id: 'simple', label: 'Simple', edition: 'quran-simple', blurb: 'Fewer marks, easier on small screens', sample: 'بِسْمِ اللَّهِ' },
];

export const DEFAULT_SCRIPT: ScriptId = 'uthmani';

export interface TranslationOption {
  id: string;
  label: string;
  credit: string;
}

/**
 * Only translations with a clear right to ship. Pickthall (d. 1936) is in the public domain. More
 * languages arrive in the translations slice, from sources with explicit terms.
 */
export const TRANSLATIONS: readonly TranslationOption[] = [
  { id: 'en.pickthall', label: 'English: Pickthall', credit: 'Mohammed Marmaduke Pickthall (1930), public domain' },
];

export const DEFAULT_TRANSLATION = 'en.pickthall';

/** No transliteration source has a clear licence yet, so none is requested. Set an edition id here once one does. */
export const TRANSLITERATION_EDITION: string | null = null;

export const API_BASE = 'https://api.alquran.cloud/v1';

export interface EditionChoices {
  script: ScriptId;
  showTranslation: boolean;
  showTransliteration: boolean;
}

const scriptEdition = (script: ScriptId): string =>
  (SCRIPTS.find((s) => s.id === script) ?? SCRIPTS[0]).edition;

export const editionsFor = ({ script, showTranslation, showTransliteration }: EditionChoices): string[] => {
  const editions = [scriptEdition(script)];
  if (showTranslation) editions.push(DEFAULT_TRANSLATION);
  if (showTransliteration && TRANSLITERATION_EDITION) editions.push(TRANSLITERATION_EDITION);
  return editions;
};

export const surahUrl = (base: string, surah: number, editions: readonly string[]): string =>
  `${base}/surah/${surah}/editions/${editions.join(',')}`;

export interface ReaderAyah {
  /** Global ayah number. */
  number: number;
  numberInSurah: number;
  arabic: string;
  translation: string | null;
  transliteration: string | null;
  juz: number;
  page: number;
}

interface RawAyah {
  number: number;
  numberInSurah: number;
  text: string;
  juz?: number;
  page?: number;
}

const isRawAyah = (v: unknown): v is RawAyah =>
  typeof v === 'object' && v !== null
  && typeof (v as RawAyah).numberInSurah === 'number'
  && typeof (v as RawAyah).text === 'string';

/** The ayahs of one edition from a response body, or null if the edition is missing or malformed. */
const ayahsOf = (body: { data: unknown[] }, edition: string): RawAyah[] | null => {
  const entry = body.data.find(
    (e) => typeof e === 'object' && e !== null && (e as { edition?: { identifier?: string } }).edition?.identifier === edition,
  ) as { ayahs?: unknown } | undefined;
  if (!entry || !Array.isArray(entry.ayahs)) return null;
  return entry.ayahs.every(isRawAyah) ? (entry.ayahs as RawAyah[]) : null;
};

/**
 * Joins the Arabic with the optional translation, matching editions by id rather than position.
 * Returns null when the Arabic is missing or the body is not a successful response, so the UI can offer a retry.
 */
export const buildReaderAyahs = (
  surahNumber: number,
  body: unknown,
  script: ScriptId,
  wantTranslation: boolean,
  wantTransliteration = false,
): ReaderAyah[] | null => {
  if (typeof body !== 'object' || body === null) return null;
  const response = body as { code?: number; data?: unknown };
  if (response.code !== 200 || !Array.isArray(response.data)) return null;
  const payload = { data: response.data };

  const arabic = ayahsOf(payload, scriptEdition(script));
  if (!arabic || arabic.length === 0) return null;

  const translation = wantTranslation ? ayahsOf(payload, DEFAULT_TRANSLATION) : null;
  const transliteration = wantTransliteration && TRANSLITERATION_EDITION ? ayahsOf(payload, TRANSLITERATION_EDITION) : null;
  const byNumber = (list: RawAyah[] | null) => new Map((list ?? []).map((a) => [a.numberInSurah, a.text]));
  const translationText = byNumber(translation);
  const transliterationText = byNumber(transliteration);

  return arabic.map((a) => {
    const cleaned = stripBom(a.text);
    return {
      number: a.number,
      numberInSurah: a.numberInSurah,
      arabic: a.numberInSurah === 1 ? stripLeadingBasmala(surahNumber, cleaned) : cleaned,
      translation: translationText.get(a.numberInSurah) ?? null,
      transliteration: transliterationText.get(a.numberInSurah) ?? null,
      juz: a.juz ?? 0,
      page: a.page ?? 0,
    };
  });
};

export interface CopyInput {
  surahName: string;
  surahNumber: number;
  ayahNumber: number;
  arabic: string;
  translation: string | null;
}

/** Text placed on the clipboard for one ayah: Arabic, translation if shown, then the reference. */
export const formatAyahForCopy = ({ surahName, surahNumber, ayahNumber, arabic, translation }: CopyInput): string =>
  [arabic, ...(translation ? [translation] : []), `— ${surahName} ${surahNumber}:${ayahNumber}`].join('\n\n');
