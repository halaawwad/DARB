import * as Location from 'expo-location';
import type { GeoPoint } from '@/types';

/**
 * Device location for the map. iOS/Android use expo-location; the web build has
 * its own implementation in `deviceLocation.web.ts`, because expo-location's web
 * shim can wait forever without a fix.
 */
export type LocationFailure = 'denied' | 'unavailable';

export type LocationResult = { ok: true; position: GeoPoint } | { ok: false; error: LocationFailure };

/** One position, asking for permission first when needed. */
export async function getCurrentLocation(): Promise<LocationResult> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return { ok: false, error: 'denied' };
    const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { ok: true, position: { latitude: coords.latitude, longitude: coords.longitude } };
  } catch (error) {
    return { ok: false, error: /denied|permission/i.test(String(error)) ? 'denied' : 'unavailable' };
  }
}
