import { useFinance } from '@/features/finance/hooks';
import { balance as financeBalance } from '@/features/finance/domain';
import { AppButton } from '@/components/ui';
import { useState } from 'react';
import { ActivityIndicator, Linking, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Mic, Phone, Sparkles, UserX } from 'lucide-react-native';

import {
  AppHeader,
  AppText,
  Avatar,
  Card,
  DetailRow,
  Divider,
  EmptyState,
  IconButton,
  Screen,
  Segmented,
  StatusBadge,
} from '@/components/ui';
import { OrderRow } from '@/components/domain/OrderRow';
import { MapSurface } from '@/components/map/MapSurface';
import { canTakeOrders } from '@/components/navigation/roleTabs';
import { useCustomer, useInsight, useLedger, useOrders, useUsers } from '@/hooks/queries';
import { useLocale } from '@/hooks/useLocale';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';
import type { Customer } from '@/types';
import { formatDate, formatMoney } from '@/utils/format';
import { customerStatusTone } from '@/utils/status';

type Section = 'info' | 'orders' | 'ledger' | 'ai';

export default function CustomerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { t, row } = useLocale();
  const role = usePreferencesStore((s) => s.role);
  const { data: customer, isLoading } = useCustomer(id);
  const finance = useFinance();
  const liveBalance =
    customer && finance.mode === 'demo' && finance.state
      ? financeBalance(finance.state, customer.id) / 100
      : (customer?.balance ?? 0);
  const [section, setSection] = useState<Section>('info');

  if (isLoading) {
    return (
      <Screen layout="fixed" contentContainerStyle={{ justifyContent: 'center' }}>
        <ActivityIndicator color={colors.brand} />
      </Screen>
    );
  }

  if (!customer) {
    return (
      <Screen>
        <AppHeader />
        <EmptyState
          icon={<UserX size={26} color={colors.brand} strokeWidth={2.2} />}
          title={t('customer.notFound')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        title={customer.shopName}
        trailing={
          canTakeOrders(role) ? (
            <IconButton
              icon={<Mic size={19} color={colors.onBrand} strokeWidth={2.3} />}
              tone="brand"
              size={40}
              onPress={() => router.push({ pathname: '/voice-order', params: { customerId: customer.id } })}
              accessibilityLabel={t('customer.voiceOrder')}
            />
          ) : undefined
        }
      />

      <Card style={{ marginBottom: spacing.lg }}>
        <View style={{ flexDirection: row, alignItems: 'center', gap: spacing.md }}>
          <Avatar name={customer.shopName} size={56} />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="h3">{customer.name}</AppText>
            <AppText variant="bodySm" color="textSecondary">
              {customer.area}
            </AppText>
            <AppText variant="bodySm" color="textSecondary" numeric>
              {customer.phone}
            </AppText>
          </View>
          <IconButton
            icon={<Phone size={19} color={colors.brand} strokeWidth={2.3} />}
            tone="surface"
            onPress={() => void Linking.openURL(`tel:${customer.phone.replace(/\s/g, '')}`)}
            accessibilityLabel={t('common.call')}
          />
        </View>
        <View
          style={{
            flexDirection: row,
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: spacing.md,
          }}
        >
          <StatusBadge
            label={t(`customer.status.${customer.status}`)}
            tone={customerStatusTone[customer.status]}
          />
          <AppText
            variant="titleLg"
            numeric
            style={{ color: liveBalance > 0 ? colors.dangerText : colors.text }}
          >
            {formatMoney(liveBalance)}
          </AppText>
        </View>
      </Card>

      <Segmented<Section>
        variant="inset"
        value={section}
        onChange={setSection}
        options={[
          { value: 'info', label: t('customer.tabs.info') },
          { value: 'orders', label: t('customer.tabs.orders') },
          { value: 'ledger', label: t('customer.tabs.ledger') },
          { value: 'ai', label: t('customer.tabs.ai') },
        ]}
        style={{ marginBottom: spacing.lg }}
      />

      {section === 'info' ? <InfoSection customer={customer} /> : null}
      {section === 'orders' ? <OrdersSection customerId={customer.id} /> : null}
      {section === 'ledger' ? (
        <>
          <AppButton
            label={t('finance.ledger')}
            variant="tonal"
            onPress={() => router.push({ pathname: '/(tabs)/finance', params: { customerId: customer.id } })}
          />
          <LedgerSection customer={{ ...customer, balance: liveBalance }} />
        </>
      ) : null}
      {section === 'ai' ? <InsightSection customerId={customer.id} /> : null}
    </Screen>
  );
}

function InfoSection({ customer }: { customer: Customer }) {
  const { t, dateLocale } = useLocale();
  const { data: users = [] } = useUsers();
  const rep = users.find((user) => user.id === customer.assignedRepId);

  return (
    <View style={{ gap: spacing.lg }}>
      <Card style={{ gap: spacing.md }}>
        <DetailRow stacked label={t('customer.address')} value={customer.address} />
        <DetailRow stacked label={t('customer.preferredVisitTime')} value={customer.preferredVisitTime} />
        <DetailRow stacked label={t('customer.assignedRep')} value={rep?.name ?? '—'} />
        <DetailRow
          stacked
          label={t('customer.lastVisit')}
          value={formatDate(customer.lastVisit, dateLocale)}
        />
        {customer.notes ? <DetailRow stacked label={t('customer.notes')} value={customer.notes} /> : null}
      </Card>
      <MapSurface
        interactive={false}
        region={{ ...customer.location, latitudeDelta: 0.008, longitudeDelta: 0.008 }}
        customers={[
          {
            id: customer.id,
            location: customer.location,
            status: customer.status,
            label: customer.shopName,
            highlighted: true,
          },
        ]}
        style={{ height: 180, borderRadius: radius.xl, overflow: 'hidden' }}
      />
    </View>
  );
}

function OrdersSection({ customerId }: { customerId: string }) {
  const { t } = useLocale();
  const { colors } = useTheme();
  const { data: orders, isLoading } = useOrders({ customerId });

  if (isLoading) return <ActivityIndicator color={colors.brand} />;
  if (!orders?.length) return <EmptyState compact title={t('orders.empty')} />;

  return (
    <Card padding="none" style={{ paddingHorizontal: spacing.lg }}>
      {orders.map((order, index) => (
        <View key={order.id}>
          {index > 0 ? <Divider /> : null}
          <OrderRow order={order} />
        </View>
      ))}
    </Card>
  );
}

function LedgerSection({ customer }: { customer: Customer }) {
  const { t, dateLocale, alignEnd, row } = useLocale();
  const { colors } = useTheme();
  const { data: entries, isLoading } = useLedger(customer.id);

  if (isLoading) return <ActivityIndicator color={colors.brand} />;
  if (!entries?.length) return <EmptyState compact title={t('ledger.empty')} />;

  // Running balance after each movement, oldest first; shown newest first.
  let running = 0;
  const rows = entries
    .map((entry) => {
      running += entry.debit - entry.credit;
      return { entry, balance: running };
    })
    .reverse();

  return (
    <View style={{ gap: spacing.lg }}>
      <Card tone="brand">
        <DetailRow label={t('ledger.currentBalance')} emphasis value={formatMoney(customer.balance)} />
      </Card>
      <Card padding="none" style={{ paddingHorizontal: spacing.lg }}>
        {rows.map(({ entry, balance }, index) => {
          const isDebit = entry.debit > 0;
          return (
            <View key={entry.id}>
              {index > 0 ? <Divider /> : null}
              <View style={{ flexDirection: row, paddingVertical: spacing.md, gap: spacing.md }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="title" weight="medium">
                    {entry.description}
                  </AppText>
                  <AppText variant="caption" color="textTertiary" numeric>
                    {formatDate(entry.date, dateLocale)} ·{' '}
                    {t('ledger.running', { amount: formatMoney(balance) })}
                  </AppText>
                </View>
                <View style={{ alignItems: alignEnd, gap: 2 }}>
                  <AppText
                    variant="title"
                    numeric
                    style={{ color: isDebit ? colors.dangerText : colors.successText }}
                  >
                    {formatMoney(isDebit ? entry.debit : entry.credit)}
                  </AppText>
                  <AppText variant="caption" color="textTertiary">
                    {isDebit ? t('ledger.debit') : t('ledger.credit')}
                  </AppText>
                </View>
              </View>
            </View>
          );
        })}
      </Card>
    </View>
  );
}

function InsightSection({ customerId }: { customerId: string }) {
  const { t, row } = useLocale();
  const { colors } = useTheme();
  const { data: insight, isLoading } = useInsight(customerId);

  if (isLoading) return <ActivityIndicator color={colors.brand} />;
  if (!insight) return <EmptyState compact title={t('ai.empty')} />;

  const header = (title: string) => (
    <View
      style={{
        flexDirection: row,
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
      }}
    >
      <View style={{ flexDirection: row, alignItems: 'center', gap: spacing.sm }}>
        <Sparkles size={18} color={colors.accent} strokeWidth={2.3} />
        <AppText variant="titleLg">{title}</AppText>
      </View>
      <StatusBadge label={t('ai.experimental')} tone="warning" size="sm" />
    </View>
  );

  return (
    <View style={{ gap: spacing.lg }}>
      <Card>
        {header(t('ai.preferences'))}
        <View style={{ gap: spacing.xs }}>
          {insight.preferences.map((preference) => (
            <AppText key={preference} variant="body" color="textSecondary">
              • {preference}
            </AppText>
          ))}
        </View>
      </Card>
      <Card>
        {header(t('ai.satisfaction'))}
        <AppText variant="h1" color="brand" numeric>
          {t('ai.score', { score: insight.satisfactionScore })}
        </AppText>
        <View
          style={{
            height: 8,
            borderRadius: radius.pill,
            backgroundColor: colors.track,
            marginVertical: spacing.sm,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: `${insight.satisfactionScore}%`,
              height: '100%',
              backgroundColor: colors.brand,
              borderRadius: radius.pill,
              alignSelf: row === 'row-reverse' ? 'flex-end' : 'flex-start',
            }}
          />
        </View>
        <AppText variant="bodySm" color="textSecondary">
          {insight.satisfactionNote}
        </AppText>
      </Card>
      <AppText variant="caption" color="textTertiary">
        {t('ai.disclaimer')}
      </AppText>
    </View>
  );
}
