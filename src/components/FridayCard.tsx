import React from 'react';
import { BookOpen, Check, Heart } from 'lucide-react';
import type { FridayChecklist } from '../friday';

interface FridayCardProps {
  checklist: FridayChecklist;
  onOpenKahf: () => void;
  onToggleKahf: () => void;
  onStartSalawat: () => void;
}

const rowStyle = { background: 'var(--color-bg-overlay)', border: '1px solid var(--color-border)' } as const;

/** Friday's two sunnah habits: Surah Al-Kahf and abundant salawat. Renders only on Fridays. */
export default function FridayCard({ checklist, onOpenKahf, onToggleKahf, onStartSalawat }: FridayCardProps) {
  if (!checklist.isFriday) return null;
  const kahf = checklist.items.find((i) => i.id === 'kahf');
  const salawat = checklist.items.find((i) => i.id === 'salawat');

  return (
    <section
      id="friday_card"
      className="rounded-3xl p-4 space-y-3"
      style={{ background: 'var(--color-brand-dim)', border: '1px solid var(--color-brand-border)' }}
      aria-label="Friday"
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="section-label" style={{ color: 'var(--color-text-brand)' }}>Friday</p>
          <h2 className="font-display font-black text-lg leading-tight" style={{ color: 'var(--color-text-primary)' }}>Jumu&rsquo;ah Mubarak</h2>
        </div>
        <span className="text-xs font-bold shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
          {checklist.doneCount} of {checklist.items.length}
        </span>
      </div>

      {kahf && (
        <div className="rounded-2xl p-3 flex items-center gap-3" style={rowStyle}>
          <BookOpen className="w-5 h-5 shrink-0" aria-hidden="true" style={{ color: 'var(--color-text-brand)' }} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black" style={{ color: 'var(--color-text-primary)' }}>{kahf.label}</p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Light until the next Friday</p>
          </div>
          <button
            type="button"
            onClick={onOpenKahf}
            aria-label="Open Al-Kahf"
            className="tap-target rounded-xl px-3 text-xs font-black cursor-pointer text-on-brand"
            style={{ background: 'var(--color-brand-500)' }}
          >
            Open
          </button>
          <button
            type="button"
            onClick={onToggleKahf}
            aria-pressed={kahf.done}
            aria-label={kahf.done ? 'Al-Kahf marked as read. Tap to undo' : 'Mark Al-Kahf as read'}
            className="tap-target w-11 rounded-xl flex items-center justify-center cursor-pointer"
            style={{ background: kahf.done ? 'var(--color-brand-500)' : 'transparent', border: '1px solid var(--color-border)', color: kahf.done ? 'var(--color-bg-deep)' : 'var(--color-text-muted)' }}
          >
            <Check className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {salawat && (
        <div className="rounded-2xl p-3 flex items-center gap-3" style={rowStyle}>
          <Heart className="w-5 h-5 shrink-0" aria-hidden="true" style={{ color: 'var(--color-text-brand)' }} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black" style={{ color: 'var(--color-text-primary)' }}>{salawat.label}</p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{salawat.done ? 'Salawat done today' : 'The best day to send it'}</p>
          </div>
          <button
            type="button"
            onClick={onStartSalawat}
            aria-label="Start salawat"
            className="tap-target rounded-xl px-3 text-xs font-black cursor-pointer text-on-brand"
            style={{ background: 'var(--color-brand-500)' }}
          >
            {salawat.done ? 'More' : 'Start'}
          </button>
        </div>
      )}
    </section>
  );
}
