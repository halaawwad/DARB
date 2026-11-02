import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { LayoutDashboard, Repeat } from 'lucide-react-native';

import { AppButton, AppHeader, AppText, Avatar, Card, DetailRow, Screen, Segmented, StatusBadge } from '@/components/ui';
import { TAB_BAR_CLEARANCE } from '@/components/navigation/TabBar';
import { useCompany, useCurrentUser } from '@/hooks/queries';
import { useLocale } from '@/hooks/useLocale';
import { usePreferencesStore, type ThemeMode } from '@/store/preferencesStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';

export default function ProfileScreen() {
  const router = useRouter();
  const { colors, mode, setMode } = useTheme();
  const { t, row } = useLocale();
  const { data: user } = useCurrentUser();
  const { data: company } = useCompany();
  const setRole = usePreferencesStore((s) => s.setRole);

  const switchRole = () => {
    router.replace('/role');
    setRole(undefined);
  };

  return (
    <Screen bottomInset={TAB_BAR_CLEARANCE}>
      <AppHeader title={t('profile.title')} leading="none" size="large" />

      <Card style={{ marginBottom: spacing.lg }}>
        <View style={{ flexDirection: row, alignItems: 'center', gap: spacing.lg, marginBottom: spacing.lg }}>
          <Avatar name={user?.name} size={60} tone="deep" />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <AppText variant="h2">{user?.name ?? ' '}</AppText>
            {user ? <StatusBadge label={t(`role.${user.role}`)} tone="brand" showDot={false} /> : null}
          </View>
        </View>
        <View style={{ gap: spacing.sm }}>
          <DetailRow label={t('profile.company')} value={company?.name} />
          <DetailRow label={t('profile.phone')} value={user?.phone} />
        </View>
      </Card>

      {user?.role === 'manager' ? (
        <Card tone="brand" style={{ marginBottom: spacing.lg }}>
          <View style={{ flexDirection: row, alignItems: 'center', gap: spacing.md }}>
            <View
              style={{ width: 44, height: 44, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft }}
            >
              <LayoutDashboard size={22} color={colors.brand} strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="titleLg">{t('profile.admin')}</AppText>
              <AppText variant="bodySm" color="textSecondary">
                {t('profile.adminBody')}
              </AppText>
            </View>
            <StatusBadge label={t('common.comingSoon')} tone="warning" size="sm" />
          </View>
        </Card>
      ) : null}

      <Card style={{ marginBottom: spacing.xl, gap: spacing.md }}>
        <AppText variant="title">{t('profile.theme')}</AppText>
        <Segmented<ThemeMode>
          variant="inset"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'light', label: t('theme.light') },
            { value: 'dark', label: t('theme.dark') },
            { value: 'system', label: t('theme.system') },
          ]}
        />
      </Card>

      <AppButton
        label={t('profile.switchRole')}
        variant="secondary"
        icon={<Repeat size={18} color={colors.text} strokeWidth={2.3} />}
        onPress={switchRole}
      />
    </Screen>
  );
}
