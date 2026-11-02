import { View } from 'react-native';
import { ShieldCheck, ShieldX, TrafficCone } from 'lucide-react-native';
import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/radius';
import { shadow } from '@/theme/shadows';
import type { CheckpointStatus } from '@/types';
import { useLocale } from '@/hooks/useLocale';
import { checkpointColor } from '@/utils/status';

export function CheckpointIcon({ status, color, size = 14 }: { status: CheckpointStatus; color: string; size?: number }) {
  const Icon = status === 'closed' ? ShieldX : status === 'crowded' ? TrafficCone : ShieldCheck;
  return <Icon size={size} color={color} strokeWidth={2.4} />;
}

/** Map pin for a checkpoint: status colour and icon, so it never relies on colour alone. */
export function CheckpointMarker({ status, label }: { status: CheckpointStatus; label?: string }) {
  const { colors } = useTheme();
  const { row } = useLocale();
  const color = checkpointColor(status, colors);

  return (
    <View
      style={[
        {
          flexDirection: row,
          alignItems: 'center',
          gap: 4,
          paddingVertical: 4,
          paddingHorizontal: 8,
          borderRadius: radius.pill,
          borderWidth: 2,
          borderColor: color,
          backgroundColor: colors.surface,
        },
        shadow.sm,
      ]}
    >
      <CheckpointIcon status={status} color={color} />
      {label ? (
        <AppText variant="caption" numberOfLines={1} style={{ maxWidth: 140 }}>
          {label}
        </AppText>
      ) : null}
    </View>
  );
}
