import { useRouter } from 'expo-router';
import { Compass } from 'lucide-react-native';
import { EmptyState, Screen } from '@/components/ui';
import { useLocale } from '@/hooks/useLocale';
import { useTheme } from '@/theme/ThemeProvider';

export default function NotFound() {
  const router = useRouter();
  const { t } = useLocale();
  const { colors } = useTheme();
  return (
    <Screen layout="fixed" contentContainerStyle={{ justifyContent: 'center' }}>
      <EmptyState
        icon={<Compass size={26} color={colors.brand} strokeWidth={2.2} />}
        title={t('notFound.title')}
        action={{ label: t('notFound.action'), onPress: () => router.replace('/') }}
      />
    </Screen>
  );
}
