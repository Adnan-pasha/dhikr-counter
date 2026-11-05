# Third-party notices

Kept in sync with `src/licenses.ts`, which the app shows under Settings.

| Component | Author | Licence | Source |
|---|---|---|---|
| Adhan recordings (`public/audio/azan-fajr.m4a`, `azan-makkah.m4a`, `azan-madinah.m4a`) | Supplied by the project owner; reciters not named in the files | Licence not independently verified | https://www.thesufi.com |
| adhan | Batoul Apps | MIT | https://github.com/batoulapps/adhan-js |
| Inter | The Inter Project Authors | SIL OFL 1.1 | https://github.com/rsms/inter |
| Space Grotesk | Florian Karsten | SIL OFL 1.1 | https://github.com/floriankarsten/space-grotesk |
| Lateef | SIL International | SIL OFL 1.1 | https://software.sil.org/lateef/ |
| Noto Naskh Arabic | The Noto Project Authors | SIL OFL 1.1 | https://github.com/notofonts/arabic |
| Quran text (Tanzil) | Tanzil Project | CC BY 3.0 (verbatim copies only, source credited and linked) | https://tanzil.net |
| Tajweed colour markers | Islamic Network (Al Quran Cloud), derived from the Tanzil text | Al Quran Cloud terms of use; text from Tanzil (CC BY 3.0) | https://alquran.cloud/terms-and-conditions |
| IndoPak text (Digital Khatt) | DigitalKhatt and Tarteel, from the Quranic Universal Library | No copyright terms published by the library; shown with credit, never altered | https://qul.tarteel.ai/resources/quran-script/566 |
| 15-line IndoPak page layout | Arrangement after the Qudratullah Company mushaf, from the Quranic Universal Library | No copyright terms published by the library; shown with credit. Only the line and page arrangement is used, never the library's own words or font | https://qul.tarteel.ai/resources/mushaf-layout/12 |
| DigitalKhatt IndoPak font | Amine Anane and Tarteel Inc | SIL OFL 1.1 | https://github.com/DigitalKhatt/indopakfont |
| Pickthall translation | Mohammed Marmaduke Pickthall (1930) | Public domain | https://tanzil.net/trans/ |
| Quran translations (QuranEnc) | QuranEnc.com and each translation's publisher | Terms published by QuranEnc: no modification, addition or deletion; publisher and QuranEnc credited; version named; kept at the latest version; no inappropriate ads next to the text | https://quranenc.com |
| Amiri Quran | Khaled Hosny | SIL OFL 1.1 | https://github.com/alif-type/amiri |
| Lucide icons | Lucide Contributors | ISC | https://lucide.dev |

## Notes

- The three adhan recordings (Fajr, Makkah, Madinah) were supplied by the project owner from an open download collection (their files are tagged with thesufi.com) and converted to mono AAC (40 kbps) with loudness levelled. The files carry no licence text, the reciters are not named, and the licence has not been independently verified. The project owner decided to use them. If a rights holder objects, remove them and the references in `src/azan.ts`.
- The earlier placeholder adhan (CC0, Wikimedia Commons, "Beautiful adhan.ogg" by Adam-synagda) was removed when these recordings replaced it.
- QuranEnc translations are fetched live from quranenc.com and shown with their footnotes, exactly as published. They are not copied into this repository or hosted by us; the device keeps a cache so surahs already opened work offline.
- Quran text and the translation are loaded on demand from api.alquran.cloud and are not bundled in the app. Recitation audio is streamed and never bundled. Any future addition needs its licence recorded here first.
- Translations that carry non-commercial terms (for example those in the Tanzil translation list, except public-domain editions) are not shipped. See docs/ROADMAP.md, section 7.
