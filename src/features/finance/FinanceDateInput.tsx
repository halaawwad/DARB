import { TextInput, View } from 'react-native';
import { AppText } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { useLocale } from '@/hooks/useLocale';
export function FinanceDateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { colors } = useTheme();
  const { textAlign } = useLocale();
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <AppText variant="caption" color="textSecondary">
        {label}
      </AppText>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.placeholder}
        style={{
          color: colors.text,
          textAlign,
          padding: 10,
          minHeight: 46,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surface,
        }}
      />
    </View>
  );
}
