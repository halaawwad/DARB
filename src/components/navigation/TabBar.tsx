import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Wallet, ClipboardList, Map, Truck, User, Users } from 'lucide-react-native';

import { AppText } from '@/components/ui/AppText';
import { PressableScale } from '@/components/ui/PressableScale';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, screenPadding } from '@/theme/spacing';
import { radius } from '@/theme/radius';
import { shadow } from '@/theme/shadows';
import { duration, spring } from '@/theme/motion';
import { useLocale } from '@/hooks/useLocale';
import { usePreferencesStore } from '@/store/preferencesStore';
import { haptics } from '@/utils/haptics';
import type { Role } from '@/types';
import { ROLE_TABS, tabLabel, type TabName } from './roleTabs';

const ICONS: Record<TabName, typeof Map> = {
  finance: Wallet,
  map: Map,
  customers: Users,
  orders: ClipboardList,
  profile: User,
};

function TabItem({
  tab,
  role,
  focused,
  onPress,
}: {
  tab: TabName;
  role?: Role;
  focused: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useLocale();
  const Icon = tab === 'orders' && role === 'delivery_rep' ? Truck : ICONS[tab];
  const label = t(tabLabel(tab, role));

  const active = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    active.value = focused ? withSpring(1, spring.press) : withTiming(0, { duration: duration.fast });
  }, [focused, active]);

  // The icon lifts slightly and the pill fades in — no bouncing labels.
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -active.value * 2 }],
  }));

  const pillStyle = useAnimatedStyle(() => ({
    opacity: active.value,
    transform: [{ scale: 0.8 + active.value * 0.2 }],
  }));

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.9}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        paddingVertical: spacing.sm,
        minHeight: 52,
      }}
    >
      <View style={{ width: 48, height: 28, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          pointerEvents="none"
          style={[
            // Beige pill behind the navy active icon (surfaceAlt = beige100 in light mode).
            {
              position: 'absolute',
              width: 48,
              height: 28,
              borderRadius: radius.pill,
              backgroundColor: colors.surfaceAlt,
            },
            pillStyle,
          ]}
        />
        <Animated.View style={iconStyle}>
          <Icon
            size={20}
            color={focused ? colors.brand : colors.textTertiary}
            strokeWidth={focused ? 2.3 : 1.9}
          />
        </Animated.View>
      </View>

      <AppText
        variant="caption"
        weight={focused ? 'semibold' : 'medium'}
        numberOfLines={1}
        style={{ color: focused ? colors.brand : colors.textTertiary, fontSize: 11, lineHeight: 15 }}
      >
        {label}
      </AppText>
    </PressableScale>
  );
}

/**
 * Floating tab bar. It sits above the map rather than cutting a band out of it.
 * Tabs come from the role (see roleTabs), and `row` puts the first tab on the
 * reading-start edge — the right in Arabic.
 */
export function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const { colors } = useTheme();
  const { row } = useLocale();
  const insets = useSafeAreaInsets();
  const role = usePreferencesStore((s) => s.role);
  const visible = role ? ROLE_TABS[role] : [];

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: screenPadding,
        paddingBottom: Math.max(insets.bottom, spacing.md),
      }}
      pointerEvents="box-none"
    >
      <View
        style={[
          {
            flexDirection: row,
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderRadius: radius.xxl,
            paddingHorizontal: spacing.xs,
            paddingVertical: spacing.xs,
            borderWidth: StyleSheet.hairlineWidth * 2,
            borderColor: colors.border,
          },
          Platform.OS === 'web' ? ({ backdropFilter: 'blur(18px) saturate(1.4)' } as object) : null,
          shadow.md,
        ]}
      >
        {visible.map((tab) => {
          const index = state.routes.findIndex((route) => route.name === tab);
          const route = state.routes[index];
          if (!route) return null;
          const focused = state.index === index;

          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (focused || event.defaultPrevented) return;
            haptics.select();
            navigateToTab(route.key);
          };

          return <TabItem key={route.key} tab={tab} role={role} focused={focused} onPress={onPress} />;
        })}
      </View>
    </View>
  );
}

/** Space screens leave at the bottom so content clears the floating bar. */
export const TAB_BAR_CLEARANCE = 96;
