import React from 'react';
import { deviceTimeZone } from './prayerTimes';
import { readPrayerLocation, readPrayerPlace, writePrayerLocation, type CityPreset, type SavedPrayerLocation } from './places';

/**
 * A quick, approximate fix is plenty for prayer times and arrives in a second or two, even indoors. The long timeout
 * leaves time to answer the phone's permission prompt, which the clock runs through.
 */
const QUICK_LOOK: PositionOptions = { enableHighAccuracy: false, timeout: 20_000, maximumAge: 10 * 60_000 };
/** Tried once when the quick look finds nothing: the phone's GPS chip, which can take a while to warm up. */
const PATIENT_LOOK: PositionOptions = { enableHighAccuracy: true, timeout: 30_000, maximumAge: 0 };
const PERMISSION_DENIED = 1;

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
  // What the visibility listener needs to know without being re-created: whether there is a place, a look in
  // progress, or a failed one worth repeating.
  const placeRef = React.useRef(place);
  placeRef.current = place;
  const loadingRef = React.useRef(false);
  const failedRef = React.useRef(false);

  const requestGps = React.useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsError('Location is not supported here. Choose a city instead.');
      return;
    }
    const request = ++latestRequest.current;
    loadingRef.current = true;
    failedRef.current = false;
    setGpsLoading(true);
    setGpsError(null);
    const look = (options: PositionOptions, canRetry: boolean) => navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (request !== latestRequest.current) return;
        const where = { lat: coords.latitude, lng: coords.longitude, timeZone: deviceTimeZone(), label: 'My location' };
        loadingRef.current = false;
        setPlace(writePrayerLocation(where, 'gps') ?? { ...where, source: 'gps' });
        setGpsLoading(false);
      },
      (failure) => {
        if (request !== latestRequest.current) return;
        // Nothing found quickly (timed out, or no signal yet): one patient try with the GPS chip before giving up.
        if (canRetry && failure.code !== PERMISSION_DENIED) {
          look(PATIENT_LOOK, false);
          return;
        }
        loadingRef.current = false;
        failedRef.current = true;
        setGpsError(failure.code === PERMISSION_DENIED
          ? 'Location permission was denied. Allow it in your phone settings, or choose a city.'
          : 'Could not find your location. Choose a city instead.');
        setGpsLoading(false);
      },
      options,
    );
    look(QUICK_LOOK, true);
  }, []);

  const selectCity = React.useCallback((city: CityPreset) => {
    latestRequest.current += 1;
    loadingRef.current = false;
    failedRef.current = false;
    setGpsLoading(false);
    setGpsError(null);
    const where = { lat: city.lat, lng: city.lng, timeZone: city.timeZone, label: city.name };
    setPlace(writePrayerLocation(where, 'city') ?? { ...where, source: 'city' });
  }, []);

  // Only a GPS place (or none) is refreshed on opening: a chosen city stays.
  React.useEffect(() => {
    if (!initial || initial.source === 'gps') requestGps();
  }, [initial, requestGps]);

  // Coming back to the app after a failed look (say, after allowing location in Settings) tries again once.
  React.useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'hidden') return;
      if (placeRef.current || loadingRef.current || !failedRef.current) return;
      requestGps();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [requestGps]);

  return { place, gpsLoading, gpsError, requestGps, selectCity };
};
