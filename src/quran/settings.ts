import { SCRIPTS, DEFAULT_SCRIPT, type ScriptId } from './editions';
import { PICKTHALL_ID, parseTranslationId, type TranslationId } from './translations';

/** "auto" follows the app: the dark page in dark mode, paper in light mode (the pairing lives in index.css). */
export type ReaderTheme = 'auto' | 'dark' | 'paper' | 'modern' | 'contrast';

export const READER_THEMES: ReadonlyArray<{ id: ReaderTheme; label: string }> = [
  { id: 'auto', label: 'Auto' },
  { id: 'dark', label: 'Dark' },
  { id: 'paper', label: 'Paper' },
  { id: 'modern', label: 'Modern' },
  { id: 'contrast', label: 'Contrast' },
];

/** Space between lines of Arabic, as a line-height multiple. Taller lines are easier to track for many readers. */
export const LINE_SPACINGS: ReadonlyArray<{ id: 'compact' | 'normal' | 'relaxed' | 'loose'; label: string; value: number }> = [
  { id: 'compact', label: 'Compact', value: 1.8 },
  { id: 'normal', label: 'Normal', value: 2.2 },
  { id: 'relaxed', label: 'Relaxed', value: 2.6 },
  { id: 'loose', label: 'Loose', value: 3 },
];

/** Arabic text sizes in px, smallest to largest. */
export const TEXT_SIZES: readonly number[] = [24, 28, 32, 36, 40, 46];

export interface ReaderSettings {
  theme: ReaderTheme;
  /** Index into TEXT_SIZES. */
  textSize: number;
  /** Index into LINE_SPACINGS. */
  lineSpacing: number;
  script: ScriptId;
  showTranslation: boolean;
  /** Which translation to show: the built-in one, or a QuranEnc one ("quranenc:<key>"). */
  translation: TranslationId;
  showTransliteration: boolean;
  keepScreenOn: boolean;
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  theme: 'auto',
  textSize: 2,
  lineSpacing: 1,
  script: DEFAULT_SCRIPT,
  showTranslation: true,
  translation: PICKTHALL_ID,
  showTransliteration: false,
  keepScreenOn: false,
};

/** The line-height for a stored spacing index; anything out of range reads as the default. */
export const lineHeightFor = (index: number): number => (LINE_SPACINGS[index] ?? LINE_SPACINGS[DEFAULT_READER_SETTINGS.lineSpacing]).value;

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
    lineSpacing: Number.isInteger(v.lineSpacing) && (v.lineSpacing as number) >= 0 && (v.lineSpacing as number) < LINE_SPACINGS.length ? (v.lineSpacing as number) : d.lineSpacing,
    script: SCRIPTS.some((s) => s.id === v.script) ? (v.script as ScriptId) : d.script,
    showTranslation: isBool(v.showTranslation) ? v.showTranslation : d.showTranslation,
    translation: parseTranslationId(v.translation) ? (v.translation as TranslationId) : d.translation,
    showTransliteration: isBool(v.showTransliteration) ? v.showTransliteration : d.showTransliteration,
    keepScreenOn: isBool(v.keepScreenOn) ? v.keepScreenOn : d.keepScreenOn,
  };
};
