/**
 * The 15-line IndoPak mushaf: 610 printed pages, each a fixed run of lines. The arrangement (which words sit
 * on which line of which page) comes from the QUL "Indopak 15 lines (Qudratullah)" layout, kept as word ids only
 * in src/quran/data/indopak-15-lines.json (built by scripts/build-indopak-layout.mjs). The words themselves are
 * read from the Digital Khatt IndoPak text the app already carries, so they are drawn in its open-licence font.
 */

import type { IndopakData } from './indopak';

export const LAYOUT_PAGES = 610;
/** Every word of the Quran in the Digital Khatt word list, ayah-end marks included. */
export const LAYOUT_WORDS = 83668;
const AYAHS = 6236;
const MAX_LINES = 15;

export type LayoutLine =
  | { kind: 'surah'; surah: number }
  | { kind: 'basmala' }
  | { kind: 'ayah'; align: 'justified' | 'centered'; from: number; to: number };

export interface LayoutData {
  pages: LayoutLine[][];
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

const readLine = (raw: unknown): LayoutLine | null => {
  if (!Array.isArray(raw)) return null;
  const [kind, align, a, b] = raw as unknown[];
  if (align !== 0 && align !== 1) return null;
  if (kind === 0) return isInt(a) && a >= 1 && a <= 114 ? { kind: 'surah', surah: a } : null;
  if (kind === 1) return { kind: 'basmala' };
  if (kind === 2 && isInt(a) && isInt(b) && a >= 1 && b >= a && b <= LAYOUT_WORDS) {
    return { kind: 'ayah', align: align === 1 ? 'justified' : 'centered', from: a, to: b };
  }
  return null;
};

/** Checks the shape of the file. Returns null for anything else, so a damaged file is never half used. */
export const parseLayout = (body: unknown): LayoutData | null => {
  const raw = (body as { pages?: unknown } | null)?.pages;
  if (!Array.isArray(raw) || raw.length !== LAYOUT_PAGES) return null;
  const pages: LayoutLine[][] = [];
  for (const page of raw as unknown[]) {
    if (!Array.isArray(page) || page.length === 0 || page.length > MAX_LINES) return null;
    const lines: LayoutLine[] = [];
    for (const line of page as unknown[]) {
      // An already-read line (kind as a word) is accepted too, so a layout can be passed through again.
      const read = typeof (line as { kind?: unknown })?.kind === 'string' ? (line as LayoutLine) : readLine(line);
      if (!read) return null;
      lines.push(read);
    }
    pages.push(lines);
  }
  return { pages };
};

export const clampLayoutPage = (n: number): number => {
  if (!Number.isFinite(n)) return 1;
  return Math.min(LAYOUT_PAGES, Math.max(1, Math.trunc(n)));
};

export const linesOfPage = (layout: LayoutData, page: number): LayoutLine[] => layout.pages[clampLayoutPage(page) - 1];

export interface IndopakWords {
  words: string[];
  /** The 1-based id of the first word of each ayah, in Quran order. */
  ayahStart: number[];
  /** The surah and ayah of each ayah, in Quran order. */
  refs: Array<{ surah: number; ayah: number }>;
}

/**
 * The word list, made from the IndoPak ayah text by splitting on spaces. The QUL word list joins the first two
 * words of 72:16 into one entry, so they are joined here too; with that, ids line up with the layout exactly.
 * Returns null unless the total is the 83,668 the layout counts.
 */
export const buildIndopakWords = (data: Pick<IndopakData, 'surahs'>): IndopakWords | null => {
  const words: string[] = [];
  const ayahStart: number[] = [];
  const refs: IndopakWords['refs'] = [];
  data.surahs.forEach((ayahs, s) => {
    ayahs.forEach((text, a) => {
      const tokens = text.split(' ');
      if (s + 1 === 72 && a + 1 === 16 && tokens.length > 1) tokens.splice(0, 2, `${tokens[0]} ${tokens[1]}`);
      ayahStart.push(words.length + 1);
      refs.push({ surah: s + 1, ayah: a + 1 });
      words.push(...tokens);
    });
  });
  if (words.length !== LAYOUT_WORDS || ayahStart.length !== AYAHS) return null;
  return { words, ayahStart, refs };
};

export const wordsOfLine = (w: IndopakWords, line: Extract<LayoutLine, { kind: 'ayah' }>): string[] =>
  w.words.slice(line.from - 1, line.to);

/** The index (0 to 6235) of the ayah a word belongs to. */
export const ayahIndexOfWord = (w: IndopakWords, wordId: number): number => {
  let low = 0;
  let high = w.ayahStart.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (w.ayahStart[mid] <= wordId) low = mid;
    else high = mid - 1;
  }
  return low;
};

/** The ayahs that have words on a page, each once, in order. One that carries over from the page before is included. */
export const ayahsOnPage = (layout: LayoutData, w: IndopakWords, page: number): number[] => {
  const seen = new Set<number>();
  for (const line of linesOfPage(layout, page)) {
    if (line.kind !== 'ayah') continue;
    for (let i = ayahIndexOfWord(w, line.from); i <= ayahIndexOfWord(w, line.to); i += 1) seen.add(i);
  }
  return [...seen].sort((a, b) => a - b);
};

export const surahsStartingOn = (layout: LayoutData, page: number): number[] =>
  linesOfPage(layout, page).flatMap((l) => (l.kind === 'surah' ? [l.surah] : []));

const lastWordCache = new WeakMap<LayoutData, number[]>();

/** The last word id on each page, used to find the page a word is on. */
const lastWordOfPages = (layout: LayoutData): number[] => {
  const cached = lastWordCache.get(layout);
  if (cached) return cached;
  const last = layout.pages.map((lines) => {
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const line = lines[i];
      if (line.kind === 'ayah') return line.to;
    }
    return 0;
  });
  lastWordCache.set(layout, last);
  return last;
};

/** The page an ayah begins on. */
export const pageOfAyah = (layout: LayoutData, w: IndopakWords, ayahIndex: number): number => {
  const wordId = w.ayahStart[Math.min(AYAHS - 1, Math.max(0, ayahIndex))];
  const last = lastWordOfPages(layout);
  let low = 0;
  let high = last.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (last[mid] >= wordId) high = mid;
    else low = mid + 1;
  }
  return low + 1;
};

/** Where each of the 30 juz begins: the surah and ayah. */
const JUZ_START: ReadonlyArray<readonly [number, number]> = [
  [1, 1], [2, 142], [2, 253], [3, 93], [4, 24], [4, 148], [5, 82], [6, 111], [7, 88], [8, 41],
  [9, 93], [11, 6], [12, 53], [15, 1], [17, 1], [18, 75], [21, 1], [23, 1], [25, 21], [27, 56],
  [29, 46], [33, 31], [36, 28], [39, 32], [41, 47], [46, 1], [51, 31], [58, 1], [67, 1], [78, 1],
];

const indexCache = new WeakMap<IndopakWords, Map<string, number>>();

const ayahIndexOf = (w: IndopakWords, surah: number, ayah: number): number => {
  let map = indexCache.get(w);
  if (!map) {
    map = new Map(w.refs.map((r, i) => [`${r.surah}:${r.ayah}`, i]));
    indexCache.set(w, map);
  }
  return map.get(`${surah}:${ayah}`) ?? 0;
};

export const firstPageOfJuz = (layout: LayoutData, w: IndopakWords, juz: number): number => {
  const [surah, ayah] = JUZ_START[Math.min(30, Math.max(1, Math.trunc(juz))) - 1];
  return pageOfAyah(layout, w, ayahIndexOf(w, surah, ayah));
};

/** The juz (1 to 30) an ayah is in. */
export const juzOfAyah = (w: IndopakWords, ayahIndex: number): number => {
  let juz = 1;
  JUZ_START.forEach(([surah, ayah], i) => { if (ayahIndexOf(w, surah, ayah) <= ayahIndex) juz = i + 1; });
  return juz;
};

const MIN_FONT_PX = 14;
const MAX_FONT_PX = 56;

/**
 * The font size that makes a whole page fit: every line must fit the width, and all of them together the height.
 * `naturalWidths` are the lines' widths when drawn at `baseSize`, so they scale straight with the size.
 */
export const fitFontSize = (input: {
  baseSize: number;
  naturalWidths: readonly number[];
  containerWidth: number;
  availableHeight: number;
  lineCount: number;
  lineHeight: number;
}): number => {
  const widest = Math.max(0, ...input.naturalWidths);
  const byWidth = widest > 0 && input.containerWidth > 0 ? (input.baseSize * input.containerWidth) / widest : Infinity;
  const byHeight = input.availableHeight > 0 && input.lineCount > 0 ? input.availableHeight / (input.lineCount * input.lineHeight) : Infinity;
  const size = Math.min(byWidth, byHeight);
  if (!Number.isFinite(size)) return MIN_FONT_PX;
  return Math.min(MAX_FONT_PX, Math.max(MIN_FONT_PX, size));
};
