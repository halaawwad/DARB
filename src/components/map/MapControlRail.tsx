import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { LocateFixed, Route } from 'lucide-react-native';

import { AppText, PressableScale } from '@/components/ui';
import { useLocale } from '@/hooks/useLocale';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/radius';
import { shadow } from '@/theme/shadows';
import { spacing } from '@/theme/spacing';
import type { LocationStatus } from '@/hooks/useUserLocation';

interface MapControlRailProps {
  locationStatus: LocationStatus;
  onLocate: () => void;
  /** Shown only when there is a route to frame. */
  onFitRoute?: () => void;
}

/** Floating vertical rail on the reading-end edge: locate me, frame today's route. */
export function MapControlRail({ locationStatus, onLocate, onFitRoute }: MapControlRailProps) {
  const { colors } = useTheme();
  const { t, alignEnd } = useLocale();
  const hasLocationProblem = locationStatus === 'denied' || locationStatus === 'unavailable';
  const message =
    locationStatus === 'denied' ? t('map.locationDenied') : locationStatus === 'unavailable' ? t('map.locationUnavailable') : undefined;

  return (
    <View style={{ alignItems: alignEnd, gap: spacing.sm }} pointerEvents="box-none">
      {message ? (
        <View
          style={[
            { maxWidth: 210, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface },
            shadow.sm,
          ]}
        >
          <AppText variant="caption" color="textSecondary">
            {message}
          </AppText>
        </View>
      ) : null}

      <View style={[{ width: 44, overflow: 'hidden', borderRadius: radius.pill, backgroundColor: colors.surface }, shadow.md]}>
        <PressableScale
          onPress={onLocate}
          disabled={locationStatus === 'requesting'}
          haptic="light"
          accessibilityRole="button"
          accessibilityLabel={t('map.locate')}
          accessibilityState={{ disabled: locationStatus === 'requesting' }}
          style={[styles.button, { backgroundColor: hasLocationProblem ? colors.dangerSoft : colors.surface }]}
        >
          {locationStatus === 'requesting' ? (
            <ActivityIndicator size="small" color={colors.brand} />
          ) : (
            <LocateFixed size={19} color={hasLocationProblem ? colors.dangerText : colors.text} strokeWidth={2.3} />
          )}
        </PressableScale>
        {onFitRoute ? (
          <>
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider }} />
            <PressableScale
              onPress={onFitRoute}
              haptic="light"
              accessibilityRole="button"
              accessibilityLabel={t('map.fitRoute')}
              style={styles.button}
            >
              <Route size={19} color={colors.brand} strokeWidth={2.3} />
            </PressableScale>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
