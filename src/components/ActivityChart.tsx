import React from 'react';
import { motion } from 'motion/react';
import { BarChart2, TrendingDown, TrendingUp } from 'lucide-react';
import type { DhikrHistory } from '../types';
import { STATS_RANGES, bucketStats, hourLabel, shouldLabelBucket, type StatsRange } from '../stats';

interface ActivityChartProps {
  history: DhikrHistory[];
  today: string;
}

const CHART_HEIGHT = 96;
const fmt = (n: number) => n.toLocaleString('en-US');

const bucketName = (range: StatsRange, key: string, label: string): string => {
  if (range === 'day') return hourLabel(Number(key));
  // A bare day number is ambiguous as a headline figure, so name the date in full.
  if (range === 'month') return new Date(`${key}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return label;
};

/** Axis tick: the day view and month view keep their short labels. */
const tickName = (range: StatsRange, key: string, label: string): string =>
  range === 'day' ? hourLabel(Number(key)) : label;

/** Beads over the chosen period, with a plain-language comparison against the period before. */
export default function ActivityChart({ history, today }: ActivityChartProps) {
  const [range, setRange] = React.useState<StatsRange>('week');
  const nowHour = new Date().getHours();
  const stats = React.useMemo(() => bucketStats(history, range, today, nowHour), [history, range, today, nowHour]);
  const max = Math.max(...stats.buckets.map((b) => b.beads), 1);
  const meta = STATS_RANGES.find((r) => r.id === range)!;
  const gap = stats.buckets.length > 14 ? 'gap-px' : 'gap-1.5';

  const change = stats.changePct;
  const Trend = change !== null && change < 0 ? TrendingDown : TrendingUp;
  const comparison = change === null
    ? `Nothing to compare with ${meta.compareLabel} yet`
    : `${change > 0 ? '+' : ''}${change}% vs ${meta.compareLabel}`;

  return (
    <div id="activity_chart" className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-md">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
          <BarChart2 className="w-4 h-4 text-brand-400" aria-hidden="true" />
          Activity
        </h3>
      </div>

      <div className="flex gap-1.5 mb-4" role="group" aria-label="Time range">
        {STATS_RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            aria-pressed={range === r.id}
            onClick={() => setRange(r.id)}
            className={`tap-target flex-1 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
              range === r.id
                ? 'border-brand-500 bg-brand-500/15 text-brand-400'
                : 'border-slate-700 bg-slate-800 text-slate-300'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div
        role="img"
        aria-label={`${fmt(stats.total)} beads over the ${meta.label.toLowerCase()}. ${comparison}.`}
        className={`flex items-end ${gap}`}
        style={{ height: CHART_HEIGHT + 22 }}
      >
        {stats.buckets.map((b, index) => (
          <div key={b.key} className="flex flex-col items-center justify-end flex-1 min-w-0 h-full">
            <div className="w-full flex items-end justify-center" style={{ height: CHART_HEIGHT }}>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(b.beads / max) * 100}%` }}
                transition={{ type: 'spring', stiffness: 80, damping: 14 }}
                className={`w-full max-w-6 rounded-t-sm ${b.beads > 0 ? 'bg-gradient-to-t from-brand-500 to-brand-400' : ''}`}
                style={{ minHeight: 2, background: b.beads > 0 ? undefined : 'var(--color-border)', opacity: b.beads > 0 ? 1 : 0.6 }}
              />
            </div>
            <span className="text-2xs font-bold text-slate-400 mt-1.5 h-4 leading-4 whitespace-nowrap">
              {shouldLabelBucket(range, index, stats.buckets.length) ? tickName(range, b.key, b.label) : ''}
            </span>
          </div>
        ))}
      </div>

      <ul className="sr-only">
        {stats.buckets.map((b) => (
          <li key={b.key}>{bucketName(range, b.key, b.label)}: {fmt(b.beads)} beads</li>
        ))}
      </ul>

      <div aria-live="polite">
      <dl className="grid grid-cols-3 gap-2 mt-4 text-center">
        <div className="rounded-xl p-2.5" style={{ background: 'var(--color-bg-raised)', border: '1px solid var(--color-border)' }}>
          <dt className="text-2xs font-bold uppercase tracking-wider text-slate-400">Total</dt>
          <dd id="stats_total" className="font-display font-black text-lg tabular-nums" style={{ color: 'var(--color-text-brand)' }}>{fmt(stats.total)}</dd>
        </div>
        <div className="rounded-xl p-2.5" style={{ background: 'var(--color-bg-raised)', border: '1px solid var(--color-border)' }}>
          <dt className="text-2xs font-bold uppercase tracking-wider text-slate-400">{range === 'year' ? 'Active months' : range === 'day' ? 'Active hours' : 'Active days'}</dt>
          <dd id="stats_active" className="font-display font-black text-lg tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{stats.activeBuckets}</dd>
        </div>
        <div className="rounded-xl p-2.5" style={{ background: 'var(--color-bg-raised)', border: '1px solid var(--color-border)' }}>
          <dt className="text-2xs font-bold uppercase tracking-wider text-slate-400">Best</dt>
          <dd id="stats_best" className="font-display font-black text-lg tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
            {stats.best ? bucketName(range, stats.best.key, stats.best.label) : '–'}
          </dd>
        </div>
      </dl>

      <p id="stats_comparison" className="mt-3 text-xs font-medium flex items-center justify-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
        <Trend className="w-3.5 h-3.5" aria-hidden="true" style={{ color: change !== null && change < 0 ? 'var(--color-text-muted)' : 'var(--color-text-brand)' }} />
        {comparison}
      </p>
      </div>
    </div>
  );
}
