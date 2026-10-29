import React from 'react';
import { DEFAULT_READER_SETTINGS, sanitizeReaderSettings, type ReaderSettings } from './settings';

export const READER_SETTINGS_KEY = 'tasbih_reader_settings';

export const loadReaderSettings = (): ReaderSettings => {
  try {
    const raw = localStorage.getItem(READER_SETTINGS_KEY);
    return raw ? sanitizeReaderSettings(JSON.parse(raw)) : DEFAULT_READER_SETTINGS;
  } catch {
    return DEFAULT_READER_SETTINGS;
  }
};

/** Reader preferences, remembered on this device. Storage may be unavailable, so nothing depends on it. */
export const useReaderSettings = () => {
  const [settings, setSettings] = React.useState<ReaderSettings>(loadReaderSettings);

  React.useEffect(() => {
    try {
      localStorage.setItem(READER_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Private mode or a full disk: the choice still applies for this visit.
    }
  }, [settings]);

  const update = React.useCallback((patch: Partial<ReaderSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  return [settings, update] as const;
};
