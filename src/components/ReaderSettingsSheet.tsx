import React from 'react';
import { X } from 'lucide-react';
import ToggleSwitch from './ToggleSwitch';
import { SCRIPTS, TRANSLATIONS, DEFAULT_TRANSLATION, TRANSLITERATION_EDITION } from '../quran/editions';
import { READER_THEMES, TEXT_SIZES, arabicFontSize, type ReaderSettings } from '../quran/settings';
import { BASMALA } from '../quran/text';

interface ReaderSettingsSheetProps {
  open: boolean;
  onClose: () => void;
  settings: ReaderSettings;
  onChange: (patch: Partial<ReaderSettings>) => void;
}

type Section = 'display' | 'text';

const card = { background: 'var(--reader-surface)', border: '1px solid var(--reader-border)', color: 'var(--reader-ink)' } as const;
const chipStyle = (active: boolean) => ({
  background: active ? 'var(--reader-accent)' : 'var(--reader-surface)',
  color: active ? 'var(--reader-bg)' : 'var(--reader-ink)',
  border: `1px solid ${active ? 'var(--reader-accent)' : 'var(--reader-border)'}`,
}) as const;

/** Display and text options for the reader, as a bottom sheet over the page. */
export default function ReaderSettingsSheet({ open, onClose, settings, onChange }: ReaderSettingsSheetProps) {
  const [section, setSection] = React.useState<Section>('display');
  const closeRef = React.useRef<HTMLButtonElement>(null);

  const dialogRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  // Escape closes the sheet from anywhere, not only while a control inside it has focus.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // The sheet is modal, so Tab must not wander into the page behind it.
  const trapTab = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const found = dialogRef.current.querySelectorAll('button, input, a[href]') as NodeListOf<HTMLElement>;
    const items = Array.from(found).filter((el: HTMLElement) => !el.hasAttribute('disabled'));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!open) return null;
  const translation = TRANSLATIONS.find((t) => t.id === DEFAULT_TRANSLATION);

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} aria-hidden="true" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Reader settings"
        onKeyDown={trapTab}
        className="relative max-h-[85%] overflow-y-auto rounded-t-3xl p-5 space-y-5"
        style={{ background: 'var(--reader-bg)', color: 'var(--reader-ink)', borderTop: '1px solid var(--reader-border)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-black">Settings</h2>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close settings"
            onClick={onClose}
            className="tap-target flex w-11 items-center justify-center rounded-xl cursor-pointer"
            style={card}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex gap-2" role="group" aria-label="Settings section">
          {(['display', 'text'] as const).map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={section === id}
              onClick={() => setSection(id)}
              className="tap-target rounded-full px-5 text-sm font-bold cursor-pointer"
              style={chipStyle(section === id)}
            >
              {id === 'display' ? 'Display' : 'Text'}
            </button>
          ))}
        </div>

        {section === 'display' ? (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--reader-muted)' }}>Theme</p>
              <div className="grid grid-cols-3 gap-2" role="group" aria-label="Theme">
                {READER_THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={settings.theme === t.id}
                    onClick={() => onChange({ theme: t.id })}
                    data-reader-theme={t.id}
                    className="tap-target rounded-2xl p-3 text-sm font-bold cursor-pointer"
                    style={{
                      background: 'var(--reader-bg)',
                      color: 'var(--reader-ink)',
                      border: `2px solid ${settings.theme === t.id ? 'var(--reader-accent)' : 'var(--reader-border)'}`,
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="reader_text_size" className="mb-2 block text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--reader-muted)' }}>
                Text size
              </label>
              <input
                id="reader_text_size"
                type="range"
                aria-label="Text size"
                aria-valuetext={`${arabicFontSize(settings.textSize)} pixels`}
                min={0}
                max={TEXT_SIZES.length - 1}
                step={1}
                value={settings.textSize}
                onChange={(e) => onChange({ textSize: Number(e.target.value) })}
                className="w-full cursor-pointer"
                style={{ accentColor: 'var(--reader-accent)' }}
              />
              <p
                lang="ar"
                dir="rtl"
                className="font-quran mt-2 text-center"
                style={{ fontSize: arabicFontSize(settings.textSize), lineHeight: 2, color: 'var(--reader-ink)' }}
              >
                {BASMALA}
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-2xl p-4" style={card}>
              <div className="min-w-0">
                <p className="text-sm font-bold">Keep screen on while reading</p>
                <p className="text-xs" style={{ color: 'var(--reader-muted)' }}>Stops the screen dimming mid-page</p>
              </div>
              <ToggleSwitch
                id="switch_reader_keep_awake"
                label="Keep screen on while reading"
                checked={settings.keepScreenOn}
                onChange={(value) => onChange({ keepScreenOn: value })}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--reader-muted)' }}>Arabic script</p>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Arabic script">
                {SCRIPTS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={settings.script === s.id}
                    onClick={() => onChange({ script: s.id })}
                    className="rounded-2xl p-3 text-center cursor-pointer"
                    style={{ ...card, border: `2px solid ${settings.script === s.id ? 'var(--reader-accent)' : 'var(--reader-border)'}` }}
                  >
                    <span lang="ar" dir="rtl" className="font-quran block text-2xl leading-loose">{s.sample}</span>
                    <span className="block text-sm font-bold">{s.label}</span>
                    <span className="block text-xs" style={{ color: 'var(--reader-muted)' }}>{s.blurb}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-2xl p-4" style={card}>
              <div className="min-w-0">
                <p className="text-sm font-bold">Show translation</p>
                <p className="text-xs" style={{ color: 'var(--reader-muted)' }}>{translation?.label}</p>
              </div>
              <ToggleSwitch
                id="switch_reader_translation"
                label="Show translation"
                checked={settings.showTranslation}
                onChange={(value) => onChange({ showTranslation: value })}
              />
            </div>

            {TRANSLITERATION_EDITION && (
              <div className="flex items-center justify-between gap-3 rounded-2xl p-4" style={card}>
                <p className="text-sm font-bold">Show transliteration</p>
                <ToggleSwitch
                  id="switch_reader_transliteration"
                  label="Show transliteration"
                  checked={settings.showTransliteration}
                  onChange={(value) => onChange({ showTransliteration: value })}
                />
              </div>
            )}

            <p className="text-xs leading-relaxed" style={{ color: 'var(--reader-muted)' }}>
              Arabic text:{' '}
              <a href="https://tanzil.net" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--reader-accent)' }}>
                Tanzil Project
              </a>{' '}
              (CC BY 3.0), shown unaltered. Translation: {translation?.credit}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
