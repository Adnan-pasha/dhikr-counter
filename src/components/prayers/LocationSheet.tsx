import React from 'react';
import { Check, LocateFixed, Search, X } from 'lucide-react';
import { useModalDialog } from '../useModalDialog';
import { CITY_PRESETS, type CityPreset } from '../../places';

interface LocationSheetProps {
  open: boolean;
  onClose: () => void;
  /** Label of the place in use, so it can be ticked in the list. */
  currentLabel: string | null;
  onSelectCity: (city: CityPreset) => void;
  onUseGps: () => void;
  gpsLoading: boolean;
  gpsError: string | null;
}

const field = { background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' } as const;

/** Choose where prayer times are worked out for: the phone's own location, or a city from the offline list. */
export default function LocationSheet({ open, onClose, currentLabel, onSelectCity, onUseGps, gpsLoading, gpsError }: LocationSheetProps) {
  const [query, setQuery] = React.useState('');
  const { dialogRef, initialFocusRef, onKeyDown } = useModalDialog(open, onClose);

  React.useEffect(() => { if (open) setQuery(''); }, [open]);

  const matches = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? CITY_PRESETS.filter((city) => city.name.toLowerCase().includes(needle)) : CITY_PRESETS;
  }, [query]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.55)' }} aria-hidden="true" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Your location"
        onKeyDown={onKeyDown}
        className="relative flex max-h-[85%] flex-col gap-3 rounded-t-3xl p-5"
        style={{ background: 'var(--color-bg-raised)', color: 'var(--color-text-primary)', borderTop: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-black">Your location</h2>
          <button ref={initialFocusRef} type="button" aria-label="Close" onClick={onClose} className="tap-target flex w-11 items-center justify-center rounded-xl cursor-pointer" style={field}>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          onClick={onUseGps}
          disabled={gpsLoading}
          className="tap-target flex items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold cursor-pointer disabled:opacity-60 text-on-brand"
          style={{ background: 'var(--color-brand-500)' }}
        >
          <LocateFixed className="h-5 w-5" aria-hidden="true" />
          {gpsLoading ? 'Finding you...' : 'Use my location'}
        </button>
        {gpsError && <p role="alert" className="text-xs font-bold" style={{ color: 'var(--color-text-brand)' }}>{gpsError}</p>}
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Your location stays on this phone. It is only used to work out the times.</p>

        <label className="relative block">
          <span className="sr-only">Search cities</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} aria-hidden="true" />
          <input
            type="search"
            role="searchbox"
            aria-label="Search cities"
            placeholder={`Search ${CITY_PRESETS.length} cities`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-h-11 w-full rounded-xl pl-9 pr-3 text-base font-semibold"
            style={field}
          />
        </label>

        <ul className="min-h-0 flex-1 overflow-y-auto space-y-1" aria-label="Cities">
          {matches.length === 0 && (
            <li className="py-6 text-center text-sm font-bold" style={{ color: 'var(--color-text-muted)' }}>No city matches "{query}"</li>
          )}
          {matches.map((city) => (
            <li key={city.name}>
              <button
                type="button"
                onClick={() => onSelectCity(city)}
                className="min-h-11 flex w-full items-center justify-between gap-2 rounded-xl px-3 text-left text-sm font-bold cursor-pointer"
                style={city.name === currentLabel ? { ...field, borderColor: 'var(--color-brand-border)' } : { color: 'var(--color-text-primary)' }}
              >
                <span>{city.name}</span>
                {city.name === currentLabel && <Check className="h-4 w-4" style={{ color: 'var(--color-text-brand)' }} aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
