# Releasing Muneeb to Google Play

Package `com.cognitrixlabs.muneeb`. Everything here is done by hand once; nothing in the repository holds a secret.

## 1. Create the upload key (once)

Run this once, anywhere outside the repository, and **back the file up** (a password manager or an encrypted drive). If it is lost, Play must be asked to reset the upload key, which takes days.

```bash
keytool -genkeypair -v -keystore muneeb-upload.jks -alias muneeb-upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

Then create `android/keystore.properties` (it is git-ignored, with `*.jks` and `*.keystore`):

```properties
storeFile=C:/path/outside/the/repo/muneeb-upload.jks
storePassword=...
keyAlias=muneeb-upload
keyPassword=...
```

Without that file the release build is unsigned and debug builds are unaffected, so contributors need nothing.

## 2. Enrol in Play App Signing

In the Play Console, create the app and let Google manage the app signing key (Play App Signing, the default for new apps). The key above is only the upload key: Google re-signs what you upload, and a lost upload key can be replaced.

## 3. Build the bundle

```bash
npm test
npx vite build
npx cap sync android
cd android && ./gradlew bundleRelease
```

The bundle is `android/app/build/outputs/bundle/release/app-release.aab`. Raise `versionCode` in `android/app/build.gradle` for every upload (and `versionName` when users should see a new version).

## 4. Declarations the Play Console asks for

**Exact alarm permission (`SCHEDULE_EXACT_ALARM`).** Declare that prayer-time alerts and user-set reminders must ring at the exact minute, with the app closed. The app asks the user to allow "Alarms and reminders" from the Prayer alerts card, and falls back to inexact alarms (a few minutes late) if they decline. Do **not** add `USE_EXACT_ALARM`: it is meant for alarm-clock and calendar apps and risks rejection.

**Other permissions, and why:**

| Permission | Why |
| --- | --- |
| `POST_NOTIFICATIONS` | Prayer alerts and reminders (Android 13 and later) |
| `RECEIVE_BOOT_COMPLETED` | Restores scheduled alerts after the phone restarts |
| `WAKE_LOCK` | Lets the alert sound play when the phone is asleep |
| `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION` | Prayer times and the Qibla direction for where the user is. Foreground only, never in the background, and never sent anywhere |
| `VIBRATE` | Counter haptics |
| `INTERNET` | Loading Quran translations on demand |

**Data safety form.** The app's own code collects and shares no user data: counts, history, reminders and the chosen place stay in the app's private storage on the device, and Android Auto Backup is switched off. Answer "no data collected" and "no data shared", and say so in the privacy policy. The one network detail to disclose in the policy: Quran text and translations are fetched on demand from `api.alquran.cloud` and `quranenc.com`, so those services can see the phone's IP address and which surah was asked for.

**Privacy policy.** A public URL is required because the app uses location. It should state: what is stored on the device, that nothing is uploaded, that location is used on the device only and not stored beyond the chosen place, the two Quran services above, that there are no accounts, ads or trackers, and how to erase everything (Settings, erase all data, or uninstalling).

## 5. Before every release

- `npm test` passes and `npx tsc --noEmit` is clean.
- Install the release build on a real phone and check: a test alert rings with the app closed, an alert survives a restart, the Prayers screen finds the location, and TalkBack reads the main screens.
- Keep `docs/ROADMAP.md` in step with what shipped.
