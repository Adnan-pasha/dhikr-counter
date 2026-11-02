import React from 'react';
import { Check, ChevronLeft, RefreshCw, Search } from 'lucide-react';
import type { CatalogStatus } from '../quran/useTranslationCatalog';
import { PICKTHALL_ID, groupByLanguage, translationIdFor, type CatalogEntry, type TranslationId } from '../quran/translations';

export interface CatalogState {
  entries: CatalogEntry[];
  status: CatalogStatus;
  retry: () => void;
}

interface TranslationPickerProps {
  catalog: CatalogState;
  selected: TranslationId;
  onSelect: (id: TranslationId) => void;
  onBack: () => void;
}

const card = { background: 'var(--reader-surface)', border: '1px solid var(--reader-border)', color: 'var(--reader-ink)' } as const;
const BUILT_IN_WORDS = 'built in pickthall english public domain';

/** Every translation on offer, grouped by language, with search. QuranEnc's list is fetched live and remembered. */
export default function TranslationPicker({ catalog, selected, onSelect, onBack }: TranslationPickerProps) {
  const [query, setQuery] = React.useState('');
  const groups = React.useMemo(() => groupByLanguage(catalog.entries, query), [catalog.entries, query]);
  const q = query.trim().toLowerCase();
  const showBuiltIn = !q || BUILT_IN_WORDS.includes(q) || q.split(/\s+/).every((w) => BUILT_IN_WORDS.includes(w));
  const nothing = !showBuiltIn && groups.length === 0 && catalog.status !== 'loading';

  const row = (key: string, selectedNow: boolean, onPick: () => void, title: string, note: string) => (
    <button
      key={key}
      type="button"
      aria-pressed={selectedNow}
      onClick={onPick}
      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left cursor-pointer"
      style={{ ...card, border: `2px solid ${selectedNow ? 'var(--reader-accent)' : 'var(--reader-border)'}` }}
    >
      <span className="min-w-0">
        <span className="block text-sm font-bold">{title}</span>
        <span className="block text-xs" style={{ color: 'var(--reader-muted)' }}>{note}</span>
      </span>
      {selectedNow && <Check className="h-4 w-4 shrink-0" aria-hidden="true" style={{ color: 'var(--reader-accent)' }} />}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Back to text settings"
          onClick={onBack}
          className="tap-target flex w-11 items-center justify-center rounded-xl cursor-pointer"
          style={card}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h3 className="font-display text-base font-black">Translations</h3>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" aria-hidden="true" style={{ color: 'var(--reader-muted)' }} />
        <input
          type="search"
          aria-label="Search translations"
          placeholder="Search by language or name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          className="min-h-11 w-full rounded-2xl py-2 pl-9 pr-3 text-sm focus:outline-none"
          style={card}
        />
      </div>

      {catalog.status === 'loading' && (
        <p role="status" className="text-xs" style={{ color: 'var(--reader-muted)' }}>Loading translations…</p>
      )}
      {catalog.status === 'cached' && (
        <p className="text-xs" style={{ color: 'var(--reader-muted)' }}>Showing your saved list. Connect to the internet to refresh it.</p>
      )}
      {catalog.status === 'error' && (
        <div className="flex items-center justify-between gap-3 rounded-2xl p-3" style={card}>
          <p className="text-xs">Could not load the list. Check your connection.</p>
          <button
            type="button"
            onClick={catalog.retry}
            className="tap-target flex items-center gap-1.5 rounded-xl px-3 text-xs font-bold cursor-pointer"
            style={{ ...card, color: 'var(--reader-accent)' }}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Retry
          </button>
        </div>
      )}

      {showBuiltIn && (
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--reader-muted)' }}>Built in</h3>
          {row(PICKTHALL_ID, selected === PICKTHALL_ID, () => onSelect(PICKTHALL_ID), 'Pickthall (English)', 'Works offline once opened. Public domain.')}
        </section>
      )}

      {groups.map((group) => (
        <section key={group.language} className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--reader-muted)' }}>
            {group.label.english}
            {group.label.native !== group.label.english && <> · <span lang={group.language}>{group.label.native}</span></>}
          </h3>
          {group.items.map((entry) => {
            const id = translationIdFor(entry.key);
            return row(entry.key, selected === id, () => onSelect(id), entry.title, entry.version ? `Version ${entry.version}` : 'QuranEnc');
          })}
        </section>
      ))}

      {nothing && <p className="text-sm" style={{ color: 'var(--reader-muted)' }}>No translations match “{query.trim()}”.</p>}

      <p className="text-xs leading-relaxed" style={{ color: 'var(--reader-muted)' }}>
        Translations come from{' '}
        <a href="https://quranenc.com" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--reader-accent)' }}>QuranEnc.com</a>
        {' '}and are shown exactly as their publishers released them, with the notes they include.
      </p>
    </div>
  );
}
