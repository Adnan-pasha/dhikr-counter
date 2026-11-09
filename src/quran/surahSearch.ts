import { SURAHS, type SurahInfo } from './surahs';

/**
 * Letters only, lower case, with doubled letters made single and e/o treated as i/u, so the many ways of writing
 * the same Arabic name meet: "Yaseen", "Yasin" and "Ya-Sin" are all "yasin"; "Ar-Rahmaan" and "rahman" both contain "rahman".
 */
const sound = (text: string): string => text
  .toLowerCase()
  .replace(/[^a-z]/g, '')
  .replace(/(.)\1+/g, '$1')
  .replace(/e/g, 'i')
  .replace(/o/g, 'u');

/** "waqiah" is written "Al-Waaqia" here: a trailing h is tried both ways. */
const variants = (query: string): string[] => {
  const base = sound(query);
  return base.length > 3 && base.endsWith('h') ? [base, base.slice(0, -1)] : [base];
};

interface Entry {
  surah: SurahInfo;
  name: string;
  meaning: string;
}

const ENTRIES: readonly Entry[] = SURAHS.map((surah) => ({ surah, name: sound(surah.englishName), meaning: sound(surah.englishNameTranslation) }));

/**
 * The surahs that match what was typed: a number, a name however it is spelt, or part of its meaning.
 * An empty search gives all 114. The best matches (the name itself, then names that start with it) come first.
 */
export const searchSurahs = (query: string): readonly SurahInfo[] => {
  const typed = query.trim();
  if (typed === '') return SURAHS;

  if (/^\d+$/.test(typed)) {
    const number = String(Number(typed));
    return SURAHS
      .filter((s) => String(s.number).startsWith(number))
      .sort((a, b) => Number(String(b.number) === number) - Number(String(a.number) === number) || a.number - b.number);
  }

  const wanted = variants(typed).filter((v) => v.length > 0);
  if (wanted.length === 0) return [];
  const scored = ENTRIES.flatMap((entry) => {
    let best = Infinity;
    for (const w of wanted) {
      const inName = entry.name.indexOf(w);
      if (inName >= 0) best = Math.min(best, entry.name === w ? 0 : inName + 1);
      else if (entry.meaning.includes(w)) best = Math.min(best, 1000);
    }
    return best === Infinity ? [] : [{ surah: entry.surah, score: best }];
  });
  return scored.sort((a, b) => a.score - b.score || a.surah.number - b.surah.number).map((s) => s.surah);
};
