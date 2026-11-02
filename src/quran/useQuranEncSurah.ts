import React from 'react';
import { parseQuranEncSurah, surahTranslationUrl, type TranslatedAyah } from './translations';

export type SurahTranslationStatus = 'idle' | 'loading' | 'ready' | 'error';

interface State {
  status: SurahTranslationStatus;
  map: Map<number, TranslatedAyah> | null;
}

const IDLE: State = { status: 'idle', map: null };

/**
 * One surah of a QuranEnc translation. Changing the translation or the surah clears the previous text at
 * once, and an answer that arrives after you have moved on is ignored, so text is never shown under the
 * wrong name.
 */
export const useQuranEncSurah = (key: string | null, surah: number | null) => {
  const [state, setState] = React.useState<State>(key && surah ? { status: 'loading', map: null } : IDLE);
  const [attempt, setAttempt] = React.useState(0);

  // Clear during render, not in an effect, so even the first paint after a switch cannot show old text.
  const lastRequest = React.useRef(`${key}|${surah}|${attempt}`);
  const request = `${key}|${surah}|${attempt}`;
  if (lastRequest.current !== request) {
    lastRequest.current = request;
    setState(key && surah ? { status: 'loading', map: null } : IDLE);
  }

  React.useEffect(() => {
    if (!key || !surah) return;
    let cancelled = false;
    fetch(surahTranslationUrl(key, surah))
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        const map = parseQuranEncSurah(body);
        setState(map ? { status: 'ready', map } : { status: 'error', map: null });
      })
      .catch(() => { if (!cancelled) setState({ status: 'error', map: null }); });
    return () => { cancelled = true; };
  }, [key, surah, attempt]);

  const retry = React.useCallback(() => setAttempt((n) => n + 1), []);
  return { status: state.status, map: state.map, retry } as const;
};
