import React from 'react';

export type QuranTab = 'read' | 'progress';

interface QuranTabsProps {
  tab: QuranTab;
  onChange: (tab: QuranTab) => void;
}

const TABS: ReadonlyArray<{ id: QuranTab; label: string }> = [
  { id: 'read', label: 'Read' },
  { id: 'progress', label: 'My Progress' },
];

/** Switches the Quran screen between the surah list and My Progress. */
export default function QuranTabs({ tab, onChange }: QuranTabsProps) {
  return (
    <div className="flex gap-2" role="group" aria-label="Quran sections">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-pressed={tab === t.id}
          onClick={() => onChange(t.id)}
          className="tap-target flex-1 rounded-xl text-sm font-bold cursor-pointer"
          style={{
            background: tab === t.id ? 'var(--color-brand-500)' : 'var(--color-bg-raised)',
            color: tab === t.id ? 'var(--color-bg-base)' : 'var(--color-text-primary)',
            border: `1px solid ${tab === t.id ? 'var(--color-brand-500)' : 'var(--color-border)'}`,
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
