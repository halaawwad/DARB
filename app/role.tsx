import { useRef, useState, type ComponentType } from 'react';
import { Alert, Keyboard, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Warehouse, Briefcase, Calculator, ShoppingBag, Truck } from 'lucide-react-native';

import { AppButton, AppText, BottomSheet, Card, Screen } from '@/components/ui';
import { homeRoute } from '@/components/navigation/roleTabs';
import { useLocale } from '@/hooks/useLocale';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';
import { ROLES, type Role } from '@/types';
import { haptics } from '@/utils/haptics';
import { ApiError, testLogin } from '@/services/http/apiClient';

const ICONS: Record<Role, ComponentType<{ size: number; color: string; strokeWidth: number }>> = {
  manager: Briefcase,
  sales_rep: ShoppingBag,
  delivery_rep: Truck,
  accountant: Calculator,
  warehouse_staff: Warehouse,
};

/** Existing demo role navigation, with a temporary real login test for Manager. */
export default function RoleScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t, row } = useLocale();
  const setRole = usePreferencesStore((s) => s.setRole);
  const [loginVisible, setLoginVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);

  const choose = (role: Role) => {
    haptics.medium();
    setRole(role);
    router.replace(homeRoute(role));
  };

  const closeLogin = () => {
    if (busy.current) return;
    setEmail('');
    setPassword('');
    setLoginVisible(false);
    Keyboard.dismiss();
  };

  const openManagerLogin = () => {
    haptics.medium();
    setEmail('');
    setPassword('');
    setLoginVisible(true);
  };

  const submitLogin = async () => {
    if (busy.current) return;
    busy.current = true;
    setSubmitting(true);
    Keyboard.dismiss();
    try {
      const name = await testLogin(email, password);
      Alert.alert(
        t('login.success'),
        name,
        [
          {
            text: t('common.continue'),
            onPress: () => {
              setLoginVisible(false);
              choose('manager');
            },
          },
        ],
        { cancelable: false },
      );
    } catch (error) {
      Alert.alert(t('login.failed'), error instanceof ApiError ? error.message : t('common.somethingWrong'));
    } finally {
      // Credentials are temporary input only; never persist or log them.
      setEmail('');
      setPassword('');
      busy.current = false;
      setSubmitting(false);
    }
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
      <AppText
        variant="bodySm"
        color="textSecondary"
        style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}
      >
        {t('rolePicker.subtitle')}
      </AppText>

      <View style={{ gap: spacing.md }}>
        {ROLES.map((role) => {
          const Icon = ICONS[role];
          return (
            <Card
              key={role}
              onPress={() => (role === 'manager' ? openManagerLogin() : choose(role))}
              accessibilityLabel={t(`role.${role}`)}
              padding="lg"
            >
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

      <BottomSheet
        visible={loginVisible}
        onClose={closeLogin}
        title={t('login.title')}
        dismissible={!submitting}
        scrollable
      >
        <View style={{ gap: spacing.md }}>
          <AppText variant="label">{t('login.email')}</AppText>
          <TextInput
            value={email}
            onChangeText={setEmail}
            accessibilityLabel={t('login.email')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            textContentType="none"
            importantForAutofill="no"
            editable={!submitting}
            style={{
              color: colors.text,
              backgroundColor: colors.surface,
              borderColor: colors.borderStrong,
              borderWidth: 1,
              borderRadius: radius.md,
              padding: spacing.md,
              fontSize: 16,
              textAlign: 'left',
            }}
          />
          <AppText variant="label">{t('login.password')}</AppText>
          <TextInput
            value={password}
            onChangeText={setPassword}
            accessibilityLabel={t('login.password')}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            textContentType="none"
            importantForAutofill="no"
            editable={!submitting}
            onSubmitEditing={() => {
              if (email.trim() && password) void submitLogin();
            }}
            returnKeyType="go"
            style={{
              color: colors.text,
              backgroundColor: colors.surface,
              borderColor: colors.borderStrong,
              borderWidth: 1,
              borderRadius: radius.md,
              padding: spacing.md,
              fontSize: 16,
              textAlign: 'left',
            }}
          />
          <AppButton
            label={t('login.submit')}
            loading={submitting}
            disabled={!email.trim() || !password}
            onPress={() => void submitLogin()}
          />
          <AppButton label={t('common.cancel')} variant="ghost" disabled={submitting} onPress={closeLogin} />
        </View>
      </BottomSheet>
    </Screen>
  );
}
