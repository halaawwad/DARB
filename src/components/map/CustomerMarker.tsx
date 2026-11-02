import { View } from 'react-native';
import { Store } from 'lucide-react-native';
import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/radius';
import { shadow } from '@/theme/shadows';
import type { CustomerStatus } from '@/types';
import { customerPinColor } from '@/utils/status';

export interface CustomerMarkerProps {
  status: CustomerStatus;
  sequence?: number;
  highlighted?: boolean;
  dimmed?: boolean;
  selected?: boolean;
}

/**
 * Customer pin: a status-coloured disc with a beige ring. Delivery stops carry
 * their route number; other pins a shop icon, so colour is never the only cue.
 */
export function CustomerMarker({ status, sequence, highlighted, dimmed, selected }: CustomerMarkerProps) {
  const { colors } = useTheme();
  const fill = selected ? colors.deep : customerPinColor(status, colors);
  const size = selected ? 40 : highlighted || sequence ? 34 : 28;

  return (
    <View style={{ alignItems: 'center', opacity: dimmed && !selected ? 0.5 : 1 }}>
      <View
        style={[
          {
            width: size,
            height: size,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: fill,
            borderWidth: highlighted || selected ? 4 : 3,
            borderColor: highlighted || selected ? colors.accent : colors.pinRing,
          },
          selected || highlighted ? shadow.md : shadow.sm,
        ]}
      >
        {sequence ? (
          <AppText variant="label" numeric align="center" style={{ color: colors.textOnColor }}>
            {sequence}
          </AppText>
        ) : (
          <Store size={selected ? 18 : 14} color={colors.textOnColor} strokeWidth={2.4} />
        )}
      </View>
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: 4,
          borderRightWidth: 4,
          borderTopWidth: 6,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: highlighted || selected ? colors.accent : colors.pinRing,
        }}
      />
    </View>
  );
}
