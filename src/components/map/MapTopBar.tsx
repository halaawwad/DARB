import type { ComponentType } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Route, ShieldAlert, Store, TriangleAlert } from 'lucide-react-native';

import { AppText, PressableScale } from '@/components/ui';
import { useLocale } from '@/hooks/useLocale';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/radius';
import { shadow } from '@/theme/shadows';
import { spacing } from '@/theme/spacing';
import type { TranslationKey } from '@/i18n';

export type MapLayer = 'customers' | 'checkpoints' | 'roadReports';

const LAYERS: { id: MapLayer; label: TranslationKey; Icon: ComponentType<{ size: number; color: string; strokeWidth: number }> }[] = [
  { id: 'customers', label: 'map.layers.customers', Icon: Store },
  { id: 'checkpoints', label: 'map.layers.checkpoints', Icon: ShieldAlert },
  { id: 'roadReports', label: 'map.layers.roadReports', Icon: TriangleAlert },
];

interface MapTopBarProps {
  layers: Record<MapLayer, boolean>;
  onToggleLayer: (layer: MapLayer) => void;
  /** "زيارات اليوم · 6 محطات" — shown only when the user has a plan today. */
  planSummary?: string;
}

/** Floating top bar: today's plan summary plus layer toggle chips. */
export function MapTopBar({ layers, onToggleLayer, planSummary }: MapTopBarProps) {
  const { colors } = useTheme();
  const { t, row, alignStart } = useLocale();

  return (
    <View pointerEvents="box-none" style={{ gap: spacing.sm }}>
      {planSummary ? (
        <View
          style={[
            {
              alignSelf: alignStart,
              flexDirection: row,
              alignItems: 'center',
              gap: spacing.sm,
              height: 40,
              paddingHorizontal: spacing.md + 2,
              borderRadius: radius.pill,
              backgroundColor: colors.deep,
            },
            shadow.sm,
          ]}
        >
          <Route size={16} color={colors.accent} strokeWidth={2.4} />
          <AppText variant="label" color="onDeep" numberOfLines={1}>
            {planSummary}
          </AppText>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ flexDirection: row, gap: spacing.sm, paddingVertical: 2 }}
      >
        {LAYERS.map(({ id, label, Icon }) => {
          const active = layers[id];
          return (
            <PressableScale
              key={id}
              onPress={() => onToggleLayer(id)}
              haptic="select"
              scaleTo={0.95}
              accessibilityRole="switch"
              accessibilityState={{ checked: active }}
              accessibilityLabel={t(label)}
              style={[
                {
                  flexDirection: row,
                  alignItems: 'center',
                  gap: spacing.xs + 2,
                  height: 38,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.pill,
                  backgroundColor: active ? colors.brand : colors.glass,
                  borderWidth: StyleSheet.hairlineWidth * 2,
                  borderColor: active ? colors.brand : colors.glassBorder,
                },
                shadow.sm,
              ]}
            >
              <Icon size={15} color={active ? colors.onBrand : colors.textSecondary} strokeWidth={2.3} />
              <AppText variant="label" style={{ color: active ? colors.onBrand : colors.text }}>
                {t(label)}
              </AppText>
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );
}
