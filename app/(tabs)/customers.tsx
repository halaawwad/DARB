import { useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SearchX } from 'lucide-react-native';

import { AppHeader, AppText, Avatar, Card, Divider, EmptyState, ListItem, Screen, SearchField, StatusBadge } from '@/components/ui';
import { TAB_BAR_CLEARANCE } from '@/components/navigation/TabBar';
import { useCustomers } from '@/hooks/queries';
import { useLocale } from '@/hooks/useLocale';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/spacing';
import { normalizeArabic } from '@/utils/arabic';
import { formatMoney } from '@/utils/format';
import { customerStatusTone } from '@/utils/status';

export default function CustomersScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t, alignEnd } = useLocale();
  const { data: customers = [], isLoading } = useCustomers();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = normalizeArabic(query);
    if (!needle) return customers;
    return customers.filter((c) =>
      [c.name, c.nickname, c.shopName, c.area, c.phone].some((field) => field && normalizeArabic(field).includes(needle)),
    );
  }, [customers, query]);

  return (
    <Screen bottomInset={TAB_BAR_CLEARANCE}>
      <AppHeader
        title={t('customers.title')}
        subtitle={t('customers.count', { count: customers.length })}
        leading="none"
        size="large"
      />
      <SearchField value={query} onChangeText={setQuery} placeholder={t('customers.search')} style={{ marginBottom: spacing.lg }} />

      {isLoading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xxl }} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<SearchX size={26} color={colors.brand} strokeWidth={2.2} />}
          title={t('customers.empty')}
          body={t('customers.emptyBody')}
        />
      ) : (
        <Card padding="none" style={{ paddingHorizontal: spacing.lg }}>
          {filtered.map((customer, index) => (
            <View key={customer.id}>
              {index > 0 ? <Divider /> : null}
              <ListItem
                title={customer.shopName}
                subtitle={`${customer.name} · ${customer.area}`}
                leading={<Avatar name={customer.shopName} size={42} />}
                trailing={
                  <View style={{ alignItems: alignEnd, gap: 4 }}>
                    <StatusBadge size="sm" label={t(`customer.status.${customer.status}`)} tone={customerStatusTone[customer.status]} />
                    {customer.balance > 0 ? (
                      <AppText variant="caption" numeric color="dangerText">
                        {formatMoney(customer.balance)}
                      </AppText>
                    ) : null}
                  </View>
                }
                onPress={() => router.push({ pathname: '/customer/[id]', params: { id: customer.id } })}
              />
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}
