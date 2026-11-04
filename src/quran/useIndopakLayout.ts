import React from 'react';
import { loadIndopak } from './indopak';
import { buildIndopakWords, parseLayout, type IndopakWords, type LayoutData } from './indopak-layout';

export const LAYOUT_URL = new URL('./data/indopak-15-lines.json', import.meta.url).href;

export interface IndopakLayoutBundle {
  layout: LayoutData;
  words: IndopakWords;
}

type FetchLike = (url: string) => Promise<{ ok: boolean; status?: number; json: () => Promise<unknown> }>;

let pending: Promise<IndopakLayoutBundle> | null = null;

/** The layout and the words it arranges, fetched together once and kept for the rest of the visit. */
export const loadIndopakLayout = (fetchImpl: FetchLike = (url) => fetch(url)): Promise<IndopakLayoutBundle> => {
  if (pending) return pending;
  const attempt = Promise.all([
    fetchImpl(LAYOUT_URL).then((response) => {
      if (!response.ok) throw new Error(`Layout request failed (${response.status ?? 'no status'})`);
      return response.json();
    }),
    loadIndopak(fetchImpl),
  ]).then(([body, text]) => {
    const layout = parseLayout(body);
    const words = buildIndopakWords(text);
    if (!layout || !words) throw new Error('The 15-line layout files are not valid');
    return { layout, words };
  });
  pending = attempt;
  attempt.catch(() => { if (pending === attempt) pending = null; });
  return attempt;
};

export const clearIndopakLayoutCache = (): void => { pending = null; };

export interface IndopakLayoutState {
  status: 'loading' | 'ready' | 'error';
  data: IndopakLayoutBundle | null;
  retry: () => void;
}

export const useIndopakLayout = (): IndopakLayoutState => {
  const [attempt, setAttempt] = React.useState(0);
  const [state, setState] = React.useState<{ status: 'loading' | 'ready' | 'error'; data: IndopakLayoutBundle | null }>({ status: 'loading', data: null });
  React.useEffect(() => {
    let alive = true;
    setState({ status: 'loading', data: null });
    loadIndopakLayout().then(
      (data) => { if (alive) setState({ status: 'ready', data }); },
      () => { if (alive) setState({ status: 'error', data: null }); },
    );
    return () => { alive = false; };
  }, [attempt]);
  const retry = React.useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
};
