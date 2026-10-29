import React from 'react';

interface ToggleSwitchProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

/**
 * A labelled on/off switch drawn with the reader's colour tokens. The button is a 44 px target;
 * the visible track inside it is smaller. The off track uses the muted ink so it stays visible
 * against a card (the border colour is far too faint for a control).
 */
export default function ToggleSwitch({ id, label, checked, onChange }: ToggleSwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="flex h-11 w-14 shrink-0 cursor-pointer items-center justify-center"
    >
      <span
        aria-hidden="true"
        className="relative block h-7 w-12 rounded-full transition-colors"
        style={{ background: checked ? 'var(--reader-accent)' : 'var(--reader-muted)' }}
      >
        <span
          className="absolute top-1 block h-5 w-5 rounded-full transition-all"
          style={{ left: checked ? '1.5rem' : '0.25rem', background: 'var(--reader-surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.35)' }}
        />
      </span>
    </button>
  );
}
