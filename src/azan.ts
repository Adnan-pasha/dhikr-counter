import type { AzanSound } from './types';

export interface AzanSource {
  id: AzanSound;
  label: string;
  /** Path relative to the app base (a file in public/), so it works offline and under any base URL. */
  path: string;
  /** Absolute URL for the current deployment. */
  url: string;
}

const baseUrl = (): string => {
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL;
  return base ?? '/';
};

const makeSource = (id: AzanSound, label: string, path: string): AzanSource => ({
  id,
  label,
  path,
  get url() {
    return `${baseUrl()}${path}`;
  },
});

/** Every adhan the app plays is bundled and precached; nothing is streamed from third parties. */
export const AZAN_SOURCES: Record<AzanSound, AzanSource> = {
  standard: makeSource('standard', 'Standard adhan', 'audio/adhan.m4a'),
};

/** Resolve any stored value (including legacy 'mecca'/'medina') to a bundled source. */
export const getAzanSource = (id?: string): AzanSource =>
  (id && (AZAN_SOURCES as Record<string, AzanSource>)[id]) || AZAN_SOURCES.standard;
