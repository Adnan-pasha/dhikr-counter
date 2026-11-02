/**
 * IndoPak text for the reader. It is the Digital Khatt IndoPak script from the Quranic Universal Library,
 * kept in one file (src/quran/data/indopak-digitalkhatt.json, built by scripts/build-indopak-data.mjs) and
 * shown exactly as exported. It only displays correctly with the DigitalKhatt IndoPak font.
 */

export const INDOPAK_URL = new URL('./data/indopak-digitalkhatt.json', import.meta.url).href;

/** The ornament that closes each ayah; the digits that follow it are the ayah number. */
export const INDOPAK_END_MARK = '۝';

/** The Bismillah header, the first ayah of Al-Fatiha as the file has it (written as code points so no editor can reorder its marks). */
export const BASMALA_INDOPAK = '\u0628\u0650\u0633\u0652\u0645\u0650\u0020\u0627\u0644\u0644\u0651\u0670\u0647\u0650\u0020\u0627\u0644\u0631\u0651\u064e\u062d\u0652\u0645\u0670\u0646\u0650\u0020\u0627\u0644\u0631\u0651\u064e\u062d\u0650\u064a\u0652\u0645\u0650';

const SURAH_COUNT = 114;

export interface IndopakData {
  /** Ayah texts, one list per surah. */
  surahs: string[][];
}

/** Checks the shape of the file. Returns null for anything else, so a damaged file is never half used. */
export const parseIndopak = (body: unknown): IndopakData | null => {
  if (typeof body !== 'object' || body === null) return null;
  const surahs = (body as { surahs?: unknown }).surahs;
  if (!Array.isArray(surahs) || surahs.length !== SURAH_COUNT) return null;
  for (const ayahs of surahs) {
    if (!Array.isArray(ayahs) || ayahs.length === 0) return null;
    if (!ayahs.every((text) => typeof text === 'string' && text.length > 0)) return null;
  }
  return { surahs: surahs as string[][] };
};

/** The ayah text of one surah, keyed by the ayah's number in the surah. Empty for an unknown surah. */
export const indopakAyahs = (data: IndopakData, surah: number): Map<number, string> => {
  const ayahs = Number.isInteger(surah) ? data.surahs[surah - 1] : undefined;
  return new Map((ayahs ?? []).map((text, i) => [i + 1, text]));
};

/** The text without the closing ornament and number, for copying and reading aloud. */
export const stripEndMarker = (text: string): string => {
  const at = text.indexOf(INDOPAK_END_MARK);
  return at === -1 ? text : text.slice(0, at).trimEnd();
};

const DIRECTION_CONTROLS = /[\u202A-\u202E\u2066-\u2069]/g;

/** The words for the clipboard: no ornament and number, and no direction override that could flip the text pasted after it. */
export const plainForCopy = (text: string): string => stripEndMarker(text).replace(DIRECTION_CONTROLS, '');

let pending: Promise<IndopakData> | null = null;

export const clearIndopakCache = (): void => { pending = null; };

type FetchLike = (url: string) => Promise<{ ok: boolean; status?: number; json: () => Promise<unknown> }>;

/** Fetches the file once and keeps it. A failure is not kept, so the next try can succeed. */
export const loadIndopak = (fetchImpl: FetchLike = (url) => fetch(url)): Promise<IndopakData> => {
  if (pending) return pending;
  const attempt = fetchImpl(INDOPAK_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`IndoPak text request failed (${response.status ?? 'no status'})`);
      return response.json();
    })
    .then((body) => {
      const data = parseIndopak(body);
      if (!data) throw new Error('IndoPak text file is not valid');
      return data;
    });
  pending = attempt;
  attempt.catch(() => { if (pending === attempt) pending = null; });
  return attempt;
};
