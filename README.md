# Dhikr Counter

A mobile-first React + Vite dhikr counter app with a library, streak/history tracking, reminders, and Qibla tools.

## Tech Stack
- React 19 + TypeScript
- Vite 6
- Tailwind CSS 4
- Framer Motion (`motion`)

## Run locally

**Prerequisites:** Node.js 20+ and npm.

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Build for production:
   ```bash
   npm run build
   ```
4. Type-check:
   ```bash
   npm run lint
   ```
5. Run tests:
   ```bash
   node tests/regressions.test.mjs
   npx tsx tests/domain.test.mjs
   ```

## Notes
- App data (dhikrs, counts, history, preferences, reminders) is stored in browser `localStorage`.
- No external API key is required for the core local app flow.

## Telemetry
- Lightweight client telemetry events are buffered in browser localStorage under `tasbih_telemetry_events` for troubleshooting in non-production builds.
