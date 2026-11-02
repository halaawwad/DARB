import type { StyleProp, ViewStyle } from 'react-native';
import type { Checkpoint, CustomerStatus, GeoPoint, GeoRegion, RoadReport } from '@/types';

/** A customer as the map draws it. */
export interface MapCustomerPin {
  id: string;
  location: GeoPoint;
  status: CustomerStatus;
  /** Accessibility label: shop name. */
  label: string;
  /** Delivery stop number (1..n) — drawn inside the pin. */
  sequence?: number;
  /** On today's plan: drawn larger with an accent ring. */
  highlighted?: boolean;
  /** Not on today's plan while a plan is shown: drawn faded. */
  dimmed?: boolean;
}

export interface MapRoute {
  /** Straight segments joining today's stops in order — no routing engine. */
  coordinates: GeoPoint[];
}

/**
 * Platform-agnostic map contract. The native implementation renders
 * react-native-maps; the web implementation renders Leaflet with Esri tiles
 * (no API key) so the app is fully previewable in a browser. Screens only ever
 * see this interface.
 */
export interface MapSurfaceProps {
  region: GeoRegion;
  customers?: MapCustomerPin[];
  selectedCustomerId?: string;
  onSelectCustomer?: (id: string) => void;
  checkpoints?: Checkpoint[];
  onSelectCheckpoint?: (id: string) => void;
  roadReports?: RoadReport[];
  selectedRoadReportId?: string;
  onSelectRoadReport?: (id: string) => void;
  route?: MapRoute;
  userLocation?: GeoPoint;
  onPressBackground?: () => void;
  /** False for small embedded previews: no panning or zooming. */
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
}

export interface MapSurfaceHandle {
  animateToRegion: (region: GeoRegion, durationMs?: number) => void;
  fitToCoordinates: (
    coordinates: GeoPoint[],
    edgePadding?: { top: number; right: number; bottom: number; left: number },
    durationMs?: number,
  ) => void;
}
