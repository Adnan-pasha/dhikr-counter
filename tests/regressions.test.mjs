import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("bottom nav uses corrected Settings label", () => {
  const nav = readFileSync("src/components/BottomNav.tsx", "utf8");
  assert.match(nav, /Settings/);
  assert.match(nav, /BottomNav/);
});

test("library card applies overflow guards for long Arabic text", () => {
  const file = readFileSync("src/components/DhikrLibrary.tsx", "utf8");
  assert.match(file, /overflow-hidden/);
  assert.match(file, /min-w-0/);
  assert.match(file, /truncate/);
});

test("README no longer points to Gemini API setup", () => {
  const readme = readFileSync("README.md", "utf8");
  assert.doesNotMatch(readme, /GEMINI_API_KEY/);
  assert.match(readme, /Dhikr Counter/);
});

test("main mounts App inside AppErrorBoundary", () => {
  const main = readFileSync("src/main.tsx", "utf8");
  assert.match(main, /<AppErrorBoundary>/);
});

test("counter keyboard shortcut ignores typing contexts", () => {
  const file = readFileSync("src/components/CounterScreen.tsx", "utf8");
  assert.match(file, /isTypingContext/);
  assert.match(file, /target\.tagName === 'INPUT'/);
  assert.match(file, /target\.tagName === 'TEXTAREA'/);
  assert.match(file, /target\.isContentEditable/);
});


test('main wires service worker update UX handlers', () => {
  const main = readFileSync('src/main.tsx', 'utf8');
  assert.match(main, /updatefound/);
  assert.match(main, /SKIP_WAITING/);
  assert.match(main, /controllerchange/);
});

test('app uses extracted reminder and connectivity hooks', () => {
  const app = readFileSync('src/App.tsx', 'utf8');
  assert.match(app, /useReminderScheduler/);
  assert.match(app, /useConnectivityStatus/);
  assert.match(app, /usePersistentAppState/);
  assert.match(app, /useDhikrActions/);
  assert.match(app, /useCounterFlow/);
  assert.match(app, /useHistoryActions/);
});


test('service worker handles SKIP_WAITING message', () => {
  const sw = readFileSync('public/sw.js', 'utf8');
  assert.match(sw, /addEventListener\('message'/);
  assert.match(sw, /SKIP_WAITING/);
  assert.match(sw, /self\.skipWaiting\(\)/);
});


test('telemetry is wired for SW and reminders', () => {
  const main = readFileSync('src/main.tsx', 'utf8');
  const hooks = readFileSync('src/hooks.ts', 'utf8');
  const eb = readFileSync('src/components/AppErrorBoundary.tsx', 'utf8');
  assert.match(main, /trackEvent\('sw_update_prompt_shown'/);
  assert.match(main, /trackEvent\('sw_registration_failed'/);
  assert.match(hooks, /trackEvent\('reminder_triggered'/);
  assert.match(eb, /trackEvent\('app_error_boundary_catch'/);
});

test('ReminderBanner is extracted into its own component', () => {
  const app = readFileSync('src/App.tsx', 'utf8');
  const banner = readFileSync('src/components/ReminderBanner.tsx', 'utf8');
  assert.match(app, /ReminderBanner/);
  assert.doesNotMatch(app, /Gentle Remembrance Alert/);
  assert.match(banner, /Gentle Remembrance Alert/);
  assert.match(banner, /onDismiss/);
  assert.match(banner, /onStartChanting/);
});

test('ConfirmModal is extracted into its own component', () => {
  const app = readFileSync('src/App.tsx', 'utf8');
  const modal = readFileSync('src/components/ConfirmModal.tsx', 'utf8');
  assert.match(app, /ConfirmModal/);
  assert.doesNotMatch(app, /AlertTriangle/);
  assert.match(modal, /AlertTriangle/);
  assert.match(modal, /onCancel/);
});

test('SW update uses in-app banner instead of window.confirm', () => {
  const main = readFileSync('src/main.tsx', 'utf8');
  assert.doesNotMatch(main, /window\.confirm/);
  assert.match(main, /sw-update-banner/);
  assert.match(main, /sw-update-confirm/);
  assert.match(main, /sw-update-dismiss/);
});


test('first-time onboarding is persisted and requests notification permission', () => {
  const app = readFileSync('src/App.tsx', 'utf8');
  const onboarding = readFileSync('src/components/OnboardingFlow.tsx', 'utf8');
  assert.match(app, /tasbih_onboarding_completed/);
  assert.match(app, /<OnboardingFlow/);
  assert.match(onboarding, /Notification\.requestPermission/);
  assert.match(onboarding, /Choose your madhab/);
});
