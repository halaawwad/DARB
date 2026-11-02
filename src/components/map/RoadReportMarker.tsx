import { View } from 'react-native';
import { Ban, Car, Construction, TriangleAlert } from 'lucide-react-native';
import type { RoadReportType } from '@/types';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/radius';
import { shadow } from '@/theme/shadows';
import { roadReportColor } from '@/utils/status';

export function ReportIcon({ type, color, size = 17 }: { type: RoadReportType; color: string; size?: number }) {
  const props = { color, size, strokeWidth: 2.5 };
  switch (type) {
    case 'accident':
      return <TriangleAlert {...props} />;
    case 'traffic':
      return <Car {...props} />;
    case 'closed_road':
      return <Ban {...props} />;
    case 'construction':
      return <Construction {...props} />;
  }
}

export function RoadReportMarker({ type, selected = false }: { type: RoadReportType; selected?: boolean }) {
  const { colors } = useTheme();
  const color = roadReportColor(type, colors);
  const size = selected ? 38 : 32;
  return (
    <View style={{ width: size, height: size + 6, alignItems: 'center' }}>
      <View
        style={[
          {
            width: size,
            height: size,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: color,
            borderColor: colors.surface,
            borderWidth: selected ? 4 : 3,
          },
          shadow.md,
        ]}
      >
        <ReportIcon type={type} color={colors.textOnColor} size={selected ? 19 : 16} />
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
          borderTopColor: color,
        }}
      />
    </View>
  );
}
