export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface GeoRegion extends GeoPoint {
  latitudeDelta: number;
  longitudeDelta: number;
}

/** ISO-8601 timestamp string. */
export type IsoDate = string;
