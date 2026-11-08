import { useRef, useState } from 'react';
import { Keyboard, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { showMessage } from '@/utils/dialog';
import { AppButton, AppText, Screen } from '@/components/ui';
import { homeRoute } from '@/components/navigation/roleTabs';
import { useLocale } from '@/hooks/useLocale';
import { ApiError } from '@/services/http/apiClient';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';
import { haptics } from '@/utils/haptics';


export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useLocale();
  const signIn = useAuthStore((s) => s.signIn);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);

  const inputStyle = {
    color: colors.text,
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    textAlign: 'left' as const,
  };

  const submit = async () => {
    if (busy.current) return;
    busy.current = true;
    setSubmitting(true);
    Keyboard.dismiss();
    try {
      const user = await signIn({ email, password });
      console.log(user.permissions);
      haptics.medium();
      if (user.role) router.replace(homeRoute(user.role));
    } catch (error) {
      const status = error instanceof ApiError ? error.status : undefined;
      const message =
        status === 401 ? t('login.invalid')
        : status === 400 ? t('login.checkFields')
        : status === 403 ? t('login.roleUnsupported')
        : error instanceof ApiError ? error.message
        : t('common.somethingWrong');
      showMessage(t('login.failed'), message);
    } finally {
      // Never keep the password around.
      setPassword('');
      busy.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <View style={{ gap: spacing.xs, marginTop: spacing.xxl, marginBottom: spacing.xxl }}>
        <AppText variant="display" color="brand">{t('brand.name')}</AppText>
        <AppText variant="bodySm" color="textSecondary">{t('brand.tagline')}</AppText>
      </View>

      <AppText variant="h2">{t('login.title')}</AppText>
      <AppText variant="bodySm" color="textSecondary" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
        {t('login.subtitle')}
      </AppText>

      <View style={{ gap: spacing.md }}>


        <AppText variant="label">{t('login.email')}</AppText>
        <TextInput
          value={email}
          onChangeText={setEmail}
          accessibilityLabel={t('login.email')}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          editable={!submitting}
          style={inputStyle}
        />

        <AppText variant="label">{t('login.password')}</AppText>
        <TextInput
          value={password}
          onChangeText={setPassword}
          accessibilityLabel={t('login.password')}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="password"
          editable={!submitting}
          returnKeyType="go"
          onSubmitEditing={() => { if (email.trim() && password) void submit(); }}
          style={inputStyle}
        />

        <AppButton
          label={t('login.submit')}
          loading={submitting}
          disabled={!email.trim() || !password}
          onPress={() => void submit()}
        />

        <AppButton label={t('login.toSignup')} variant="ghost" disabled={submitting} onPress={() => router.push('/signup')} />
        {__DEV__ && (
            <AppButton label={t('login.demo')} variant="ghost" disabled={submitting} onPress={() => router.push('/role')} />
        )}
      </View>
    </Screen>
  );
}