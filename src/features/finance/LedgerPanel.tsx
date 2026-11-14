import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  FileDown,
  ReceiptText,
  Search,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react-native';
import { AppButton, AppText, Card, SearchField } from '@/components/ui';
import { useLocale } from '@/hooks/useLocale';
import { useTheme } from '@/theme/ThemeProvider';
import { typeFace } from '@/theme/typography';
import { balance, type FinanceEntry, type FinanceState } from './domain';
import { money, reference } from './documents';
import { FinanceDateInput } from './FinanceDateInput';

type Rows = string[][];
interface Props {
  state: FinanceState;
  customerId: string;
  onCustomer: (id: string) => void;
  onExport: (title: string, rows: Rows) => void;
  onCollect?: () => void;
}
const validDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  Number.isFinite(Date.parse(s)) &&
  new Date(s).toISOString().slice(0, 10) === s;
const dateOnly = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hebron',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

export function LedgerPanel({ state, customerId, onCustomer, onExport, onCollect }: Props) {
  const { t, row, dateLocale } = useLocale();
  const { colors } = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'all' | 'debit' | 'credit'>('all');
  const [period, setPeriod] = useState<'all' | 'month' | 'custom'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const customer = state.customers.find((c) => c.id === customerId);
  const current = balance(state, customerId);
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(dateLocale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Hebron',
    });
  const title = (entry: FinanceEntry) => {
    if (entry.kind !== 'opening') return t(`finance.${entry.kind}`);
    if (entry.reference === 'opening') return t('finance.opening');
    if (entry.reference === 'balanceAdjustment') return t('finance.balanceAdjustment');
    return entry.reference;
  };
  const label = (value: number) =>
    t(value < 0 ? 'finance.statement.inCredit' : value > 0 ? 'finance.balance' : 'finance.statement.settled');
  const allRows = useMemo(() => {
    let running = 0;
    return state.entries
      .filter((e) => e.customerId === customerId)
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => {
        running += e.debit - e.credit;
        return { ...e, running };
      });
  }, [state, customerId]);
  const start =
    period === 'month' ? dateOnly(new Date()).slice(0, 7) + '-01' : period === 'custom' ? from : '';
  const end = period === 'custom' ? to : '';
  const datesValid =
    (!start || validDate(start)) && (!end || validDate(end)) && (!start || !end || start <= end);
  const normalized = (value: string) => value.replace(/[,٬]/g, '').trim().toLowerCase();
  const visible = datesValid
    ? allRows.filter((e) => {
        const localDate = dateOnly(new Date(e.date));
        return (
          (!start || localDate >= start) &&
          (!end || localDate <= end) &&
          (period !== 'month' || localDate.slice(0, 7) === start.slice(0, 7)) &&
          (type === 'all' || (type === 'debit' ? e.debit > 0 : e.credit > 0)) &&
          normalized(`${title(e)} ${reference(e.reference)} ${money(e.debit || e.credit)}`).includes(
            normalized(query),
          )
        );
      })
    : [];
  const totals = visible.reduce((n, e) => ({ debit: n.debit + e.debit, credit: n.credit + e.credit }), {
    debit: 0,
    credit: 0,
  });
  const chips = <T extends string>(
    selected: T,
    change: (value: T) => void,
    choices: { value: T; label: string }[],
  ) => (
    <View style={{ flexDirection: row, flexWrap: 'wrap', gap: 7 }}>
      {choices.map((choice) => (
        <Pressable
          key={choice.value}
          accessibilityRole="button"
          accessibilityLabel={choice.label}
          accessibilityState={{ selected: choice.value === selected }}
          onPress={() => change(choice.value)}
          style={{
            paddingVertical: 9,
            paddingHorizontal: 14,
            borderRadius: 11,
            backgroundColor: selected === choice.value ? colors.brand : colors.surfaceAlt,
            minHeight: 40,
            justifyContent: 'center',
          }}
        >
          <AppText
            variant="caption"
            weight="medium"
            style={{ color: selected === choice.value ? colors.onBrand : colors.textSecondary }}
          >
            {choice.label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 5 }}>
        <AppText variant="h3">{t('finance.ledger')}</AppText>
        <AppText variant="bodySm" color="textSecondary">
          {t('finance.statement.subtitle')}
        </AppText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('finance.statement.chooseCustomer')}
        accessibilityState={{ expanded: pickerOpen }}
        onPress={() => setPickerOpen(!pickerOpen)}
        style={{
          backgroundColor: colors.surface,
          borderColor: pickerOpen ? colors.brand : colors.border,
          borderWidth: 1,
          borderRadius: 18,
          padding: 15,
          flexDirection: row,
          gap: 12,
          alignItems: 'center',
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: colors.brandSofter,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <UserRound size={23} color={colors.brand} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <AppText variant="caption" color="textTertiary">
            {t('finance.customer')}
          </AppText>
          <AppText variant="title" weight="semibold">
            {customer?.name ?? t('finance.statement.chooseCustomer')}
          </AppText>
        </View>
        <View style={{ gap: 5, alignItems: 'center' }}>
          <ChevronDown
            size={17}
            color={colors.brand}
            style={{ transform: [{ rotate: pickerOpen ? '180deg' : '0deg' }] }}
          />
          <AppText variant="caption" color="brand">
            {t('finance.statement.change')}
          </AppText>
        </View>
      </Pressable>
      {pickerOpen ? (
        <Card tone="plain" style={{ gap: 10, padding: 12 }}>
          <SearchField
            value={customerSearch}
            onChangeText={setCustomerSearch}
            placeholder={t('finance.collect.searchCustomer')}
          />
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 260 }}>
            {state.customers
              .filter((c) => `${c.name} ${c.phone}`.includes(customerSearch.trim()))
              .map((c) => {
                const value = balance(state, c.id);
                return (
                  <Pressable
                    key={c.id}
                    accessibilityRole="button"
                    accessibilityLabel={c.name}
                    onPress={() => {
                      onCustomer(c.id);
                      setPickerOpen(false);
                      setCustomerSearch('');
                    }}
                    style={{
                      padding: 12,
                      flexDirection: row,
                      gap: 12,
                      alignItems: 'center',
                      borderRadius: 12,
                      backgroundColor: customerId === c.id ? colors.brandSofter : colors.surface,
                    }}
                  >
                    <View style={{ flex: 1, gap: 3 }}>
                      <AppText variant="bodySm" weight="medium">
                        {c.name}
                      </AppText>
                      <AppText variant="caption" color={value < 0 ? 'successText' : 'textSecondary'}>
                        {label(value)} · {money(Math.abs(value))}
                      </AppText>
                    </View>
                    {c.id === customerId ? <Check size={18} color={colors.brand} /> : null}
                  </Pressable>
                );
              })}
            {!state.customers.some((c) => `${c.name} ${c.phone}`.includes(customerSearch.trim())) ? (
              <AppText variant="bodySm" color="textTertiary" style={{ padding: 16 }}>
                {t('finance.collect.noResults')}
              </AppText>
            ) : null}
          </ScrollView>
        </Card>
      ) : null}
      {customer ? (
        <>
          <View style={{ backgroundColor: colors.deep, borderRadius: 22, padding: 22, gap: 12 }}>
            <View style={{ flexDirection: row, justifyContent: 'space-between', alignItems: 'center' }}>
              <AppText color="onDeepMuted" variant="bodySm">
                {label(current)}
              </AppText>
              <ReceiptText size={22} color={colors.onDeepMuted} />
            </View>
            <AppText
              numeric
              color="onDeep"
              style={{ fontSize: 36, lineHeight: 50, fontFamily: typeFace('semibold') }}
            >
              {money(Math.abs(current))}
            </AppText>
            <AppText color="onDeepMuted" variant="caption">
              {t(
                current < 0
                  ? 'finance.statement.creditHint'
                  : current > 0
                    ? 'finance.statement.debtHint'
                    : 'finance.statement.settledHint',
              )}
            </AppText>
          </View>
          <View style={{ flexDirection: row, gap: 10 }}>
            {[
              { title: t('finance.statement.debits'), value: totals.debit, credit: false },
              { title: t('finance.statement.credits'), value: totals.credit, credit: true },
            ].map((metric) => (
              <Card key={metric.title} tone="plain" style={{ flex: 1, padding: 14, gap: 6 }}>
                <View style={{ flexDirection: row, gap: 6, alignItems: 'center' }}>
                  {metric.credit ? (
                    <ArrowDownLeft size={16} color={colors.success} />
                  ) : (
                    <ArrowUpRight size={16} color={colors.warning} />
                  )}
                  <AppText variant="caption" color="textSecondary" style={{ flexShrink: 1 }}>
                    {metric.title}
                  </AppText>
                </View>
                <AppText variant="titleLg" numeric>
                  {money(metric.value)}
                </AppText>
              </Card>
            ))}
          </View>
          <View style={{ flexDirection: row, gap: 8 }}>
            <AppButton
              label={t('finance.exportLedger')}
              variant="secondary"
              size="sm"
              style={{ flex: 1 }}
              icon={<FileDown size={17} color={colors.brand} />}
              disabled={!datesValid}
              onPress={() =>
                onExport(`${t('finance.ledger')} — ${customer.name}`, [
                  [
                    t('finance.date'),
                    t('finance.reference'),
                    t('finance.debit'),
                    t('finance.credit'),
                    t('finance.running'),
                  ],
                  ...visible.map((e) => [
                    date(e.date),
                    title(e),
                    money(e.debit),
                    money(e.credit),
                    `${money(Math.abs(e.running))} — ${label(e.running)}`,
                  ]),
                ])
              }
            />
            {onCollect ? (
              <AppButton label={t('finance.newReceipt')} size="sm" fullWidth={false} onPress={onCollect} />
            ) : null}
          </View>
          <Card tone="plain" style={{ gap: 12, padding: 14 }}>
            <View style={{ flexDirection: row, alignItems: 'center', justifyContent: 'space-between' }}>
              <AppText variant="title" weight="semibold">
                {t('finance.statement.movements')}
              </AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('finance.statement.filters')}
                accessibilityState={{ expanded: filterOpen }}
                onPress={() => setFilterOpen(!filterOpen)}
                style={{
                  flexDirection: row,
                  padding: 8,
                  gap: 6,
                  alignItems: 'center',
                  borderRadius: 10,
                  backgroundColor: filterOpen ? colors.brandSoft : colors.surfaceAlt,
                }}
              >
                <SlidersHorizontal size={16} color={colors.brand} />
                <AppText variant="caption" color="brand">
                  {t('finance.statement.filters')}
                </AppText>
              </Pressable>
            </View>
            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder={t('finance.statement.searchMovements')}
            />
            {chips(type, setType, [
              { value: 'all', label: t('finance.statement.all') },
              { value: 'debit', label: t('finance.debit') },
              { value: 'credit', label: t('finance.credit') },
            ])}
            {filterOpen ? (
              <View style={{ gap: 12, borderTopWidth: 1, borderColor: colors.border, paddingTop: 12 }}>
                <AppText variant="caption" color="textSecondary">
                  {t('finance.statement.period')}
                </AppText>
                {chips(period, setPeriod, [
                  { value: 'all', label: t('finance.statement.allDates') },
                  { value: 'month', label: t('finance.statement.thisMonth') },
                  { value: 'custom', label: t('finance.statement.customDates') },
                ])}
                {period === 'custom' ? (
                  <View style={{ flexDirection: row, gap: 10 }}>
                    <FinanceDateInput label={t('finance.from')} value={from} onChange={setFrom} />
                    <FinanceDateInput label={t('finance.to')} value={to} onChange={setTo} />
                  </View>
                ) : null}
                {!datesValid ? (
                  <AppText color="dangerText" variant="caption">
                    {t('finance.error.date')}
                  </AppText>
                ) : null}
              </View>
            ) : null}
            <AppText variant="caption" color="textTertiary">
              {t('finance.statement.count', { n: visible.length })}
            </AppText>
          </Card>
          <AppText variant="caption" color="textTertiary">
            {t('finance.statement.summaryHint')}
          </AppText>
          <View style={{ gap: 10 }}>
            {visible
              .slice()
              .reverse()
              .map((e) => {
                const debit = e.debit > 0;
                const isOpening =
                  e.kind === 'opening' && (e.reference === 'opening' || e.reference.includes('رصيد افتتاحي'));
                return (
                  <Card key={e.id} tone="plain" style={{ padding: 15, gap: 12 }}>
                    <View style={{ flexDirection: row, gap: 11, alignItems: 'center' }}>
                      <View
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 12,
                          backgroundColor: isOpening
                            ? colors.surfaceAlt
                            : debit
                              ? colors.warningSoft
                              : colors.successSoft,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {isOpening ? (
                          <ReceiptText size={18} color={colors.textSecondary} />
                        ) : debit ? (
                          <ArrowUpRight size={18} color={colors.warningText} />
                        ) : (
                          <ArrowDownLeft size={18} color={colors.successText} />
                        )}
                      </View>
                      <View style={{ flex: 1, gap: 4 }}>
                        <AppText variant="bodySm" weight="semibold">
                          {title(e)}
                        </AppText>
                        <AppText variant="caption" color="textTertiary">
                          {date(e.date)}
                          {e.kind !== 'opening' ? ` · ${reference(e.reference)}` : ''}
                        </AppText>
                      </View>
                      <View style={{ gap: 3 }}>
                        <AppText
                          variant="title"
                          numeric
                          color={debit ? 'warningText' : e.credit ? 'successText' : 'textSecondary'}
                        >
                          {money(e.debit || e.credit)}
                        </AppText>
                        <AppText variant="caption" color="textTertiary">
                          {t(debit ? 'finance.debit' : 'finance.credit')}
                        </AppText>
                      </View>
                    </View>
                    <View
                      style={{
                        borderTopWidth: 1,
                        borderColor: colors.border,
                        paddingTop: 10,
                        flexDirection: row,
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <AppText variant="caption" color="textTertiary">
                        {t('finance.running')}
                      </AppText>
                      <AppText
                        variant="caption"
                        weight="medium"
                        color={e.running < 0 ? 'successText' : 'textSecondary'}
                      >
                        {money(Math.abs(e.running))} · {label(e.running)}
                      </AppText>
                    </View>
                  </Card>
                );
              })}
            {!visible.length ? (
              <Card tone="plain" style={{ paddingVertical: 28, gap: 8, alignItems: 'center' }}>
                <Search size={25} color={colors.textTertiary} />
                <AppText variant="bodySm" color="textSecondary">
                  {t(
                    query || type !== 'all' || period !== 'all'
                      ? 'finance.statement.noMatches'
                      : 'finance.empty',
                  )}
                </AppText>
              </Card>
            ) : null}
          </View>
        </>
      ) : (
        <AppText color="textSecondary">{t('finance.noCustomers')}</AppText>
      )}
    </View>
  );
}
