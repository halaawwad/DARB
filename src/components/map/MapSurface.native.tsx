import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { Platform, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { CustomerMarker } from './CustomerMarker';
import { CheckpointMarker } from './CheckpointMarker';
import { RoadReportMarker } from './RoadReportMarker';
import { mapStyleDark, mapStyleLight } from './mapStyle';
import type { MapSurfaceHandle, MapSurfaceProps } from './types';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Google Maps on Android; Apple Maps on iOS (custom JSON styling only applies to
 * the Google provider, which is why the style array is passed conditionally).
 */
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
  const { isDark, colors } = useTheme();
  const mapRef = useRef<MapView>(null);

  useImperativeHandle(ref, () => ({
    animateToRegion: (next, durationMs = 500) => {
      mapRef.current?.animateToRegion(next as Region, durationMs);
    },
    fitToCoordinates: (coordinates, edgePadding = { top: 80, right: 40, bottom: 160, left: 40 }) => {
      mapRef.current?.fitToCoordinates(coordinates, { edgePadding, animated: true });
    },
  }));

  const customMapStyle = useMemo(
    () => (Platform.OS === 'android' ? (isDark ? mapStyleDark : mapStyleLight) : undefined),
    [isDark],
  );

  return (
    <View style={style}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={region as Region}
        customMapStyle={customMapStyle}
        showsUserLocation={Boolean(userLocation)}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        onPress={() => onPressBackground?.()}
      >
        {route && route.coordinates.length > 1 ? (
          <>
            {/* A light casing under the route keeps it readable on any base map. */}
            <Polyline coordinates={route.coordinates} strokeColor={colors.surface} strokeWidth={8} lineCap="round" lineJoin="round" />
            <Polyline coordinates={route.coordinates} strokeColor={colors.mapRoute} strokeWidth={4.5} lineCap="round" lineJoin="round" />
          </>
        ) : null}

        {checkpoints?.map((checkpoint) => (
          <Marker
            key={`${checkpoint.id}-${checkpoint.status}`}
            coordinate={checkpoint.location}
            onPress={(event) => {
              event.stopPropagation();
              onSelectCheckpoint?.(checkpoint.id);
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={20}
            accessibilityLabel={checkpoint.name}
          >
            <CheckpointMarker status={checkpoint.status} label={checkpoint.name} />
          </Marker>
        ))}

        {roadReports?.map((report) => (
          <Marker
            key={`${report.id}-${report.id === selectedRoadReportId}`}
            coordinate={report.location}
            onPress={(event) => {
              event.stopPropagation();
              onSelectRoadReport?.(report.id);
            }}
            anchor={{ x: 0.5, y: 1 }}
            zIndex={report.id === selectedRoadReportId ? 60 : 30}
          >
            <RoadReportMarker type={report.type} selected={report.id === selectedRoadReportId} />
          </Marker>
        ))}

        {customers?.map((pin) => {
          const selected = pin.id === selectedCustomerId;
          return (
            <Marker
              // Re-keyed on visual state so Android redraws the custom view.
              key={`${pin.id}-${selected}-${pin.highlighted}-${pin.dimmed}-${pin.sequence ?? ''}`}
              coordinate={pin.location}
              onPress={(event) => {
                // Stop the tap also registering as a background press.
                event.stopPropagation();
                onSelectCustomer?.(pin.id);
              }}
              anchor={{ x: 0.5, y: 1 }}
              zIndex={selected ? 100 : pin.highlighted || pin.sequence ? 50 : 40}
              accessibilityLabel={pin.label}
            >
              <CustomerMarker
                status={pin.status}
                sequence={pin.sequence}
                highlighted={pin.highlighted}
                dimmed={pin.dimmed}
                selected={selected}
              />
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
});
