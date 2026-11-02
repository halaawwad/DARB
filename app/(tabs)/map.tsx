import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mic } from 'lucide-react-native';

import { MapSurface } from '@/components/map/MapSurface';
import { MapTopBar, type MapLayer } from '@/components/map/MapTopBar';
import { MapControlRail } from '@/components/map/MapControlRail';
import { MapSelectionSheet, type MapSelection } from '@/components/map/MapSelectionSheet';
import type { MapCustomerPin, MapSurfaceHandle } from '@/components/map/types';
import { TAB_BAR_CLEARANCE } from '@/components/navigation/TabBar';
import { canTakeOrders } from '@/components/navigation/roleTabs';
import { IconButton } from '@/components/ui';
import { DEFAULT_REGION } from '@/data/mapDefaults';
import { useCheckpoints, useCurrentUser, useCustomers, useRoadReports, useTodayPlan } from '@/hooks/queries';
import { useLocale } from '@/hooks/useLocale';
import { useUserLocation } from '@/hooks/useUserLocation';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme } from '@/theme/ThemeProvider';
import { brandGlow } from '@/theme/shadows';
import { screenPadding, spacing } from '@/theme/spacing';
import type { GeoPoint } from '@/types';

/**
 * Main screen: full-screen map with floating chrome (top bar, control rail,
 * mic FAB) and a bottom sheet for whatever was tapped. Sales reps see today's
 * visits highlighted; delivery reps see numbered stops. Both get a straight-line
 * route through their stops.
 */
export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t, isRTL } = useLocale();
  const role = usePreferencesStore((s) => s.role);
  const mapRef = useRef<MapSurfaceHandle>(null);
  const location = useUserLocation();

  const { data: user } = useCurrentUser();
  const { data: plan } = useTodayPlan(user?.id);
  const { data: customers = [] } = useCustomers();
  const { data: checkpoints = [] } = useCheckpoints();
  const { data: roadReports = [] } = useRoadReports();

  const [layers, setLayers] = useState<Record<MapLayer, boolean>>({ customers: true, checkpoints: true, roadReports: true });
  const [selection, setSelection] = useState<MapSelection>();

  const sequenceByCustomer = useMemo(
    () => new Map(plan?.stops.map((stop) => [stop.customerId, stop.sequence]) ?? []),
    [plan],
  );

  const route = useMemo(() => {
    const coordinates = (plan?.stops ?? [])
      .map((stop) => customers.find((customer) => customer.id === stop.customerId)?.location)
      .filter((point): point is GeoPoint => Boolean(point));
    return coordinates.length > 1 ? { coordinates } : undefined;
  }, [plan, customers]);

  const pins = useMemo<MapCustomerPin[]>(
    () =>
      customers.map((customer) => {
        const onPlan = sequenceByCustomer.has(customer.id);
        return {
          id: customer.id,
          location: customer.location,
          status: customer.status,
          label: customer.shopName,
          sequence: plan?.kind === 'deliveries' ? sequenceByCustomer.get(customer.id) : undefined,
          highlighted: plan?.kind === 'visits' && onPlan,
          dimmed: Boolean(plan) && !onPlan,
        };
      }),
    [customers, plan, sequenceByCustomer],
  );

  // Frame today's route once it first loads.
  const framed = useRef(false);
  const fitRoute = () => route && mapRef.current?.fitToCoordinates(route.coordinates, edgePadding);
  useEffect(() => {
    if (!route || framed.current) return;
    framed.current = true;
    const timer = setTimeout(fitRoute, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  const edgePadding = { top: insets.top + 140, right: 48, bottom: TAB_BAR_CLEARANCE + insets.bottom + 40, left: 48 };

  const locate = async () => {
    const point = await location.request();
    if (point) mapRef.current?.animateToRegion({ ...point, latitudeDelta: 0.012, longitudeDelta: 0.012 });
  };

  const select = {
    customer: (id: string) => {
      const item = customers.find((c) => c.id === id);
      if (item) setSelection({ kind: 'customer', item });
    },
    checkpoint: (id: string) => {
      const item = checkpoints.find((c) => c.id === id);
      if (item) setSelection({ kind: 'checkpoint', item });
    },
    roadReport: (id: string) => {
      const item = roadReports.find((r) => r.id === id);
      if (item) setSelection({ kind: 'roadReport', item });
    },
  };

  const openVoiceOrder = (customerId?: string) => {
    setSelection(undefined);
    router.push(customerId ? { pathname: '/voice-order', params: { customerId } } : '/voice-order');
  };

  const planSummary = plan
    ? `${t(plan.kind === 'visits' ? 'map.todayVisits' : 'map.todayDeliveries')} · ${t('map.stopsCount', { count: plan.stops.length })}`
    : undefined;

  const sideEnd = isRTL ? 'left' : 'right';
  const sideStart = isRTL ? 'right' : 'left';
  const takesOrders = canTakeOrders(role);

  return (
    <View style={{ flex: 1, backgroundColor: colors.mapLand }}>
      <MapSurface
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        region={DEFAULT_REGION}
        customers={layers.customers ? pins : undefined}
        selectedCustomerId={selection?.kind === 'customer' ? selection.item.id : undefined}
        onSelectCustomer={select.customer}
        checkpoints={layers.checkpoints ? checkpoints : undefined}
        onSelectCheckpoint={select.checkpoint}
        roadReports={layers.roadReports ? roadReports : undefined}
        selectedRoadReportId={selection?.kind === 'roadReport' ? selection.item.id : undefined}
        onSelectRoadReport={select.roadReport}
        route={route}
        userLocation={location.location}
        onPressBackground={() => setSelection(undefined)}
      />

      <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + spacing.md, left: screenPadding, right: screenPadding }}>
        <MapTopBar
          layers={layers}
          onToggleLayer={(layer) => setLayers((current) => ({ ...current, [layer]: !current[layer] }))}
          planSummary={planSummary}
        />
      </View>

      <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 132, [sideEnd]: screenPadding }}>
        <MapControlRail locationStatus={location.status} onLocate={locate} onFitRoute={route ? fitRoute : undefined} />
      </View>

      {takesOrders ? (
        <View style={{ position: 'absolute', bottom: insets.bottom + TAB_BAR_CLEARANCE, [sideStart]: screenPadding }}>
          <IconButton
            icon={<Mic size={26} color={colors.onBrand} strokeWidth={2.3} />}
            tone="brand"
            size={60}
            onPress={() => openVoiceOrder()}
            accessibilityLabel={t('voice.title')}
            style={[brandGlow, { borderWidth: 3, borderColor: colors.accent }]}
          />
        </View>
      ) : null}

      <MapSelectionSheet
        selection={selection}
        onClose={() => setSelection(undefined)}
        onOpenProfile={(id) => {
          setSelection(undefined);
          router.push({ pathname: '/customer/[id]', params: { id } });
        }}
        onVoiceOrder={takesOrders ? openVoiceOrder : undefined}
      />
    </View>
  );
}
