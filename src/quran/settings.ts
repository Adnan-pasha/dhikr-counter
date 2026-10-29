import { SCRIPTS, DEFAULT_SCRIPT, type ScriptId } from './editions';

export type ReaderTheme = 'dark' | 'paper' | 'modern';

export const READER_THEMES: ReadonlyArray<{ id: ReaderTheme; label: string }> = [
  { id: 'dark', label: 'Dark' },
  { id: 'paper', label: 'Paper' },
  { id: 'modern', label: 'Modern' },
];

/** Arabic text sizes in px, smallest to largest. */
export const TEXT_SIZES: readonly number[] = [24, 28, 32, 36, 40, 46];

export interface ReaderSettings {
  theme: ReaderTheme;
  /** Index into TEXT_SIZES. */
  textSize: number;
  script: ScriptId;
  showTranslation: boolean;
  showTransliteration: boolean;
  keepScreenOn: boolean;
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  theme: 'dark',
  textSize: 2,
  script: DEFAULT_SCRIPT,
  showTranslation: true,
  showTransliteration: false,
  keepScreenOn: false,
};

const clampSize = (index: number): number => Math.min(TEXT_SIZES.length - 1, Math.max(0, index));

export const arabicFontSize = (index: number): number => TEXT_SIZES[clampSize(index)];

export const stepTextSize = (index: number, delta: -1 | 1): number => clampSize(index + delta);

const isBool = (v: unknown): v is boolean => typeof v === 'boolean';

/** Validates stored settings field by field so one bad value never discards the rest. */
export const sanitizeReaderSettings = (value: unknown): ReaderSettings => {
  const d = DEFAULT_READER_SETTINGS;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return d;
  const v = value as Record<string, unknown>;
  return {
    theme: READER_THEMES.some((t) => t.id === v.theme) ? (v.theme as ReaderTheme) : d.theme,
    textSize: Number.isInteger(v.textSize) && (v.textSize as number) >= 0 && (v.textSize as number) < TEXT_SIZES.length ? (v.textSize as number) : d.textSize,
    script: SCRIPTS.some((s) => s.id === v.script) ? (v.script as ScriptId) : d.script,
    showTranslation: isBool(v.showTranslation) ? v.showTranslation : d.showTranslation,
    showTransliteration: isBool(v.showTransliteration) ? v.showTransliteration : d.showTransliteration,
    keepScreenOn: isBool(v.keepScreenOn) ? v.keepScreenOn : d.keepScreenOn,
  };
};
