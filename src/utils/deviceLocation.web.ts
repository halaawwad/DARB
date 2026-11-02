import type { LocationResult } from './deviceLocation';

export type { LocationFailure, LocationResult } from './deviceLocation';

/** Browser geolocation with a timeout; the browser's own prompt is the permission request. */
export function getCurrentLocation(): Promise<LocationResult> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve({ ok: false, error: 'unavailable' });
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ ok: true, position: { latitude: coords.latitude, longitude: coords.longitude } }),
      (error) => resolve({ ok: false, error: error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable' }),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 },
    );
  });
}
