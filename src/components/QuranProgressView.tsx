import React from 'react';
import { BookOpen, Check, ChevronLeft } from 'lucide-react';
import ReadingGoalSheet from './ReadingGoalSheet';
import {
  AYAT_IN_QURAN, daysToKhatam, goalReached, khatamStatus, minutesOn, weekStrip,
  type QuranProgress, type ReadingPosition,
} from '../quran/progress';

interface QuranProgressViewProps {
  onGoBack: () => void;
  /** Section switcher (Read / My Progress) shown under the title. */
  tabs?: React.ReactNode;
  progress: QuranProgress;
  today: string;
  surahName: (surah: number) => string;
  onSetGoal: (minutes: number) => void;
  /** Null means nothing has been read yet, so start from the beginning. */
  onContinue: (position: ReadingPosition | null) => void;
  onStartKhatam: (days: number) => void;
  onEndKhatam: () => void;
}

type Section = 'reading' | 'khatam';

const PLAN_CHOICES = [30, 60, 90, 180] as const;
const RING = 112;
const STROKE = 10;
const RADIUS = (RING - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const DAY_RING = 30;
const DAY_STROKE = 4;
const DAY_RADIUS = (DAY_RING - DAY_STROKE) / 2;
const DAY_CIRCUMFERENCE = 2 * Math.PI * DAY_RADIUS;

const card = { background: 'var(--color-bg-raised)', border: '1px solid var(--color-border)' } as const;

const dayName = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

/** My Progress: today's reading against the goal, where to continue, the week, and a khatam plan. */
export default function QuranProgressView({ onGoBack, tabs, progress, today, surahName, onSetGoal, onContinue, onStartKhatam, onEndKhatam }: QuranProgressViewProps) {
  const [section, setSection] = React.useState<Section>('reading');
  const [goalOpen, setGoalOpen] = React.useState(false);
  const [planDays, setPlanDays] = React.useState<number>(PLAN_CHOICES[0]);
  const [confirmEnd, setConfirmEnd] = React.useState(false);
  const planHeadingRef = React.useRef<HTMLHeadingElement>(null);
  const startHeadingRef = React.useRef<HTMLHeadingElement>(null);
  const endButtonRef = React.useRef<HTMLButtonElement>(null);
  const keepButtonRef = React.useRef<HTMLButtonElement>(null);

  const goal = progress.goalMinutes;
  const minutes = minutesOn(progress, today);
  const reached = goalReached(progress, today);
  const ratio = goal ? Math.min(1, (minutes * 60) / (goal * 60)) : 0;
  const position = progress.position;
  const plan = khatamStatus(progress, today);

  // Buttons here replace one another, so focus is placed deliberately instead of dropping to the page.
  const hadPlan = React.useRef(Boolean(plan));
  React.useEffect(() => {
    const has = Boolean(plan);
    if (has === hadPlan.current) return;
    hadPlan.current = has;
    (has ? planHeadingRef : startHeadingRef).current?.focus();
  }, [plan]);

  const confirmWasShown = React.useRef(false);
  React.useEffect(() => {
    if (confirmEnd) keepButtonRef.current?.focus();
    else if (confirmWasShown.current) endButtonRef.current?.focus();
    confirmWasShown.current = confirmEnd;
  }, [confirmEnd]);

  return (
    <div className="screen relative">
      <div className="screen-header">
        <div className="header-row">
          <button onClick={onGoBack} className="back-btn" aria-label="Go back to Home">
            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
            <span>Home</span>
          </button>
          <h1 className="screen-title text-center">Quran</h1>
          <div className="w-10" />
        </div>
        {tabs}
      </div>

      <div className="flex gap-2 px-4 pt-4" role="group" aria-label="Progress section">
        {(['reading', 'khatam'] as const).map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={section === id}
            onClick={() => setSection(id)}
            className="tap-target rounded-full px-5 text-sm font-bold cursor-pointer"
            style={{
              background: section === id ? 'var(--color-text-primary)' : 'var(--color-bg-raised)',
              color: section === id ? 'var(--color-bg-base)' : 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
            }}
          >
            {id === 'reading' ? 'Reading' : 'Khatam'}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {section === 'reading' ? (
          <>
            <section className="rounded-3xl p-4" style={card}>
              {goal ? (
                <div className="flex items-center gap-4">
                  <div
                    className="relative shrink-0"
                    style={{ width: RING, height: RING }}
                    role="progressbar"
                    aria-label="Today's reading"
                    aria-valuemin={0}
                    aria-valuemax={goal}
                    aria-valuenow={Math.min(minutes, goal)}
                    aria-valuetext={`${minutes} of ${goal} minutes today`}
                  >
                    <svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`} className="-rotate-90" aria-hidden="true">
                      <circle cx={RING / 2} cy={RING / 2} r={RADIUS} fill="none" stroke="var(--color-border)" strokeWidth={STROKE} />
                      <circle
                        cx={RING / 2} cy={RING / 2} r={RADIUS} fill="none" stroke="var(--color-text-brand)" strokeWidth={STROKE}
                        strokeLinecap="round" strokeDasharray={CIRCUMFERENCE} strokeDashoffset={CIRCUMFERENCE * (1 - ratio)}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-display text-3xl font-black leading-none tabular-nums">{minutes}</span>
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{minutes === 1 ? 'minute read' : 'minutes read'}</span>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black">{reached ? 'Goal reached today' : `Goal: ${goal} min a day`}</p>
                    <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                      At this pace you would finish the Quran in about {daysToKhatam(goal)} days.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-center">
                  <BookOpen className="mx-auto h-8 w-8" aria-hidden="true" style={{ color: 'var(--color-text-brand)' }} />
                  <p className="text-sm font-black">Set a daily reading goal</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>A few minutes a day adds up. Pick what feels easy to keep.</p>
                </div>
              )}
            </section>

            <button
              type="button"
              onClick={() => onContinue(position)}
              aria-label={position
                ? `Continue reading ${surahName(position.surah)} ${position.surah}:${position.ayah}`
                : `Start reading ${surahName(1)} 1:1`}
              className="min-h-11 flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left cursor-pointer"
              style={card}
            >
              <span className="min-w-0">
                <span className="block text-sm font-black">
                  {position ? `${surahName(position.surah)} ${position.surah}:${position.ayah}` : `${surahName(1)} 1:1`}
                </span>
                <span className="block text-xs" style={{ color: 'var(--color-text-brand)' }}>{position ? 'Continue reading' : 'Start reading'}</span>
              </span>
              <BookOpen className="h-5 w-5 shrink-0" aria-hidden="true" style={{ color: 'var(--color-text-brand)' }} />
            </button>

            <section className="rounded-3xl p-4" style={card}>
              <ul className="grid grid-cols-7 gap-1" aria-label="This week">
                {weekStrip(progress, today).map((day) => {
                  const mins = minutesOn(progress, day.date);
                  const label = goal
                    ? `${dayName(day.date)}: ${mins} of ${goal} minutes${day.reached ? ', goal reached' : ''}`
                    : `${dayName(day.date)}: ${mins} minutes`;
                  return (
                    <li key={day.date} aria-current={day.isToday ? 'date' : undefined} className="flex flex-col items-center gap-1.5">
                      <span className="sr-only">{label}</span>
                      <span
                        aria-hidden="true"
                        className="rounded-full px-1.5 text-xs font-bold"
                        style={day.isToday ? { background: 'var(--color-text-primary)', color: 'var(--color-bg-base)' } : { color: 'var(--color-text-muted)' }}
                      >
                        {day.label}
                      </span>
                      <svg width={DAY_RING} height={DAY_RING} viewBox={`0 0 ${DAY_RING} ${DAY_RING}`} className="-rotate-90" aria-hidden="true">
                        <circle cx={DAY_RING / 2} cy={DAY_RING / 2} r={DAY_RADIUS} fill="none" stroke="var(--color-border)" strokeWidth={DAY_STROKE} />
                        {day.ratio > 0 && (
                          <circle
                            cx={DAY_RING / 2} cy={DAY_RING / 2} r={DAY_RADIUS} fill="none" stroke="var(--color-text-brand)" strokeWidth={DAY_STROKE}
                            strokeLinecap="round" strokeDasharray={DAY_CIRCUMFERENCE} strokeDashoffset={DAY_CIRCUMFERENCE * (1 - day.ratio)}
                          />
                        )}
                      </svg>
                    </li>
                  );
                })}
              </ul>
            </section>
          </>
        ) : plan ? (
          <section className="space-y-4 rounded-3xl p-4" style={card}>
            <div className="flex items-baseline justify-between">
              <h3 ref={planHeadingRef} tabIndex={-1} className="font-display text-lg font-black outline-none">Day {plan.dayNumber} of {plan.days}</h3>
              <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--color-text-muted)' }}>{plan.percent}% read</span>
            </div>
            <div
              role="progressbar"
              aria-label="Khatam progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={plan.percent}
              className="h-3 overflow-hidden rounded-full"
              style={{ background: 'var(--color-border)' }}
            >
              <div className="h-full rounded-full" style={{ width: `${plan.percent}%`, background: 'var(--color-text-brand)' }} />
            </div>
            <p className="text-sm font-bold">
              {plan.finished
                ? 'Khatam complete. Alhamdulillah!'
                : plan.remainingToday > 0
                  ? `${plan.remainingToday} ayat to read today`
                  : plan.aheadBy > 0
                    ? `${plan.aheadBy} ayat ahead of today's portion`
                    : "Today's portion is done"}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              About {plan.perDay} ayat a day, {AYAT_IN_QURAN} in all. You can go faster or slower; the plan just keeps count.
            </p>

            {confirmEnd ? (
              <div className="flex gap-2" role="group" aria-label="Confirm ending the plan">
                <p className="sr-only">End this plan?</p>
                <button ref={keepButtonRef} type="button" onClick={() => setConfirmEnd(false)} className="tap-target flex-1 rounded-2xl text-sm font-bold cursor-pointer" style={card}>
                  Keep plan
                </button>
                <button
                  type="button"
                  onClick={() => { setConfirmEnd(false); onEndKhatam(); }}
                  className="tap-target flex-1 rounded-2xl text-sm font-black cursor-pointer"
                  style={{ background: 'var(--color-bg-overlay)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
                >
                  Yes, end plan
                </button>
              </div>
            ) : (
              <button ref={endButtonRef} type="button" onClick={() => setConfirmEnd(true)} className="tap-target text-xs font-bold cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>
                End plan
              </button>
            )}
          </section>
        ) : (
          <section className="space-y-4 rounded-3xl p-4" style={card}>
            <h3 ref={startHeadingRef} tabIndex={-1} className="font-display text-lg font-black outline-none">Start your khatam</h3>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              Choose how many days to complete the Quran. We will show how much to read each day and keep count as you go.
            </p>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Plan length">
              {PLAN_CHOICES.map((days) => (
                <button
                  key={days}
                  type="button"
                  aria-pressed={planDays === days}
                  onClick={() => setPlanDays(days)}
                  className="tap-target rounded-2xl text-sm font-black cursor-pointer"
                  style={{ ...card, border: `2px solid ${planDays === days ? 'var(--color-text-brand)' : 'var(--color-border)'}` }}
                >
                  {days} days
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onStartKhatam(planDays)}
              className="tap-target flex w-full items-center justify-center gap-2 rounded-2xl text-sm font-black cursor-pointer text-on-brand"
              style={{ background: 'var(--color-brand-500)' }}
            >
              <Check className="h-4 w-4" aria-hidden="true" /> Start plan
            </button>
          </section>
        )}
      </div>

      {section === 'reading' && (
        <div className="shrink-0 p-4">
          <button
            type="button"
            onClick={() => setGoalOpen(true)}
            className="tap-target w-full rounded-2xl text-sm font-black cursor-pointer text-on-brand"
            style={{ background: 'var(--color-brand-500)' }}
          >
            {goal ? 'Edit reading goal' : 'Set reading goal'}
          </button>
        </div>
      )}

      <ReadingGoalSheet open={goalOpen} current={goal} onClose={() => setGoalOpen(false)} onSave={onSetGoal} />
    </div>
  );
}
