import React from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import type { SalahLog } from '../types';
import { FARD_PRAYERS, canShowMonth, dayLabel, monthCells, shiftMonth, type YearMonth } from '../salah';

interface SalahCalendarProps {
  logs: readonly SalahLog[];
  today: string;
  /** The oldest day that can be opened. */
  earliest: string;
  selected: string;
  month: YearMonth;
  onMonthChange: (month: YearMonth) => void;
  onSelect: (date: string) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TITLE = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

const cellStyle = (count: number, future: boolean): string => {
  if (future) return 'bg-slate-900 border-slate-800/50 text-slate-700';
  if (count === FARD_PRAYERS.length) return 'bg-emerald-500/30 border-emerald-500/50 text-emerald-200';
  if (count >= 3) return 'bg-brand-500/30 border-brand-500/40 text-brand-300';
  if (count >= 1) return 'bg-brand-500/15 border-brand-500/25 text-brand-400';
  return 'bg-slate-800/60 border-slate-700 text-slate-400';
};

/** A month of days; tapping one opens it above. Months before the install date and after today are out of reach. */
export default function SalahCalendar({ logs, today, earliest, selected, month, onMonthChange, onSelect }: SalahCalendarProps) {
  const { blanks, days } = React.useMemo(() => monthCells(month.year, month.month, today, logs), [month, today, logs]);
  const previous = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const canPrevious = canShowMonth(previous, earliest, today);
  const canNext = canShowMonth(next, earliest, today);
  const title = TITLE.format(new Date(month.year, month.month, 1));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          aria-label="Previous month"
          disabled={!canPrevious}
          onClick={() => onMonthChange(previous)}
          className="min-h-11 min-w-11 flex items-center justify-center rounded-xl cursor-pointer disabled:opacity-30 disabled:cursor-default"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <p className="text-sm font-black" style={{ color: 'var(--color-text-primary)' }} aria-live="polite">{title}</p>
        <button
          type="button"
          aria-label="Next month"
          disabled={!canNext}
          onClick={() => onMonthChange(next)}
          className="min-h-11 min-w-11 flex items-center justify-center rounded-xl cursor-pointer disabled:opacity-30 disabled:cursor-default"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1" aria-hidden="true">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-xs font-black text-slate-400">{d.slice(0, 1)}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: blanks }, (_, i) => <div key={`blank-${i}`} />)}
        {days.map(({ date, day, count, future }) => {
          const isSelected = date === selected;
          const unreachable = future || date < earliest;
          return (
            <button
              key={date}
              type="button"
              disabled={unreachable}
              aria-label={dayLabel(date, count)}
              aria-pressed={isSelected}
              aria-current={date === today ? 'date' : undefined}
              onClick={() => onSelect(date)}
              className={`min-h-11 rounded-lg border flex flex-col items-center justify-center text-xs font-black leading-none cursor-pointer disabled:cursor-default ${cellStyle(count, unreachable)} ${
                isSelected ? 'ring-2 ring-brand-500' : date === today ? 'ring-1 ring-brand-500/60' : ''
              }`}
            >
              <span>{day}</span>
              {!unreachable && count === FARD_PRAYERS.length && <Check className="w-3 h-3 mt-0.5 stroke-[3]" aria-hidden="true" />}
              {!unreachable && count > 0 && count < FARD_PRAYERS.length && <span className="mt-0.5 text-[10px] font-bold opacity-80">{count}/5</span>}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-slate-400 text-center mt-2">Tap a day to add or fix its prayers.</p>
    </div>
  );
}
