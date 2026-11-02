export interface ThirdPartyNotice {
  name: string;
  author: string;
  license: string;
  url: string;
  note?: string;
}

/** Shown in Settings. Keep in sync with THIRD_PARTY_NOTICES.md. */
export const THIRD_PARTY_NOTICES: ThirdPartyNotice[] = [
  {
    name: 'Adhan recording (audio)',
    author: 'Adam-synagda',
    license: 'CC0 1.0',
    url: 'https://commons.wikimedia.org/wiki/File:Beautiful_adhan.ogg',
    note: 'Wikimedia Commons, "Beautiful adhan.ogg". Converted to AAC; no attribution required.',
  },
  {
    name: 'adhan',
    author: 'Batoul Apps',
    license: 'MIT',
    url: 'https://github.com/batoulapps/adhan-js',
    note: 'Prayer time calculation, computed on your device.',
  },
  {
    name: 'Inter',
    author: 'The Inter Project Authors',
    license: 'SIL OFL 1.1',
    url: 'https://github.com/rsms/inter',
  },
  {
    name: 'Space Grotesk',
    author: 'Florian Karsten',
    license: 'SIL OFL 1.1',
    url: 'https://github.com/floriankarsten/space-grotesk',
  },
  {
    name: 'Lateef',
    author: 'SIL International (Bob Hallissy, Martin Hosken)',
    license: 'SIL OFL 1.1',
    url: 'https://software.sil.org/lateef/',
    note: 'Arabic typeface for dhikr and Quran text.',
  },
  {
    name: 'Noto Naskh Arabic',
    author: 'The Noto Project Authors',
    license: 'SIL OFL 1.1',
    url: 'https://github.com/notofonts/arabic',
  },
  {
    name: 'Quran text (Tanzil)',
    author: 'Tanzil Project',
    license: 'CC BY 3.0',
    url: 'https://tanzil.net',
    note: 'Arabic text, shown unaltered. The Bismillah is shown once as a header.',
  },
  {
    name: 'Tajweed colour markers',
    author: 'Islamic Network (Al Quran Cloud), derived from the Tanzil text',
    license: 'Al Quran Cloud terms of use; text from Tanzil (CC BY 3.0)',
    url: 'https://alquran.cloud/terms-and-conditions',
    note: 'Colour rules for the Uthmani text. Only colour changes; the text is unaltered.',
  },
  {
    name: 'Pickthall translation',
    author: 'Mohammed Marmaduke Pickthall',
    license: 'Public domain',
    url: 'https://tanzil.net/trans/',
    note: 'English translation (1930).',
  },
  {
    name: 'Quran translations (QuranEnc)',
    author: 'QuranEnc.com and the publishers of each translation',
    license: 'Published terms: shown unmodified, credited, with version',
    url: 'https://quranenc.com',
    note: 'Loaded live and shown unmodified, with the publisher and version named.',
  },
  {
    name: 'Amiri Quran',
    author: 'Khaled Hosny',
    license: 'SIL OFL 1.1',
    url: 'https://github.com/alif-type/amiri',
    note: 'Typeface for the Quran reader.',
  },
  {
    name: 'Lucide icons',
    author: 'Lucide Contributors',
    license: 'ISC',
    url: 'https://lucide.dev',
  },
];
