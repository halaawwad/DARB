import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type HostInstance } from 'react-native';
import { CustomerMarker } from './CustomerMarker';
import { CheckpointMarker } from './CheckpointMarker';
import { RoadReportMarker } from './RoadReportMarker';
import type { MapSurfaceHandle, MapSurfaceProps } from './types';
import { useLocale } from '@/hooks/useLocale';
import { useTheme } from '@/theme/ThemeProvider';
import type { GeoPoint, GeoRegion } from '@/types';

/**
 * Default (web) implementation — react-native-maps has no browser build.
 *
 * A Leaflet map with Esri satellite imagery plus road and place-name overlays
 * so streets stay readable. No API key. Pins are the shared marker components
 * drawn over the map and re-projected on every move, so they look identical to
 * the native pins.
 *
 * Metro picks `MapSurface.native.tsx` on iOS/Android. This file is also what
 * TypeScript resolves, so both share one contract.
 */

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const SATELLITE = `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`;
const ROADS = `${ESRI}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`;
const PLACES = `${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`;

const toLatLngs = (line: GeoPoint[]) => line.map((p) => [p.latitude, p.longitude] as L.LatLngTuple);

function toBounds(region: GeoRegion): L.LatLngBoundsExpression {
  return [
    [region.latitude - region.latitudeDelta / 2, region.longitude - region.longitudeDelta / 2],
    [region.latitude + region.latitudeDelta / 2, region.longitude + region.longitudeDelta / 2],
  ];
}

export const MapSurface = forwardRef<MapSurfaceHandle, MapSurfaceProps>(function MapSurface(
  {
    region,
    customers,
    selectedCustomerId,
    onSelectCustomer,
    checkpoints,
    onSelectCheckpoint,
    roadReports,
    selectedRoadReportId,
    onSelectRoadReport,
    route,
    userLocation,
    onPressBackground,
    interactive = true,
    style,
  },
  ref,
) {
  const { colors } = useTheme();
  const { t } = useLocale();
  const hostRef = useRef<HostInstance>(null);
  const mapRef = useRef<L.Map | null>(null);
  // Bumped on every pan/zoom frame so the pin overlay re-projects.
  const [, setFrame] = useState(0);

  // Listeners are bound once; read the latest callback through a ref.
  const onBackground = useRef(onPressBackground);
  onBackground.current = onPressBackground;

  useEffect(() => {
    // On web a View ref is the underlying DOM element.
    const host = hostRef.current as unknown as HTMLElement | null;
    if (!host) return;

    // Zoom animation is off so the pin overlay moves in lockstep with the tiles.
    const map = L.map(host, {
      zoomControl: false,
      zoomAnimation: false,
      zoomSnap: 0.25,
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      touchZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
    });
    map.attributionControl.setPrefix(false);
    L.tileLayer(SATELLITE, { maxZoom: 19, attribution: 'Imagery © Esri' }).addTo(map);
    L.tileLayer(ROADS, { maxZoom: 19 }).addTo(map);
    L.tileLayer(PLACES, { maxZoom: 19 }).addTo(map);
    map.setView([region.latitude, region.longitude], 14);

    const redraw = () => setFrame((n) => n + 1);
    map.on('move zoom moveend', redraw);
    map.on('click', () => onBackground.current?.());
    mapRef.current = map;

    // The host may get its real size after mount; fit the region once it has one.
    let fitted = false;
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
      if (!fitted && host.clientWidth > 0 && host.clientHeight > 0) {
        fitted = true;
        map.fitBounds(toBounds(region));
      }
      redraw();
    });
    observer.observe(host);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // Mount once — the screen moves the camera through the handle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The route is a Leaflet polyline — it belongs to the map, not the pin overlay.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !route || route.coordinates.length < 2) return;
    const layers = [
      // A light casing under the route keeps it readable on satellite imagery.
      L.polyline(toLatLngs(route.coordinates), { color: colors.surface, weight: 8, opacity: 0.9 }),
      L.polyline(toLatLngs(route.coordinates), { color: colors.mapRoute, weight: 4.5 }),
    ];
    layers.forEach((layer) => layer.addTo(map));
    return () => layers.forEach((layer) => layer.remove());
  }, [route, colors]);

  useImperativeHandle(ref, () => ({
    animateToRegion: (next, durationMs = 600) => {
      mapRef.current?.flyToBounds(toBounds(next), { duration: durationMs / 1000 });
    },
    fitToCoordinates: (coordinates, edgePadding = { top: 80, right: 40, bottom: 160, left: 40 }, durationMs = 600) => {
      const map = mapRef.current;
      if (!map || !coordinates.length) return;
      if (coordinates.length === 1) {
        map.setView([coordinates[0].latitude, coordinates[0].longitude], Math.max(map.getZoom(), 15));
        return;
      }
      map.flyToBounds(L.latLngBounds(toLatLngs(coordinates)), {
        paddingTopLeft: [edgePadding.left, edgePadding.top],
        paddingBottomRight: [edgePadding.right, edgePadding.bottom],
        duration: durationMs / 1000,
      });
    },
  }));

  const map = mapRef.current;
  const size = map?.getSize();
  const project = (point: GeoPoint) => map!.latLngToContainerPoint([point.latitude, point.longitude]);
  const offscreen = (x: number, y: number) => !size || x < -60 || y < -60 || x > size.x + 60 || y > size.y + 60;
  const userPoint = map && userLocation ? project(userLocation) : null;

  return (
    <View style={[{ backgroundColor: colors.mapLand, overflow: 'hidden' }, style]}>
      <View ref={hostRef} style={[StyleSheet.absoluteFill, { zIndex: 0 }]} />

      {map && size ? (
        <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: 1 }]}>
          {userPoint ? (
            <View
              pointerEvents="none"
              style={{ position: 'absolute', left: userPoint.x - 26, top: userPoint.y - 26, width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}
            >
              <View style={[StyleSheet.absoluteFill, { borderRadius: 26, backgroundColor: colors.info, opacity: 0.18 }]} />
              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: colors.info, borderWidth: 3, borderColor: colors.surface }} />
            </View>
          ) : null}

          {checkpoints?.map((checkpoint) => {
            const { x, y } = project(checkpoint.location);
            if (offscreen(x, y)) return null;
            return (
              <Pressable
                key={checkpoint.id}
                onPress={() => onSelectCheckpoint?.(checkpoint.id)}
                accessibilityRole="button"
                accessibilityLabel={`${checkpoint.name}، ${t(`checkpoint.status.${checkpoint.status}`)}`}
                style={{ position: 'absolute', left: x - 80, top: y - 14, width: 160, alignItems: 'center', zIndex: 2 }}
              >
                <CheckpointMarker status={checkpoint.status} label={checkpoint.name} />
              </Pressable>
            );
          })}

          {roadReports?.map((report) => {
            const { x, y } = project(report.location);
            if (offscreen(x, y)) return null;
            const selected = report.id === selectedRoadReportId;
            return (
              <Pressable
                key={report.id}
                onPress={() => onSelectRoadReport?.(report.id)}
                accessibilityRole="button"
                accessibilityLabel={t(`roadReport.type.${report.type}`)}
                style={{ position: 'absolute', left: x - 24, top: y - (selected ? 44 : 38), width: 48, alignItems: 'center', zIndex: selected ? 6 : 3 }}
              >
                <RoadReportMarker type={report.type} selected={selected} />
              </Pressable>
            );
          })}

          {customers?.map((pin) => {
            const { x, y } = project(pin.location);
            if (offscreen(x, y)) return null;
            const selected = pin.id === selectedCustomerId;
            // Pin height = disc + 6px stem; anchor the stem tip on the point.
            const height = (selected ? 40 : pin.highlighted || pin.sequence ? 34 : 28) + 6;
            return (
              <Pressable
                key={pin.id}
                onPress={() => onSelectCustomer?.(pin.id)}
                accessibilityRole="button"
                accessibilityLabel={pin.label}
                accessibilityState={{ selected }}
                style={{
                  position: 'absolute',
                  left: x - 24,
                  top: y - height,
                  width: 48,
                  alignItems: 'center',
                  zIndex: selected ? 10 : pin.highlighted || pin.sequence ? 5 : 4,
                }}
              >
                <CustomerMarker
                  status={pin.status}
                  sequence={pin.sequence}
                  highlighted={pin.highlighted}
                  dimmed={pin.dimmed}
                  selected={selected}
                />
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
});
