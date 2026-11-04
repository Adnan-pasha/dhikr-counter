import React from 'react';
import { deviceTimeZone } from './prayerTimes';
import { readPrayerLocation, readPrayerPlace, writePrayerLocation, type CityPreset, type SavedPrayerLocation } from './places';

const GPS_TIMEOUT_MS = 8000;

export interface PrayerPlaceState {
  /** Where prayer times are worked out for. Null until the user allows GPS or picks a city: there is no default place. */
  place: SavedPrayerLocation | null;
  gpsLoading: boolean;
  gpsError: string | null;
  /** Ask the phone where it is. Replaces a chosen city once a fix arrives. */
  requestGps: () => void;
  selectCity: (city: CityPreset) => void;
}

/**
 * The place the user's prayer times are for. It is remembered between visits. A city picked on purpose is
 * never overridden by GPS when the screen opens, and a GPS request still in flight when a city is picked
 * is dropped, so the later answer cannot undo the choice.
 */
export const usePrayerPlace = (): PrayerPlaceState => {
  const [initial] = React.useState(() => readPrayerLocation());
  const [place, setPlace] = React.useState<SavedPrayerLocation | null>(() => readPrayerPlace());
  const [gpsLoading, setGpsLoading] = React.useState(false);
  const [gpsError, setGpsError] = React.useState<string | null>(null);
  const latestRequest = React.useRef(0);

  const requestGps = React.useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsError('Location is not supported here. Choose a city instead.');
      return;
    }
    const request = ++latestRequest.current;
    setGpsLoading(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (request !== latestRequest.current) return;
        const where = { lat: coords.latitude, lng: coords.longitude, timeZone: deviceTimeZone(), label: 'My location' };
        setPlace(writePrayerLocation(where, 'gps') ?? { ...where, source: 'gps' });
        setGpsLoading(false);
      },
      (failure) => {
        if (request !== latestRequest.current) return;
        setGpsError(failure.code === 1
          ? 'Location permission was denied. Allow it in your phone settings, or choose a city.'
          : 'Could not find your location. Choose a city instead.');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: GPS_TIMEOUT_MS },
    );
  }, []);

  const selectCity = React.useCallback((city: CityPreset) => {
    latestRequest.current += 1;
    setGpsLoading(false);
    setGpsError(null);
    const where = { lat: city.lat, lng: city.lng, timeZone: city.timeZone, label: city.name };
    setPlace(writePrayerLocation(where, 'city') ?? { ...where, source: 'city' });
  }, []);

  // Only a GPS place (or none) is refreshed on opening: a chosen city stays.
  React.useEffect(() => {
    if (!initial || initial.source === 'gps') requestGps();
  }, [initial, requestGps]);

  return { place, gpsLoading, gpsError, requestGps, selectCity };
};
