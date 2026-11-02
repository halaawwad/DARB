import { useCallback, useState } from 'react';
import type { GeoPoint } from '@/types';
import { getCurrentLocation } from '@/utils/deviceLocation';

export type LocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable';

/**
 * GPS is a nice-to-have, never a requirement: the map stays centred on
 * Ramallah and everything works without it. Location is only requested when
 * the user taps "locate me".
 */
export function useUserLocation() {
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [location, setLocation] = useState<GeoPoint | undefined>();

  const request = useCallback(async () => {
    setStatus('requesting');
    const result = await getCurrentLocation();
    if (!result.ok) {
      setStatus(result.error);
      return undefined;
    }
    setLocation(result.position);
    setStatus('granted');
    return result.position;
  }, []);

  return { location, status, request };
}
