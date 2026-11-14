import { View } from 'react-native';
import { AppText } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
export function FinanceDateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { colors, isDark } = useTheme();
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
      <AppText variant="caption" color="textSecondary">
        {label}
      </AppText>
      <input
        type="date"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          boxSizing: 'border-box',
          width: '100%',
          minWidth: 0,
          minHeight: 46,
          padding: 10,
          borderRadius: 10,
          border: `1px solid ${colors.borderStrong}`,
          color: colors.text,
          backgroundColor: colors.surface,
          fontFamily: 'inherit',
          fontSize: 14,
          colorScheme: isDark ? 'dark' : 'light',
        }}
      />
    </View>
  );
}
