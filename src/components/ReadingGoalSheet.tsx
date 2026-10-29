import React from 'react';
import { X } from 'lucide-react';
import { useModalDialog } from './useModalDialog';
import { GOAL_CHOICES, ayatPerDay, daysToKhatam } from '../quran/progress';

interface ReadingGoalSheetProps {
  open: boolean;
  /** The goal in use now, or null when none is set. */
  current: number | null;
  onClose: () => void;
  onSave: (minutes: number) => void;
}

const DEFAULT_CHOICE = GOAL_CHOICES[0];

/** Pick a daily reading goal, with what it means in ayat and in time to finish the Quran. */
export default function ReadingGoalSheet({ open, current, onClose, onSave }: ReadingGoalSheetProps) {
  const [choice, setChoice] = React.useState<number>(current ?? DEFAULT_CHOICE);
  const { dialogRef, initialFocusRef, onKeyDown } = useModalDialog(open, onClose);

  React.useEffect(() => {
    if (open) setChoice(current ?? DEFAULT_CHOICE);
  }, [open, current]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.55)' }} aria-hidden="true" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Reading goal"
        onKeyDown={onKeyDown}
        className="relative rounded-t-3xl p-5 space-y-4"
        style={{ background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', borderTop: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-black">Quran reading goal</h2>
          <button
            ref={initialFocusRef}
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="tap-target flex w-11 items-center justify-center rounded-xl cursor-pointer"
            style={{ background: 'var(--color-bg-raised)', border: '1px solid var(--color-border)' }}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-2" role="group" aria-label="Minutes a day">
          {GOAL_CHOICES.map((minutes) => (
            <button
              key={minutes}
              type="button"
              aria-pressed={choice === minutes}
              onClick={() => setChoice(minutes)}
              className="min-h-11 flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left cursor-pointer"
              style={{
                background: 'var(--color-bg-raised)',
                border: `2px solid ${choice === minutes ? 'var(--color-text-brand)' : 'var(--color-border)'}`,
              }}
            >
              <span className="text-sm font-black">{minutes} minutes</span>
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>about {ayatPerDay(minutes)} ayat a day</span>
            </button>
          ))}
        </div>

        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          At this pace you would finish the Quran in about {daysToKhatam(choice)} days. Reading speed varies, so treat it as a guide.
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="tap-target flex-1 rounded-2xl text-sm font-bold cursor-pointer"
            style={{ background: 'var(--color-bg-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { onSave(choice); onClose(); }}
            className="tap-target flex-1 rounded-2xl text-sm font-black cursor-pointer text-on-brand"
            style={{ background: 'var(--color-brand-500)' }}
          >
            Save goal
          </button>
        </div>
      </div>
    </div>
  );
}
