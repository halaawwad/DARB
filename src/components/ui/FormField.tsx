import { TextInput, View } from 'react-native';

import { AppText } from '@/components/ui';
import { useLocale } from '@/hooks/useLocale';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';

export interface FormFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  editable?: boolean;
  /** Latin-only content (email, phone, password) is left-aligned. */
  ltr?: boolean;
  secure?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
}

export function FormField({ label, value, onChangeText, editable = true, ltr, secure, keyboardType = 'default' }: FormFieldProps) {
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
          opacity: editable ? 1 : 0.6,
          textAlign: ltr ? 'left' : textAlign,
        }}
      />
    </View>
  );
}