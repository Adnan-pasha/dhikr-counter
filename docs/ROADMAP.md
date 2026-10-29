# Dhikr: final plan (Quran, prayer, utilities, native Android)

Status on 2026-10-29. Phases 0 to 3 are shipped and live. This document covers everything still to do,
in the order we should do it, with what each slice delivers, what blocks it and how we know it is done.

Written for the project owner, to approve scope and order before any building starts.

---

## 1. What Muslim Pro does, and what we do about it

Findings come from going through Muslim Pro on a real phone (screens, UI text and settings), plus checks of
the public Quran data sources. Nothing was downloaded, signed into or changed.

| Muslim Pro area | What it has | Our decision |
|---|---|---|
| **Quran reader** | One block per ayah (Arabic, transliteration, translation), ayah menu, parchment theme, Display / Text / Audio settings sheet | **Build** (Phase Q) |
| **Script option** | IndoPak, Uthmani, Simple, an Indonesian mushaf, plus Tajweed colours | **Build** Uthmani, Simple, IndoPak, Tajweed colours. Skip the Indonesian mushaf for now |
| **Translations** | About 42+ languages and 63+ translations seen, each a small download, with its own translation reciter | **Build** with a language-grouped picker and offline caching |
| **Transliteration** | Only 4 choices (None, Asian, Default phonetic, Turkish) | **Build** a simple on/off plus the Latin transliteration we already have |
| **Reading goal / My Progress** | 5, 10 or 15 minute goal mapped to ayat, ring, 7-day row, "continue here", khatam projection, Reading / Khatam switch | **Build** (Phase Q). This is the habit loop |
| **Learn tab** | Lessons, Memorise, Articles, Resources | **Later**. Large editorial content we cannot source quickly |
| **Prayers tab** | 7-day ring strip, tick circle per prayer, times, per-prayer adhan alarm sheet (repeat days, sound, pre-adhan reminder) | **Build** (Phase P), needs native for reliable alarms |
| **Tasbih** | Big count, loop counter, swipe back to undo, bead skins, current-dhikr sheet | **We already match or beat it.** Possible later: bead skins |
| **Duas** | Mood search, Hisnul Muslim by chapter, Al-Ma'thurat, bookmarks, recents | **Build** (Phase D) on our Adhkaar library |
| **Calendar** | Hijri month grid with Gregorian dates and a list of Islamic events | **Build** (Phase U) |
| **Tracker** | Month grid with five-prayer checklist per day, Praying / Fasting tabs | **Build** (Phase U), reuses our Salah log |
| **Zakat** | Calculator with 10 asset categories, local currency | **Build** (Phase U) |
| **99 Names** | Numbered list with meanings | **Build** (Phase U), small |
| **Shahadah** | One screen | **Build** (Phase U), tiny |
| **Journal** | Daily reflection, mood, prayer / fast / sunnah / sadaqah tracking, streaks | **Maybe** (Phase U, last) |
| **Qibla** | Needs location, falls back to promoting Tasbih | We already have Qibla. Match the graceful fallback |
| **Widgets** | Notification widget (prayer times in the shade) | **Build** (Phase 4, our own two widgets) |
| **Quests, Stars, Crescents, top-up, vouchers** | Points currency with a store | **Skip.** We keep streaks, freezes and goals, with no currency or paywall |
| **Premium / ads / account wall** | Log-in wall on Khatam, premium banners | **Skip.** No ads, no accounts, no paywall |
| **Ask AiDeen, Ummah feed, Messages, Qalbox video, Games** | AI chat, social, video | **Skip.** Out of scope and a moderation or privacy burden |
| **Giving, Halal places, Mosques, Hajj** | Donations, location search, Hajj guide | **Later / skip.** Need payment partners or map APIs |

Not opened on purpose: the social feeds (other people's content), donation buttons, anything behind a
login, and the AI chat.

### UI patterns worth adopting
- **Reader:** parchment "Paper" theme next to Dark, text-size slider, List vs Page mode, keep-screen-on.
- **Settings as a bottom sheet** with chips (Display / Text / Audio) instead of a long scrolling page.
- **A goal strip inside the reader** ("Reading goal: 3/5 mins") so progress is visible while you read.
- **Ring strips** for the week, one ring per day, today highlighted.
- **Four primary tabs** (Home, Prayers, Quran, Community). We currently have six items plus More; we should
  consolidate once Prayers exists (see Phase P).

---

## 2. Principles that stay fixed
- **Calm, not manipulative.** Streaks, freezes and goals yes. Currencies, countdown pressure, guilt notifications, feeds no.
- **No accounts, no ads, no paywall.** Everything works offline once content is cached. Data stays on the device.
- **Commercial-safe sources only.** Every Quran text, translation, font and audio file gets a licence check before use,
  and credit lives in the in-app credits screen and `THIRD_PARTY_NOTICES.md`.
- **Never alter the Quran text.** Display exactly what the source provides.
- **Accessible and fast.** WCAG contrast, 44 px targets, reduced motion respected, works on small phones.
- **Tests first, review every slice, small commits.** Same workflow as Phases 0 to 3.

---

## 3. Phase Q: Quran (first, biggest value)

### Q1. Reader rebuild (size L)
- Per-ayah blocks: Arabic, then transliteration, then translation, with an ayah chip menu (copy, bookmark, share text, "mark as where I stopped").
- Display settings sheet: themes (Dark, Paper, Modern), text size slider, List / Page mode (Page deferred if the data source has no page data), keep-screen-on.
- Switches for translation and transliteration, persisted.
- Scripts in this slice: **Uthmani** and **Simple** (both available from our current source).
- **Done when:** a surah reads cleanly at 360 px in each theme, settings survive a reload, and a screen reader reads each ayah as one block.

### Q2. Translations (size L)
- Language-grouped picker with translator names and download size, search, "downloaded" badge.
- Offline cache in IndexedDB per translation; the reader works with no network once a translation is cached.
- Start with a curated list of widely used translations, expand toward the full catalogue as licences are confirmed.
- **Gate:** confirm the licence of each translation and the terms of the data provider (see section 6).
- **Done when:** switching translation is instant offline, and a failed download shows a retry without losing the current text.

### Q3. IndoPak script and Tajweed colours (size M)
- Script option cards with a live preview (like Muslim Pro). Tajweed colour switch with a small legend.
- **Gate:** the IndoPak *font* is cleared (DigitalKhatt, OFL-1.1) but the IndoPak *text* is not. Our current source has no IndoPak
  edition, and the available IndoPak text (Quran Foundation, QUL) has unstated or restricted terms. We must not convert the Uthmani text into IndoPak
  ourselves, because the text may not be altered. Until the text is cleared in writing, ship Uthmani, Simple and Tajweed colours.
- **Done when:** the three scripts render correctly with their diacritics at small sizes and offline.

### Q4. Reading goal and My Progress (size L)
- **Goal:** 5, 10 or 15 minutes a day, each mapped to an ayat range, with the live projection "at this pace you finish in N days".
- **Counting time honestly:** only active reading counts: reader open, screen on, and scrolling or paging within a short window. Pauses stop the clock.
- **Home of progress:** a Quran "My Progress" screen with the ring, a Reading / Khatam switch, a seven-day row and "continue from here".
- **Khatam plan:** pick a duration, get a daily target, see how far ahead or behind you are, with no guilt wording.
- **In-reader strip** showing today's minutes against the goal.
- **Done when:** reading for the goal time fills the ring, the day row updates, the streak engine counts the day, and the numbers survive reload.

### Q5. Quran audio (size L, last, rights are the least clear)
- Reciter choice, play / pause / next, speed, auto-scroll with the ayah, repeat, optional translation audio.
- **Gate:** audio licences differ per reciter, and streaming at runtime beats bundling (same rule we applied to the adhan).
- **Done when:** audio follows the highlighted ayah, survives screen lock on the native app, and respects the repeat setting.

---

## 4. Phase P: Prayer times (size L)
- **Location and times:** ask for location with a clear reason, or let the user pick a city. Calculation method and madhab already exist in settings.
- **Prayers screen:** day strip with a ring per day, a row per prayer with its time and a tick (reuses the Salah log), a "next prayer in 1h 20m" card on Home.
- **Per-prayer notification sheet:** notify on/off, adhan alarm, repeat days, sound, pre-adhan reminder.
- **Navigation:** consolidate to four main tabs (Home, Prayers, Quran, More) with Tasbih and Adhkaar reachable from Home and More.
- **Reliability** of adhan and reminders when the app is closed depends on Phase 4 (native alarms).

## 5. Phase D and Phase U (smaller, can interleave)
- **Phase D: Duas (M).** Hisnul Muslim by chapter, situation / mood search, bookmarks, recents, built on the existing Adhkaar library.
- **Phase U: Utilities (S to M each).** Hijri calendar with Islamic events; 99 Names; Shahadah; Zakat calculator (10 asset categories, local currency, nisab from a gold / silver price the user can edit offline); Tracker with a fasting tab; optional Journal last.

---

## 6. Phase 4: native Android app (starts once Q1 to Q4 are live)

**Why:** the web app cannot ring an alarm or adhan reliably when closed, cannot vibrate precisely on every phone, and cannot offer widgets.

**What this machine already has:** Android SDK (build-tools 37, platform 36), JDK 21 and a test phone, so we can build and run from here.

### 4a. Wrapper (M)
- Add Capacitor Android around the existing build. Keep the web app as the single source of truth.
- Plugins: Haptics (real vibration patterns), Local Notifications (scheduled), Preferences (shared with widgets), Geolocation, Keep Awake, Splash and Status Bar.
- Debug APK installable on the phone; a CI step that builds a signed release bundle.

### 4b. Reliable reminders and adhan (L)
- Schedule exact alarms for reminders and prayer times, rescheduled after reboot and timezone change.
- Android needs a user-granted "alarms and reminders" permission and a notification permission on recent versions, plus battery-optimisation guidance. We design a short, honest permission flow.
- Adhan plays as a notification sound or full audio per prayer, with the per-prayer sheet from Phase P.
- **Done when:** a reminder set for two minutes ahead fires with the app swiped away and the screen off, on the test phone.

### 4c. Widgets (L)
- **2x2 tap-to-count** (one tap adds a bead for the current dhikr, with a safe daily total).
- **4x2 daily dhikr** (today's dhikr, progress ring and next prayer time).
- Optional notification widget with the prayer times (the one Muslim Pro has).
- Needs a little native Kotlin (the web layer cannot draw widgets) sharing data with the app through Preferences.

### 4d. Release (M)
- Play Store listing, privacy policy, data-safety form, screenshots, signed bundle, internal testing track first.
- **Optional later:** on-device voice counting (speech recognition, offline), bead skins, iOS (needs a Mac and a developer account).

---

## 7. Data and licence gates (researched and checked 2026-10-29)

Rule: if a licence is unclear, we ship without it, list it as "not included" in the credits, and move on.
Nothing here is legal advice. Items marked **checked** were confirmed against the primary page by me; the rest come from a second research pass
and still need the primary page read before we rely on them.

### Safe to use now
| Need | Source | Terms | Status |
|---|---|---|---|
| Uthmani and Simple Arabic text | [Tanzil](https://tanzil.net/docs/text_license) | Creative Commons Attribution 3.0. Copy and distribute **verbatim** only; changing it is not allowed. Credit the Tanzil Project, link to tanzil.net, keep the notice in derived files | **Checked.** Bundle offline, show credit and link |
| Tajweed-coloured text | [alquran.cloud](https://alquran.cloud/terms-and-conditions) edition `quran-tajweed` | Same site terms as below: commercial reproduction of the text needs no permission, keep diacritics and orthography | **Checked** (terms). Confirm the edition's own credit line before release |
| IndoPak font | [DigitalKhatt/indopakfont](https://github.com/DigitalKhatt/indopakfont) (font based on the Quraan Al Majeed 13-line IndoPak Mushaf) | Repository declares **OFL-1.1**. OFL allows bundling and commercial use; keep the notice; modified versions may not reuse the font name | **Checked** (repo declares OFL-1.1; I did not read the licence file text). Read `LICENSE` in the release package before shipping |
| Madani / Uthmani web fonts | DigitalKhatt `madinafont`, Amiri | OFL-1.1 | Second pass, not re-checked. Both are standard open fonts |
| Streaming recitation | [Islamic Network CDN](https://alquran.cloud/terms-and-conditions) (current source) | "Copyrights lie with the reciters and they may ask you to remove the content." Cache aggressively at our own edge | **Checked**, but see audio note below |

### Use only with conditions
| Need | Source | Terms | Status |
|---|---|---|---|
| Translations, main catalogue | [QuranEnc](https://quranenc.com/en/home) (80+ languages, XML / CSV / SQLite / API) | Republish **unmodified**, credit publisher and QuranEnc, state the version, keep transcript info, update to the latest version, no inappropriate ads next to the translation | Per page notices. Read its full terms and get written confirmation that long-term offline bundling is covered. Does **not** cover its translation audio |
| Public-domain translations | Pickthall, Yusuf Ali (original edition only) | Verify each edition at its source. Modern revisions are usually copyrighted | Use only editions we can show are public domain |
| QUL / Tarteel resources | [QUL](https://qul.tarteel.ai/resources) (scripts, 219 translations, 131 audio sets) | Code is MIT. Each **resource** has its own licence, and the font page for IndoPak says "we don't have copyright information" | Per resource. Email them for the exact resource IDs before bundling |
| KFGQPC Uthmanic Hafs font | King Fahd Complex | Custom free licence: free use and distribution, but no sale, modification or reverse engineering. Terms are inside the font file | Second pass. Read the embedded licence; fine for an unmodified free app only after that |

### Do not rely on
| Item | Why |
|---|---|
| Tanzil translations and alquran.cloud's third-party translations | Tanzil mirrors say **non-commercial only**. alquran.cloud says non-commercial users may reproduce translations freely and does not grant the same to commercial offline bundling |
| fawazahmed0/quran-api (440+ editions) | The Unlicense covers the repository code, not each translation's text |
| Quran Foundation / Quran.com offline copies | [Developer terms](https://api-docs.quran.foundation/legal/developer-terms/): free and ad-free apps are allowed, but offline copies only through Content Sync (re-sync every 7 days), no prepackaged bundle of text, and audio or translation redistribution needs a separate written licence. Fonts and Mushaf images may be bundled with a developer account and credit |
| everyayah.com and Maqra mirrors for audio | No site-wide licence found; link-back request only; rights sit with reciters |
| Noto Nastaliq Urdu, Awami Nastaliq | OFL, but they are Urdu typefaces, not Quran fonts |

### Audio note
The two readings of the Islamic Network terms differ. The page says "you may bundle them into a commercial product" but also that the reciters keep the
copyright and can ask for removal. The second research pass called the recitations "licensed for free, non-commercial redistribution". I could not
reconcile these from the page alone. So: **stream only, never ship audio inside the app**, credit each reciter, and ask Islamic Network to confirm in writing.

### The launch set (what ships first)
Tanzil Uthmani and Simple text, Tajweed colours, DigitalKhatt and Amiri OFL fonts, verified public-domain translations, QuranEnc translations under its terms,
streamed recitation with clear reciter credit. Everything else stays behind a written permission.

### Who to email (your call; earlier you chose to hold off)
1. **QuranEnc:** does the reuse terms cover offline bundling in a company-branded app, and its translation audio?
2. **Tarteel / QUL:** written clearance for the exact IndoPak text and font resource IDs, and any translation or audio resources we want.
3. **Quran Foundation:** whether a developer account and Content Sync fit an offline-first app; the IndoPak text licence.
4. **Islamic Network:** may a free, ad-free company app stream, and optionally cache, their recitation audio; which reciters and translation audio are cleared.
5. **Individual translators or publishers** for any modern translation we want offline (Saheeh International, The Clear Quran and others).

### What this changes in the plan
- **Q1** is unaffected (Uthmani and Simple from Tanzil text).
- **Q2** uses public-domain translations plus QuranEnc, and drops Tanzil-derived translations from the shipped list.
- **Q3** ships Tajweed colours; IndoPak waits for the text clearance even though the font is ready.
- **Q5** stays last and streamed.

---

## 8. Order and sizing

| # | Slice | Size | Depends on | Delivers |
|---|---|---|---|---|
| 1 | Q1 Reader rebuild | L | none | New reading experience, Uthmani and Simple |
| 2 | Q4 Reading goal and My Progress | L | Q1 | The daily Quran habit loop |
| 3 | Q2 Translations | L | Q1, licence gate | Global reach |
| 4 | Q3 IndoPak and Tajweed | M | licence gate | Script choice |
| 5 | Phase 4a and 4b | M + L | none (can start in parallel) | Native app, reliable reminders |
| 6 | Phase P Prayers | L | 4b for alarms | Prayer times and adhan |
| 7 | Phase 4c Widgets | L | 4a | Home-screen presence |
| 8 | Phase D Duas, Phase U utilities | M + several S | none | Breadth |
| 9 | Q5 Audio | L | licence gate, 4a for lock-screen | Listening |
| 10 | 4d Release | M | the rest | Play Store |

Sizes: S is a day or two of work, M about a week, L one to two weeks. These are rough and the licence gates can move them.

---

## 9. Decisions

| # | Question | Answer |
|---|---|---|
| 1 | Order of slices | **Approved** as in section 8 |
| 2 | Data source for translations and IndoPak | **Research done** (section 7). Needs your call on the QuranEnc-first approach and on whether to open a Quran Foundation developer account for IndoPak |
| 3 | Platform | **Android first**, iOS later |
| 4 | App name and package id | **Open.** Shortlist below |
| 5 | Skip list: no accounts, points, AI chat, social feed, donations | **Confirmed** |

### Name shortlist
I cannot query the Play Store directly, so "no exact match found" means my web searches did not surface one. Search the Play Console
and run a trademark check before registering anything.

| Name | Meaning | Check |
|---|---|---|
| **Dhikra** (ذكرى) | Remembrance, reminder | No exact Play listing found. Close to many "Dhikr" apps, which helps discovery but is less distinctive |
| **Itqan** (إتقان) | Doing a thing with excellence, mastery | No exact match found. Suits a habit and Quran-progress app |
| **Tazkiyah** (تزكية) | Purification of the soul | No exact match found. Harder to spell and search |
| Wird / Wirdi / Werd | A daily portion of Quran or dhikr | **Avoid.** Several existing apps, including at least one on Google Play with a dhikr counter |
| Sakina / Sakinah | Tranquillity | **Avoid.** Many existing apps across stores |

Suggested package id pattern: `com.cognitrixlabs.<name>` in lowercase, for example `com.cognitrixlabs.dhikra`.
