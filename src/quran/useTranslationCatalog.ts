import React from 'react';
import { catalogUrl, parseCatalog, type CatalogEntry } from './translations';

export const CATALOG_KEY = 'tasbih_quran_translation_catalog';

export type CatalogStatus = 'loading' | 'ready' | 'cached' | 'error';

const loadSaved = (): CatalogEntry[] => {
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    return raw ? parseCatalog({ translations: JSON.parse(raw).map(fromSaved) }) : [];
  } catch {
    return [];
  }
};

// Saved entries use the reader's own field names; parseCatalog reads QuranEnc's, so translate back.
const fromSaved = (e: CatalogEntry) => ({
  key: e?.key, title: e?.title, language_iso_code: e?.language, direction: e?.direction, version: e?.version, last_update: e?.lastUpdate,
});

/**
 * The list of QuranEnc translations. The last good copy is kept on the device, so the picker and the
 * credit line still work with no network. An empty answer counts as a failure, never as "no translations".
 */
export const useTranslationCatalog = () => {
  const [entries, setEntries] = React.useState<CatalogEntry[]>(loadSaved);
  const [status, setStatus] = React.useState<CatalogStatus>('loading');
  const attempt = React.useRef(0);

  const load = React.useCallback(() => {
    const id = ++attempt.current;
    setStatus('loading');
    fetch(catalogUrl())
      .then((r) => r.json())
      .then((body) => {
        const parsed = parseCatalog(body);
        if (parsed.length === 0) throw new Error('empty catalogue');
        if (id !== attempt.current) return;
        setEntries(parsed);
        setStatus('ready');
        try {
          localStorage.setItem(CATALOG_KEY, JSON.stringify(parsed));
        } catch {
          // Storage unavailable: the list still works for this visit.
        }
      })
      .catch(() => {
        if (id !== attempt.current) return;
        setStatus(loadSaved().length > 0 ? 'cached' : 'error');
      });
  }, []);

  React.useEffect(() => {
    load();
    return () => { attempt.current += 1; };
  }, [load]);

  return { entries, status, retry: load } as const;
};
