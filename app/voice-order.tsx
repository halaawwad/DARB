import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Check, FlaskConical, Mic, Square } from 'lucide-react-native';

import { AppButton, AppHeader, AppText, Card, DetailRow, Divider, PressableScale, Screen } from '@/components/ui';
import { useCreateOrder, useCurrentUser, useCustomers, useProducts } from '@/hooks/queries';
import { useLocale } from '@/hooks/useLocale';
import { useTheme } from '@/theme/ThemeProvider';
import { duration } from '@/theme/motion';
import { radius } from '@/theme/radius';
import { brandGlow } from '@/theme/shadows';
import { spacing } from '@/theme/spacing';
import { haptics } from '@/utils/haptics';
import { formatMoney } from '@/utils/format';
import { isSpeechAvailable, startListening, type ListenFailure } from '@/utils/speech';
import { parseVoiceOrder } from '@/utils/voiceOrder';

const MIC_SIZE = 120;

/** Pulsing rings behind the mic while it listens. */
function ListeningRings({ active }: { active: boolean }) {
  const { colors } = useTheme();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (active) pulse.value = withRepeat(withTiming(1, { duration: duration.pulse }), -1, false);
    else {
      cancelAnimation(pulse);
      pulse.value = withTiming(0, { duration: duration.fast });
    }
  }, [active, pulse]);

  const ring = useAnimatedStyle(() => ({
    opacity: active ? 0.45 * (1 - pulse.value) : 0,
    transform: [{ scale: 1 + pulse.value * 0.6 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', width: MIC_SIZE, height: MIC_SIZE, borderRadius: radius.pill, backgroundColor: colors.brand },
        ring,
      ]}
    />
  );
}

/**
 * Dictate an order: listen in Arabic (or fill a demo sentence), show the
 * transcript and the parsed order, then add it to the mock orders on confirm.
 */
export default function VoiceOrderScreen() {
  const router = useRouter();
  const { customerId } = useLocalSearchParams<{ customerId?: string }>();
  const { colors } = useTheme();
  const { t, row, alignEnd } = useLocale();
  const { data: user } = useCurrentUser();
  const { data: products = [] } = useProducts();
  const { data: customers = [] } = useCustomers();
  const createOrder = useCreateOrder();

  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [failure, setFailure] = useState<ListenFailure>();
  const stopRef = useRef<() => void>(undefined);
  const available = useMemo(() => isSpeechAvailable(), []);

  useEffect(() => () => stopRef.current?.(), []);

  const parsed = useMemo(() => {
    if (!transcript) return undefined;
    const result = parseVoiceOrder(transcript, products, customers);
    // A customer opened from their profile or pin is the fallback when none is spoken.
    return { ...result, customer: result.customer ?? customers.find((c) => c.id === customerId) };
  }, [transcript, products, customers, customerId]);

  const total = parsed?.items.reduce((sum, item) => sum + item.quantity * item.product.price, 0) ?? 0;

  const toggleListening = async () => {
    if (listening) {
      stopRef.current?.();
      return;
    }
    haptics.medium();
    setFailure(undefined);
    setTranscript('');
    setListening(true);
    stopRef.current = await startListening({
      onTranscript: (text) => setTranscript(text),
      onError: (reason) => {
        setFailure(reason);
        setListening(false);
      },
      onEnd: () => setListening(false),
    });
  };

  const fillDemo = () => {
    stopRef.current?.();
    setListening(false);
    setFailure(undefined);
    setTranscript(t('voice.sample'));
  };

  const confirm = async () => {
    if (!parsed?.customer || !parsed.items.length || !user) return;
    await createOrder.mutateAsync({
      customerId: parsed.customer.id,
      repId: user.id,
      source: 'voice',
      items: parsed.items.map(({ product, quantity }) => ({ productId: product.id, quantity, unitPrice: product.price })),
    });
    haptics.success();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const failureText =
    failure === 'unavailable' ? t('voice.unavailable') : failure === 'permission' ? t('voice.permission') : failure ? t('voice.failed') : undefined;

  return (
    <Screen>
      <AppHeader title={t('voice.title')} leading="close" />

      <View style={{ alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xxl }}>
        <View style={{ width: MIC_SIZE * 1.7, height: MIC_SIZE * 1.7, alignItems: 'center', justifyContent: 'center' }}>
          <ListeningRings active={listening} />
          <PressableScale
            onPress={() => void toggleListening()}
            scaleTo={0.94}
            accessibilityRole="button"
            accessibilityLabel={listening ? t('voice.stop') : t('voice.start')}
            accessibilityState={{ busy: listening }}
            style={[
              {
                width: MIC_SIZE,
                height: MIC_SIZE,
                borderRadius: radius.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: listening ? colors.danger : colors.brand,
                borderWidth: 4,
                borderColor: colors.accent,
                opacity: available ? 1 : 0.6,
              },
              brandGlow,
            ]}
          >
            {listening ? (
              <Square size={36} color={colors.textOnColor} fill={colors.textOnColor} strokeWidth={2} />
            ) : (
              <Mic size={46} color={colors.onBrand} strokeWidth={2.2} />
            )}
          </PressableScale>
        </View>
        <AppText variant="bodySm" color="textSecondary" align="center">
          {listening ? t('voice.listening') : t('voice.hint')}
        </AppText>
        {failureText ? (
          <AppText variant="bodySm" color="dangerText" align="center">
            {failureText}
          </AppText>
        ) : null}
        <AppButton
          label={t('voice.demo')}
          variant="tonal"
          size="sm"
          fullWidth={false}
          icon={<FlaskConical size={16} color={colors.brand} strokeWidth={2.3} />}
          onPress={fillDemo}
          accessibilityHint={t('voice.demoHint')}
          style={{ alignSelf: 'center' }}
        />
      </View>

      {transcript ? (
        <Card style={{ marginBottom: spacing.lg, gap: spacing.xs }}>
          <AppText variant="caption" color="textTertiary">
            {t('voice.transcript')}
          </AppText>
          <AppText variant="bodyLg">«{transcript}»</AppText>
        </Card>
      ) : null}

      {parsed && !listening ? (
        <Card style={{ marginBottom: spacing.xl, gap: spacing.sm }}>
          <AppText variant="titleLg">{t('voice.parsed')}</AppText>
          <DetailRow label={t('voice.customer')} value={parsed.customer?.shopName ?? t('voice.noCustomer')} />
          <Divider style={{ marginVertical: spacing.xs }} />
          {parsed.items.length ? (
            parsed.items.map(({ product, quantity }) => (
              <View key={product.id} style={{ flexDirection: row, alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <AppText variant="title" weight="medium">
                    {product.name}
                  </AppText>
                  <AppText variant="caption" color="textTertiary" numeric>
                    {quantity} × {product.unit} · {formatMoney(product.price)}
                  </AppText>
                </View>
                <View style={{ alignItems: alignEnd }}>
                  <AppText variant="title" numeric>
                    {formatMoney(quantity * product.price)}
                  </AppText>
                </View>
              </View>
            ))
          ) : (
            <AppText variant="bodySm" color="dangerText">
              {t('voice.noItems')}
            </AppText>
          )}
          <Divider style={{ marginVertical: spacing.xs }} />
          <DetailRow label={t('voice.total')} emphasis value={formatMoney(total)} />
        </Card>
      ) : null}

      {parsed && !listening ? (
        <AppButton
          label={t('voice.confirm')}
          icon={<Check size={18} color={colors.onBrand} strokeWidth={2.5} />}
          disabled={!parsed.customer || !parsed.items.length || !user}
          loading={createOrder.isPending}
          onPress={() => void confirm()}
        />
      ) : null}
    </Screen>
  );
}
