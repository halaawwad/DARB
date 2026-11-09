import { useRef, useState } from 'react';
import { Keyboard, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AppButton, AppText, Screen } from '@/components/ui';
import { homeRoute } from '@/components/navigation/roleTabs';
import { useLocale } from '@/hooks/useLocale';
import { ApiError } from '@/services/http/apiClient';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';
import { showMessage } from '@/utils/dialog';
import { haptics } from '@/utils/haptics';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  editable: boolean;
  /** Latin-only content (email, password, company code) is left-aligned. */
  ltr?: boolean;
  secure?: boolean;
  keyboardType?: 'default' | 'email-address';
}

function Field({ label, value, onChangeText, editable, ltr, secure, keyboardType = 'default' }: FieldProps) {
  const { colors } = useTheme();
  const { textAlign } = useLocale();
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel={label}
        editable={editable}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoCapitalize={ltr ? 'none' : 'words'}
        autoCorrect={false}
        style={{
          color: colors.text,
          backgroundColor: colors.surface,
          borderColor: colors.borderStrong,
          borderWidth: 1,
          borderRadius: radius.md,
          padding: spacing.md,
          fontSize: 16,
          textAlign: ltr ? 'left' : textAlign,
        }}
      />
    </View>
  );
}

export default function SignupScreen() {
  const router = useRouter();
  const { t } = useLocale();
  const signUp = useAuthStore((s) => s.signUp);

  const [companyName, setCompanyName] = useState('');
  const [companySlug, setCompanySlug] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);

  const validate = (): string | undefined => {
    const values = [companyName, companySlug, firstName, lastName, email, password, confirm];
    if (!values.every((v) => v.trim())) return t('signup.required');
    const slug = companySlug.trim().toLowerCase();
    if (slug.length < 3 || slug.length > 40 || !SLUG.test(slug)) return t('signup.codeInvalid');
    if (password.length < 8) return t('signup.passwordShort');
    if (password !== confirm) return t('signup.passwordMismatch');
    return undefined;
  };

  const submit = async () => {
    if (busy.current) return;
    const problem = validate();
    if (problem) {
      showMessage(t('signup.failed'), problem);
      return;
    }
    busy.current = true;
    setSubmitting(true);
    Keyboard.dismiss();
    try {
      const user = await signUp({ companyName, companySlug, firstName, lastName, email, password });
      haptics.medium();
      if (user.role) router.replace(homeRoute(user.role));
    } catch (error) {
      const status = error instanceof ApiError ? error.status : undefined;
      const message =
        status === 409 ? t('signup.codeTaken')
        : error instanceof ApiError ? error.message
        : t('common.somethingWrong');
      showMessage(t('signup.failed'), message);
    } finally {
      setPassword('');
      setConfirm('');
      busy.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <View style={{ gap: spacing.xs, marginTop: spacing.xl, marginBottom: spacing.lg }}>
        <AppText variant="h2">{t('signup.title')}</AppText>
        <AppText variant="bodySm" color="textSecondary">{t('signup.subtitle')}</AppText>
      </View>

      <View style={{ gap: spacing.md }}>
        <Field label={t('signup.companyName')} value={companyName} onChangeText={setCompanyName} editable={!submitting} />
        <Field label={t('signup.companyCode')} value={companySlug} onChangeText={setCompanySlug} editable={!submitting} ltr />
        <Field label={t('signup.firstName')} value={firstName} onChangeText={setFirstName} editable={!submitting} />
        <Field label={t('signup.lastName')} value={lastName} onChangeText={setLastName} editable={!submitting} />
        <Field label={t('login.email')} value={email} onChangeText={setEmail} editable={!submitting} ltr keyboardType="email-address" />
        <Field label={t('login.password')} value={password} onChangeText={setPassword} editable={!submitting} ltr secure />
        <Field label={t('signup.confirmPassword')} value={confirm} onChangeText={setConfirm} editable={!submitting} ltr secure />

        <AppButton label={t('signup.submit')} loading={submitting} disabled={submitting} onPress={() => void submit()} />
        <AppButton label={t('signup.toLogin')} variant="ghost" disabled={submitting} onPress={() => router.replace('/login')} />
      </View>
    </Screen>
  );
}