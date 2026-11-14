import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Banknote,
  Building2,
  Check,
  ChevronDown,
  CreditCard,
  FileText,
  Plus,
  ReceiptText,
  ShieldCheck,
  UserRound,
  Wallet,
  X,
} from 'lucide-react-native';
import { AppButton, AppText, Card, SearchField } from '@/components/ui';
import { useLocale } from '@/hooks/useLocale';
import { useTheme } from '@/theme/ThemeProvider';
import { typeFace } from '@/theme/typography';
import { balance, parseAmount, type FinanceState, type Method, type Receipt } from './domain';
import { money } from './documents';

interface Props {
  state: FinanceState;
  customerId: string;
  onCustomer: (id: string) => void;
  amount: string;
  onAmount: (value: string) => void;
  method: Method;
  onMethod: (value: Method) => void;
  note: string;
  onNote: (value: string) => void;
  bank: string;
  onBank: (value: string) => void;
  number: string;
  onNumber: (value: string) => void;
  due: string;
  onDue: (value: string) => void;
  error?: string;
  busy: boolean;
  review?: Pick<Receipt, 'customerId' | 'amount' | 'method' | 'cheque' | 'note'>;
  onReview: () => void;
  onConfirm: () => void;
  onEdit: () => void;
  onClose: () => void;
}

export function ReceiptComposer(p: Props) {
  const { colors } = useTheme();
  const { t, row, textAlign, alignStart } = useLocale();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = width < 640;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [noteOpen, setNoteOpen] = useState(Boolean(p.note));
  const customer = p.state.customers.find((c) => c.id === p.customerId);
  const debt = customer ? balance(p.state, customer.id) : 0;
  let entered = 0;
  try {
    entered = parseAmount(p.amount);
  } catch {
    /* Keep the preview neutral until the amount is valid. */
  }
  const nextBalance = debt - (p.method === 'cheque' ? 0 : entered);
  const methods = [
    {
      value: 'cash' as const,
      title: t('finance.cash'),
      subtitle: t('finance.collect.cashHint'),
      Icon: Banknote,
    },
    {
      value: 'cheque' as const,
      title: t('finance.cheque'),
      subtitle: t('finance.collect.chequeHint'),
      Icon: Building2,
    },
    {
      value: 'digital' as const,
      title: t('finance.collect.digitalTitle'),
      subtitle: t('finance.collect.digitalHint'),
      Icon: CreditCard,
    },
  ];
  const inputStyle = {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    backgroundColor: colors.surface,
    color: colors.text,
    padding: 14,
    fontSize: 15,
    minHeight: 50,
    fontFamily: typeFace('regular'),
    textAlign,
  };
  const field = (label: string, value: string, change: (value: string) => void, placeholder?: string) => (
    <View style={{ gap: 7, flex: 1 }}>
      <AppText variant="bodySm" weight="medium">
        {label}
      </AppText>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={change}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        style={inputStyle}
      />
    </View>
  );
  const sectionHeading = (number: string, title: string) => (
    <View style={{ flexDirection: row, gap: 9, alignItems: 'center', marginBottom: 12 }}>
      <View
        style={{
          width: 25,
          height: 25,
          borderRadius: 9,
          backgroundColor: colors.brandSoft,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <AppText variant="caption" weight="semibold" color="brand" numeric>
          {number}
        </AppText>
      </View>
      <AppText variant="title" weight="semibold">
        {title}
      </AppText>
    </View>
  );
  const detail = (label: string, value: string, strong = false) => (
    <View
      style={{
        flexDirection: row,
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        paddingVertical: 11,
      }}
    >
      <AppText variant="bodySm" color="textSecondary">
        {label}
      </AppText>
      <AppText
        variant={strong ? 'title' : 'bodySm'}
        weight={strong ? 'semibold' : 'medium'}
        style={{ flexShrink: 1 }}
      >
        {value}
      </AppText>
    </View>
  );

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={p.review ? p.onEdit : p.onClose}
      statusBarTranslucent
    >
      <View
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: 'center',
          alignItems: 'center',
          padding: compact ? 0 : 24,
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{
            width: '100%',
            maxWidth: 600,
            height: compact ? '100%' : '94%',
            maxHeight: 980,
            backgroundColor: colors.background,
            borderRadius: compact ? 0 : 26,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              paddingTop: compact ? Math.max(insets.top, 16) : 22,
              paddingHorizontal: 24,
              paddingBottom: 18,
              backgroundColor: colors.surface,
              borderBottomWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View style={{ flexDirection: row, alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 15,
                  backgroundColor: colors.brand,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Wallet size={23} color={colors.onBrand} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="h2">{t(p.review ? 'finance.review' : 'finance.newReceipt')}</AppText>
                <AppText variant="caption" color="textSecondary">
                  {t('finance.collect.subtitle')}
                </AppText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('finance.close')}
                onPress={p.onClose}
                disabled={p.busy}
                hitSlop={8}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 13,
                  backgroundColor: colors.surfaceAlt,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
            <View style={{ flexDirection: row, gap: 8, alignItems: 'center', marginTop: 20 }}>
              {[
                { label: t('finance.collect.details'), complete: Boolean(p.review) },
                { label: t('finance.collect.reviewStep'), complete: false },
              ].map((step, i) => (
                <View key={step.label} style={{ flex: 1, gap: 7 }}>
                  <View
                    style={{
                      height: 3,
                      borderRadius: 3,
                      backgroundColor: i === 0 || p.review ? colors.brand : colors.border,
                    }}
                  />
                  <View style={{ flexDirection: row, alignItems: 'center', gap: 5 }}>
                    {step.complete ? <Check size={13} color={colors.success} /> : null}
                    <AppText variant="caption" color={i === 0 || p.review ? 'brand' : 'textTertiary'}>
                      {step.label}
                    </AppText>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            contentContainerStyle={{ padding: compact ? 18 : 24, gap: 20 }}
            style={{ flex: 1 }}
          >
            {p.review ? (
              <>
                <View style={{ alignItems: 'center', gap: 10, paddingTop: 8 }}>
                  <View
                    style={{
                      backgroundColor: colors.brandSoft,
                      borderRadius: 20,
                      width: 64,
                      height: 64,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ReceiptText size={30} color={colors.brand} />
                  </View>
                  <AppText variant="titleLg">{t('finance.collect.ready')}</AppText>
                  <AppText variant="bodySm" color="textSecondary">
                    {t('finance.collect.reviewHint')}
                  </AppText>
                </View>
                <Card tone="plain" style={{ padding: 22 }}>
                  <AppText align="center" variant="caption" color="textSecondary">
                    {t('finance.amount')}
                  </AppText>
                  <AppText
                    align="center"
                    numeric
                    style={{
                      fontSize: 38,
                      lineHeight: 56,
                      fontFamily: typeFace('bold'),
                      color: colors.brand,
                      marginVertical: 10,
                    }}
                  >
                    {money(p.review.amount)}
                  </AppText>
                  <View
                    style={{
                      borderTopWidth: 1,
                      borderStyle: 'dashed',
                      borderColor: colors.borderStrong,
                      marginVertical: 8,
                    }}
                  />
                  {detail(t('finance.customer'), customer?.name ?? '', true)}
                  {detail(
                    t('finance.method'),
                    methods.find((m) => m.value === p.review!.method)?.title ?? '',
                  )}
                  {p.review.cheque ? (
                    <>
                      {detail(t('finance.bank'), p.review.cheque.bank)}
                      {detail(t('finance.chequeNumber'), p.review.cheque.number)}
                      {detail(t('finance.due'), p.review.cheque.due)}
                    </>
                  ) : null}
                  {p.note ? detail(t('finance.note'), p.note) : null}
                  <View
                    style={{
                      backgroundColor: colors.brandSofter,
                      borderRadius: 13,
                      paddingHorizontal: 12,
                      marginTop: 10,
                    }}
                  >
                    {detail(t('finance.collect.after'), money(nextBalance), true)}
                  </View>
                </Card>
                {p.method === 'cheque' ? (
                  <AppText variant="bodySm" color="warningText">
                    {t('finance.chequeNote')}
                  </AppText>
                ) : nextBalance < 0 ? (
                  <AppText variant="bodySm" color="infoText">
                    {t('finance.paymentWarning', { amount: money(nextBalance) })}
                  </AppText>
                ) : null}
              </>
            ) : (
              <>
                <View>
                  {sectionHeading('01', t('finance.collect.who'))}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('finance.collect.chooseCustomer')}
                    accessibilityState={{ expanded: pickerOpen }}
                    onPress={() => setPickerOpen(!pickerOpen)}
                    style={{
                      borderWidth: 1,
                      borderColor: pickerOpen ? colors.brand : colors.border,
                      backgroundColor: colors.surface,
                      borderRadius: 18,
                      padding: 15,
                      flexDirection: row,
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        backgroundColor: colors.surfaceAlt,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <UserRound size={22} color={colors.brand} />
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <AppText variant="title" weight="semibold">
                        {customer?.name ?? t('finance.collect.chooseCustomer')}
                      </AppText>
                      <AppText variant="caption" color="textSecondary">
                        {t('finance.balance')}: {money(debt)}
                      </AppText>
                    </View>
                    <ChevronDown
                      size={19}
                      color={colors.textTertiary}
                      style={{ transform: [{ rotate: pickerOpen ? '180deg' : '0deg' }] }}
                    />
                  </Pressable>
                  {pickerOpen ? (
                    <View
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 16,
                        backgroundColor: colors.surface,
                        padding: 12,
                        gap: 8,
                        marginTop: 8,
                      }}
                    >
                      <SearchField
                        value={search}
                        onChangeText={setSearch}
                        placeholder={t('finance.collect.searchCustomer')}
                      />
                      <ScrollView
                        nestedScrollEnabled
                        style={{ maxHeight: 240 }}
                        keyboardShouldPersistTaps="handled"
                      >
                        {p.state.customers
                          .filter((c) => `${c.name} ${c.phone}`.includes(search.trim()))
                          .map((c) => (
                            <Pressable
                              key={c.id}
                              accessibilityRole="button"
                              accessibilityLabel={c.name}
                              onPress={() => {
                                p.onCustomer(c.id);
                                setPickerOpen(false);
                                setSearch('');
                              }}
                              style={{
                                padding: 12,
                                flexDirection: row,
                                gap: 10,
                                alignItems: 'center',
                                backgroundColor: c.id === p.customerId ? colors.brandSofter : colors.surface,
                                borderRadius: 12,
                              }}
                            >
                              <View style={{ flex: 1, gap: 3 }}>
                                <AppText variant="bodySm" weight="medium">
                                  {c.name}
                                </AppText>
                                <AppText variant="caption" color="textSecondary">
                                  {money(balance(p.state, c.id))}
                                </AppText>
                              </View>
                              {c.id === p.customerId ? <Check size={17} color={colors.brand} /> : null}
                            </Pressable>
                          ))}
                        {!p.state.customers.some((c) => `${c.name} ${c.phone}`.includes(search.trim())) ? (
                          <AppText variant="bodySm" color="textTertiary" style={{ padding: 16 }}>
                            {t('finance.collect.noResults')}
                          </AppText>
                        ) : null}
                      </ScrollView>
                    </View>
                  ) : null}
                </View>

                <View>
                  {sectionHeading('02', t('finance.collect.howMuch'))}
                  <View style={{ backgroundColor: colors.deep, borderRadius: 22, padding: 22, gap: 14 }}>
                    <AppText variant="bodySm" color="onDeepMuted">
                      {t('finance.collect.amountLabel')}
                    </AppText>
                    <View style={{ flexDirection: row, gap: 12, alignItems: 'center' }}>
                      <TextInput
                        accessibilityLabel={t('finance.amount')}
                        value={p.amount}
                        onChangeText={p.onAmount}
                        placeholder="0.00"
                        placeholderTextColor={colors.onDeepMuted}
                        keyboardType="decimal-pad"
                        inputMode="decimal"
                        selectTextOnFocus
                        style={{
                          flex: 1,
                          minWidth: 0,
                          color: colors.onDeep,
                          fontSize: compact ? 40 : 46,
                          lineHeight: 60,
                          fontFamily: typeFace('semibold'),
                          textAlign,
                          padding: 0,
                          minHeight: 68,
                        }}
                      />
                      <View
                        style={{
                          borderWidth: 1,
                          borderColor: colors.onDeepMuted,
                          borderRadius: 12,
                          paddingVertical: 6,
                          paddingHorizontal: 12,
                        }}
                      >
                        <AppText color="onDeep" variant="h3">
                          ₪
                        </AppText>
                      </View>
                    </View>
                    <View style={{ height: 1, backgroundColor: colors.onDeepMuted, opacity: 0.25 }} />
                    <View style={{ flexDirection: row, justifyContent: 'space-between', gap: 12 }}>
                      <AppText variant="caption" color="onDeepMuted">
                        {t('finance.collect.after')}
                      </AppText>
                      <AppText variant="bodySm" color="onDeep" numeric>
                        {entered ? money(nextBalance) : '—'}
                      </AppText>
                    </View>
                  </View>
                  <View style={{ flexDirection: row, gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('finance.collect.fullBalance')}
                      disabled={debt <= 0}
                      onPress={() => p.onAmount((debt / 100).toFixed(2))}
                      style={{
                        flexGrow: 1,
                        padding: 10,
                        borderRadius: 11,
                        backgroundColor: colors.brandSoft,
                        opacity: debt > 0 ? 1 : 0.45,
                      }}
                    >
                      <AppText align="center" variant="caption" color="brand" weight="semibold">
                        {t('finance.collect.fullBalance')}
                      </AppText>
                    </Pressable>
                    {[50, 100, 200].map((n) => (
                      <Pressable
                        key={n}
                        accessibilityRole="button"
                        accessibilityLabel={money(n * 100)}
                        onPress={() => p.onAmount(String(n))}
                        style={{
                          flexGrow: 1,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.surface,
                          borderRadius: 11,
                          padding: 10,
                        }}
                      >
                        <AppText align="center" variant="caption" numeric>
                          {money(n * 100)}
                        </AppText>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View>
                  {sectionHeading('03', t('finance.method'))}
                  <View style={{ flexDirection: row, gap: 8 }}>
                    {methods.map(({ value, title, subtitle, Icon }) => {
                      const active = p.method === value;
                      return (
                        <Pressable
                          key={value}
                          accessibilityRole="button"
                          accessibilityLabel={t(`finance.${value}`)}
                          accessibilityState={{ selected: active }}
                          onPress={() => p.onMethod(value)}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            borderWidth: active ? 2 : 1,
                            borderColor: active ? colors.brand : colors.border,
                            backgroundColor: active ? colors.brandSofter : colors.surface,
                            borderRadius: 17,
                            padding: compact ? 10 : 14,
                            gap: 7,
                            alignItems: alignStart,
                          }}
                        >
                          <View
                            style={{
                              width: '100%',
                              flexDirection: row,
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <Icon size={22} color={active ? colors.brand : colors.textSecondary} />
                            <View
                              style={{
                                width: 16,
                                height: 16,
                                borderRadius: 8,
                                borderWidth: active ? 0 : 1,
                                borderColor: colors.borderStrong,
                                backgroundColor: active ? colors.brand : colors.surface,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {active ? <Check size={11} color={colors.onBrand} /> : null}
                            </View>
                          </View>
                          <AppText variant="bodySm" weight="semibold">
                            {title}
                          </AppText>
                          <AppText variant="caption" color="textSecondary" style={{ fontSize: 10 }}>
                            {subtitle}
                          </AppText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                {p.method === 'cheque' ? (
                  <Card tone="plain" style={{ gap: 14 }}>
                    <View style={{ flexDirection: row, alignItems: 'center', gap: 8 }}>
                      <Building2 size={18} color={colors.brand} />
                      <AppText weight="semibold">{t('finance.collect.chequeDetails')}</AppText>
                    </View>
                    {field(t('finance.bank'), p.bank, p.onBank)}
                    {field(t('finance.chequeNumber'), p.number, p.onNumber)}
                    {field(t('finance.due'), p.due, p.onDue, 'YYYY-MM-DD')}
                    <AppText variant="caption" color="warningText">
                      {t('finance.chequeNote')}
                    </AppText>
                  </Card>
                ) : p.method === 'digital' ? (
                  <Card tone="brand">
                    <AppText variant="bodySm" color="infoText">
                      {t('finance.digitalNote')}
                    </AppText>
                  </Card>
                ) : null}
                <View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('finance.note')}
                    accessibilityState={{ expanded: noteOpen }}
                    onPress={() => setNoteOpen(!noteOpen)}
                    style={{ flexDirection: row, gap: 8, alignItems: 'center', paddingVertical: 8 }}
                  >
                    <Plus size={17} color={colors.textSecondary} />
                    <AppText variant="bodySm" color="textSecondary">
                      {t('finance.collect.addNote')}
                    </AppText>
                  </Pressable>
                  {noteOpen ? (
                    <TextInput
                      accessibilityLabel={t('finance.note')}
                      value={p.note}
                      onChangeText={p.onNote}
                      multiline
                      maxLength={500}
                      placeholder={t('finance.collect.notePlaceholder')}
                      placeholderTextColor={colors.placeholder}
                      style={[inputStyle, { minHeight: 88, textAlignVertical: 'top' }]}
                    />
                  ) : null}
                </View>
              </>
            )}
          </ScrollView>

          <View
            style={{
              paddingHorizontal: compact ? 18 : 24,
              paddingTop: 14,
              paddingBottom: compact ? Math.max(insets.bottom, 16) : 20,
              borderTopWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              gap: 9,
            }}
          >
            {p.error ? (
              <View
                accessibilityRole="alert"
                style={{ backgroundColor: colors.dangerSoft, borderRadius: 12, padding: 13 }}
              >
                <AppText variant="bodySm" color="dangerText">
                  {p.error}
                </AppText>
              </View>
            ) : null}
            <AppButton
              label={t(p.review ? 'finance.confirm' : 'finance.save')}
              loading={p.busy}
              onPress={p.review ? p.onConfirm : p.onReview}
              iconEnd={<ArrowLeft size={18} color={colors.onBrand} />}
            />
            {p.review ? (
              <AppButton
                size="sm"
                label={t('finance.back')}
                variant="ghost"
                onPress={p.onEdit}
                disabled={p.busy}
              />
            ) : (
              <View style={{ flexDirection: row, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <ShieldCheck size={13} color={colors.textTertiary} />
                <AppText variant="caption" color="textTertiary">
                  {t('finance.collect.savedHint')}
                </AppText>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
