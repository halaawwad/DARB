/**
 * Google Maps style JSON (Android). The goal is a quiet base map: beige land,
 * softened roads and no points of interest competing with customer pins.
 */
type MapStyleElement = {
  featureType?: string;
  elementType?: string;
  stylers: Record<string, string | number>[];
};

export const mapStyleLight: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#F3EEE4' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#5A6478' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#EBDFC8' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#EEE7D8' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#D6E2EC' }] },
];

export const mapStyleDark: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#18233A' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8F99AD' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#121B2E' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#26324A' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#34425E' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#1B2840' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#1B2A44' }] },
];
