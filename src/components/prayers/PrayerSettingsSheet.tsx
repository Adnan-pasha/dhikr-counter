import React from 'react';
import { Pause, Play, X } from 'lucide-react';
import { useModalDialog } from '../useModalDialog';
import { CALCULATION_METHODS } from '../../prayerTimes';
import { AZAN_SOURCES } from '../../azan';
import type { AzanSound, Madhab, PrayerCalculationMethod } from '../../types';

interface PrayerSettingsSheetProps {
  open: boolean;
  onClose: () => void;
  method: PrayerCalculationMethod;
  madhab: Madhab;
  onMethodChange: (method: PrayerCalculationMethod) => void;
  onMadhabChange: (madhab: Madhab) => void;
  /** The voice for Dhuhr, Asr, Maghrib and Isha. Fajr always has its own. */
  voice: AzanSound;
  onVoiceChange: (voice: AzanSound) => void;
  /** Which recording is playing as a preview ('fajr', 'makkah' or 'madinah'), or null. */
  playing: string | null;
  onPreview: (kind: 'fajr' | AzanSound) => void;
}

const field = { background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' } as const;

const ASR_RULES: ReadonlyArray<{ id: 'standard' | 'hanafi'; label: string; detail: string }> = [
  { id: 'standard', label: 'Standard', detail: 'Shafi, Maliki, Hanbali: Asr when a shadow equals the object' },
  { id: 'hanafi', label: 'Hanafi', detail: 'Asr when a shadow is twice the object, so it is later' },
];

/** Play or stop a preview of one recording. */
function PreviewButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={active ? `Stop ${label}` : `Hear ${label}`}
      className="tap-target flex w-11 items-center justify-center rounded-xl cursor-pointer"
      style={field}
    >
      {active ? <Pause className="h-5 w-5" aria-hidden="true" /> : <Play className="h-5 w-5" aria-hidden="true" />}
    </button>
  );
}

/** How the times are worked out, and the adhan voice. */
export default function PrayerSettingsSheet({ open, onClose, method, madhab, onMethodChange, onMadhabChange, voice, onVoiceChange, playing, onPreview }: PrayerSettingsSheetProps) {
  const { dialogRef, initialFocusRef, onKeyDown } = useModalDialog(open, onClose);
  if (!open) return null;
  const rule = madhab === 'hanafi' ? 'hanafi' : 'standard';

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.55)' }} aria-hidden="true" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Prayer settings"
        onKeyDown={onKeyDown}
        className="relative max-h-[85%] space-y-5 overflow-y-auto rounded-t-3xl p-5"
        style={{ background: 'var(--color-bg-raised)', color: 'var(--color-text-primary)', borderTop: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-black">Prayer settings</h2>
          <button ref={initialFocusRef} type="button" aria-label="Close" onClick={onClose} className="tap-target flex w-11 items-center justify-center rounded-xl cursor-pointer" style={field}>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <label className="block text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
          Calculation method
          <select
            value={method}
            onChange={(e) => onMethodChange(e.target.value as PrayerCalculationMethod)}
            className="mt-1 block min-h-11 w-full rounded-xl px-3 text-base font-semibold normal-case tracking-normal"
            style={field}
          >
            {CALCULATION_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Pick the one your local mosque follows. Times can differ by a minute or two between apps and mosques.
        </p>

        <div role="radiogroup" aria-label="Asr time" className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Asr time</p>
          {ASR_RULES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={rule === item.id}
              onClick={() => onMadhabChange(item.id === 'hanafi' ? 'hanafi' : madhab === 'hanafi' ? 'shafi' : madhab)}
              className="min-h-11 w-full rounded-xl px-3 py-2 text-left cursor-pointer"
              style={rule === item.id ? { ...field, borderColor: 'var(--color-brand-border)', background: 'var(--color-brand-dim)' } : field}
            >
              <span className="block text-sm font-black">{item.label}</span>
              <span className="block text-xs" style={{ color: 'var(--color-text-muted)' }}>{item.detail}</span>
            </button>
          ))}
        </div>

        <div role="radiogroup" aria-label="Adhan voice" className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Adhan voice</p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Fajr has its own adhan. Dhuhr, Asr, Maghrib and Isha use the voice you pick.</p>
          {(Object.keys(AZAN_SOURCES) as AzanSound[]).map((id) => (
            <div key={id} className="flex gap-2">
              <button
                type="button"
                role="radio"
                aria-checked={voice === id}
                onClick={() => onVoiceChange(id)}
                className="min-h-11 flex-1 rounded-xl px-3 text-left text-sm font-black cursor-pointer"
                style={voice === id ? { ...field, borderColor: 'var(--color-brand-border)', background: 'var(--color-brand-dim)' } : field}
              >
                {AZAN_SOURCES[id].label}
              </button>
              <PreviewButton label={AZAN_SOURCES[id].label} active={playing === id} onClick={() => onPreview(id)} />
            </div>
          ))}
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 text-sm font-black">Fajr adhan</p>
            <PreviewButton label="Fajr adhan" active={playing === 'fajr'} onClick={() => onPreview('fajr')} />
          </div>
        </div>
      </div>
    </div>
  );
}
