import React from 'react';
import { MapPin } from 'lucide-react';

interface NextPrayerCardProps {
  name: string;
  /** When it starts, already formatted in the place's own clock. */
  time: string;
  /** Time left, such as "1h 20m". */
  countdown: string;
  placeLabel: string;
  /** The place's own clock, shown only when it differs from the phone's. */
  placeClock?: string;
}

/** The one thing most people open the Prayers tab for: what is next, and how long until it. */
export default function NextPrayerCard({ name, time, countdown, placeLabel, placeClock }: NextPrayerCardProps) {
  return (
    <section
      id="next_prayer_card"
      aria-label="Next prayer"
      className="rounded-3xl p-5 border"
      style={{ background: 'var(--color-brand-dim)', borderColor: 'var(--color-brand-border)' }}
    >
      <p className="section-label">Next prayer</p>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-3xl font-black" style={{ color: 'var(--color-text-primary)' }}>{name}</h2>
        <p className="text-2xl font-black tabular-nums" style={{ color: 'var(--color-text-brand)' }}>{time}</p>
      </div>
      <p className="mt-1 text-sm font-bold" style={{ color: 'var(--color-text-secondary)' }}>in {countdown}</p>
      <p className="mt-3 flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{placeLabel}{placeClock ? `, ${placeClock} there` : ''}</span>
      </p>
    </section>
  );
}
