export interface TelemetryEvent {
  name: string;
  timestamp: string;
  payload?: Record<string, unknown>;
}

const KEY = 'tasbih_telemetry_events';
const MAX_EVENTS = 200;

export const trackEvent = (name: string, payload?: Record<string, unknown>) => {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const events = Array.isArray(parsed) ? parsed : [];
    const next: TelemetryEvent = { name, timestamp: new Date().toISOString(), payload };
    const trimmed = [...events, next].slice(-MAX_EVENTS);
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.error('Telemetry track failed:', err);
  }
};

export const getTelemetryEvents = (): TelemetryEvent[] => {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
