import React from 'react';
import { Bell, BellOff, Check } from 'lucide-react';
import { AppIcon, type IconKey } from '../../icons';

interface PrayerRowProps {
  /** Lower case id: fajr, sunrise, dhuhr, asr, maghrib or isha. */
  id: string;
  label: string;
  arabic: string;
  icon: IconKey;
  time: string;
  /** This is the prayer whose time it is now. */
  isCurrent: boolean;
  /** Sunrise ends Fajr but is not a prayer, so it has no tick and no adhan. */
  isPrayer: boolean;
  done: boolean;
  adhanOn: boolean;
  onToggleDone: () => void;
  onToggleAdhan: () => void;
}

/** One line of the day: the prayer, its time, a tick to log it and a switch for its adhan. */
export default function PrayerRow({ id, label, arabic, icon, time, isCurrent, isPrayer, done, adhanOn, onToggleDone, onToggleAdhan }: PrayerRowProps) {
  return (
    <div
      id={`prayer_row_${id}`}
      role="listitem"
      aria-current={isCurrent ? 'time' : undefined}
      className="flex items-center gap-2 rounded-2xl border pl-3 pr-1"
      style={{
        background: isCurrent || done ? 'var(--color-brand-dim)' : 'var(--color-bg-surface)',
        borderColor: isCurrent ? 'var(--color-brand-500)' : done ? 'var(--color-brand-border)' : 'var(--color-border)',
      }}
    >
      <span className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center bg-brand-500/10 text-brand-400" aria-hidden="true">
        <AppIcon name={icon} className="w-5 h-5" />
      </span>

      {/* Two short lines, so the name never shares a line with the time on a narrow phone. */}
      <div className="min-w-0 flex-1 py-2 flex flex-col">
        <span data-prayer-name className="text-sm font-black leading-tight truncate" style={{ color: isCurrent ? 'var(--color-text-brand)' : 'var(--color-text-primary)' }}>{label}</span>
        {isCurrent ? (
          <span data-prayer-sub className="text-xs font-bold" style={{ color: 'var(--color-text-brand)' }}>Now</span>
        ) : (
          <span data-prayer-sub className="text-xs font-arabic truncate" style={{ color: 'var(--color-text-muted)' }} aria-hidden="true">{arabic}</span>
        )}
      </div>

      <p data-prayer-time className="text-sm font-black tabular-nums shrink-0 whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>{time}</p>

      {isPrayer ? (
        <>
          <button
            type="button"
            role="switch"
            aria-checked={adhanOn}
            aria-label={`Adhan for ${label}`}
            onClick={onToggleAdhan}
            className="min-h-11 min-w-11 flex items-center justify-center rounded-xl cursor-pointer"
            style={{ color: adhanOn ? 'var(--color-text-brand)' : 'var(--color-text-muted)' }}
          >
            {adhanOn ? <Bell className="w-5 h-5" aria-hidden="true" /> : <BellOff className="w-5 h-5" aria-hidden="true" />}
          </button>
          <button
            type="button"
            role="checkbox"
            aria-checked={done}
            aria-label={`${label} prayed`}
            onClick={onToggleDone}
            className="min-h-11 min-w-11 flex items-center justify-center rounded-xl cursor-pointer"
          >
            <span
              className="w-7 h-7 rounded-full border-2 flex items-center justify-center"
              style={done ? { background: 'var(--color-brand-500)', borderColor: 'var(--color-brand-500)' } : { borderColor: 'var(--color-text-muted)' }}
            >
              {done && <Check className="w-4 h-4 text-on-brand stroke-[3]" aria-hidden="true" />}
            </span>
          </button>
        </>
      ) : (
        <span className="min-w-[88px]" aria-hidden="true" />
      )}
    </div>
  );
}
