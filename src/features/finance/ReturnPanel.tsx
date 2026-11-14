import { useEffect, useRef, useState } from 'react';
import {
  Image,
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
import * as Crypto from 'expo-crypto';
import { Check, ClipboardCheck, Clock3, PackageCheck, ShieldCheck, X } from 'lucide-react-native';
import { AppButton, AppText, Card, SearchField, StatusBadge } from '@/components/ui';
import { useLocale } from '@/hooks/useLocale';
import { useTheme } from '@/theme/ThemeProvider';
import { ar, type TranslationKey } from '@/i18n';
import { typeFace } from '@/theme/typography';
import { applyOperation, returnStatus, type CreditReturn, type FinanceState, type Operation } from './domain';
import { financeRepository } from './repository';
import { money, reference } from './documents';

type Status = 'pending' | 'accepted' | 'rejected';
interface Props {
  state: FinanceState;
  actorId: string;
  canCreate: boolean;
  canReview: boolean;
  onRequest: () => void;
  notice: (id?: string) => string;
}
const errorText = (code: string): TranslationKey =>
  (`finance.error.${code}` in ar ? `finance.error.${code}` : 'finance.error.server') as TranslationKey;
export function ReturnPanel({ state, actorId, canCreate, canReview, onRequest, notice }: Props) {
  const { t, row, dateLocale } = useLocale();
  const { colors } = useTheme();
  const [status, setStatus] = useState<Status>(canCreate ? 'accepted' : 'pending');
  const previousReturns = useRef(state.returns.length);
  useEffect(() => {
    if (canCreate && state.returns.length > previousReturns.current) {
      setStatus(returnStatus(state.returns[state.returns.length - 1]));
      setPage(1);
    }
    previousReturns.current = state.returns.length;
  }, [state.returns, canCreate]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<string>();
  const [message, setMessage] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [showPhoto, setShowPhoto] = useState<string>();
  const customer = (id: string) => state.customers.find((c) => c.id === id)?.name ?? id;
  const requests = state.returns
    .filter(
      (r) =>
        returnStatus(r) === status &&
        `${customer(r.customerId)} ${r.id} ${reference(r.id)} ${reference(r.invoiceId)} ${r.reason}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    )
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));
  const pages = Math.max(1, Math.ceil(requests.length / 5));
  const current = Math.min(page, pages);
  const review = state.returns.find((r) => r.id === target);
  const date = (value: string) =>
    new Date(value).toLocaleString(dateLocale, {
      timeZone: 'Asia/Hebron',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 6 }}>
        <AppText variant="h3">{t('finance.returns')}</AppText>
        <AppText variant="bodySm" color="textSecondary">
          {t('finance.returnReview.subtitle')}
        </AppText>
      </View>
      <Card tone="brand" style={{ gap: 9, padding: 15 }}>
        <View style={{ flexDirection: row, gap: 8, alignItems: 'center' }}>
          <ShieldCheck size={20} color={colors.brand} />
          <AppText variant="bodySm" weight="semibold" style={{ flex: 1 }}>
            {t('finance.returns.summary')}
          </AppText>
        </View>
        <AppButton
          label={t(showDetails ? 'finance.returns.hideDetails' : 'finance.returns.details')}
          variant="ghost"
          size="sm"
          onPress={() => setShowDetails(!showDetails)}
        />
        {showDetails ? (
          <View style={{ gap: 8 }}>
            <AppText variant="caption" color="textSecondary">
              {t('finance.returnReview.noCredit')}
            </AppText>
            <AppText variant="caption" color="textSecondary">
              {t('finance.returnReview.reserved')}
            </AppText>
          </View>
        ) : null}
      </Card>
      {canCreate ? (
        <AppButton label={t('finance.newReturn')} disabled={!state.invoices.length} onPress={onRequest} />
      ) : (
        <AppText variant="bodySm" color="textSecondary">
          {t('finance.returnReview.onlyReview')}
        </AppText>
      )}
      {!state.invoices.length ? (
        <AppText color="warningText" variant="bodySm">
          {t('finance.returns.noInvoices')}
        </AppText>
      ) : null}
      {!canReview && showDetails ? (
        <AppText variant="caption" color="textSecondary">
          {t('finance.returnReview.reviewAccess')}
        </AppText>
      ) : null}
      <View style={{ flexDirection: row, gap: 7 }}>
        {(['pending', 'accepted', 'rejected'] as Status[]).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityLabel={t(`finance.returnReview.status.${value}`)}
            aria-selected={status === value}
            onPress={() => {
              setStatus(value);
              setPage(1);
            }}
            style={{
              flex: 1,
              paddingVertical: 12,
              paddingHorizontal: 6,
              borderWidth: 1,
              borderColor: status === value ? colors.brand : colors.border,
              borderRadius: 13,
              backgroundColor: status === value ? colors.brand : colors.surface,
              gap: 4,
            }}
          >
            <AppText
              variant="bodySm"
              align="center"
              weight="medium"
              style={{ color: status === value ? colors.onBrand : colors.text }}
            >
              {t(`finance.returnReview.status.${value}`)}
            </AppText>
            <AppText
              variant="caption"
              align="center"
              numeric
              style={{ color: status === value ? colors.onBrand : colors.textTertiary }}
            >
              {state.returns.filter((r) => returnStatus(r) === value).length}
            </AppText>
          </Pressable>
        ))}
      </View>
      <SearchField
        value={query}
        onChangeText={(value) => {
          setQuery(value);
          setPage(1);
        }}
        placeholder={t('finance.returnReview.search')}
      />
      {message ? <StatusBadge label={message} tone="success" /> : null}
      <AppText variant="caption" color="textTertiary">
        {t('finance.returnReview.count', { n: requests.length })}
      </AppText>
      {requests.slice((current - 1) * 5, current * 5).map((r) => {
        const invoice = state.invoices.find((i) => i.id === r.invoiceId);
        return (
          <Card key={r.id} tone="plain" style={{ padding: 16, gap: 12 }}>
            <View
              style={{ flexDirection: row, alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <AppText variant="title" weight="semibold">
                  {customer(r.customerId)}
                </AppText>
                <AppText variant="caption" color="textTertiary">
                  {t('finance.returnReview.request')} {reference(r.id)}
                </AppText>
              </View>
              <StatusBadge
                tone={status === 'pending' ? 'warning' : status === 'accepted' ? 'success' : 'danger'}
                label={t(`finance.returnReview.status.${status}`)}
              />
            </View>
            <View style={{ flexDirection: row, justifyContent: 'space-between', alignItems: 'center' }}>
              <AppText variant="caption" color="textSecondary">
                {t(status === 'accepted' ? 'finance.returns.credited' : 'finance.returnReview.value')}
              </AppText>
              <AppText variant="h3" numeric>
                {money(r.amount)}
              </AppText>
            </View>
            <AppText variant="caption" color="textSecondary">
              {t('finance.returnReview.invoice')}: {reference(r.invoiceId)} · {date(r.date)}
            </AppText>
            {r.items.map((item) => {
              const original = invoice?.items.find((i) => i.productId === item.productId);
              return (
                <View
                  key={item.productId}
                  style={{ backgroundColor: colors.surfaceAlt, padding: 11, borderRadius: 12, gap: 4 }}
                >
                  <AppText variant="bodySm" weight="medium">
                    {original?.name ?? item.productId} × {item.quantity}
                  </AppText>
                  <AppText variant="caption" color="textSecondary">
                    {t('finance.returnReview.unit')}: {original?.unit ?? t('finance.returns.unitUnknown')}
                    {original?.sku ? ` · ${original.sku}` : ''}
                  </AppText>
                </View>
              );
            })}
            <AppText variant="bodySm">{r.reason}</AppText>
            <AppButton
              size="sm"
              variant="ghost"
              label={t('finance.photoView')}
              onPress={() => setShowPhoto(showPhoto === r.id ? undefined : r.id)}
            />
            {showPhoto === r.id ? (
              <Image
                source={{ uri: r.photo }}
                accessibilityLabel={t('finance.returnReview.image')}
                style={{ height: 180, borderRadius: 12 }}
                resizeMode="contain"
              />
            ) : null}
            {status === 'pending' ? (
              <AppText variant="bodySm" color="warningText">
                {t('finance.returnCheck.pending')}
              </AppText>
            ) : null}
            {r.salesCheck ? (
              <Card tone="brand" style={{ gap: 8, padding: 12 }}>
                <StatusBadge
                  tone="success"
                  label={t(
                    r.salesCheck.source === 'unit_codes'
                      ? 'finance.unitCodes.badge'
                      : 'finance.saleCheck.matched',
                  )}
                />
                <AppText variant="caption" color="textSecondary">
                  {t(
                    r.salesCheck.source === 'unit_codes'
                      ? 'finance.unitCodes.matched'
                      : 'finance.saleCheck.limit',
                  )}
                </AppText>
                <AppText variant="caption" color="textTertiary">
                  {t(
                    r.salesCheck.source === 'unit_codes'
                      ? 'finance.unitCodes.system'
                      : 'finance.saleCheck.system',
                  )}{' '}
                  · {date(r.salesCheck.checkedAt)}
                </AppText>
              </Card>
            ) : null}
            {r.status === undefined ? (
              <AppText variant="caption" color="textSecondary">
                {t('finance.returnReview.legacy')}
              </AppText>
            ) : null}
            {r.reviewNote ? (
              <View style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: 10, gap: 5 }}>
                <AppText variant="bodySm">{r.reviewNote}</AppText>
                <AppText variant="caption" color="textTertiary">
                  {t('finance.returnReview.reviewer')}: {r.reviewedBy} ·{' '}
                  {r.reviewedAt ? date(r.reviewedAt) : ''}
                </AppText>
              </View>
            ) : null}
            {status === 'pending' && canReview ? (
              r.requestedBy === actorId ? (
                <AppText variant="caption" color="warningText">
                  {t('finance.returnReview.self')}
                </AppText>
              ) : (
                <AppButton
                  label={t('finance.returnReview.inspect')}
                  icon={<ClipboardCheck size={18} color={colors.onBrand} />}
                  onPress={() => {
                    setMessage('');
                    setTarget(r.id);
                  }}
                />
              )
            ) : null}
            <AppText variant="caption" color="textTertiary">
              {notice(r.reviewOperationId ?? r.id)}
            </AppText>
          </Card>
        );
      })}
      {!requests.length ? (
        <Card tone="plain" style={{ alignItems: 'center', gap: 10, paddingVertical: 28 }}>
          <PackageCheck size={30} color={colors.textTertiary} />
          <AppText color="textSecondary" variant="bodySm">
            {t('finance.returnReview.empty')}
          </AppText>
        </Card>
      ) : null}
      {requests.length > 5 ? (
        <View style={{ flexDirection: row, justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <AppButton
            fullWidth={false}
            variant="secondary"
            size="sm"
            label={t('finance.billing.previous')}
            disabled={current === 1}
            onPress={() => setPage(current - 1)}
          />
          <AppText variant="caption" numeric>
            {current} / {pages}
          </AppText>
          <AppButton
            fullWidth={false}
            variant="secondary"
            size="sm"
            label={t('finance.billing.next')}
            disabled={current === pages}
            onPress={() => setPage(current + 1)}
          />
        </View>
      ) : null}
      {review ? (
        <ReturnInspection
          key={review.id}
          state={state}
          request={review}
          actorId={actorId}
          close={() => setTarget(undefined)}
          saved={(decision) => {
            setTarget(undefined);
            setStatus(decision);
            setPage(1);
            setMessage(t('finance.returnReview.saved'));
          }}
        />
      ) : null}
    </View>
  );
}

function ReturnInspection({
  state,
  request,
  actorId,
  close,
  saved,
}: {
  state: FinanceState;
  request: CreditReturn;
  actorId: string;
  close: () => void;
  saved: (status: 'accepted' | 'rejected') => void;
}) {
  const { t, row, textAlign } = useLocale();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [note, setNote] = useState('');
  const [received, setReceived] = useState<Record<string, string>>({});
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [checks, setChecks] = useState({
    identityMatched: false,
    quantityMatched: false,
    conditionChecked: false,
  });
  const [decision, setDecision] = useState<Extract<Operation, { kind: 'returnReview' }>>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const invoice = state.invoices.find((i) => i.id === request.invoiceId);
  const customer = state.customers.find((c) => c.id === request.customerId);
  const allChecked = Object.values(checks).every(Boolean);
  const complete = request.items.every((item) => {
    const original = invoice?.items.find((i) => i.productId === item.productId);
    return (
      /^\d+$/.test(received[item.productId] ?? '') &&
      Number(received[item.productId]) === item.quantity &&
      (!original?.sku || codes[item.productId]?.trim() === original.sku)
    );
  });
  const editable = returnStatus(request) === 'pending' && request.requestedBy !== actorId;
  function choose(value: 'accepted' | 'rejected') {
    setError('');
    const op: Extract<Operation, { kind: 'returnReview' }> = {
      id: Crypto.randomUUID(),
      actorId,
      date: new Date().toISOString(),
      kind: 'returnReview',
      returnId: request.id,
      decision: value,
      note: note.trim(),
      inspection:
        value === 'accepted'
          ? {
              ...checks,
              received: request.items.map((item) => ({
                productId: item.productId,
                quantity: Number(received[item.productId]),
                observedCode: codes[item.productId]?.trim() || undefined,
              })),
            }
          : undefined,
    };
    try {
      applyOperation(state, op);
      setDecision(op);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'invalid');
    }
  }
  async function commit() {
    if (!decision || busy) return;
    setBusy(true);
    setError('');
    try {
      await financeRepository.submit(decision);
      saved(decision.decision);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'server');
    } finally {
      setBusy(false);
    }
  }
  const field = (label: string, value: string, onChange: (value: string) => void, numeric = false) => (
    <View style={{ gap: 6 }}>
      <AppText variant="bodySm" weight="medium">
        {label}
      </AppText>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? 'number-pad' : 'default'}
        style={{
          borderWidth: 1,
          borderColor: colors.borderStrong,
          borderRadius: 11,
          padding: 12,
          minHeight: 48,
          fontSize: 16,
          color: colors.text,
          backgroundColor: colors.surface,
          textAlign,
          fontFamily: typeFace('regular'),
        }}
      />
    </View>
  );
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={busy ? () => {} : decision ? () => setDecision(undefined) : close}
      statusBarTranslucent
    >
      <View
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          padding: width < 640 ? 0 : 24,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{
            width: '100%',
            maxWidth: 620,
            height: width < 640 ? '100%' : '94%',
            maxHeight: 1000,
            backgroundColor: colors.background,
            borderRadius: width < 640 ? 0 : 24,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: Math.max(18, insets.top),
              paddingBottom: 16,
              backgroundColor: colors.surface,
              borderBottomWidth: 1,
              borderColor: colors.border,
              flexDirection: row,
              gap: 10,
              alignItems: 'center',
            }}
          >
            <ClipboardCheck size={25} color={colors.brand} />
            <View style={{ flex: 1, gap: 3 }}>
              <AppText variant="h3">{t('finance.returnReview.heading')}</AppText>
              <AppText variant="caption" color="textSecondary">
                {customer?.name} · {reference(request.id)}
              </AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('finance.close')}
              disabled={busy}
              onPress={close}
              style={{ padding: 10 }}
            >
              <X size={21} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 20, gap: 16 }}
            style={{ flex: 1 }}
          >
            {decision ? (
              <>
                <Card tone="brand" style={{ gap: 12 }}>
                  <AppText variant="h2">
                    {t(
                      decision.decision === 'accepted'
                        ? 'finance.returnReview.confirmAccept'
                        : 'finance.returnReview.confirmReject',
                    )}
                  </AppText>
                  <AppText variant="h1" numeric>
                    {money(request.amount)}
                  </AppText>
                  <AppText variant="bodySm">
                    {t(
                      decision.decision === 'accepted'
                        ? 'finance.returnReview.acceptEffect'
                        : 'finance.returnReview.rejectEffect',
                      { amount: money(request.amount) },
                    )}
                  </AppText>
                  <AppText>{decision.note}</AppText>
                </Card>
              </>
            ) : (
              <>
                <Card tone="brand">
                  <AppText variant="bodySm" color="textSecondary">
                    {t('finance.returnReview.physical')}
                  </AppText>
                </Card>
                <Card tone="plain" style={{ gap: 8 }}>
                  <AppText variant="caption" color="textSecondary">
                    {t('finance.returnReview.invoice')}: {reference(request.invoiceId)}
                  </AppText>
                  <AppText>{request.reason}</AppText>
                  <Image
                    source={{ uri: request.photo }}
                    accessibilityLabel={t('finance.returnReview.image')}
                    style={{ height: 190, borderRadius: 12 }}
                    resizeMode="contain"
                  />
                </Card>
                {request.items.map((item) => {
                  const original = invoice?.items.find((i) => i.productId === item.productId);
                  const qty = received[item.productId] ?? '';
                  const code = codes[item.productId] ?? '';
                  return (
                    <Card key={item.productId} tone="plain" style={{ gap: 12 }}>
                      <AppText variant="title" weight="semibold">
                        {original?.name ?? item.productId}
                      </AppText>
                      <AppText variant="bodySm" color="textSecondary">
                        {t('finance.returnReview.sold', { n: original?.quantity ?? 0 })} ·{' '}
                        {t('finance.returnReview.requested', { n: item.quantity })}
                      </AppText>
                      <AppText variant="bodySm">
                        {t('finance.returnReview.unit')}:{' '}
                        {original?.unit ?? t('finance.returnReview.unitUnknown')}
                      </AppText>
                      {original?.sku ? (
                        <>
                          <AppText variant="bodySm" numeric>
                            {t('finance.returnReview.expectedCode')}: {original.sku}
                          </AppText>
                          {field(t('finance.returnReview.observedCode'), code, (v) =>
                            setCodes({ ...codes, [item.productId]: v }),
                          )}
                          {code && code.trim() !== original.sku ? (
                            <AppText variant="caption" color="dangerText">
                              {t('finance.error.inspectionCode')}
                            </AppText>
                          ) : null}
                        </>
                      ) : (
                        <AppText variant="caption" color="warningText">
                          {t('finance.returnReview.noCode')}
                        </AppText>
                      )}
                      {field(
                        t('finance.returnReview.received'),
                        qty,
                        (v) => setReceived({ ...received, [item.productId]: v }),
                        true,
                      )}
                      {qty && Number(qty) !== item.quantity ? (
                        <AppText variant="caption" color="dangerText">
                          {t('finance.error.inspectionQuantity')}
                        </AppText>
                      ) : null}
                    </Card>
                  );
                })}
                <View style={{ gap: 10 }}>
                  {(
                    [
                      { key: 'identityMatched', label: 'finance.returnReview.identity' },
                      { key: 'quantityMatched', label: 'finance.returnReview.quantity' },
                      { key: 'conditionChecked', label: 'finance.returnReview.condition' },
                    ] as const
                  ).map((check) => (
                    <Pressable
                      key={check.key}
                      accessibilityRole="checkbox"
                      accessibilityLabel={t(check.label)}
                      aria-checked={checks[check.key]}
                      accessibilityState={{ checked: checks[check.key] }}
                      onPress={() => setChecks({ ...checks, [check.key]: !checks[check.key] })}
                      style={{
                        flexDirection: row,
                        gap: 10,
                        alignItems: 'center',
                        padding: 13,
                        borderWidth: 1,
                        borderColor: checks[check.key] ? colors.brand : colors.border,
                        backgroundColor: colors.surface,
                        borderRadius: 12,
                      }}
                    >
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          backgroundColor: checks[check.key] ? colors.brand : colors.surface,
                          borderWidth: 1,
                          borderColor: checks[check.key] ? colors.brand : colors.borderStrong,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {checks[check.key] ? <Check size={16} color={colors.onBrand} /> : null}
                      </View>
                      <AppText variant="bodySm" style={{ flex: 1 }}>
                        {t(check.label)}
                      </AppText>
                    </Pressable>
                  ))}
                </View>
                <View style={{ gap: 7 }}>
                  <AppText weight="medium">{t('finance.returnReview.note')}</AppText>
                  <TextInput
                    accessibilityLabel={t('finance.returnReview.note')}
                    value={note}
                    onChangeText={setNote}
                    maxLength={500}
                    multiline
                    style={{
                      minHeight: 90,
                      borderWidth: 1,
                      borderColor: colors.borderStrong,
                      borderRadius: 12,
                      padding: 12,
                      fontSize: 16,
                      fontFamily: typeFace('regular'),
                      textAlign,
                      textAlignVertical: 'top',
                      color: colors.text,
                      backgroundColor: colors.surface,
                    }}
                  />
                </View>
              </>
            )}
          </ScrollView>
          <View
            style={{
              padding: 18,
              paddingBottom: Math.max(18, insets.bottom),
              backgroundColor: colors.surface,
              borderTopWidth: 1,
              borderColor: colors.border,
              gap: 9,
            }}
          >
            {error ? (
              <AppText accessibilityRole="alert" color="dangerText" variant="bodySm">
                {t(errorText(error))}
              </AppText>
            ) : null}
            {!editable ? (
              <AppText color="warningText">
                {t(
                  request.requestedBy === actorId ? 'finance.returnReview.self' : 'finance.error.returnState',
                )}
              </AppText>
            ) : null}
            {decision ? (
              <>
                <AppButton
                  label={t(
                    decision.decision === 'accepted'
                      ? 'finance.returnReview.confirmAccept'
                      : 'finance.returnReview.confirmReject',
                  )}
                  loading={busy}
                  disabled={!editable}
                  variant={decision.decision === 'accepted' ? 'primary' : 'danger'}
                  onPress={() => void commit()}
                />
                <AppButton
                  label={t('finance.back')}
                  variant="ghost"
                  disabled={busy}
                  onPress={() => setDecision(undefined)}
                />
              </>
            ) : (
              <>
                <AppButton
                  label={t('finance.returnReview.accept')}
                  disabled={!editable || !allChecked || !complete || note.trim().length < 3}
                  onPress={() => choose('accepted')}
                />
                <AppButton
                  label={t('finance.returnReview.reject')}
                  variant="danger"
                  disabled={!editable || note.trim().length < 3}
                  onPress={() => choose('rejected')}
                />
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
