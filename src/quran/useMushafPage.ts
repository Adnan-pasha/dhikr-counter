import React from 'react';
import { API_BASE, DEFAULT_TRANSLATION, scriptOption, type ScriptId } from './editions';
import { loadIndopak } from './indopak';
import { buildMushafPage, pageUrl, TOTAL_PAGES, type MushafPage } from './pages';

/** The pages kept in memory. Old ones go first, so a long read does not grow without end. */
const CACHE_LIMIT = 48;
const REQUEST_TIMEOUT_MS = 15000;
const cache = new Map<string, MushafPage>();

const remember = (key: string, page: MushafPage): void => {
  cache.delete(key);
  cache.set(key, page);
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
};
const inFlight = new Map<string, Promise<MushafPage>>();

export const clearPageCache = (): void => {
  cache.clear();
  inFlight.clear();
};

const keyOf = (page: number, script: ScriptId, translation: boolean): string => `${page}|${script}|${translation ? 't' : '-'}`;

const getJson = async (url: string): Promise<unknown> => {
  const response = await fetch(url, typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) } : undefined);
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json();
};

/** One page, built from one request per edition. The Arabic must arrive; the translation may fail without hiding it. */
const fetchPage = (page: number, script: ScriptId, translation: boolean): Promise<MushafPage> => {
  const key = keyOf(page, script, translation);
  const hit = cache.get(key);
  if (hit && !hit.partial) return Promise.resolve(hit);
  const pending = inFlight.get(key);
  if (pending) return pending;

  const option = scriptOption(script);
  const request = (async () => {
    const [arabicBody, overlayBody, translationBody, indopak] = await Promise.all([
      getJson(pageUrl(API_BASE, page, option.edition)),
      option.overlay ? getJson(pageUrl(API_BASE, page, option.overlay)).catch(() => null) : Promise.resolve(null),
      translation ? getJson(pageUrl(API_BASE, page, DEFAULT_TRANSLATION)).catch(() => null) : Promise.resolve(null),
      option.bundled ? loadIndopak() : Promise.resolve(null),
    ]);
    const built = buildMushafPage(page, arabicBody, { script, overlayBody, translationBody, indopak });
    if (!built) throw new Error('The page text was not in the expected form');
    // What did not arrive is asked for again the next time the page is opened, instead of staying missing.
    const partial = (translation && !translationBody) || (Boolean(option.overlay) && !overlayBody);
    const result = partial ? { ...built, partial: true } : built;
    remember(key, result);
    return result;
  })();
  inFlight.set(key, request);
  const done = () => inFlight.delete(key);
  request.then(done, done);
  return request;
};

export interface MushafPageState {
  status: 'loading' | 'ready' | 'error';
  page: MushafPage | null;
  retry: () => void;
}

/**
 * The page asked for, with the pages on either side fetched quietly afterwards so turning is instant.
 * A page that is not ready yet is never shown as the previous page's text.
 */
export const useMushafPage = (page: number, script: ScriptId, translation: boolean): MushafPageState => {
  const key = keyOf(page, script, translation);
  const [attempt, setAttempt] = React.useState(0);
  const [failed, setFailed] = React.useState<string | null>(null);
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setFailed(null);
    fetchPage(page, script, translation).then(
      () => {
        if (cancelled) return;
        setTick((n) => n + 1);
        for (const next of [page + 1, page - 1]) {
          if (next >= 1 && next <= TOTAL_PAGES) void fetchPage(next, script, translation).catch(() => {});
        }
      },
      () => { if (!cancelled) setFailed(key); },
    );
    return () => { cancelled = true; };
  }, [page, script, translation, key, attempt]);

  const retry = React.useCallback(() => setAttempt((n) => n + 1), []);
  const ready = cache.get(key) ?? null;
  if (ready) return { status: 'ready', page: ready, retry };
  return { status: failed === key ? 'error' : 'loading', page: null, retry };
};
