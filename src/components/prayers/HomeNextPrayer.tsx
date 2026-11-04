import React from 'react';
import { ChevronRight, MapPin, MoonStar } from 'lucide-react';
import { readPrayerSettings } from '../../domain';
import { eventWindow, formatClock, formatCountdown, pickNext, todayKeyIn } from '../../prayerTimes';
import { readPrayerPlace } from '../../places';
import type { Madhab } from '../../types';

interface HomeNextPrayerProps {
  /** The Asr rule the rest of the app uses, so Home and Prayers always show the same time. */
  madhab: Madhab;
  onOpen: () => void;
  getNow?: () => Date;
}

const realClock = (): Date => new Date();
const NAMES = { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha', sunrise: 'Sunrise' } as const;

/** The next prayer and the time left, on Home. It only reads the saved place: it never asks for GPS on its own. */
export default function HomeNextPrayer({ madhab, onOpen, getNow = realClock }: HomeNextPrayerProps) {
  const [place] = React.useState(() => readPrayerPlace());
  const [settings] = React.useState(() => readPrayerSettings(madhab));
  const [now, setNow] = React.useState<Date>(() => getNow());

  // Once a minute is enough for a countdown shown in minutes.
  React.useEffect(() => {
    const interval = setInterval(() => setNow(getNow()), 30_000);
    return () => clearInterval(interval);
  }, [getNow]);

  const options = React.useMemo(() => ({ method: settings.calculationMethod, madhab }), [settings.calculationMethod, madhab]);
  const dateKey = place ? todayKeyIn(place.timeZone, now) : '';
  // The three-day window changes once a day; which prayer is next is looked up again on every tick.
  const span = React.useMemo(() => (place ? eventWindow(place, options, dateKey) : []), [place, options, dateKey]);
  const next = span.length > 0 ? pickNext(span, now, true) : null;

  const shell = 'w-full min-h-11 rounded-2xl p-4 flex items-center gap-4 cursor-pointer text-left';
  const style = { background: 'var(--color-brand-dim)', border: '1px solid var(--color-brand-border)' } as const;

  if (!place || !next) {
    return (
      <button type="button" onClick={onOpen} aria-label="Set up prayer times" className={shell} style={style}>
        <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--color-bg-raised)', color: 'var(--color-text-brand)' }}>
          <MapPin className="w-5 h-5" aria-hidden="true" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-black" style={{ color: 'var(--color-text-primary)' }}>Set up prayer times</span>
          <span className="block text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Choose your location for accurate times</span>
        </span>
        <ChevronRight className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} aria-hidden="true" />
      </button>
    );
  }

  const name = NAMES[next.event];
  const remaining = formatCountdown(next.time.getTime() - now.getTime());
  const time = formatClock(next.time, place.timeZone, true);
  return (
    <button type="button" onClick={onOpen} aria-label={`Next prayer: ${name} at ${time}, in ${remaining}`} className={shell} style={style}>
      <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--color-bg-raised)', color: 'var(--color-text-brand)' }}>
        <MoonStar className="w-5 h-5" aria-hidden="true" />
      </span>
      <span className="flex-1 min-w-0" aria-hidden="true">
        <span className="block text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Next prayer</span>
        <span className="flex items-baseline gap-2">
          <span className="text-lg font-black" style={{ color: 'var(--color-text-primary)' }}>{name}</span>
          <span className="text-sm font-black tabular-nums" style={{ color: 'var(--color-text-brand)' }}>{time}</span>
        </span>
        <span className="block text-xs" style={{ color: 'var(--color-text-secondary)' }}>in {remaining}</span>
      </span>
      <ChevronRight className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} aria-hidden="true" />
    </button>
  );
}
