# Muneeb: design and experience audit

Audit date 2026-11-11, on `main` at `78f7007` (tsc clean, build OK, 1132 of 1132 tests passing).
No code was changed for this audit.

## How this was done

The production web build was opened in Chrome at 360x740 (phone size, touch, location set to Mumbai)
and every screen was walked and screenshotted: first run, Home (empty and with data), Tasbih (idle,
mid-round, round complete, focus mode), Adhkaar (list, fazail open, add form), Quran (surah list,
surah reader, Pages reader, Go-to sheet, reader settings, My Progress), Prayers (list, settings
sheet, location sheet, a ticked prayer), More sheet, Routines, Salah (list, week, calendar, after a
tick), Qibla, Stats (all four tabs), Settings (all sections, reminder form), light mode on most
screens, and each colour theme on Home. Findings marked "code" were confirmed in the source.

**Not judged, and why:**

- Motion and haptics were judged from the code and still frames, not felt on a phone.
- The native Android build was not run, so the alarm card, the permission flow and the splash screen
  are not covered.
- The per-prayer adhan sheet, a routine mid-run and the ayah menu were not captured.
- TalkBack was not re-tested (it was audited in PR #45).

## Verdict

The foundations are better than most apps in this category: it is honest, private, offline, and the
counter and Pages reader are genuinely pleasant. But it does not yet feel like one crafted product.
It feels like a tasbih counter that grew nine more screens. Three things hold it back, in order:

1. **Trust.** A handful of visible mistakes (dates that disagree, a bead total that doubles, the old
   app name, leftover placeholder text) would each cost a reviewer's confidence in the prayer times.
2. **Shape.** Home is a menu, not a day. Two screens track the same prayers. Ten destinations compete
   for a busy person's two minutes.
3. **Voice.** Calm, plain wording in the newer screens sits beside gamified, machine-sounding wording
   in the older ones ("Spiritual Rank", "New Auto-Tasbih Duty", "Beads Chanted").

Fix those and the app is ready to carry a signature feature. Adding a signature feature first would
put a spotlight on the rough parts.

---

## Tier 0: mistakes that break trust (fix before any polish)

These are defects, not taste. Each is small. Together they are the highest-impact work in this file.

| # | What a user sees | Where | Cause |
|---|---|---|---|
| 0.1 | **Three different Hijri dates at the same moment**: Home says 30 Jumada al-Awwal, Salah says 29 Jumada al-Awwal, Prayers says 1 Jumada al-Thani | Home, Salah, Prayers headers | Three implementations (code): `src/hijri.ts` is the good one; `HomeScreen.tsx` and `SalahTracker.tsx` each carry their own approximation |
| 0.2 | **Today's beads double after finishing a round.** 33 taps shows "66 / 100 beads" on Home and "66 beads chanted" in Stats, while the Home "Total" card and the Stats calendar say 33 | Home ring, Stats levels | Code: `dailyProgress` and the Stats total add the saved round and the still-showing counter value (`habits.ts:167`, `App.tsx:677`) |
| 0.3 | **The app calls itself three names.** First run shows "Dhikr", Home's title is "Dhikr Counter", Settings says "while Dhikr is open". The app is Muneeb | Onboarding, Home, Settings | Old strings |
| 0.4 | **Placeholder text shipped**: "TASBIH COMPANION HUB. Designed and engineered in high-fidelity sandbox context" | Settings footer | Leftover scaffold |
| 0.5 | **A desktop test tool is on the phone's Qibla screen**: "Align Simulator", "Auto-Align", a dial slider, and "Live dragging is simulated for desktop". On a phone, "auto-align" on a compass reads as fake | Qibla | Dev aid never hidden on touch devices |
| 0.6 | **Prayer rows collide at 360px**: "NOW03:37 PM"; Maghrib's Arabic name runs into its time | Prayers | Row has no room for name + Arabic + badge + time + bell + tick |
| 0.7 | **Home's header says "ASR TIME" from the clock**, not from the real prayer times shown two cards below. It can disagree with the Next prayer card | Home header | Time-of-day guess predates the prayer-times engine |
| 0.8 | **The third stat card is cut off** at the right edge | Home header | Row overflows at 360px |
| 0.9 | **Colour themes do almost nothing.** Emerald, Rose Desert and Tahajjud Blue render the same green Home. The "Rose Desert" swatch is green | Settings, all screens | Theme only changes a shell background class (code) |
| 0.10 | **Light mode opens a dark Quran reader** under a white bottom bar | Quran reader | Reader has its own theme, defaulting to Dark regardless of app mode |
| 0.11 | Reminder list truncates its own titles ("FAJR MORNING R...") and wraps times onto two lines ("05:15 / AM") | Settings | Fixed-width layout |
| 0.12 | Custom dhikr form: the count shortcuts (33, 99, 100) run off the right edge | Adhkaar | Row overflows |
| 0.13 | "Surah 1 1:1" flashes before the surah name loads | Quran, My Progress | Name comes from the network list, not the built-in table |
| 0.14 | Grammar: "1 days", "1 days of remembrance!" | Home, Stats | No singular form |

---

## Tier 1: shape of the experience

### 1.1 Home is a menu, not a day (highest-impact design issue)

What a busy adult wants on opening: *what is next, and what is left today*. What they get:

- A fixed header that takes the top third of the screen on every scroll position: a clock (the phone
  already has one), the title, two dates, and three stat cards. Two of the three are vanity numbers
  (streak, all-time total), and they sit above the next prayer.
- Then seven sections: next prayer, bead ring, reading goal, quick tasbih, ayah of the day, routines,
  and an "Explore" grid of six buttons that repeats the bottom bar, plus a Qibla card.
- Nothing on Home shows today's five prayers or lets one be ticked.
- Nothing adapts to the time of day. The Morning routine is listed first at 6 pm.

What would feel crafted: one calm "today" surface. Next prayer with a live countdown at the top,
today's five prayers as five tappable dots, then one suggested action for this moment (morning
adhkaar after Fajr, after-salah dhikr just after a prayer time, evening adhkaar after Asr, the
Quran goal if unread), then the day's small tally. Everything else moves below or away.

### 1.2 Two screens do the same job

**Prayers** (bottom bar) and **Salah** (in More) both list the five prayers with a tick. They have
different layouts, different week strips, and different Hijri dates. The best moment in the app,
"Fajr logged. Barakallahu feek. Continue with your after-salah dhikr?", appears on Salah, which is
the one fewer people will open; a tick on Prayers did not show it. Merge them: Prayers keeps times,
ticks and the after-prayer offer; the month calendar and backfill become a "History" view inside it.

### 1.3 Too many doors

Six bottom-bar items (five tabs and More), five more in the More sheet, and the Explore grid again
on Home. Adhkaar, Routines and Tasbih are three doors into one activity (remembering Allah with a
count). A busy person should not have to learn the difference between an adhkaar, a routine and a
tasbih to do their morning dhikr. Target: four tabs (Today, Prayers, Quran, Dhikr) plus a small
settings entry. Qibla lives inside Prayers (the compass icon is already there), Stats inside Today.

### 1.4 Taps for the daily routine

| Daily action | Now | Should be |
|---|---|---|
| See the next prayer and time left | 0 (once location is set) | 0, and on the home screen without opening the app |
| Tick a prayer | 2 (Prayers, tick) | 1 from Home |
| After-prayer dhikr | 4 (More, Routines, After Salah, Begin), or scroll Home and tap Begin | 1, offered at the right moment |
| Morning or evening adhkaar | Scroll Home, Begin | 1, shown first at the right time of day |
| One round of tasbih | 1 (Tasbih), then tap | Good. Keep |
| Continue the Quran | 2 to 3 (Quran, find place) | 1 ("Continue, Al-Kahf 18:10") |
| Find the Qibla | 2 (More, Qibla) | 2 is fine |

### 1.5 First run asks the wrong questions

- Step 1 is a decorative illustration that says nothing specific. Step 2 asks for a madhab before
  any value has been shown. Step 3 asks for a bead goal. Step 4 asks for notifications.
- **Location is never asked**, so the first Home shows "Set up prayer times" instead of prayer
  times. Location is the one input that makes the app useful in the first ten seconds.
- The madhab cards default to Shafi'i with no hint from the user's region, and the notification
  page promises "prayer reminders" that then need separate set-up on the Prayers screen.
- Better: one welcome line, then "Where are you?" (use my location, or pick a city), then show
  today's real prayer times on the next page with the Asr choice inline, then alerts. Goal-setting
  can wait until the first round is finished.

### 1.6 Stats gamifies worship

"Spiritual Rank", "App rank level 1 of 5", "Initiate Seeker (Mubtadi)", locked "Achievement
badges", "Next level: 300 beads". The roadmap's own principle is "calm, not manipulative". Ranking
someone's remembrance is the part of the app most likely to put off the main audience, and to be
criticised in a review. Keep the honest history (calendar, week chart, streak with pauses). Drop
ranks and levels, or reword badges as quiet milestones with no locks.

The **Hadiths** tab pairs each hadith with unattributed commentary under the label "Advocacy &
Benefit" ("the heart is spiritually non-functional, regardless of physical health"). Text placed
beside a hadith must be sourced or removed. It also does not belong under Stats.

---

## Tier 2: craft

### 2.1 Copy: two voices

The newer screens are plain and warm: "Start today. One bead is enough." "Your location stays on
this phone." "Pick the one your local mosque follows." That is the app's voice. The older screens
are not:

| Now | Problem | Direction |
|---|---|---|
| "New Auto-Tasbih Duty", "Duty label / title", "Preset target praise" | Machine-sounding, and "duty" is heavy | "New reminder", "Name", "Dhikr" |
| "Total Beads Chanted", "beads chanted" | Dhikr is not chanted | "Total count" |
| "Complete your first prayer to populate logs!" | Wrong noun, developer wording | "Your finished rounds will appear here." |
| "Daily streaks, interactive maps, level progression & authentic advice" | There are no maps; reads like a feature list | Remove screen subtitles altogether |
| "Play Goal Complete Chime Trial", "Physical Haptic Vibration", "Auto-Advance Sequence: switch to next prayer in sequence" | Jargon; "prayer" is the wrong word for a dhikr | "Preview chime", "Vibration", "Move to the next dhikr when a round finishes" |
| "Danger Settings: Reset All Preferences & Data" | Shouting | "Erase everything on this phone" |
| "Rotate to orient indicator vertically top" | Not a sentence | "Turn until the Kaaba marker is at the top." |
| "Never miss a meaningful moment." | Marketing voice, and a promise notifications cannot keep | "Hear the adhan on time, even with the app closed." |
| Prayers footer: "reminders with the app closed are coming" | Out of date for the Android app (check what the native build shows) | State what is true on each platform |
| "More Features", "Explore", "Positioned Location", "Schedules & Reminders" | Filler headings | Fewer headings; name things by what they are |

Spelling is also mixed: "Fazail", "Adhkaar", "Aya", "Salah" and "Prayers" for one thing. Pick one
transliteration style and one word per idea.

### 2.2 Typography

- Space Grotesk for titles and big numbers, Inter for text (often at its heaviest weight for card
  headings), and monospace for numbers on Stats and Qibla. Mono numerals on Stats look like a
  terminal, and the very heavy card headings fight the calm tone. Use one text family at two
  weights, one display family, and tabular figures for times and counts.
- Space Grotesk's "1" has a wide flag and looks like a different glyph beside other digits ("1 days",
  "100 beads"). For an app whose main content is numbers and times, choose the numeral style on
  purpose.
- Uppercase, letter-spaced labels are everywhere (STREAK, ADHKAAR, TOTAL, TODAY, QUICK TASBIH, AYAH
  OF THE DAY, NEXT PRAYER). When everything is a label, nothing is. Keep them for true section
  headings only.
- Text below 12px exists in 20 places (8px, 9px, 10px), mostly in onboarding, the prayer rows, the
  Salah calendar, Qibla and Adhkaar. The roadmap sets a higher bar than this.
- Arabic is the best typography in the app. The dhikr on the counter and the Pages reader are
  beautiful. Give Arabic more room elsewhere (Adhkaar cards squeeze it into a corner at a small size).

### 2.3 Colour and surfaces

- Dark mode is one green at one brightness on near-black, for every state: active, done, link,
  icon, label, border, progress. Nothing has priority because everything is the accent. Reserve the
  accent for the one primary action and for "done"; let the rest be neutral.
- Every block is a rounded, bordered card, often a card inside a card (Stats, Settings, Routines,
  Adhkaar). Borders at this density read as clutter. Group with space and type; keep cards for
  things that are tappable as a whole.
- Light mode is clean but generic: grey cards on grey. It loses the warmth of the dark theme. A
  warm paper tone (the reader already has a "Paper" theme) would give light mode a character of
  its own.
- Qibla in dark mode uses hard white outlines on its panels, unlike any other screen.
- Buttons come in at least five shapes: full pill, rounded rectangle, squircle icon button, text
  link, outlined box. Settle on two.

### 2.4 Density and layout

- **Adhkaar cards** carry up to five badges (Authentic, Daily, Short, Active, Done Today), three
  lines of text, two metadata items and five buttons, the last of which is cut off by the screen
  edge. One card nearly fills the screen; 48 of them is a long scroll. A row should be: name,
  Arabic, count, one tap to start. The rest belongs behind the row.
- **Surah reader** repeats a chip ("Aya 1:1") and a "Juz 1 · Page 1" line above every single ayah.
  The ayah number is already in the end-of-ayah marker. Remove both; show Juz and page once, in the
  header, as the reader scrolls.
- **Fixed headers are tall** on Home (a third of the screen), Stats (a quote card plus tabs stay
  pinned, leaving half the screen for content), Adhkaar and Quran. On a 740px screen the content
  window is often under 55 percent.
- **Settings** is one long page: madhab, appearance, theme, audio, behaviour, reminders, danger,
  credits. Prayer settings already live on the Prayers screen, so the madhab block here is a second
  place to change the same thing. Group into four short pages or sheets.
- **Routines** lists truncate both the source ("Sahih al-...") and the Arabic.

### 2.5 Motion (from code and stills)

- Good: reduced motion is respected globally; the bottom-bar pill glides on a spring; the counter
  ring and the "Masha'Allah! Round complete" moment are right in spirit.
- First run has three elements floating or pulsing forever. Looping decoration is the opposite of
  calm, and it runs the GPU on the first screen.
- The round-complete moment is the emotional peak of the app and is currently a ring colour change
  and a line of text. It deserves a designed second: the bead string settling, a soft pulse, a
  distinct haptic, then stillness.
- Ticking a prayer, finishing a routine, reaching the daily goal and finishing the Quran goal should
  share one small, recognisable "done" motion. Today each is different or absent.
- Sheets (More, Prayer settings, Go to, Reader settings) do not look draggable-to-dismiss and the
  More sheet leaves a blurred, dead bottom bar under it.

### 2.6 Haptics (from code)

- Vibration fires only on counter taps, through the browser `navigator.vibrate` call with 14 to 60 ms
  pulses. On Android this is a motor buzz, not the crisp tick that modern phones can give. The
  Capacitor Haptics plugin (planned in the roadmap, not installed) gives real impact and selection
  feedback.
- No haptic on: ticking a prayer, the Qibla needle reaching the Kaaba (the one place a haptic is
  functionally useful, because the user is looking at the room, not the phone), tab changes,
  toggles, or page turns.
- For eyes-free tasbih, the pattern matters more than the strength: a light tick per bead, a
  different feel at 33, 66 and 99, and a clear finish. The three kinds exist (tap, milestone,
  complete) but differ only by a few milliseconds.

### 2.7 Empty states

- Good: "Start today. One bead is enough."; the suggested surahs strip on the Quran list; the
  reading-goal card.
- Weak: a brand-new user sees zeros everywhere. Home shows three "0" cards and a "0%" ring; Salah
  shows three "0" cards and "Yesterday: 0/5. Fill in what you prayed?" on day one, which reads as a
  reproach before the user has done anything; Stats shows an empty chart, "BEST: -", and a locked
  badge wall. Hide tallies until there is something to tally, and never show yesterday's zero on
  the first day.
- "Set a reading goal" on Home opens My Progress, where the user must find and tap "Set reading
  goal" again. It should open the goal choice directly.

---

## Screen by screen

**First run.** Looks polished at a glance; says little; never asks for location; wrong name; 8 to
10px text in the cards. See 1.5.

**Home.** See 1.1. Also: "Quick Tasbih" has both an "Open" link and a play button that go to the
same place; "Ayah of the day" is a nice moment buried fourth; the Qibla card sits below a grid that
already had six shortcuts.

**Tasbih.** The best screen. Big Arabic, a clear count, the bead string, tap anywhere. Issues: the
"Pending" pill is status jargon; three controls in the header and three at the bottom is a lot for
a screen whose job is one gesture; focus mode removes very little (the bottom bar stays), so it
does not earn its name. "33×" at bottom-left is an unlabelled control. After a round there is no
next step offered for a standalone dhikr (another round, the next of the three tasbihat).

**Adhkaar.** The content is valuable and sourced. The presentation buries it. See 2.4. Three
unlabelled icon buttons (heart, star, plus) sit above the search; filter chips scroll off-screen
with no hint of how many there are.

**Quran: list.** Clear. The row text wraps awkwardly ("The Opening · 7 ayahs · / Meccan"); three
tabs plus a settings button plus search plus suggestions before the first surah.

**Quran: surah reader.** See 2.4 for the repeated chips. Two wide buttons ("Script Uthmani",
"English: Pickthall") take a permanent row for choices made once. Pickthall is the default English
translation; its 1930 wording ("the Beneficent") is hard going for a busy reader, so if a clearer
licensed translation is available, default to that.

**Quran: Pages.** Excellent. The closest thing in the app to a printed mushaf. Small things: the
hint "Swipe right for the next page" should disappear after the first swipe; the bottom bar and
page bar together take 150px from the page, so this screen is the best case for a true immersive
mode.

**Quran: My Progress.** Calm and clear once a goal is set. Empty state is fine.

**Prayers.** The right idea and the strongest candidate for the app's centre. Fix the row
collisions (0.6). The location bar takes a full row to say "My location" (it should say the place
name, small). The week strip shows seven "0" rings on day one. The explainer paragraph at the
bottom is doing the job that a clearer layout should do.

**Salah.** Duplicate of Prayers. See 1.2. Subtitles under each prayer ("Pre-dawn", "Midday") where
the time should be.

**Qibla.** The compass itself is handsome. Everything around it is noise: two header buttons, a
location bar, an instruction pill, a "positioned location" block that repeats the location bar, two
readouts that show the same number, then the simulator. On a phone this screen should be the
compass, the place name, and one line of guidance, with a haptic when aligned.

**Stats.** See 1.6. Pinned quote card plus pinned tabs leave little room. Mono numerals. The week
chart with no data is an empty box.

**Settings.** See 2.4 and 2.1. The reminder form is the least finished part of the app (hard white
outline, custom time steppers, "duty" wording).

**More sheet.** Fine, but its existence is a symptom of 1.3.

---

## What is already good (protect it)

- The principles: no accounts, ads or trackers; offline; the Quran text verbatim. These are the
  story an award jury would tell about this app. The Settings line "Your counts, history and
  settings stay on this device" is the best sentence in the product.
- Honest wording about limits: "Times can differ by a minute or two between apps and mosques."
- The counter's feel, the bead string, left-handed layout, streak pauses and freezes with no guilt.
- The Pages reader and the Arabic typography.
- The after-prayer offer on Salah, and the suggested daily surahs strip.
- Accessibility groundwork: named controls, reduced motion, large-text handling in the bottom bar.

## Suggested order of work

1. **Tier 0 in one or two small PRs** (dates, bead total, name, placeholder text, Qibla simulator,
   row collisions, clipped rows). Roughly two to three days. Nothing else should ship before this.
2. **Copy pass** (2.1) in one PR: strings only, low risk, large effect on how finished it feels.
3. **Shape** (1.1 to 1.3): the "today" Home and the Prayers and Salah merge. This is the main
   design work and should be planned as a signature piece, not as clean-up.
4. **Craft** (2.2 to 2.7) alongside whatever is built next, screen by screen.
