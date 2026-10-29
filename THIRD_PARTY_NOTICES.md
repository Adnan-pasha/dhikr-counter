# Third-party notices

Kept in sync with `src/licenses.ts`, which the app shows under Settings.

| Component | Author | Licence | Source |
|---|---|---|---|
| Adhan recording (`public/audio/adhan.m4a`) | Adam-synagda | CC0 1.0 | https://commons.wikimedia.org/wiki/File:Beautiful_adhan.ogg |
| adhan | Batoul Apps | MIT | https://github.com/batoulapps/adhan-js |
| Inter | The Inter Project Authors | SIL OFL 1.1 | https://github.com/rsms/inter |
| Space Grotesk | Florian Karsten | SIL OFL 1.1 | https://github.com/floriankarsten/space-grotesk |
| Lateef | SIL International | SIL OFL 1.1 | https://software.sil.org/lateef/ |
| Noto Naskh Arabic | The Noto Project Authors | SIL OFL 1.1 | https://github.com/notofonts/arabic |
| Quran text (Tanzil) | Tanzil Project | CC BY 3.0 (verbatim copies only, source credited and linked) | https://tanzil.net |
| Pickthall translation | Mohammed Marmaduke Pickthall (1930) | Public domain | https://tanzil.net/trans/ |
| Amiri Quran | Khaled Hosny | SIL OFL 1.1 | https://github.com/alif-type/amiri |
| Lucide icons | Lucide Contributors | ISC | https://lucide.dev |

## Notes

- The adhan recording was converted from Ogg Vorbis to AAC (64 kbps). CC0 permits this; no attribution is required, but it is given here as a courtesy. The reciter is not named on the source page.
- Quran text and the translation are loaded on demand from api.alquran.cloud and are not bundled in the app. Recitation audio is streamed and never bundled. Any future addition needs its licence recorded here first.
- Translations that carry non-commercial terms (for example those in the Tanzil translation list, except public-domain editions) are not shipped. See docs/ROADMAP.md, section 7.
