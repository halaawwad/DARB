import type { ReactNode } from 'react';
import { View } from 'react-native';
import { AppText, ListItem, StatusBadge } from '@/components/ui';
import { useLocale } from '@/hooks/useLocale';
import { spacing } from '@/theme/spacing';
import type { Order } from '@/types';
import { formatDate, formatMoney } from '@/utils/format';
import { orderStatusTone } from '@/utils/status';

export interface OrderRowProps {
  order: Order;
  /** Defaults to the order date — pass the shop name on cross-customer lists. */
  title?: string;
  leading?: ReactNode;
  onPress?: () => void;
}

/** One order line: who/when, item count, total and status. Shared by lists and the customer profile. */
export function OrderRow({ order, title, leading, onPress }: OrderRowProps) {
  const { t, dateLocale, alignEnd } = useLocale();
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const date = formatDate(order.createdAt, dateLocale);
  const details = [title ? date : undefined, t('orders.items', { count: itemCount }), order.source === 'voice' ? t('orders.byVoice') : undefined]
    .filter(Boolean)
    .join(' · ');

  return (
    <ListItem
      title={title ?? date}
      subtitle={details}
      leading={leading}
      onPress={onPress}
      trailing={
        <View style={{ alignItems: alignEnd, gap: spacing.xs }}>
          <AppText variant="title" numeric>
            {formatMoney(order.total)}
          </AppText>
          <StatusBadge size="sm" label={t(`orders.status.${order.status}`)} tone={orderStatusTone[order.status]} />
        </View>
      }
    />
  );
}
