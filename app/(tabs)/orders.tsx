import { useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ClipboardList } from 'lucide-react-native';

import { AppHeader, AppText, Card, Divider, EmptyState, Screen, Segmented } from '@/components/ui';
import { OrderRow } from '@/components/domain/OrderRow';
import { TAB_BAR_CLEARANCE } from '@/components/navigation/TabBar';
import { useCurrentUser, useCustomers, useOrders, useTodayPlan } from '@/hooks/queries';
import { useLocale } from '@/hooks/useLocale';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';
import type { Order } from '@/types';

type Filter = 'all' | 'open' | 'delivered';

const matches = (order: Order, filter: Filter) =>
  filter === 'all' ||
  (filter === 'delivered' ? order.status === 'delivered' : order.status === 'pending' || order.status === 'out_for_delivery');

/**
 * Sales reps see their own orders; managers and accountants see the whole
 * company's; delivery reps see today's deliveries in route order.
 */
export default function OrdersScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useLocale();
  const { data: user } = useCurrentUser();
  const isDelivery = user?.role === 'delivery_rep';
  const isSales = user?.role === 'sales_rep';

  const { data: orders = [], isLoading } = useOrders(isSales ? { repId: user?.id } : undefined);
  const { data: plan } = useTodayPlan(isDelivery ? user?.id : undefined);
  const { data: customers = [] } = useCustomers();
  const [filter, setFilter] = useState<Filter>('all');

  const shopName = (customerId: string) => customers.find((c) => c.id === customerId)?.shopName ?? '';
  const openCustomer = (id: string) => router.push({ pathname: '/customer/[id]', params: { id } });

  const rows = useMemo(() => {
    if (isDelivery) {
      return (plan?.stops ?? []).flatMap((stop) => {
        const order = orders.find((o) => o.id === stop.orderId);
        return order ? [{ order, sequence: stop.sequence }] : [];
      });
    }
    return orders.filter((o) => matches(o, filter)).map((order) => ({ order, sequence: undefined }));
  }, [isDelivery, plan, orders, filter]);

  const title = isDelivery ? t('deliveries.title') : isSales ? t('orders.mine') : t('orders.title');
  const subtitle = isDelivery ? t('deliveries.subtitle', { count: rows.length }) : isSales ? undefined : t('orders.all');

  return (
    <Screen bottomInset={TAB_BAR_CLEARANCE}>
      <AppHeader title={title} subtitle={subtitle} leading="none" size="large" />

      {!isDelivery ? (
        <Segmented<Filter>
          variant="inset"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: t('orders.filter.all') },
            { value: 'open', label: t('orders.filter.open') },
            { value: 'delivered', label: t('orders.filter.delivered') },
          ]}
          style={{ marginBottom: spacing.lg }}
        />
      ) : null}

      {isLoading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xxl }} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={26} color={colors.brand} strokeWidth={2.2} />}
          title={isDelivery ? t('deliveries.empty') : t('orders.empty')}
          body={isDelivery ? undefined : t('orders.emptyBody')}
        />
      ) : (
        <Card padding="none" style={{ paddingHorizontal: spacing.lg }}>
          {rows.map(({ order, sequence }, index) => (
            <View key={order.id}>
              {index > 0 ? <Divider /> : null}
              <OrderRow
                order={order}
                title={shopName(order.customerId)}
                onPress={() => openCustomer(order.customerId)}
                leading={
                  sequence ? (
                    <View
                      accessibilityLabel={t('deliveries.stop', { n: sequence })}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: radius.pill,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.brand,
                        borderWidth: 2,
                        borderColor: colors.accent,
                      }}
                    >
                      <AppText variant="label" numeric align="center" style={{ color: colors.onBrand }}>
                        {sequence}
                      </AppText>
                    </View>
                  ) : undefined
                }
              />
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}
