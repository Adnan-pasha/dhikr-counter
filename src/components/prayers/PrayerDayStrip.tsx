import React from 'react';
import { FARD_PRAYERS, dayLabel } from '../../salah';

export interface StripDay {
  date: string;
  count: number;
  /** Narrow weekday, such as "M". */
  weekday: string;
  dayOfMonth: number;
}

interface PrayerDayStripProps {
  days: readonly StripDay[];
  selected: string;
  today: string;
  /** The oldest day that can be opened. */
  earliest: string;
  onSelect: (date: string) => void;
}

const SIZE = 40;
const RADIUS = 16;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** A progress ring: how many of the five prayers were done that day. */
function Ring({ count, selected }: { count: number; selected: boolean }) {
  const complete = count === FARD_PRAYERS.length;
  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true" className="shrink-0">
      <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" strokeWidth="3" stroke="var(--color-border)" />
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        stroke={complete ? 'var(--color-emerald-400, #34d399)' : 'var(--color-brand-500)'}
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE * (1 - count / FARD_PRAYERS.length)}
        transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize="13" fontWeight="800" fill={selected ? 'var(--color-text-brand)' : 'var(--color-text-secondary)'}>
        {count}
      </text>
    </svg>
  );
}

/** The last seven days, each with a ring. Tapping one shows its prayer times and its ticks. */
export default function PrayerDayStrip({ days, selected, today, earliest, onSelect }: PrayerDayStripProps) {
  return (
    <div id="prayer_day_strip" className="grid grid-cols-7 gap-1" role="group" aria-label="Last seven days">
      {days.map((day) => {
        const isSelected = day.date === selected;
        return (
          <button
            key={day.date}
            type="button"
            aria-label={dayLabel(day.date, day.count)}
            aria-pressed={isSelected}
            aria-current={day.date === today ? 'date' : undefined}
            disabled={day.date < earliest}
            onClick={() => onSelect(day.date)}
            className={`min-h-11 flex flex-col items-center gap-0.5 rounded-xl py-1 cursor-pointer disabled:opacity-40 disabled:cursor-default ${isSelected ? 'ring-2 ring-brand-500' : ''}`}
          >
            <span className="text-xs font-bold" style={{ color: day.date === today ? 'var(--color-text-brand)' : 'var(--color-text-muted)' }} aria-hidden="true">
              {day.weekday}
            </span>
            <Ring count={day.count} selected={isSelected} />
            <span className="text-[11px] font-bold tabular-nums" style={{ color: 'var(--color-text-muted)' }} aria-hidden="true">
              {day.dayOfMonth}
            </span>
          </button>
        );
      })}
    </div>
  );
}
