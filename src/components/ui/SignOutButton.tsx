import { LogOut } from 'lucide-react-native';

import { AppButton } from '@/components/ui';
import { useLocale } from '@/hooks/useLocale';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/theme/ThemeProvider';
import { confirmAction } from '@/utils/dialog';

export function SignOutButton() {
  const { colors } = useTheme();
  const { t } = useLocale();
  const signOut = useAuthStore((s) => s.signOut);

  const onPress = async () => {
    const confirmed = await confirmAction({
      title: t('auth.signOut'),
      message: t('auth.signOutConfirm'),
      confirmLabel: t('auth.signOut'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (confirmed) await signOut();
  };

  return (
    <AppButton
      label={t('auth.signOut')}
      variant="secondary"
      icon={<LogOut size={18} color={colors.text} strokeWidth={2.3} />}
      onPress={() => void onPress()}
    />
  );
}