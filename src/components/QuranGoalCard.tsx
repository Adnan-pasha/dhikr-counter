import React from 'react';
import { BookOpen, ChevronRight } from 'lucide-react';
import { goalRatio, minutesOn, type QuranProgress } from '../quran/progress';

interface QuranGoalCardProps {
  progress: QuranProgress;
  today: string;
  /** Opens the Quran progress screen so a goal can be chosen. */
  onOpenProgress: () => void;
  /** Opens the reader where the user stopped. */
  onContinue: () => void;
}

const SIZE = 52;
const STROKE = 6;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** A quiet Home card: today's Quran reading against the goal, with a way back into the reader. */
export default function QuranGoalCard({ progress, today, onOpenProgress, onContinue }: QuranGoalCardProps) {
  const goal = progress.goalMinutes;
  const minutes = minutesOn(progress, today);
  const ratio = goalRatio(progress, today);
  const surround = { background: 'var(--color-bg-raised)', border: '1px solid var(--color-border)' } as const;

  if (!goal) {
    return (
      <button
        id="quran_goal_card"
        type="button"
        onClick={onOpenProgress}
        className="min-h-11 flex w-full items-center gap-3 rounded-3xl p-4 text-left cursor-pointer"
        style={surround}
      >
        <BookOpen className="h-6 w-6 shrink-0" aria-hidden="true" style={{ color: 'var(--color-text-brand)' }} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black" style={{ color: 'var(--color-text-primary)' }}>Set a reading goal</span>
          <span className="block text-xs" style={{ color: 'var(--color-text-muted)' }}>A few minutes of Quran a day</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" style={{ color: 'var(--color-text-muted)' }} />
      </button>
    );
  }

  return (
    <section id="quran_goal_card" className="flex items-center gap-3 rounded-3xl p-4" style={surround} aria-label="Quran reading today">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }} aria-hidden="true">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--color-border)" strokeWidth={STROKE} />
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--color-text-brand)" strokeWidth={STROKE}
            strokeLinecap="round" strokeDasharray={CIRCUMFERENCE} strokeDashoffset={CIRCUMFERENCE * (1 - ratio)}
          />
        </svg>
        <BookOpen className="absolute inset-0 m-auto h-5 w-5" style={{ color: 'var(--color-text-brand)' }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Quran today</p>
        <p className="font-display text-lg font-black tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{minutes} / {goal} min</p>
      </div>
      <button
        type="button"
        onClick={onContinue}
        aria-label="Continue reading the Quran"
        className="tap-target rounded-2xl px-4 text-xs font-black cursor-pointer text-on-brand"
        style={{ background: 'var(--color-brand-500)' }}
      >
        Continue
      </button>
    </section>
  );
}
