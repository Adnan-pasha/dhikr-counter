import React from 'react';
import { API_BASE, DEFAULT_TRANSLATION } from './editions';

const cache = new Map<number, string[]>();

export const clearAyahTranslationCache = (): void => cache.clear();

type FetchLike = (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

/** The built-in English translation of one surah, ayah by ayah. Null when it could not be fetched or read. */
export const fetchSurahTranslation = async (surah: number, fetchImpl: FetchLike = (url) => fetch(url)): Promise<string[] | null> => {
  const hit = cache.get(surah);
  if (hit) return hit;
  try {
    const response = await fetchImpl(`${API_BASE}/surah/${surah}/${DEFAULT_TRANSLATION}`);
    if (!response.ok) return null;
    const body = (await response.json()) as { code?: number; data?: { ayahs?: Array<{ text?: unknown }> } };
    const ayahs = body.code === 200 ? body.data?.ayahs : undefined;
    if (!Array.isArray(ayahs) || ayahs.length === 0 || !ayahs.every((a) => typeof a.text === 'string')) return null;
    const texts = ayahs.map((a) => a.text as string);
    cache.set(surah, texts);
    return texts;
  } catch {
    return null;
  }
};

/** The translation of one ayah, once it arrives. Null while loading, when off, or when it could not be had. */
export const useAyahTranslation = (surah: number | null, ayah: number | null, enabled: boolean): string | null => {
  const [texts, setTexts] = React.useState<{ surah: number; texts: string[] } | null>(null);
  React.useEffect(() => {
    if (!enabled || surah === null) return;
    let alive = true;
    fetchSurahTranslation(surah).then((t) => { if (alive && t) setTexts({ surah, texts: t }); });
    return () => { alive = false; };
  }, [surah, enabled]);
  if (!enabled || surah === null || ayah === null || texts?.surah !== surah) return null;
  return texts.texts[ayah - 1] ?? null;
};
