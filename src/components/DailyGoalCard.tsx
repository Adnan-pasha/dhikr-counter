import React from 'react';
import { Flame, Pause, Play } from 'lucide-react';
import { motion } from 'motion/react';
import { streakMessage, progressLabel, MAX_PAUSE_DAYS, type DailyProgress, type StreakInfo } from '../habits';

interface DailyGoalCardProps {
  progress: DailyProgress;
  streakInfo: StreakInfo;
  onStartPause: (days: number) => void;
  onEndPause: () => void;
}

const SIZE = 84;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const PAUSE_CHOICES = [3, 7, MAX_PAUSE_DAYS] as const;

/** Today's goal ring beside the streak, with a calm way to put the streak on hold. */
export default function DailyGoalCard({ progress, streakInfo, onStartPause, onEndPause }: DailyGoalCardProps) {
  const [choosing, setChoosing] = React.useState(false);
  // The buttons swap in place, so focus is moved on purpose to the control that replaces the one pressed.
  const pending = React.useRef<'choices' | 'pause' | 'resume' | null>(null);
  const pauseRef = React.useRef<HTMLButtonElement>(null);
  const resumeRef = React.useRef<HTMLButtonElement>(null);
  const firstChoiceRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    const target = { choices: firstChoiceRef, pause: pauseRef, resume: resumeRef }[pending.current ?? 'pause'];
    if (pending.current) target.current?.focus();
    pending.current = null;
  }, [choosing, streakInfo.paused]);
  const percent = Math.round(progress.ratio * 100);

  return (
    <section
      id="daily_goal_card"
      className="rounded-3xl p-4"
      style={{ background: 'var(--color-bg-raised)', border: '1px solid var(--color-border)' }}
      aria-label="Today's goal and streak"
    >
      <div className="flex items-center gap-4">
        <div
          className="relative shrink-0"
          style={{ width: SIZE, height: SIZE }}
          role="progressbar"
          aria-label="Daily goal"
          aria-valuemin={0}
          aria-valuemax={progress.goal}
          aria-valuenow={Math.min(progress.beads, progress.goal)}
          aria-valuetext={`${progress.beads} of ${progress.goal} beads today`}
        >
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90" aria-hidden="true">
            <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--color-border)" strokeWidth={STROKE} />
            <motion.circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="var(--color-text-brand)"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              initial={false}
              animate={{ strokeDashoffset: CIRCUMFERENCE * (1 - progress.ratio) }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display font-black text-lg leading-none tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
              {progress.done ? '✓' : `${percent}%`}
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="section-label">Today</p>
          <p className="font-display font-black text-xl leading-tight tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
            {progressLabel(progress)}
          </p>
          <p className="text-xs mt-1 flex items-start gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
            <Flame className="w-3.5 h-3.5 shrink-0 mt-px" style={{ color: streakInfo.paused ? 'var(--color-text-muted)' : '#FB923C' }} aria-hidden="true" />
            <span id="streak_message" role="status">{streakMessage(streakInfo)}</span>
          </p>
        </div>
      </div>

      {streakInfo.paused ? (
        <button
          id="btn_resume_streak"
          ref={resumeRef}
          type="button"
          onClick={() => { pending.current = 'pause'; onEndPause(); }}
          className="tap-target mt-3 w-full rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
          style={{ background: 'var(--color-bg-overlay)', color: 'var(--color-text-brand)', border: '1px solid var(--color-border)' }}
        >
          <Play className="w-3.5 h-3.5" aria-hidden="true" /> Resume streak
        </button>
      ) : choosing ? (
        <div className="mt-3" role="group" aria-label="Pause streak for">
          <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>Pause for travel, illness or a rest. Your streak waits.</p>
          <div className="flex gap-2">
            {PAUSE_CHOICES.map((days, index) => (
              <button
                key={days}
                ref={index === 0 ? firstChoiceRef : undefined}
                type="button"
                onClick={() => { pending.current = 'resume'; onStartPause(days); setChoosing(false); }}
                className="tap-target flex-1 rounded-2xl text-xs font-black cursor-pointer"
                style={{ background: 'var(--color-bg-overlay)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
              >
                {days} days
              </button>
            ))}
            <button
              type="button"
              onClick={() => { pending.current = 'pause'; setChoosing(false); }}
              className="tap-target rounded-2xl px-3 text-xs font-bold cursor-pointer"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        streakInfo.streak > 0 && (
          <button
            id="btn_pause_streak"
            ref={pauseRef}
            type="button"
            onClick={() => { pending.current = 'choices'; setChoosing(true); }}
            className="tap-target mt-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <Pause className="w-3.5 h-3.5" aria-hidden="true" /> Pause streak
          </button>
        )
      )}
    </section>
  );
}
