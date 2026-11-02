import React from 'react';
import { TAJWEED_RULES, tajweedColorVar } from '../quran/tajweed';

const SOURCE_URL = 'https://alquran.cloud/tajweed-guide';

/** What each tajweed colour means, folded away until the reader wants it. */
export default function TajweedLegend({ defaultOpen = false }: { defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="rounded-2xl p-3 text-sm" style={{ background: 'var(--reader-surface)', border: '1px solid var(--reader-border)', color: 'var(--reader-ink)' }}>
      <summary className="min-h-11 cursor-pointer py-2 font-bold">Tajweed colour guide</summary>
      <ul className="mt-2 space-y-2">
        {TAJWEED_RULES.map((rule) => (
          <li key={rule.code} className="flex items-start gap-3">
            <span
              data-swatch={rule.code}
              aria-hidden="true"
              className="mt-1 h-4 w-4 shrink-0 rounded-full"
              style={{ background: tajweedColorVar(rule.code) }}
            />
            <span className="min-w-0">
              <span className="font-bold">{rule.name}</span>{' '}
              <span lang="ar" dir="rtl" className="font-quran">{rule.arabic}</span>
              <span className="block text-xs" style={{ color: 'var(--reader-muted)' }}>{rule.summary}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs" style={{ color: 'var(--reader-muted)' }}>
        Grey stands for letters that are not pronounced or are merged into the next (hamzat ul wasl, silent letters, laam shamsiyyah and the two idgham kinds for similar letters). The blues are the madd rules; their names above say how long each lasts.
      </p>
      <p className="mt-2 text-xs" style={{ color: 'var(--reader-muted)' }}>
        Colours come from the{' '}
        <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--reader-accent)' }}>Al Quran Cloud tajweed text</a>.
        Colour is a reading aid; the letters themselves are never changed.
      </p>
    </details>
  );
}
