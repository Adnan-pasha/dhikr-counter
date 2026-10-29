export interface Surah {
  number: number;
  /** Arabic name. */
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: 'Meccan' | 'Medinan';
}

/** Quick jumps for the reader's Juz menu. */
export const JUZ_STARTS: ReadonlyArray<{ juz: number; surah: number; label: string }> = [
  { juz: 1, surah: 1, label: 'Al-Fatihah' },
  { juz: 2, surah: 2, label: 'Al-Baqarah 142' },
  { juz: 3, surah: 2, label: 'Al-Baqarah 253' },
  { juz: 4, surah: 3, label: 'Aal-Imran 92' },
  { juz: 5, surah: 4, label: 'An-Nisa 24' },
  { juz: 6, surah: 4, label: 'An-Nisa 148' },
  { juz: 7, surah: 5, label: "Al-Ma'idah 82" },
  { juz: 8, surah: 6, label: "Al-An'am 111" },
  { juz: 9, surah: 7, label: "Al-A'raf 87" },
  { juz: 10, surah: 8, label: 'Al-Anfal 41' },
];
