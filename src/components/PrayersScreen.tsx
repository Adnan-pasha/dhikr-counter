import React from 'react';
import { ChevronDown, Compass, MapPin, Settings2, VolumeX } from 'lucide-react';
import type { AzanSound, Madhab, PrayerAzanId, PrayerSettings, SalahLog, SalahName } from '../types';
import { SALAH_META } from '../types';
import { readPrayerSettings, writePrayerSettings } from '../domain';
import {
  PRAYER_EVENTS, computePrayerDay, deviceTimeZone, differsFromPhoneClock, eventWindow, formatClock, formatCountdown, pickCurrent, pickNext, todayKeyIn,
  type PrayerEvent, type PrayerLocation,
} from '../prayerTimes';
import { addDays, browserStorage, earliestDate, prayerCount, readInstallDate } from '../salah';
import { usePrayerPlace } from '../usePrayerPlace';
import { hijriLabel } from '../hijri';
import { hasAdhanPlayed, markAdhanPlayed } from '../adhanMemory';
import { useAzanPlayer } from '../useAzanPlayer';
import NextPrayerCard from './prayers/NextPrayerCard';
import PrayerDayStrip, { type StripDay } from './prayers/PrayerDayStrip';
import PrayerRow from './prayers/PrayerRow';
import LocationSheet from './prayers/LocationSheet';
import PrayerSettingsSheet from './prayers/PrayerSettingsSheet';
import NativeAlarmsCard from './prayers/NativeAlarmsCard';
import type { AdhanPlayRequest } from '../nativeAlarms';
import type { NativeAlarms } from '../useNativeAlarms';

interface PrayersScreenProps {
  madhab: Madhab;
  onMadhabChange: (madhab: Madhab) => void;
  salahLogs: readonly SalahLog[];
  /** Logs or un-logs a prayer on a day. Shared with the Salah screen, so both always agree. */
  onTogglePrayer: (date: string, prayer: SalahName) => void;
  onOpenQibla: () => void;
  /** Today as the Salah log counts it (the phone's date). */
  today: string;
  /** The clock, replaceable so tests can set the time. */
  getNow?: () => Date;
  /** The phone's alarms, shown as a card with their permissions. Left out in a browser. */
  alarms?: NativeAlarms;
  /**
   * Whether this screen plays the adhan itself at prayer time. It does, unless the phone's own alarm is set to ring
   * (and a tap on that alert plays the full adhan), so it never plays over it.
   */
  autoPlayAdhan?: boolean;
  /** Play one prayer's adhan now (a tapped notification). A new nonce is a new request. */
  playRequest?: AdhanPlayRequest | null;
}

const realClock = (): Date => new Date();

const ROWS: Record<PrayerEvent, { label: string; arabic: string; icon: 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha' }> = {
  fajr: { label: SALAH_META.fajr.label, arabic: SALAH_META.fajr.arabicName, icon: 'fajr' },
  sunrise: { label: 'Sunrise', arabic: 'الشروق', icon: 'sunrise' },
  dhuhr: { label: SALAH_META.dhuhr.label, arabic: SALAH_META.dhuhr.arabicName, icon: 'dhuhr' },
  asr: { label: SALAH_META.asr.label, arabic: SALAH_META.asr.arabicName, icon: 'asr' },
  maghrib: { label: SALAH_META.maghrib.label, arabic: SALAH_META.maghrib.arabicName, icon: 'maghrib' },
  isha: { label: SALAH_META.isha.label, arabic: SALAH_META.isha.arabicName, icon: 'isha' },
};

const isPrayerId = (event: PrayerEvent): event is PrayerAzanId & SalahName => event !== 'sunrise';

/** How long after its time a prayer can still start the adhan, so a slow wake-up does not miss it. */
const ADHAN_WINDOW_MS = 120_000;

const weekday = (date: string): string => new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'narrow' });
const dayOfMonth = (date: string): number => Number(date.slice(8, 10));

/** Prayer times for the day, a tick for each prayer, and a switch for each adhan. */
export default function PrayersScreen({ madhab, onMadhabChange, salahLogs, onTogglePrayer, onOpenQibla, today, getNow = realClock, alarms, autoPlayAdhan, playRequest }: PrayersScreenProps) {
  const autoPlay = autoPlayAdhan ?? true;
  const { place, gpsLoading, gpsError, requestGps, selectCity } = usePrayerPlace();
  const [sheet, setSheet] = React.useState<'location' | 'settings' | null>(null);
  const [selected, setSelected] = React.useState(today);
  const [adhanBanner, setAdhanBanner] = React.useState<string | null>(null);

  // One clock for the whole screen.
  const [now, setNow] = React.useState<Date>(() => getNow());
  React.useEffect(() => {
    const interval = setInterval(() => setNow(getNow()), 1000);
    return () => clearInterval(interval);
  }, [getNow]);

  // ── Settings: remembered on the phone, with the Asr rule shared with the rest of the app ──
  const [settings, setSettings] = React.useState<PrayerSettings>(() => readPrayerSettings(madhab));
  const player = useAzanPlayer(settings.azanSound);
  // Which recording the settings sheet is previewing, so its button can offer to stop it.
  const [previewing, setPreviewing] = React.useState<string | null>(null);
  const preview = (kind: 'fajr' | AzanSound) => {
    if (previewing === kind && player.playing) {
      player.stop();
      setPreviewing(null);
      return;
    }
    setPreviewing(kind);
    if (kind === 'fajr') player.play('fajr');
    else player.play(undefined, kind);
  };
  const latestSettings = React.useRef(settings);
  const save = (next: PrayerSettings) => {
    const written = writePrayerSettings(next);
    latestSettings.current = written;
    setSettings(written);
  };
  const update = (diff: Partial<PrayerSettings>) => {
    save({ ...latestSettings.current, ...diff });
    if (diff.madhab && diff.madhab !== madhab) onMadhabChange(diff.madhab);
  };
  const seenMadhab = React.useRef<Madhab | null>(null);
  React.useEffect(() => {
    if (seenMadhab.current === madhab) return;
    seenMadhab.current = madhab;
    if (latestSettings.current.madhab !== madhab) save({ ...latestSettings.current, madhab });
  }, [madhab]);

  const calcOptions = React.useMemo(
    () => ({ method: settings.calculationMethod, madhab: settings.madhab }),
    [settings.calculationMethod, settings.madhab],
  );
  const where: PrayerLocation | null = React.useMemo(
    () => (place ? { lat: place.lat, lng: place.lng, timeZone: place.timeZone } : null),
    [place?.lat, place?.lng, place?.timeZone],
  );

  // ── Times ──
  const placeToday = where ? todayKeyIn(where.timeZone, now) : today;
  // Yesterday, today and tomorrow, so Isha after midnight and the roll-over to the next Fajr are both right.
  const span = React.useMemo(() => (where ? eventWindow(where, calcOptions, placeToday) : []), [where, calcOptions, placeToday]);
  const day = React.useMemo(() => (where ? computePrayerDay(where, selected, calcOptions) : null), [where, calcOptions, selected]);
  const current = span.length > 0 ? pickCurrent(span, now) : null;
  const upcoming = span.length > 0 ? pickNext(span, now, true) : null;

  // Someone looking at today when midnight passes moves on to the new today.
  const shownToday = React.useRef(today);
  React.useEffect(() => {
    const previous = shownToday.current;
    shownToday.current = today;
    if (previous !== today) setSelected((chosen) => (chosen === previous ? today : chosen));
  }, [today]);

  // ── Salah log ──
  const byDate = React.useMemo(() => new Map(salahLogs.map((l) => [l.date, l])), [salahLogs]);
  const earliest = React.useMemo(() => earliestDate(salahLogs, readInstallDate(browserStorage(), today), today), [salahLogs, today]);
  const stripDays: StripDay[] = React.useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const date = addDays(today, i - 6);
      return { date, count: prayerCount(byDate.get(date)), weekday: weekday(date), dayOfMonth: dayOfMonth(date) };
    }),
    [today, byDate],
  );
  const selectedLog = byDate.get(selected);

  // ── Adhan: each prayer sounds once, remembered by day and prayer (also across leaving this tab and coming back) ──
  const adhanOn = settings.azanEnabled;
  const play = player.play;
  React.useEffect(() => {
    if (!autoPlay) return undefined;
    const watch = () => {
      const nowMs = getNow().getTime();
      for (const moment of span) {
        if (!isPrayerId(moment.event) || !adhanOn[moment.event]) continue;
        const elapsed = nowMs - moment.time.getTime();
        if (elapsed < 0 || elapsed >= ADHAN_WINDOW_MS) continue;
        const key = `${moment.dateKey}-${moment.event}`;
        if (hasAdhanPlayed(key)) continue;
        markAdhanPlayed(key);
        setAdhanBanner(ROWS[moment.event].label);
        play(moment.event);
      }
    };
    watch();
    const interval = setInterval(watch, 5000);
    return () => clearInterval(interval);
  }, [span, adhanOn, getNow, play, autoPlay]);

  // A tapped prayer notification asks for that prayer's adhan, once per request.
  const handledRequest = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (!playRequest || handledRequest.current === playRequest.nonce) return;
    handledRequest.current = playRequest.nonce;
    setAdhanBanner(ROWS[playRequest.prayer].label);
    play(playRequest.prayer);
  }, [playRequest, play]);

  const closeSheet = React.useCallback(() => setSheet(null), []);
  // "Use my location" in the sheet closes it when the fix arrives, but not when it fails (the error shows there).
  const placeBeforeFix = React.useRef<typeof place>(null);
  const awaitingFix = React.useRef(false);
  React.useEffect(() => {
    if (awaitingFix.current && place && place !== placeBeforeFix.current && place.source === 'gps') {
      awaitingFix.current = false;
      closeSheet();
    }
  }, [place, closeSheet]);
  const stopAdhan = () => { player.stop(); setAdhanBanner(null); };

  // ── Text ──
  const placeClock = where && differsFromPhoneClock(now, where.timeZone, deviceTimeZone())
    ? formatClock(now, where.timeZone, true)
    : undefined;
  const heading = new Date(`${selected}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const hijri = where && day ? hijriLabel(day.dhuhr, where.timeZone) : '';

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="header-row">
          <h1 className="screen-title">Prayers</h1>
          <div className="flex gap-1">
            <button type="button" aria-label="Qibla compass" onClick={onOpenQibla} className="min-h-11 min-w-11 flex items-center justify-center rounded-xl cursor-pointer" style={{ color: 'var(--color-text-secondary)' }}>
              <Compass className="w-5 h-5" aria-hidden="true" />
            </button>
            <button type="button" aria-label="Prayer settings" onClick={() => setSheet('settings')} className="min-h-11 min-w-11 flex items-center justify-center rounded-xl cursor-pointer" style={{ color: 'var(--color-text-secondary)' }}>
              <Settings2 className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>
        <button
          type="button"
          aria-label={place ? `Location: ${place.label ?? 'My location'}. Change` : 'Choose your location'}
          onClick={() => setSheet('location')}
          className="mt-1 min-h-11 flex max-w-full items-center gap-1.5 rounded-xl px-3 text-sm font-bold cursor-pointer"
          style={{ background: 'var(--color-bg-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
        >
          <MapPin className="w-4 h-4 shrink-0" style={{ color: 'var(--color-text-brand)' }} aria-hidden="true" />
          <span className="truncate">{place ? (place.label ?? 'My location') : 'Choose your location'}</span>
          <ChevronDown className="w-4 h-4 shrink-0" aria-hidden="true" />
        </button>
        {place && gpsError && (
          <p role="status" className="mt-2 text-xs font-bold" style={{ color: 'var(--color-text-brand)' }}>
            Could not refresh your location, so these times are for {place.label ?? 'your last location'}.
          </p>
        )}
        {place && (
          <p className="caption mt-2">
            {heading}{hijri ? ` · ${hijri}` : ''}
          </p>
        )}
      </div>

      <div className="scroll-area space-y-5">
        {alarms && <NativeAlarmsCard alarms={alarms} />}

        {adhanBanner && (
          <div role="status" aria-label="Adhan" className="flex items-center gap-2 rounded-2xl border p-3" style={{ background: 'var(--color-brand-dim)', borderColor: 'var(--color-brand-border)' }}>
            <p className="min-w-0 flex-1 text-sm font-black" style={{ color: 'var(--color-text-primary)' }}>{adhanBanner} prayer time</p>
            <button type="button" onClick={stopAdhan} className="min-h-11 flex items-center gap-1.5 rounded-xl px-3 text-xs font-black cursor-pointer" style={{ color: 'var(--color-text-brand)' }}>
              <VolumeX className="w-4 h-4" aria-hidden="true" />
              {player.playing ? 'Stop adhan' : 'Dismiss'}
            </button>
          </div>
        )}
        {player.error && <p role="alert" className="text-xs font-bold" style={{ color: 'var(--color-text-brand)' }}>{player.error}</p>}

        {!place && (
          <div id="prayers_needs_location" role="status" className="flex flex-col items-center gap-3 rounded-3xl border p-6 text-center" style={{ background: 'var(--color-bg-raised)', borderColor: 'var(--color-border)' }}>
            <MapPin className="w-8 h-8" style={{ color: 'var(--color-text-brand)' }} aria-hidden="true" />
            <h2 className="font-display text-lg font-black" style={{ color: 'var(--color-text-primary)' }}>Where are you?</h2>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Prayer times depend on where you are. Your location stays on this phone.
            </p>
            <button type="button" onClick={requestGps} disabled={gpsLoading} className="tap-target w-full rounded-xl px-4 text-sm font-black cursor-pointer disabled:opacity-60 text-on-brand" style={{ background: 'var(--color-brand-500)' }}>
              {gpsLoading ? 'Finding you...' : 'Use my location'}
            </button>
            <button type="button" onClick={() => setSheet('location')} className="tap-target w-full rounded-xl px-4 text-sm font-bold cursor-pointer" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
              Choose a city
            </button>
            {gpsError && <p className="text-xs font-bold" style={{ color: 'var(--color-text-brand)' }}>{gpsError}</p>}
          </div>
        )}

        {place && where && day && upcoming && current && (
          <>
            <NextPrayerCard
              name={ROWS[upcoming.event].label}
              time={formatClock(upcoming.time, where.timeZone, true)}
              countdown={formatCountdown(upcoming.time.getTime() - now.getTime())}
              placeLabel={place.label ?? 'My location'}
              placeClock={placeClock}
            />

            <PrayerDayStrip days={stripDays} selected={selected} today={today} earliest={earliest} onSelect={setSelected} />

            <section aria-label="Prayer times" role="list" className="space-y-2">
              {PRAYER_EVENTS.map((event) => {
                const meta = ROWS[event];
                const prayer = isPrayerId(event);
                return (
                  <PrayerRow
                    key={event}
                    id={event}
                    label={meta.label}
                    arabic={meta.arabic}
                    icon={meta.icon}
                    time={formatClock(day[event], where.timeZone, true)}
                    isCurrent={current.event === event && current.time.getTime() === day[event].getTime()}
                    isPrayer={prayer}
                    done={prayer && selectedLog?.prayers[event] === true}
                    adhanOn={prayer && adhanOn[event]}
                    onToggleDone={() => { if (prayer) onTogglePrayer(selected, event); }}
                    onToggleAdhan={() => {
                      if (!prayer) return;
                      const turningOn = !adhanOn[event];
                      if (turningOn) {
                        // Switching it on a minute after its time is a choice for tomorrow, not a cue to sound it now.
                        for (const m of span) if (m.event === event) markAdhanPlayed(`${m.dateKey}-${m.event}`);
                      }
                      update({ azanEnabled: { ...adhanOn, [event]: turningOn } });
                    }}
                  />
                );
              })}
            </section>
            <p className="pb-2 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Times are worked out on your phone. The adhan sounds while this screen is open; reminders with the app closed are coming. Tick a prayer when you have prayed it.
            </p>
          </>
        )}
      </div>

      <LocationSheet
        open={sheet === 'location'}
        onClose={closeSheet}
        currentLabel={place?.label ?? null}
        onSelectCity={(city) => { selectCity(city); closeSheet(); }}
        onUseGps={() => { awaitingFix.current = true; placeBeforeFix.current = place; requestGps(); }}
        gpsLoading={gpsLoading}
        gpsError={gpsError}
      />
      <PrayerSettingsSheet
        open={sheet === 'settings'}
        onClose={closeSheet}
        method={settings.calculationMethod}
        madhab={settings.madhab}
        onMethodChange={(calculationMethod) => update({ calculationMethod })}
        onMadhabChange={(next) => update({ madhab: next })}
        voice={settings.azanSound}
        onVoiceChange={(azanSound) => update({ azanSound })}
        playing={player.playing ? previewing : null}
        onPreview={preview}
      />
    </div>
  );
}
