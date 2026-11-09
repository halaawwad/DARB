import type { ComponentType } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Briefcase, Calculator, ShoppingBag, Truck } from 'lucide-react-native';

import { AppText, Card, Screen } from '@/components/ui';
import { homeRoute } from '@/components/navigation/roleTabs';
import { useLocale } from '@/hooks/useLocale';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';
import { ROLES, type Role } from '@/types';
import { haptics } from '@/utils/haptics';

const ICONS: Record<Role, ComponentType<{ size: number; color: string; strokeWidth: number }>> = {
  manager: Briefcase,
  sales_rep: ShoppingBag,
  delivery_rep: Truck,
  accountant: Calculator,
};

/** Demo mode: pick a role and use the mock data, no server needed. */
export default function RoleScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t, row } = useLocale();
  const signInDemo = useAuthStore((s) => s.signInDemo);

  const choose = (role: Role) => {
    haptics.medium();
    signInDemo(role);
    router.replace(homeRoute(role));
  };

  return (
    <Screen>
      <View style={{ gap: spacing.xs, marginTop: spacing.xxl, marginBottom: spacing.xxl }}>
        <AppText variant="display" color="brand">
          {t('brand.name')}
        </AppText>
        <AppText variant="bodySm" color="textSecondary">
          {t('brand.tagline')}
        </AppText>
      </View>

      <AppText variant="h2">{t('rolePicker.title')}</AppText>
      <AppText variant="bodySm" color="textSecondary" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
        {t('rolePicker.subtitle')}
      </AppText>

      <View style={{ gap: spacing.md }}>
        {ROLES.map((role) => {
          const Icon = ICONS[role];
          return (
            <Card key={role} onPress={() => choose(role)} accessibilityLabel={t(`role.${role}`)} padding="lg">
              <View style={{ flexDirection: row, alignItems: 'center', gap: spacing.md }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: radius.lg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.brandSoft,
                  }}
                >
                  <Icon size={22} color={colors.brand} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="titleLg">{t(`role.${role}`)}</AppText>
                  <AppText variant="bodySm" color="textSecondary">
                    {t(`role.${role}.body`)}
                  </AppText>
                </View>
              </View>
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}