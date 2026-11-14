import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  Printer,
  Search,
} from 'lucide-react-native';
import { AppButton, AppText, Card, SearchField } from '@/components/ui';
import { useLocale } from '@/hooks/useLocale';
import { useTheme } from '@/theme/ThemeProvider';
import type { FinanceInvoice, FinanceState } from './domain';
import { money, reference } from './documents';

interface Props {
  state: FinanceState;
  canIssue: boolean;
  onIssue: (orderId: string) => void;
  onPrint: (invoice: FinanceInvoice) => void;
  notice: (id?: string) => string;
}
const PAGE_SIZE = 5;
export function InvoicePanel({ state, canIssue, onIssue, onPrint, notice }: Props) {
  const { colors } = useTheme();
  const { t, row, dateLocale } = useLocale();
  const [tab, setTab] = useState<'pending' | 'issued'>('pending');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string>();
  const previousInvoices = useRef(state.invoices.length);
  useEffect(() => {
    if (state.invoices.length > previousInvoices.current) {
      setTab('issued');
      setPage(1);
      setQuery('');
      setExpanded(undefined);
    }
    previousInvoices.current = state.invoices.length;
  }, [state.invoices.length]);
  const customer = (id: string) => state.customers.find((c) => c.id === id)?.name ?? id;
  const pending = state.orders.filter(
    (o) => o.status !== 'cancelled' && !state.invoices.some((i) => i.orderId === o.id),
  );
  const source = tab === 'pending' ? pending : state.invoices;
  const filtered = source
    .filter((item) =>
      `${customer(item.customerId)} ${item.id} ${reference(item.id)} ${'orderId' in item ? item.orderId : ''}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    )
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const changeTab = (value: 'pending' | 'issued') => {
    setTab(value);
    setPage(1);
    setExpanded(undefined);
  };
  const date = (value: string) =>
    new Date(value).toLocaleDateString(dateLocale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Hebron',
    });
  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 5 }}>
        <AppText variant="h3">{t('finance.invoices')}</AppText>
        <AppText variant="bodySm" color="textSecondary">
          {t('finance.billing.subtitle')}
        </AppText>
      </View>
      <View style={{ flexDirection: row, gap: 8 }}>
        {[
          {
            value: 'pending' as const,
            label: t('finance.billing.pending'),
            count: pending.length,
            Icon: ClipboardList,
          },
          {
            value: 'issued' as const,
            label: t('finance.issued'),
            count: state.invoices.length,
            Icon: FileText,
          },
        ].map(({ value, label, count, Icon }) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityLabel={label}
            aria-selected={tab === value}
            accessibilityState={{ selected: tab === value }}
            onPress={() => changeTab(value)}
            style={{
              flex: 1,
              gap: 9,
              padding: 13,
              borderRadius: 15,
              borderWidth: 1,
              borderColor: tab === value ? colors.brand : colors.border,
              backgroundColor: tab === value ? colors.brand : colors.surface,
            }}
          >
            <View style={{ flexDirection: row, alignItems: 'center', justifyContent: 'space-between' }}>
              <Icon size={20} color={tab === value ? colors.onBrand : colors.brand} />
              <AppText
                variant="title"
                numeric
                style={{ color: tab === value ? colors.onBrand : colors.brand }}
              >
                {count}
              </AppText>
            </View>
            <AppText
              variant="bodySm"
              weight="semibold"
              style={{ color: tab === value ? colors.onBrand : colors.text }}
            >
              {label}
            </AppText>
          </Pressable>
        ))}
      </View>
      <SearchField
        value={query}
        onChangeText={(value) => {
          setQuery(value);
          setPage(1);
          setExpanded(undefined);
        }}
        placeholder={t('finance.search')}
      />
      <View style={{ flexDirection: row, alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <AppText variant="caption" color="textSecondary">
          {t('finance.billing.results', { n: filtered.length })}
        </AppText>
        <AppText variant="caption" color="textTertiary">
          {t('finance.billing.pageSize', { n: PAGE_SIZE })}
        </AppText>
      </View>
      {rows.map((item) => (
        <Card key={item.id} tone="plain" style={{ padding: 15, gap: 11 }}>
          <View style={{ flexDirection: row, gap: 10, alignItems: 'center' }}>
            <View
              style={{
                width: 37,
                height: 37,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.brandSofter,
              }}
            >
              {tab === 'issued' && expanded === item.id ? (
                <Card tone="brand" style={{ gap: 8, padding: 12 }}>
                  <AppText variant="bodySm">{t('finance.unitCodes.labels')}</AppText>
                  {item.items.some((line) => line.unitCodes?.length) ? (
                    item.items.map((line) => (
                      <View key={line.productId} style={{ gap: 4 }}>
                        <AppText weight="semibold">{line.name}</AppText>
                        {line.unitCodes?.map((code) => (
                          <AppText key={code} variant="caption" selectable>
                            {code}
                          </AppText>
                        ))}
                      </View>
                    ))
                  ) : (
                    <AppText variant="caption" color="warningText">
                      {t('finance.unitCodes.legacy')}
                    </AppText>
                  )}
                </Card>
              ) : null}
              {tab === 'pending' ? (
                <ClipboardList size={19} color={colors.brand} />
              ) : (
                <FileText size={19} color={colors.brand} />
              )}
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <AppText variant="bodySm" weight="semibold">
                {customer(item.customerId)}
              </AppText>
              <AppText variant="caption" color="textTertiary">
                {t(tab === 'pending' ? 'finance.order' : 'finance.invoice')} {reference(item.id)}
              </AppText>
            </View>
            <AppText variant="titleLg" numeric>
              {money(item.total)}
            </AppText>
          </View>
          <View style={{ flexDirection: row, alignItems: 'center', justifyContent: 'space-between' }}>
            <AppText variant="caption" color="textSecondary">
              {date(item.date)}
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('finance.billing.showItems', { n: item.items.length })}
              accessibilityState={{ expanded: expanded === item.id }}
              onPress={() => setExpanded(expanded === item.id ? undefined : item.id)}
              style={{ flexDirection: row, gap: 5, alignItems: 'center', padding: 5 }}
            >
              <AppText variant="caption" color="brand">
                {t('finance.billing.showItems', { n: item.items.length })}
              </AppText>
              <ChevronDown
                size={14}
                color={colors.brand}
                style={{ transform: [{ rotate: expanded === item.id ? '180deg' : '0deg' }] }}
              />
            </Pressable>
          </View>
          {expanded === item.id ? (
            <View style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: 10, gap: 9 }}>
              {item.items.map((line) => (
                <View
                  key={line.productId}
                  style={{ flexDirection: row, justifyContent: 'space-between', gap: 10 }}
                >
                  <AppText variant="bodySm" style={{ flex: 1 }}>
                    {line.name} × {line.quantity}
                  </AppText>
                  <AppText variant="bodySm" numeric>
                    {money(line.quantity * line.unitPrice)}
                  </AppText>
                </View>
              ))}
            </View>
          ) : null}
          {tab === 'pending' ? (
            canIssue ? (
              <AppButton
                label={t('finance.issueInvoice')}
                size="sm"
                variant="tonal"
                onPress={() => onIssue(item.id)}
              />
            ) : null
          ) : (
            <>
              <AppText variant="caption" color="textTertiary">
                {notice(item.id)}
              </AppText>
              <AppButton
                label={t('finance.print')}
                variant="secondary"
                size="sm"
                icon={<Printer size={16} color={colors.brand} />}
                onPress={() => onPrint(item as FinanceInvoice)}
              />
            </>
          )}
        </Card>
      ))}
      {!rows.length ? (
        <Card tone="plain" style={{ gap: 8, paddingVertical: 26, alignItems: 'center' }}>
          <Search size={27} color={colors.textTertiary} />
          <AppText variant="bodySm" color="textSecondary">
            {t(
              query
                ? 'finance.billing.noMatches'
                : tab === 'pending'
                  ? 'finance.billing.noPending'
                  : 'finance.billing.noIssued',
            )}
          </AppText>
        </Card>
      ) : null}
      {filtered.length > PAGE_SIZE ? (
        <View
          style={{
            flexDirection: row,
            gap: 10,
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 8,
          }}
        >
          <AppButton
            label={t('finance.billing.previous')}
            size="sm"
            variant="secondary"
            fullWidth={false}
            disabled={currentPage === 1}
            icon={<ChevronRight size={16} color={colors.brand} />}
            onPress={() => {
              setPage(currentPage - 1);
              setExpanded(undefined);
            }}
          />
          <AppText variant="caption" numeric>
            {t('finance.billing.page', { current: currentPage, total: totalPages })}
          </AppText>
          <AppButton
            label={t('finance.billing.next')}
            size="sm"
            variant="secondary"
            fullWidth={false}
            disabled={currentPage === totalPages}
            iconEnd={<ChevronLeft size={16} color={colors.brand} />}
            onPress={() => {
              setPage(currentPage + 1);
              setExpanded(undefined);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
