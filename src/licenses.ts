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
    name: 'Lucide icons',
    author: 'Lucide Contributors',
    license: 'ISC',
    url: 'https://lucide.dev',
  },
];
