import { SaleCheckSummary } from './SaleCheckSummary';
import { ReturnPanel } from './ReturnPanel';
import { InvoicePanel } from './InvoicePanel';
import { LedgerPanel } from './LedgerPanel';
import { ReceiptComposer } from './ReceiptComposer';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Crypto from 'expo-crypto';
import {
  Wallet,
  ReceiptText,
  RefreshCw,
  Plus,
  FileText,
  Banknote,
  CircleCheck,
  WifiOff,
} from 'lucide-react-native';
import { AppButton, AppText, Card, Screen, SearchField, StatusBadge } from '@/components/ui';
import { TAB_BAR_CLEARANCE } from '@/components/navigation/TabBar';
import { useLocale } from '@/hooks/useLocale';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme } from '@/theme/ThemeProvider';
import { ar, type TranslationKey } from '@/i18n';
import { useFinance } from './hooks';
import { financeRepository } from './repository';
import {
  applyOperation,
  balance,
  parseAmount,
  remaining,
  wallet,
  type FinanceState,
  type Method,
  type Operation,
} from './domain';
import { documentHtml, money, printDocument, reference, shareReceipt } from './documents';

type Section = 'overview' | 'ledger' | 'cheques' | 'wallet' | 'invoices' | 'returns' | 'sync';
type Form = 'receipt' | 'return' | 'deposit' | 'order' | 'connect';
const sections: Section[] = ['overview', 'ledger', 'cheques', 'wallet', 'invoices', 'returns', 'sync'];
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Hebron' });
const validDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  Number.isFinite(Date.parse(s)) &&
  new Date(s).toISOString().slice(0, 10) === s;
function errorKey(code: string): TranslationKey {
  const key = `finance.error.${code}`;
  return (key in ar ? key : 'finance.error.server') as TranslationKey;
}

function Field({
  label,
  value,
  onChange,
  numeric = false,
  secret = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
  secret?: boolean;
  placeholder?: string;
}) {
  const { colors } = useTheme();
  const { textAlign } = useLocale();
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="bodySm" weight="medium">
        {label}
      </AppText>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        secureTextEntry={secret}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        autoCapitalize="none"
        style={{
          borderWidth: 1,
          borderColor: colors.borderStrong,
          borderRadius: 12,
          padding: 12,
          minHeight: 48,
          color: colors.text,
          backgroundColor: colors.surface,
          textAlign,
          fontSize: 16,
        }}
      />
    </View>
  );
}
function Choices<T extends string>({
  value,
  onChange,
  items,
  wrap = false,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: string }[];
  wrap?: boolean;
}) {
  const { colors } = useTheme();
  const { row } = useLocale();
  const buttons = items.map((item) => (
    <Pressable
      key={item.value}
      accessibilityRole="button"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: value === item.value }}
      onPress={() => onChange(item.value)}
      style={{
        ...(wrap
          ? { flexBasis: '45%' as const, flexGrow: 1, minHeight: 48, justifyContent: 'center' as const }
          : {}),
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: value === item.value ? colors.brand : colors.border,
        backgroundColor: value === item.value ? colors.brand : colors.surface,
      }}
    >
      <AppText variant="bodySm" style={{ color: value === item.value ? colors.onBrand : colors.text }}>
        {item.label}
      </AppText>
    </Pressable>
  ));
  return wrap ? (
    <View style={{ flexDirection: row, flexWrap: 'wrap', gap: 8, paddingVertical: 6 }}>{buttons}</View>
  ) : (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator
      contentContainerStyle={{ flexDirection: row, gap: 8, paddingVertical: 6 }}
    >
      {buttons}
    </ScrollView>
  );
}
export default function FinanceScreen() {
  const f = useFinance();
  const { t, row, dateLocale } = useLocale();
  const { colors } = useTheme();
  const role = usePreferencesStore((s) => s.role);
  const params = useLocalSearchParams<{ customerId?: string; connect?: string }>();
  const [section, setSection] = useState<Section>(
    params.customerId ? 'ledger' : role === 'warehouse_staff' ? 'returns' : 'overview',
  );
  const [customerId, setCustomerId] = useState(params.customerId ?? '');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<Form | undefined>(params.connect === '1' ? 'connect' : undefined);
  const [confirmation, setConfirmation] = useState<Operation>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [discardId, setDiscardId] = useState<string>();
  useEffect(() => {
    if (params.customerId) {
      setCustomerId(params.customerId);
      setSection('ledger');
    }
  }, [params.customerId]);
  const state = f.state;
  const actorId =
    f.mode === 'server'
      ? (f.actorId ?? '')
      : {
          manager: 'u_manager',
          accountant: 'u_accountant',
          warehouse_staff: 'u_warehouse',
          sales_rep: 'u_sales',
          delivery_rep: 'u_delivery',
        }[role ?? 'accountant'];
  const manage =
    f.mode === 'server'
      ? f.permissions?.includes('finance:manage')
      : role === 'accountant' || role === 'manager';
  const collect =
    f.mode === 'server' ? f.permissions?.includes('finance:collect') : !!role && role !== 'warehouse_staff';
  const canCreateReturn =
    f.mode === 'server'
      ? Boolean(f.permissions?.includes('returns:create'))
      : Boolean(role && role !== 'warehouse_staff');
  const canReviewReturn =
    f.mode === 'server'
      ? Boolean(f.permissions?.includes('returns:review'))
      : role === 'warehouse_staff' || role === 'manager';
  const createOrders =
    f.mode === 'server'
      ? f.permissions?.includes('orders:create')
      : role === 'sales_rep' || role === 'manager';
  const currentCustomer = state?.customers.find((c) => c.id === (customerId || state.customers[0]?.id));
  const chosenId = currentCustomer?.id ?? '';
  const pendingIds = new Set(f.pending.map((p) => p.op.id));
  const notice = (id?: string) =>
    f.mode === 'demo'
      ? t('finance.demoDocument')
      : id && (pendingIds.has(id) || (id === 'pending' && f.pending.length > 0))
        ? t('finance.pendingDocument')
        : t('finance.synced');
  const saveStatus: TranslationKey =
    f.mode === 'demo'
      ? 'finance.saved'
      : f.syncing
        ? 'finance.syncing'
        : f.error
          ? 'finance.syncFailed'
          : !f.authenticated
            ? 'finance.reconnect'
            : f.pending.length
              ? 'finance.waitingSync'
              : f.lastSync
                ? 'finance.synced'
                : 'finance.neverSynced';
  const name = (id: string) => state?.customers.find((c) => c.id === id)?.name ?? id;
  const matches = (id: string, customer: string) =>
    `${reference(id)} ${name(customer)}`.toLowerCase().includes(search.trim().toLowerCase());
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(dateLocale, { year: 'numeric', month: 'short', day: 'numeric' });
  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'server');
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    if (!confirmation) return;
    await act(async () => {
      await financeRepository.submit(confirmation);
      setConfirmation(undefined);
      setForm(undefined);
      setMessage(t('finance.saved'));
    });
  }
  const invoiceRows = (i: FinanceState['invoices'][number]) => [
    [t('finance.product'), t('finance.quantity'), t('finance.price'), t('finance.total')],
    ...i.items.map((item) => [
      item.name,
      String(item.quantity),
      money(item.unitPrice),
      money(item.unitPrice * item.quantity),
    ]),
    ...i.items.flatMap((item) => (item.unitCodes ?? []).map((code) => [item.name, code, '', ''])),
    [t('finance.unitCodes.labels'), '', '', ''],
    [t('finance.total'), '', '', money(i.total)],
  ];
  const cardTitle = (title: string, subtitle?: string) => (
    <View style={{ gap: 4 }}>
      <AppText variant="titleLg">{title}</AppText>
      {subtitle ? (
        <AppText variant="bodySm" color="textSecondary">
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
  const empty = (
    <AppText color="textTertiary" style={{ paddingVertical: 20 }}>
      {t('finance.empty')}
    </AppText>
  );
  if (!state || !f.ready)
    return (
      <Screen>
        <AppText variant="h2">{t('finance.title')}</AppText>
        {f.error ? (
          <>
            <AppText color="dangerText">{t(errorKey(f.error))}</AppText>
            <AppButton label={t('finance.retry')} onPress={() => void financeRepository.init()} />
          </>
        ) : (
          <ActivityIndicator color={colors.brand} />
        )}
      </Screen>
    );
  const due = state.receipts.filter(
    (r) =>
      r.method === 'cheque' &&
      r.status === 'pending' &&
      r.cheque!.due <=
        new Date(Date.now() + 7 * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Hebron' }),
  );
  const metric = (label: string, value: number, icon: React.ReactNode) => (
    <Card key={label} style={{ flexGrow: 1, flexBasis: '45%', gap: 8 }}>
      <View style={{ flexDirection: row, justifyContent: 'space-between', alignItems: 'center' }}>
        {icon}
        <AppText variant="caption" color="textSecondary">
          {label}
        </AppText>
      </View>
      <AppText variant="h2" numeric>
        {money(value)}
      </AppText>
    </Card>
  );
  const summary = (op: Operation) =>
    op.kind === 'receipt'
      ? `${name(op.customerId)} · ${money(op.amount)} · ${t(`finance.${op.method}`)}`
      : op.kind === 'invoice'
        ? `${t('finance.invoice')} · ${reference(op.orderId)}`
        : op.kind === 'cheque'
          ? `${reference(op.receiptId)} · ${t(`finance.status.${op.status}`)}`
          : op.kind === 'deposit'
            ? `${money(op.amount)} · ${op.note}`
            : op.kind === 'order'
              ? `${name(op.customerId)} · ${money(op.items.reduce((n, i) => n + i.quantity * i.unitPrice, 0))}`
              : op.kind === 'returnReview'
                ? `${reference(op.returnId)} · ${t(`finance.returnReview.status.${op.decision}`)}`
                : op.kind === 'returnCheck'
                  ? `${reference(op.returnId)} · ${t('finance.returnCheck.action')}`
                  : `${reference(op.invoiceId)} · ${op.reason}`;
  const print = (title: string, rows: string[][], id?: string) =>
    act(() => printDocument(documentHtml(title, state.companyName, rows, notice(id))));
  return (
    <>
      <Screen
        bottomInset={TAB_BAR_CLEARANCE}
        keyboardAvoiding
        contentContainerStyle={{ gap: 16 }}
        testID="finance-screen"
      >
        <View style={{ flexDirection: row, alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1, gap: 3 }}>
            <AppText variant="h2">{t('finance.title')}</AppText>
            <AppText color="textSecondary" variant="bodySm">
              {t('finance.subtitle')}
            </AppText>
          </View>
          <View style={{ backgroundColor: colors.brand, borderRadius: 18, padding: 14 }}>
            <Wallet color={colors.onBrand} size={26} />
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('finance.sync')}
          onPress={() => setSection('sync')}
        >
          <Card style={{ backgroundColor: !f.online ? colors.warningSoft : colors.brandSofter, padding: 12 }}>
            <View style={{ flexDirection: row, alignItems: 'center', gap: 10 }}>
              {!f.online ? (
                <WifiOff color={colors.warningText} size={18} />
              ) : (
                <CircleCheck color={colors.brand} size={18} />
              )}
              <View style={{ flex: 1 }}>
                <AppText variant="bodySm" weight="medium">
                  {!f.online
                    ? t('finance.offline')
                    : t(f.mode === 'demo' ? 'finance.demo' : 'finance.server')}
                </AppText>
                {f.pending.length ? (
                  <AppText variant="caption" color="warningText">
                    {t('finance.pending', { n: f.pending.length })}
                  </AppText>
                ) : null}
              </View>
              <RefreshCw size={16} color={colors.brand} />
            </View>
          </Card>
        </Pressable>
        <Choices
          wrap
          value={section}
          onChange={setSection}
          items={(canReviewReturn && !collect && !canCreateReturn
            ? (['returns', 'sync'] as Section[])
            : sections
          ).map((value) => ({ value, label: t(`finance.${value}`) }))}
        />
        {message || f.mode === 'server' ? (
          <StatusBadge
            tone={
              f.error
                ? 'danger'
                : f.pending.length || (!f.authenticated && f.mode === 'server')
                  ? 'warning'
                  : 'success'
            }
            label={message && message !== t('finance.saved') ? message : t(saveStatus)}
          />
        ) : null}
        {error ? (
          <AppText accessibilityRole="alert" color="dangerText">
            {t(errorKey(error))}
          </AppText>
        ) : null}
        {section === 'overview' ? (
          <>
            {state.companyId === 'darb-presentation' ? (
              <Card tone="brand" style={{ gap: 10 }}>
                <AppText variant="h3">{t('finance.presentation.title')}</AppText>
                <AppText variant="bodySm">{t('finance.presentation.steps')}</AppText>
                <AppButton
                  label={t('finance.presentation.invoice')}
                  size="sm"
                  onPress={() => setSection('invoices')}
                />
                <AppButton
                  label={t('finance.presentation.exit')}
                  variant="ghost"
                  size="sm"
                  onPress={() => void act(() => financeRepository.exitPresentation())}
                />
              </Card>
            ) : null}
            <View style={{ flexDirection: row, flexWrap: 'wrap', gap: 10 }}>
              {metric(
                t('finance.receivables'),
                state.customers.reduce((n, c) => n + Math.max(0, balance(state, c.id)), 0),
                <FileText size={20} color={colors.brand} />,
              )}
              {metric(
                t('finance.cashWallet'),
                wallet(state, actorId),
                <Wallet size={20} color={colors.success} />,
              )}
              {metric(
                t('finance.collected'),
                state.receipts.filter((r) => r.status === 'cleared').reduce((n, r) => n + r.amount, 0),
                <Banknote size={20} color={colors.brand} />,
              )}
              {metric(
                t('finance.pendingCheques'),
                state.receipts
                  .filter((r) => r.method === 'cheque' && r.status === 'pending')
                  .reduce((n, r) => n + r.amount, 0),
                <ReceiptText size={20} color={colors.warning} />,
              )}
            </View>
            {collect ? (
              <AppButton
                label={t('finance.newReceipt')}
                icon={<Plus color={colors.onBrand} size={18} />}
                onPress={() => setForm('receipt')}
              />
            ) : null}
            {createOrders ? (
              <AppButton label={t('finance.newOrder')} variant="secondary" onPress={() => setForm('order')} />
            ) : null}
            {due.length ? (
              <Card style={{ gap: 10, backgroundColor: colors.warningSoft }}>
                {cardTitle(t('finance.dueCheques'))}
                {due.map((r) => (
                  <Pressable key={r.id} onPress={() => setSection('cheques')}>
                    <AppText>
                      {name(r.customerId)} · {money(r.amount)} · {r.cheque!.due}
                    </AppText>
                  </Pressable>
                ))}
              </Card>
            ) : null}
            {cardTitle(t('finance.activity'))}
            {state.entries
              .filter((e) => e.kind !== 'opening')
              .slice(-6)
              .reverse()
              .map((e) => (
                <Card key={e.id} style={{ gap: 4 }}>
                  <AppText weight="medium">
                    {name(e.customerId)} · {t(`finance.${e.kind}`)}
                  </AppText>
                  <AppText numeric color={e.debit ? 'dangerText' : 'successText'}>
                    {money(e.debit || e.credit)} · {date(e.date)}
                  </AppText>
                </Card>
              ))}
            {!state.entries.some((e) => e.kind !== 'opening') ? empty : null}
          </>
        ) : null}
        {section === 'ledger' ? (
          <LedgerPanel
            state={state}
            customerId={chosenId}
            onCustomer={setCustomerId}
            onCollect={collect ? () => setForm('receipt') : undefined}
            onExport={(title, rows) => void print(title, rows, f.pending.length ? 'pending' : undefined)}
          />
        ) : null}
        {['cheques', 'wallet'].includes(section) ? (
          <SearchField value={search} onChangeText={setSearch} placeholder={t('finance.search')} />
        ) : null}
        {section === 'cheques' ? (
          <>
            <AppText variant="bodySm" color="textSecondary">
              {t('finance.chequeNote')}
            </AppText>
            {collect ? (
              <AppButton label={t('finance.newReceipt')} onPress={() => setForm('receipt')} />
            ) : null}
            {state.receipts
              .filter((r) => r.method === 'cheque' && matches(r.id, r.customerId))
              .slice()
              .sort((a, b) => a.cheque!.due.localeCompare(b.cheque!.due))
              .map((r) => (
                <Card key={r.id} style={{ gap: 10 }}>
                  {cardTitle(name(r.customerId), `${r.cheque!.bank} · ${r.cheque!.number}`)}
                  <View style={{ flexDirection: row, justifyContent: 'space-between' }}>
                    <AppText variant="h3" numeric>
                      {money(r.amount)}
                    </AppText>
                    <StatusBadge
                      tone={
                        r.status === 'cleared' ? 'success' : r.status === 'bounced' ? 'danger' : 'warning'
                      }
                      label={t(`finance.status.${r.status}`)}
                    />
                  </View>
                  <AppText numeric>{r.cheque!.due}</AppText>
                  {r.status === 'pending' && r.cheque!.due === today() ? (
                    <AppText color="warningText">{t('finance.dueToday')}</AppText>
                  ) : null}
                  {r.status === 'pending' && r.cheque!.due < today() ? (
                    <AppText color="dangerText">{t('finance.overdue')}</AppText>
                  ) : null}
                  {r.status === 'pending' && manage ? (
                    <>
                      <AppButton
                        label={t('finance.clearCheque')}
                        size="sm"
                        variant="tonal"
                        onPress={() =>
                          setConfirmation({
                            id: Crypto.randomUUID(),
                            actorId,
                            date: new Date().toISOString(),
                            kind: 'cheque',
                            receiptId: r.id,
                            status: 'cleared',
                          })
                        }
                      />
                      <AppButton
                        label={t('finance.bounceCheque')}
                        size="sm"
                        variant="danger"
                        onPress={() =>
                          setConfirmation({
                            id: Crypto.randomUUID(),
                            actorId,
                            date: new Date().toISOString(),
                            kind: 'cheque',
                            receiptId: r.id,
                            status: 'bounced',
                          })
                        }
                      />
                    </>
                  ) : null}
                </Card>
              ))}
            {!state.receipts.some((r) => r.method === 'cheque' && matches(r.id, r.customerId)) ? empty : null}
          </>
        ) : null}
        {section === 'wallet' ? (
          <>
            <Card tone="brand" style={{ gap: 6 }}>
              <AppText>{t('finance.cashWallet')}</AppText>
              <AppText variant="h1" numeric>
                {money(wallet(state, actorId))}
              </AppText>
              <AppText variant="bodySm">
                {t('finance.digitalWallet')}: {money(wallet(state, actorId, 'digital'))}
              </AppText>
            </Card>
            <AppText variant="bodySm" color="textSecondary">
              {t('finance.digitalNote')}
            </AppText>
            {collect ? (
              <>
                <AppButton label={t('finance.newReceipt')} onPress={() => setForm('receipt')} />
                <AppButton
                  label={t('finance.deposit')}
                  variant="secondary"
                  disabled={wallet(state, actorId) <= 0}
                  onPress={() => setForm('deposit')}
                />
              </>
            ) : null}
            {state.receipts
              .filter((r) => r.actorId === actorId && matches(r.id, r.customerId))
              .slice()
              .reverse()
              .map((r) => (
                <Card key={r.id} style={{ gap: 10 }}>
                  {cardTitle(`${t('finance.receipt')} ${reference(r.id)}`, name(r.customerId))}
                  <AppText variant="h3" numeric>
                    {money(r.amount)}
                  </AppText>
                  <AppText variant="bodySm">
                    {t(`finance.${r.method}`)} · {date(r.date)}
                  </AppText>
                  <StatusBadge
                    label={t(`finance.status.${r.status}`)}
                    tone={r.status === 'cleared' ? 'success' : r.status === 'pending' ? 'warning' : 'danger'}
                  />
                  <AppText variant="caption" color="textTertiary">
                    {notice(r.id)}
                  </AppText>
                  <AppButton
                    size="sm"
                    variant="secondary"
                    label={t('finance.print')}
                    onPress={() =>
                      void print(
                        `${t('finance.receipt')} ${reference(r.id)}`,
                        [
                          [t('finance.customer'), name(r.customerId)],
                          [t('finance.amount'), money(r.amount)],
                          [t('finance.method'), t(`finance.${r.method}`)],
                          [t('finance.date'), date(r.date)],
                          [t('finance.note'), r.note],
                          [t('finance.statusLabel'), t(`finance.status.${r.status}`)],
                          ...(r.cheque
                            ? [
                                [t('finance.bank'), r.cheque.bank],
                                [t('finance.chequeNumber'), r.cheque.number],
                                [t('finance.due'), r.cheque.due],
                                [
                                  t('finance.note'),
                                  r.status === 'pending'
                                    ? t('finance.pendingReceipt')
                                    : r.status === 'bounced'
                                      ? t('finance.bouncedReceipt')
                                      : t('finance.clearedReceipt'),
                                ],
                              ]
                            : []),
                        ],
                        r.id,
                      )
                    }
                  />
                  <AppButton
                    size="sm"
                    variant="tonal"
                    label={t('finance.whatsapp')}
                    onPress={() => void act(() => shareReceipt(state, r, notice(r.id)))}
                  />
                </Card>
              ))}
            {cardTitle(t('finance.depositHistory'))}
            {state.deposits
              .filter((d) => d.actorId === actorId)
              .slice()
              .reverse()
              .map((d) => (
                <Card key={d.id}>
                  <AppText>
                    {money(d.amount)} · {date(d.date)}
                  </AppText>
                  <AppText color="textSecondary">{d.note}</AppText>
                </Card>
              ))}
          </>
        ) : null}
        {section === 'invoices' ? (
          <InvoicePanel
            state={state}
            canIssue={Boolean(collect)}
            notice={notice}
            onIssue={(orderId) =>
              setConfirmation({
                id: Crypto.randomUUID(),
                actorId,
                date: new Date().toISOString(),
                kind: 'invoice',
                orderId,
              })
            }
            onPrint={(invoice) =>
              void print(
                `${t('finance.invoice')} ${reference(invoice.id)} — ${name(invoice.customerId)}`,
                invoiceRows(invoice),
                invoice.id,
              )
            }
          />
        ) : null}
        {section === 'returns' ? (
          <ReturnPanel
            state={state}
            actorId={actorId}
            canCreate={canCreateReturn}
            canReview={canReviewReturn}
            onRequest={() => setForm('return')}
            notice={notice}
          />
        ) : null}
        {section === 'sync' ? (
          <>
            <Card style={{ gap: 12 }}>
              {cardTitle(
                t('finance.sync'),
                f.mode === 'demo'
                  ? t('finance.demoSync')
                  : f.authenticated
                    ? t('finance.server')
                    : t('finance.reconnect'),
              )}
              <AppText color="textSecondary" variant="bodySm">
                {t('finance.localNote')}
              </AppText>
              <AppText variant="caption">
                {f.lastSync
                  ? t('finance.lastSync', { date: new Date(f.lastSync).toLocaleString(dateLocale) })
                  : t('finance.neverSynced')}
              </AppText>
              {f.error ? <AppText color="dangerText">{t(errorKey(f.error))}</AppText> : null}
              <AppButton
                label={t('finance.syncNow')}
                variant="tonal"
                loading={f.syncing}
                disabled={f.mode === 'demo' || !f.online || !f.authenticated}
                onPress={() => void financeRepository.sync()}
              />
              <AppButton
                label={t('finance.presentation.start')}
                variant="secondary"
                onPress={() =>
                  void act(async () => {
                    await financeRepository.startPresentation();
                    setSection('overview');
                  })
                }
              />
              <AppText variant="caption" color="textSecondary">
                {t('finance.presentation.separate')}
              </AppText>
              <AppButton label={t('finance.connect')} onPress={() => setForm('connect')} />
              {f.mode === 'server' ? (
                <AppButton
                  label={t('finance.demoAction')}
                  variant="ghost"
                  onPress={() => void act(() => financeRepository.useDemo())}
                />
              ) : null}
            </Card>
            {f.pending.some((p) => p.error) ? (
              <AppText color="dangerText">{t('finance.blocked')}</AppText>
            ) : null}
            {f.pending.map((p, index) => (
              <Card key={p.op.id} style={{ gap: 6 }}>
                <AppText>{summary(p.op)}</AppText>
                <AppText variant="caption">
                  {reference(p.op.id)} · {date(p.op.date)}
                </AppText>
                {p.error ? (
                  <>
                    <AppText color="dangerText">{t(errorKey(p.error))}</AppText>
                    {index === 0 ? (
                      <AppButton
                        label={t('finance.archive')}
                        variant="danger"
                        onPress={() => setDiscardId(p.op.id)}
                      />
                    ) : null}
                  </>
                ) : null}
              </Card>
            ))}
            {f.rejected?.length ? (
              <>
                <AppText variant="title">{t('finance.archived')}</AppText>
                {f.rejected.map((p) => (
                  <Card key={p.op.id}>
                    <AppText>{summary(p.op)}</AppText>
                    <AppText variant="caption" color="dangerText">
                      {t(errorKey(p.error ?? 'invalid'))}
                    </AppText>
                  </Card>
                ))}
              </>
            ) : null}
          </>
        ) : null}
      </Screen>
      {form ? (
        <FinanceForm
          key={form}
          form={form}
          state={state}
          actorId={actorId}
          customerId={chosenId}
          close={() => setForm(undefined)}
          saved={() => {
            setForm(undefined);
            setMessage(t('finance.saved'));
          }}
        />
      ) : null}
      <Modal
        visible={!!discardId}
        transparent
        animationType="fade"
        onRequestClose={() => setDiscardId(undefined)}
      >
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.overlay }}>
          <Card style={{ gap: 16, width: '100%', maxWidth: 520, alignSelf: 'center' }}>
            <AppText>{t('finance.archiveConfirm')}</AppText>
            {error ? <AppText color="dangerText">{t(errorKey(error))}</AppText> : null}
            <AppButton
              label={t('finance.archive')}
              variant="danger"
              loading={busy}
              onPress={() =>
                void act(async () => {
                  await financeRepository.archiveRejected(discardId!);
                  setDiscardId(undefined);
                })
              }
            />
            <AppButton
              label={t('finance.cancel')}
              variant="ghost"
              disabled={busy}
              onPress={() => setDiscardId(undefined)}
            />
          </Card>
        </View>
      </Modal>
      <Modal
        visible={!!confirmation}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmation(undefined)}
      >
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.overlay }}>
          <Card style={{ gap: 16, width: '100%', maxWidth: 520, alignSelf: 'center' }}>
            <AppText variant="h3">{t('finance.review')}</AppText>
            {confirmation ? (
              <>
                <AppText>{summary(confirmation)}</AppText>
                {confirmation.kind === 'receipt' && confirmation.method !== 'cheque' ? (
                  <AppText color="textSecondary">
                    {t('finance.paymentWarning', {
                      amount: money(balance(state, confirmation.customerId) - confirmation.amount),
                    })}
                  </AppText>
                ) : null}
                {confirmation.kind === 'invoice' ? (
                  <AppText color="textSecondary">{t('finance.unitCodes.labels')}</AppText>
                ) : null}
                {confirmation.kind === 'cheque' ? (
                  <AppText color="textSecondary">{t('finance.reviewCheque')}</AppText>
                ) : null}
              </>
            ) : null}
            {error ? <AppText color="dangerText">{t(errorKey(error))}</AppText> : null}
            <AppButton label={t('finance.confirm')} loading={busy} onPress={() => void commit()} />
            <AppButton
              variant="ghost"
              disabled={busy}
              label={t('finance.back')}
              onPress={() => setConfirmation(undefined)}
            />
          </Card>
        </View>
      </Modal>
    </>
  );
}

function FinanceForm({
  form,
  state,
  actorId,
  customerId,
  close,
  saved,
}: {
  form: Form;
  state: FinanceState;
  actorId: string;
  customerId: string;
  close: () => void;
  saved: () => void;
}) {
  const { t, row } = useLocale();
  const { colors } = useTheme();
  const [customer, setCustomer] = useState(customerId);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<Method>('cash');
  const [note, setNote] = useState('');
  const [number, setNumber] = useState('');
  const [bank, setBank] = useState('');
  const [due, setDue] = useState(today());
  const [invoiceId, setInvoiceId] = useState(
    state.invoices.find(
      (i) =>
        (!customerId || i.customerId === customerId) &&
        i.items.some((item) => item.unitCodes?.length && remaining(state, i.id, item.productId) > 0),
    )?.id ??
      state.invoices.find(
        (i) =>
          i.customerId === customerId && i.items.some((item) => remaining(state, i.id, item.productId) > 0),
      )?.id ??
      state.invoices.find((i) => i.items.some((item) => remaining(state, i.id, item.productId) > 0))?.id ??
      state.invoices[0]?.id ??
      '',
  );
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [photo, setPhoto] = useState('');
  const [unitCodeText, setUnitCodeText] = useState('');
  const [cart, setCart] = useState<
    { productId: string; quantity: number; name: string; unitPrice: number }[]
  >([]);
  const [url, setUrl] = useState(process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001');
  const [email, setEmail] = useState(__DEV__ ? (process.env.EXPO_PUBLIC_FINANCE_EMAIL ?? '') : '');
  const [password, setPassword] = useState('');
  const [slug, setSlug] = useState(__DEV__ ? (process.env.EXPO_PUBLIC_FINANCE_COMPANY ?? '') : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingReview, setPendingReview] = useState<Operation>();
  const [manualReturn, setManualReturn] = useState(false);
  const [requestInvoiceSearch, setRequestInvoiceSearch] = useState('');
  const [requestInvoiceOpen, setRequestInvoiceOpen] = useState(false);
  const invoice = state.invoices.find((i) => i.id === invoiceId);
  const products =
    form === 'return'
      ? (invoice?.items
          .filter((i) => remaining(state, invoiceId, i.productId) > 0)
          .map((i) => ({ id: i.productId, name: i.name, price: i.unitPrice })) ?? [])
      : state.products;
  const selectedProduct = products.find((p) => p.id === productId) ?? products[0];
  const tracked = !!invoice?.items.find((i) => i.productId === selectedProduct?.id)?.unitCodes?.length;
  const needsManual = manualReturn || !tracked;
  const returnHint: TranslationKey | undefined = !selectedProduct
    ? 'finance.returnExhaustedHelp'
    : !/^\d+$/.test(quantity) ||
        Number(quantity) <= 0 ||
        Number(quantity) > remaining(state, invoiceId, selectedProduct.id)
      ? 'finance.error.quantity'
      : !needsManual &&
          unitCodeText
            .trim()
            .split(/[\s,،]+/)
            .filter(Boolean).length !== Number(quantity)
        ? 'finance.error.unitCode'
        : note.trim().length < 3
          ? 'finance.reasonRequired'
          : !photo
            ? 'finance.photoRequired'
            : undefined;
  const base = () => ({ id: Crypto.randomUUID(), actorId, date: new Date().toISOString() });
  const integerQuantity = () => {
    if (!/^\d+$/.test(quantity) || !Number.isSafeInteger(Number(quantity)) || Number(quantity) <= 0)
      throw new Error('quantity');
    return Number(quantity);
  };
  async function pickPhoto() {
    setError('');
    setBusy(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError('photo');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled) {
        const asset = result.assets[0];
        let image = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: Math.min(asset.width, 1000) } }],
          { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true },
        );
        if ((image.base64?.length ?? 0) > 440000)
          image = await ImageManipulator.manipulateAsync(asset.uri, [{ resize: { width: 640 } }], {
            compress: 0.3,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: true,
          });
        const value = `data:image/jpeg;base64,${image.base64}`;
        if (!image.base64 || value.length > 450000) throw new Error('photo');
        setPhoto(value);
      }
    } catch {
      setError('photo');
    } finally {
      setBusy(false);
    }
  }
  function addItem() {
    try {
      if (!selectedProduct) throw new Error('quantity');
      const n = integerQuantity();
      if (cart.some((i) => i.productId === selectedProduct.id)) throw new Error('quantity');
      setCart([
        ...cart,
        {
          productId: selectedProduct.id,
          name: selectedProduct.name,
          quantity: n,
          unitPrice: selectedProduct.price,
        },
      ]);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function submit() {
    setError('');
    try {
      if (form === 'connect') {
        setBusy(true);
        await financeRepository.connect(url, email.trim(), password, slug.trim());
        setPassword('');
        close();
        return;
      }
      let op: Operation;
      if (form === 'receipt')
        op = {
          ...base(),
          kind: 'receipt',
          customerId: customer,
          amount: parseAmount(amount),
          method,
          note,
          cheque: method === 'cheque' ? { number, bank, due } : undefined,
        };
      else if (form === 'deposit') op = { ...base(), kind: 'deposit', amount: parseAmount(amount), note };
      else if (form === 'return')
        op = {
          ...base(),
          kind: 'return',
          verification: needsManual ? undefined : 'unit_codes',
          customerId: needsManual ? undefined : invoice?.customerId,
          invoiceId,
          items: [
            {
              productId: selectedProduct?.id ?? '',
              quantity: integerQuantity(),
              unitCodes: unitCodeText
                .split(/[\s,،]+/)
                .map((c) => c.trim().toUpperCase())
                .filter(Boolean),
            },
          ],
          reason: note,
          photo,
        };
      else op = { ...base(), kind: 'order', customerId: customer, items: cart };
      applyOperation(state, op);
      setPendingReview(op);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'invalid');
    } finally {
      setBusy(false);
    }
  }
  const title = t(
    form === 'receipt'
      ? 'finance.newReceipt'
      : form === 'return'
        ? 'finance.newReturn'
        : form === 'deposit'
          ? 'finance.deposit'
          : form === 'order'
            ? 'finance.newOrder'
            : 'finance.connect',
  );
  if (form === 'receipt') {
    return (
      <ReceiptComposer
        state={state}
        customerId={customer}
        onCustomer={setCustomer}
        amount={amount}
        onAmount={setAmount}
        method={method}
        onMethod={setMethod}
        note={note}
        onNote={setNote}
        bank={bank}
        onBank={setBank}
        number={number}
        onNumber={setNumber}
        due={due}
        onDue={setDue}
        error={error ? t(errorKey(error)) : undefined}
        busy={busy}
        review={pendingReview?.kind === 'receipt' ? pendingReview : undefined}
        onReview={() => void submit()}
        onEdit={() => setPendingReview(undefined)}
        onClose={close}
        onConfirm={() =>
          void (async () => {
            if (!pendingReview) return;
            setBusy(true);
            setError('');
            try {
              await financeRepository.submit(pendingReview);
              saved();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'server');
            } finally {
              setBusy(false);
            }
          })()
        }
      />
    );
  }
  if (pendingReview) {
    const op = pendingReview;
    const total =
      op.kind === 'receipt' || op.kind === 'deposit'
        ? op.amount
        : op.kind === 'order'
          ? op.items.reduce((n, i) => n + i.quantity * i.unitPrice, 0)
          : op.kind === 'return'
            ? op.items.reduce(
                (n, i) =>
                  n +
                  (state.invoices
                    .find((v) => v.id === op.invoiceId)
                    ?.items.find((v) => v.productId === i.productId)?.unitPrice ?? 0) *
                    i.quantity,
                0,
              )
            : 0;
    return (
      <Modal visible animationType="slide" onRequestClose={() => setPendingReview(undefined)}>
        <Screen
          contentContainerStyle={{
            gap: 20,
            paddingTop: 40,
            maxWidth: 560,
            width: '100%',
            alignSelf: 'center',
          }}
        >
          <AppText variant="h2">{t('finance.review')}</AppText>
          <Card style={{ gap: 12 }}>
            <AppText variant="h3">{title}</AppText>
            {op.kind === 'return' ? (
              <Card tone="brand" style={{ gap: 8 }}>
                <AppText color="warningText" variant="bodySm">
                  {op.verification === 'unit_codes'
                    ? t('finance.saleCheck.credit', { amount: money(total) })
                    : t('finance.returnReview.formSummary')}
                </AppText>
                {op.verification === 'unit_codes' ? (
                  <AppText variant="caption" color="textSecondary">
                    {t('finance.unitCodes.matched')}
                  </AppText>
                ) : null}
                {op.items.map((item) => (
                  <AppText key={item.productId} variant="bodySm">
                    {
                      state.invoices
                        .find((i) => i.id === op.invoiceId)
                        ?.items.find((i) => i.productId === item.productId)?.name
                    }{' '}
                    × {item.quantity}
                  </AppText>
                ))}
              </Card>
            ) : null}
            <AppText>
              {
                state.customers.find(
                  (c) =>
                    c.id ===
                    (op.kind === 'return'
                      ? state.invoices.find((i) => i.id === op.invoiceId)?.customerId
                      : customer),
                )?.name
              }
            </AppText>
            <AppText variant="h1" numeric>
              {money(total)}
            </AppText>
            {op.kind === 'receipt' ? (
              <>
                <AppText>{t(`finance.${op.method}`)}</AppText>
                <AppText color="textSecondary">
                  {op.method === 'cheque'
                    ? t('finance.chequeNote')
                    : t('finance.paymentWarning', {
                        amount: money(balance(state, op.customerId) - op.amount),
                      })}
                </AppText>
                {op.cheque ? (
                  <AppText>
                    {op.cheque.bank} · {op.cheque.number} · {op.cheque.due}
                  </AppText>
                ) : null}
              </>
            ) : null}
            {note ? <AppText>{note}</AppText> : null}
            {op.kind === 'order'
              ? op.items.map((i) => (
                  <AppText key={i.productId}>
                    {i.name} × {i.quantity} · {money(i.unitPrice * i.quantity)}
                  </AppText>
                ))
              : null}
          </Card>
          {error ? (
            <AppText accessibilityRole="alert" color="dangerText">
              {t(errorKey(error))}
            </AppText>
          ) : null}
          <AppButton
            label={t('finance.confirm')}
            loading={busy}
            onPress={() =>
              void (async () => {
                setBusy(true);
                setError('');
                try {
                  await financeRepository.submit(op);
                  saved();
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'server');
                } finally {
                  setBusy(false);
                }
              })()
            }
          />
          <AppButton
            variant="ghost"
            disabled={busy}
            label={t('finance.back')}
            onPress={() => setPendingReview(undefined)}
          />
        </Screen>
      </Modal>
    );
  }
  return (
    <Modal visible animationType="slide" onRequestClose={close}>
      <Screen
        keyboardAvoiding
        contentContainerStyle={{
          gap: 16,
          paddingTop: 32,
          paddingBottom: 40,
          maxWidth: 560,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        <View style={{ flexDirection: row, alignItems: 'center', justifyContent: 'space-between' }}>
          <AppText variant="h3">{title}</AppText>
          <AppButton label={t('finance.close')} fullWidth={false} variant="ghost" size="sm" onPress={close} />
        </View>
        {form === 'connect' ? (
          <>
            <Field label={t('finance.url')} value={url} onChange={setUrl} />
            <Field label={t('finance.company')} value={slug} onChange={setSlug} />
            <Field label={t('finance.email')} value={email} onChange={setEmail} />
            <Field label={t('finance.password')} value={password} onChange={setPassword} secret />
          </>
        ) : null}
        {form === 'order' ? (
          <>
            <AppText>{t('finance.customer')}</AppText>
            <Choices
              value={customer}
              onChange={setCustomer}
              items={state.customers.map((c) => ({ value: c.id, label: c.name }))}
            />
          </>
        ) : null}
        {form === 'deposit' ? (
          <Field label={t('finance.amount')} value={amount} onChange={setAmount} numeric />
        ) : null}
        {form === 'deposit' ? <AppText color="textSecondary">{t('finance.depositNote')}</AppText> : null}
        {form === 'return' ? (
          <>
            <AppText color="textSecondary" variant="bodySm">
              {t('finance.returnNote')}
            </AppText>
            <Card tone="brand" style={{ gap: 8 }}>
              <AppText variant="caption">{t('finance.returnReview.invoice')}</AppText>
              <AppText weight="semibold">
                {invoice
                  ? reference(invoice.id) +
                    ' · ' +
                    state.customers.find((c) => c.id === invoice.customerId)?.name
                  : t('finance.error.invoice')}
              </AppText>
              <AppButton
                size="sm"
                variant="secondary"
                label={t('finance.statement.change')}
                onPress={() => setRequestInvoiceOpen(!requestInvoiceOpen)}
              />
            </Card>
            {requestInvoiceOpen ? (
              <Card tone="plain" style={{ gap: 10, padding: 12 }}>
                <SearchField
                  value={requestInvoiceSearch}
                  onChangeText={setRequestInvoiceSearch}
                  placeholder={t('finance.search')}
                />
                <ScrollView
                  style={{ maxHeight: 240 }}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                >
                  {state.invoices
                    .filter((i) =>
                      (reference(i.id) + ' ' + state.customers.find((c) => c.id === i.customerId)?.name)
                        .toLowerCase()
                        .includes(requestInvoiceSearch.toLowerCase()),
                    )
                    .map((i) => (
                      <Pressable
                        key={i.id}
                        accessibilityRole="button"
                        accessibilityLabel={
                          reference(i.id) + ' · ' + state.customers.find((c) => c.id === i.customerId)?.name
                        }
                        onPress={() => {
                          setInvoiceId(i.id);
                          setProductId('');
                          setUnitCodeText('');
                          setManualReturn(false);
                          setRequestInvoiceOpen(false);
                          setRequestInvoiceSearch('');
                        }}
                        style={{ padding: 12, borderBottomWidth: 1, borderColor: colors.border }}
                      >
                        <AppText variant="bodySm">
                          {reference(i.id)} · {state.customers.find((c) => c.id === i.customerId)?.name}
                        </AppText>
                        <AppText variant="caption" numeric>
                          {money(i.total)}
                        </AppText>
                        <AppText
                          variant="caption"
                          color={
                            i.items.some((item) => remaining(state, i.id, item.productId) > 0)
                              ? 'successText'
                              : 'warningText'
                          }
                        >
                          {t(
                            i.items.some((item) => remaining(state, i.id, item.productId) > 0)
                              ? 'finance.returnAvailable'
                              : 'finance.returnExhausted',
                          )}
                        </AppText>
                      </Pressable>
                    ))}
                </ScrollView>
              </Card>
            ) : null}
          </>
        ) : null}
        {form === 'return' || form === 'order' ? (
          <>
            <AppText>{t('finance.product')}</AppText>
            <Choices
              value={selectedProduct?.id ?? ''}
              onChange={setProductId}
              items={products.map((p) => ({ value: p.id, label: p.name }))}
            />
            <Field label={t('finance.quantity')} value={quantity} onChange={setQuantity} numeric />
            {form === 'return' ? (
              <AppText color="textSecondary">
                {t('finance.remaining', { n: remaining(state, invoiceId, selectedProduct?.id ?? '') })}
              </AppText>
            ) : (
              <>
                <AppText color="textSecondary">{t('finance.offlineOrderNote')}</AppText>
                <AppButton label={t('finance.addItem')} variant="secondary" onPress={addItem} />
                {cart.map((i) => (
                  <Card key={i.productId}>
                    <AppText>
                      {i.name} × {i.quantity} · {money(i.unitPrice * i.quantity)}
                    </AppText>
                    <AppButton
                      label={t('finance.removeItem')}
                      size="sm"
                      variant="ghost"
                      onPress={() => setCart(cart.filter((n) => n.productId !== i.productId))}
                    />
                  </Card>
                ))}
              </>
            )}
          </>
        ) : null}
        {form === 'return' ? (
          <>
            {tracked ? (
              <Field label={t('finance.unitCodes.input')} value={unitCodeText} onChange={setUnitCodeText} />
            ) : null}
            {tracked ? (
              <AppText variant="caption" color="textSecondary">
                {t('finance.unitCodes.shortHelp')}
              </AppText>
            ) : null}
            {!selectedProduct ||
            !invoice?.items.find((i) => i.productId === selectedProduct.id)?.unitCodes?.length ? (
              <AppText color="warningText">{t('finance.unitCodes.legacy')}</AppText>
            ) : null}
            {tracked ? (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel={t('finance.saleCheck.manual')}
                aria-checked={manualReturn}
                onPress={() => setManualReturn(!manualReturn)}
                style={{
                  padding: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  backgroundColor: manualReturn ? colors.brandSoft : colors.surface,
                }}
              >
                <AppText variant="bodySm">
                  {manualReturn ? '✓ ' : ''}
                  {t('finance.saleCheck.manual')}
                </AppText>
              </Pressable>
            ) : null}
            {!needsManual ? (
              <SaleCheckSummary
                state={state}
                invoiceId={invoiceId}
                customerId={invoice?.customerId ?? ''}
                productId={selectedProduct?.id ?? ''}
                quantity={Number(quantity)}
                unitCodes={unitCodeText
                  .split(/[\s,،]+/)
                  .map((c) => c.trim().toUpperCase())
                  .filter(Boolean)}
              />
            ) : null}
          </>
        ) : null}
        {form !== 'connect' && form !== 'order' ? (
          <Field
            label={t(form === 'return' ? 'finance.reason' : 'finance.note')}
            value={note}
            onChange={setNote}
          />
        ) : null}
        {form === 'return' ? (
          <>
            <AppButton
              label={t(photo ? 'finance.photoAttached' : 'finance.photo')}
              variant="secondary"
              onPress={() => void pickPhoto()}
            />
            {photo ? <Image source={{ uri: photo }} style={{ height: 160 }} resizeMode="contain" /> : null}
          </>
        ) : null}
        {form === 'return' && !selectedProduct ? (
          <Card tone="brand" style={{ gap: 10 }}>
            <AppText accessibilityRole="alert" color="warningText">
              {t('finance.returnExhaustedHelp')}
            </AppText>
            <AppButton
              variant="secondary"
              label={t('finance.returnChooseInvoice')}
              onPress={() => setRequestInvoiceOpen(true)}
            />
          </Card>
        ) : null}
        {error ? (
          <AppText accessibilityRole="alert" color="dangerText">
            {t(errorKey(error))}
          </AppText>
        ) : null}
        {form === 'return' && returnHint ? (
          <AppText accessibilityRole="alert" color="warningText">
            {t(returnHint)}
          </AppText>
        ) : null}
        <AppButton
          label={t(form === 'connect' ? 'finance.login' : 'finance.save')}
          loading={busy}
          disabled={form === 'return' && !!returnHint}
          onPress={() => void submit()}
        />
      </Screen>
    </Modal>
  );
}
