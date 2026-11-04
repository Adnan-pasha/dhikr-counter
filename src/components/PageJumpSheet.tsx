import React from 'react';
import { X } from 'lucide-react';
import { useModalDialog } from './useModalDialog';
import { JUZ_FIRST_PAGE, TOTAL_PAGES } from '../quran/pages';

interface PageJumpSheetProps {
  open: boolean;
  onClose: () => void;
  /** The page on screen now. */
  page: number;
  onGo: (page: number) => void;
  /** How many pages there are. The 604-page mushaf unless said otherwise. */
  total?: number;
  /** The page each juz begins on, for a mushaf with its own page numbers. */
  juzFirstPages?: readonly number[];
}

const card = { background: 'var(--reader-surface)', border: '1px solid var(--reader-border)', color: 'var(--reader-ink)' } as const;

/** Go to a page number, or to the first page of a juz. */
export default function PageJumpSheet({ open, onClose, page, onGo, total = TOTAL_PAGES, juzFirstPages = JUZ_FIRST_PAGE }: PageJumpSheetProps) {
  const [value, setValue] = React.useState(String(page));
  const { dialogRef, initialFocusRef, onKeyDown } = useModalDialog(open, onClose);

  React.useEffect(() => { if (open) setValue(String(page)); }, [open, page]);

  if (!open) return null;

  const typed = Number(value);
  const valid = value.trim() !== '' && Number.isFinite(typed) && typed >= 1 && typed <= total;

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.55)' }} aria-hidden="true" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Go to page or juz"
        onKeyDown={onKeyDown}
        className="relative max-h-[85%] overflow-y-auto rounded-t-3xl p-5 space-y-5"
        style={{ background: 'var(--reader-bg)', color: 'var(--reader-ink)', borderTop: '1px solid var(--reader-border)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-black">Go to</h2>
          <button ref={initialFocusRef} type="button" aria-label="Close" onClick={onClose} className="tap-target flex w-11 items-center justify-center rounded-xl cursor-pointer" style={card}>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form
          className="flex items-end gap-2"
          onSubmit={(e) => { e.preventDefault(); if (valid) onGo(Math.min(total, Math.max(1, Math.trunc(typed)))); }}
        >
          <label className="min-w-0 flex-1 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--reader-muted)' }}>
            Page number
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={total}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-label="Page number"
              className="mt-1 block min-h-11 w-full rounded-xl px-3 text-base font-bold normal-case tracking-normal"
              style={card}
            />
          </label>
          <button type="submit" disabled={!valid} className="tap-target rounded-xl px-5 text-sm font-bold cursor-pointer disabled:opacity-40" style={{ background: 'var(--reader-accent)', color: 'var(--reader-bg)' }}>
            Go
          </button>
        </form>
        <p className="text-xs" style={{ color: 'var(--reader-muted)' }}>Pages 1 to {total}.</p>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--reader-muted)' }}>Juz</p>
          <div className="grid grid-cols-5 gap-2" role="group" aria-label="Juz">
            {juzFirstPages.map((first, i) => (
              <button
                key={first}
                type="button"
                aria-label={`Juz ${i + 1}`}
                onClick={() => onGo(first)}
                className="min-h-11 rounded-xl text-sm font-bold cursor-pointer"
                style={card}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
