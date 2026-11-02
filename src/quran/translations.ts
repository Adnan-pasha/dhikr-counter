import type { ReaderAyah } from './editions';

export const QURANENC_BASE = 'https://quranenc.com/api/v1';

/** The built-in translation, loaded with the Arabic. Pickthall (1930) is in the public domain. */
export const PICKTHALL_ID = 'pickthall';

const KEY_PATTERN = /^[a-z0-9_]{2,60}$/;
const SURAHS = 114;

export type TranslationId = string;

export type ParsedTranslationId = { source: 'builtin' } | { source: 'quranenc'; key: string };

export const translationIdFor = (key: string): TranslationId => `quranenc:${key}`;

/** Understands the ids stored in settings. Anything unexpected is null, never a URL fragment. */
export const parseTranslationId = (id: unknown): ParsedTranslationId | null => {
  if (id === PICKTHALL_ID) return { source: 'builtin' };
  if (typeof id !== 'string' || !id.startsWith('quranenc:')) return null;
  const key = id.slice('quranenc:'.length);
  return KEY_PATTERN.test(key) ? { source: 'quranenc', key } : null;
};

export const catalogUrl = (): string => `${QURANENC_BASE}/translations/list`;

export const surahTranslationUrl = (key: string, surah: number): string => {
  if (!KEY_PATTERN.test(key)) throw new Error(`Unsafe translation key: ${key}`);
  if (!Number.isInteger(surah) || surah < 1 || surah > SURAHS) throw new Error(`Surah out of range: ${surah}`);
  return `${QURANENC_BASE}/translation/sura/${key}/${surah}`;
};

// ── catalogue ─────────────────────────────────────────────────────────────────

export interface CatalogEntry {
  key: string;
  /** The publisher's own title, e.g. "English Translation - Noor International Center". */
  title: string;
  /** ISO language code. */
  language: string;
  direction: 'ltr' | 'rtl';
  version: string;
  /** Seconds since 1970. */
  lastUpdate: number;
}

/** Keeps only what the reader needs from QuranEnc's list; entries that cannot be used safely are dropped. */
export const parseCatalog = (body: unknown): CatalogEntry[] => {
  if (typeof body !== 'object' || body === null) return [];
  const list = (body as { translations?: unknown }).translations;
  if (!Array.isArray(list)) return [];
  const entries: CatalogEntry[] = [];
  for (const raw of list) {
    if (typeof raw !== 'object' || raw === null) continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.key !== 'string' || !KEY_PATTERN.test(r.key)) continue;
    if (typeof r.title !== 'string' || r.title.trim() === '') continue;
    entries.push({
      key: r.key,
      title: r.title.trim(),
      language: typeof r.language_iso_code === 'string' && r.language_iso_code ? r.language_iso_code : 'und',
      direction: r.direction === 'rtl' ? 'rtl' : 'ltr',
      version: typeof r.version === 'string' ? r.version : '',
      lastUpdate: typeof r.last_update === 'number' ? r.last_update : 0,
    });
  }
  return entries;
};

export interface LanguageLabel {
  english: string;
  /** The language's name in itself, so people can find their own language. */
  native: string;
}

const nameIn = (locale: string, code: string): string | null => {
  try {
    const name = new Intl.DisplayNames([locale], { type: 'language', fallback: 'none' }).of(code);
    return name && name !== code ? name : null;
  } catch {
    return null;
  }
};

/** QuranEnc languages the browser has no display name for. */
const LANGUAGE_NAME_FALLBACKS: Readonly<Record<string, string>> = { mdh: 'Maguindanaon' };

export const languageLabel = (code: string): LanguageLabel => {
  const english = nameIn('en', code) ?? LANGUAGE_NAME_FALLBACKS[code] ?? code;
  return { english, native: nameIn(code, code) ?? english };
};

export interface LanguageGroup {
  language: string;
  label: LanguageLabel;
  items: CatalogEntry[];
}

/** Groups translations by language for the picker, filtered by a search that matches title, key or language. */
export const groupByLanguage = (entries: readonly CatalogEntry[], query: string): LanguageGroup[] => {
  const q = query.trim().toLowerCase();
  const groups = new Map<string, LanguageGroup>();
  for (const entry of entries) {
    let group = groups.get(entry.language);
    if (!group) {
      group = { language: entry.language, label: languageLabel(entry.language), items: [] };
      groups.set(entry.language, group);
    }
    const haystack = [entry.title, entry.key, entry.language, group.label.english, group.label.native].join(' ').toLowerCase();
    if (!q || haystack.includes(q)) group.items.push(entry);
  }
  return [...groups.values()]
    .filter((g) => g.items.length > 0)
    .map((g) => ({ ...g, items: [...g.items].sort((a, b) => a.title.localeCompare(b.title)) }))
    .sort((a, b) => a.label.english.localeCompare(b.label.english));
};

// ── a surah's translation ─────────────────────────────────────────────────────

export interface TranslatedAyah {
  translation: string;
  footnotes: string | null;
}

/**
 * Reads QuranEnc's response for one surah. The translation and its footnotes are kept exactly as published:
 * the publisher's terms forbid changing, adding or removing any of it.
 */
export const parseQuranEncSurah = (body: unknown): Map<number, TranslatedAyah> | null => {
  if (typeof body !== 'object' || body === null) return null;
  const rows = (body as { result?: unknown }).result;
  if (!Array.isArray(rows)) return null;
  const map = new Map<number, TranslatedAyah>();
  for (const raw of rows) {
    if (typeof raw !== 'object' || raw === null) continue;
    const r = raw as Record<string, unknown>;
    const aya = Number(r.aya);
    if (!Number.isInteger(aya) || aya < 1 || typeof r.translation !== 'string') continue;
    const notes = typeof r.footnotes === 'string' && r.footnotes.trim() !== '' ? r.footnotes : null;
    map.set(aya, { translation: r.translation, footnotes: notes });
  }
  return map.size > 0 ? map : null;
};

/** Puts a loaded translation onto the ayahs. Ayahs it does not cover show no translation rather than the previous one. */
export const applyTranslation = (ayahs: readonly ReaderAyah[], map: ReadonlyMap<number, TranslatedAyah> | null): ReaderAyah[] =>
  ayahs.map((a) => {
    const found = map?.get(a.numberInSurah);
    return { ...a, translation: found?.translation ?? null, footnotes: found?.footnotes ?? null };
  });

/** A readable name for the current choice, for the settings screen. */
export const translationLabel = (id: TranslationId, entries: readonly CatalogEntry[]): string => {
  const parsed = parseTranslationId(id);
  if (!parsed || parsed.source === 'builtin') return 'English: Pickthall';
  return entries.find((e) => e.key === parsed.key)?.title ?? parsed.key;
};

export interface Credit {
  text: string;
  url: string;
}

/** The credit the publisher's terms ask for: who published it, which version, and where it comes from. */
export const translationCredit = (entry: CatalogEntry | null, fallbackKey?: string): Credit => {
  if (!entry && fallbackKey) return { text: `${fallbackKey}. Source: QuranEnc.com`, url: `https://quranenc.com/en/browse/${fallbackKey}` };
  if (!entry) return { text: 'Mohammed Marmaduke Pickthall (1930), public domain', url: 'https://tanzil.net/trans/' };
  return {
    text: `${entry.title}${entry.version ? `, v${entry.version}` : ''}. Source: QuranEnc.com`,
    url: `https://quranenc.com/en/browse/${entry.key}`,
  };
};
