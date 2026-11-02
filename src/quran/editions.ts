import { stripBom, stripLeadingBasmala } from './text';
import { colourText, type TajweedSegment } from './tajweed';
import { PICKTHALL_ID, parseTranslationId, type TranslationId } from './translations';

export type ScriptId = 'uthmani' | 'simple' | 'tajweed' | 'indopak';

export interface ScriptOption {
  id: ScriptId;
  label: string;
  /** Edition id at the text service. */
  edition: string;
  blurb: string;
  /** Shown on the option card as a live preview. */
  sample: string;
  /** The same sample as the tajweed edition marks it, so the card can show the colours. */
  sampleMarked?: string;
  /** True when the Arabic comes from a file bundled with the app; the service then supplies only ayah numbers, juz and page. */
  bundled?: boolean;
  /** The reader font for this script. */
  font?: 'quran' | 'indopak';
  /** True when the text already ends each ayah with its own numbered ornament. */
  selfNumbered?: boolean;
  /** A second edition that marks the tajweed rules. It only says which letters to colour; the text shown is always `edition`. */
  overlay?: string;
}

/**
 * Arabic scripts we can show today. Uthmani and Simple are the Tanzil text (CC BY 3.0, shown unaltered).
 * Tajweed shows the Uthmani text with its rules coloured: the tajweed edition spells some letters differently,
 * so it is used only to find which letters to colour.
 * IndoPak is not here: its text has no cleared licence yet (see docs/ROADMAP.md).
 */
export const SCRIPTS: readonly ScriptOption[] = [
  { id: 'uthmani', label: 'Uthmani', edition: 'quran-uthmani', blurb: 'Full marks, the Madani mushaf style', sample: 'بِسْمِ ٱللَّهِ' },
  { id: 'simple', label: 'Simple', edition: 'quran-simple', blurb: 'Fewer marks, easier on small screens', sample: 'بِسْمِ اللَّهِ' },
  {
    id: 'tajweed', label: 'Tajweed', edition: 'quran-uthmani', overlay: 'quran-tajweed',
    blurb: 'Uthmani with colours for the tajweed rules',
    sample: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ',
    sampleMarked: 'بِسْمِ [h:1[ٱ]للَّهِ [h:2[ٱ][l[ل]رَّحْمَ[n[ـٰ]نِ',
  },
  {
    id: 'indopak', label: 'IndoPak', edition: 'quran-uthmani', bundled: true, font: 'indopak', selfNumbered: true,
    blurb: 'The South Asian mushaf style',
    sample: 'بِسْمِ اللّٰهِ',
  },
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
  /** The chosen translation. Only the built-in one comes from this service; QuranEnc ones are fetched separately. */
  translation?: TranslationId;
}

const isBuiltIn = (translation: TranslationId = PICKTHALL_ID): boolean => parseTranslationId(translation)?.source === 'builtin';

export const scriptOption = (script: ScriptId): ScriptOption => SCRIPTS.find((s) => s.id === script) ?? SCRIPTS[0];
const scriptEdition = (script: ScriptId): string => scriptOption(script).edition;

export const editionsFor = ({ script, showTranslation, showTransliteration, translation }: EditionChoices): string[] => {
  const editions = [scriptEdition(script)];
  const overlay = scriptOption(script).overlay;
  if (overlay) editions.push(overlay);
  if (showTranslation && isBuiltIn(translation)) editions.push(DEFAULT_TRANSLATION);
  if (showTransliteration && TRANSLITERATION_EDITION) editions.push(TRANSLITERATION_EDITION);
  return editions;
};

export const surahUrl = (base: string, surah: number, editions: readonly string[]): string =>
  `${base}/surah/${surah}/editions/${editions.join(',')}`;

export interface ReaderAyah {
  /** Global ayah number. */
  number: number;
  numberInSurah: number;
  /** Plain text, with no tajweed markers: what is copied and read aloud. */
  arabic: string;
  /** The same text in pieces with their tajweed rule, for the Tajweed script only. */
  arabicSegments?: TajweedSegment[] | null;
  /** The script this text was built in. The reader keeps old text on screen while a new script loads, so the font follows the text, not the setting. */
  script?: ScriptId;
  translation: string | null;
  /** The publisher's notes for this ayah, shown with the translation. Null when there are none. */
  footnotes: string | null;
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
  translationChoice: TranslationId = PICKTHALL_ID,
  /** The Arabic for a bundled script, by ayah number in the surah. Required for those scripts. */
  bundledArabic: ReadonlyMap<number, string> | null = null,
): ReaderAyah[] | null => {
  if (typeof body !== 'object' || body === null) return null;
  const response = body as { code?: number; data?: unknown };
  if (response.code !== 200 || !Array.isArray(response.data)) return null;
  const payload = { data: response.data };

  const arabic = ayahsOf(payload, scriptEdition(script));
  if (!arabic || arabic.length === 0) return null;
  const bundled = scriptOption(script).bundled === true;
  // A bundled script never falls back to another script's text, ayah by ayah or as a whole.
  if (bundled && arabic.some((a) => !bundledArabic?.has(a.numberInSurah))) return null;

  const translation = wantTranslation && isBuiltIn(translationChoice) ? ayahsOf(payload, DEFAULT_TRANSLATION) : null;
  const transliteration = wantTransliteration && TRANSLITERATION_EDITION ? ayahsOf(payload, TRANSLITERATION_EDITION) : null;
  const byNumber = (list: RawAyah[] | null) => new Map((list ?? []).map((a) => [a.numberInSurah, a.text]));
  const translationText = byNumber(translation);
  const transliterationText = byNumber(transliteration);

  const overlay = scriptOption(script).overlay;
  const overlayText = overlay ? new Map((ayahsOf(payload, overlay) ?? []).map((a) => [a.numberInSurah, a.text])) : null;

  return arabic.map((a) => {
    const cleaned = stripBom(a.text);
    const bundledText = bundled ? bundledArabic?.get(a.numberInSurah) : undefined;
    const arabicText = bundledText ?? (a.numberInSurah === 1 ? stripLeadingBasmala(surahNumber, cleaned) : cleaned);
    const marked = overlayText?.get(a.numberInSurah);
    const segments = marked ? colourText(marked, arabicText) : null;
    return {
      number: a.number,
      numberInSurah: a.numberInSurah,
      arabic: arabicText,
      arabicSegments: segments,
      script,
      translation: translationText.get(a.numberInSurah) ?? null,
      footnotes: null,
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
  /** The publisher's notes for the translation, copied with it so none of it is left behind. */
  footnotes?: string | null;
}

/** Text placed on the clipboard for one ayah: Arabic, translation and its notes if shown, then the reference. */
export const formatAyahForCopy = ({ surahName, surahNumber, ayahNumber, arabic, translation, footnotes }: CopyInput): string =>
  [arabic, ...(translation ? [translation] : []), ...(translation && footnotes ? [footnotes] : []), `— ${surahName} ${surahNumber}:${ayahNumber}`].join('\n\n');
