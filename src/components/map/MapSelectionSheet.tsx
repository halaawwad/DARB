import { useRef, type ReactNode } from 'react';
import { View } from 'react-native';
import { Mic, UserRound } from 'lucide-react-native';

import { AppButton, AppText, BottomSheet, DetailRow, Divider, StatusBadge } from '@/components/ui';
import { useLocale } from '@/hooks/useLocale';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/spacing';
import type { Checkpoint, Customer, RoadReport } from '@/types';
import { formatDate, formatMoney, formatRelative } from '@/utils/format';
import { checkpointStatusTone, customerStatusTone } from '@/utils/status';

export type MapSelection =
  | { kind: 'customer'; item: Customer }
  | { kind: 'checkpoint'; item: Checkpoint }
  | { kind: 'roadReport'; item: RoadReport };

interface MapSelectionSheetProps {
  selection?: MapSelection;
  onClose: () => void;
  onOpenProfile: (customerId: string) => void;
  /** Omitted for roles that do not take orders. */
  onVoiceOrder?: (customerId: string) => void;
}

/** Details for whatever was tapped on the map. */
export function MapSelectionSheet({ selection, onClose, onOpenProfile, onVoiceOrder }: MapSelectionSheetProps) {
  const { t, dateLocale } = useLocale();
  const { colors } = useTheme();
  // Keep showing the last selection while the sheet animates closed.
  const last = useRef(selection);
  if (selection) last.current = selection;
  const shown = selection ?? last.current;

  let title: string | undefined;
  let subtitle: string | undefined;
  let body: ReactNode = null;

  if (shown?.kind === 'checkpoint') {
    const checkpoint = shown.item;
    title = checkpoint.name;
    subtitle = t('checkpoint.title');
    body = (
      <View style={{ gap: spacing.md }}>
        <StatusBadge label={t(`checkpoint.status.${checkpoint.status}`)} tone={checkpointStatusTone[checkpoint.status]} />
        <AppText variant="bodySm" color="textSecondary">
          {t('checkpoint.updated', { time: formatRelative(checkpoint.updatedAt, t) })}
        </AppText>
      </View>
    );
  } else if (shown?.kind === 'roadReport') {
    const report = shown.item;
    title = t(`roadReport.type.${report.type}`);
    subtitle = t('roadReport.title');
    body = (
      <View style={{ gap: spacing.sm }}>
        <AppText variant="body">{report.note}</AppText>
        <AppText variant="bodySm" color="textSecondary">
          {formatRelative(report.createdAt, t)}
        </AppText>
      </View>
    );
  } else if (shown?.kind === 'customer') {
    const customer = shown.item;
    title = customer.name;
    subtitle = customer.shopName;
    body = (
      <View style={{ gap: spacing.sm }}>
        <StatusBadge label={t(`customer.status.${customer.status}`)} tone={customerStatusTone[customer.status]} />
        <Divider style={{ marginVertical: spacing.xs }} />
        <DetailRow label={t('customer.phone')} value={customer.phone} />
        <DetailRow label={t('customer.area')} value={customer.area} />
        <DetailRow label={t('customer.balance')}>
          <AppText variant="title" numeric style={{ color: customer.balance > 0 ? colors.dangerText : colors.text }}>
            {formatMoney(customer.balance)}
          </AppText>
        </DetailRow>
        <DetailRow label={t('customer.lastVisit')} value={formatDate(customer.lastVisit, dateLocale)} />

        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          <AppButton
            label={t('customer.fullProfile')}
            icon={<UserRound size={18} color={colors.onBrand} strokeWidth={2.3} />}
            onPress={() => onOpenProfile(customer.id)}
          />
          {onVoiceOrder ? (
            <AppButton
              label={t('customer.voiceOrder')}
              variant="secondary"
              icon={<Mic size={18} color={colors.text} strokeWidth={2.3} />}
              onPress={() => onVoiceOrder(customer.id)}
            />
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <BottomSheet visible={Boolean(selection)} onClose={onClose} title={title} subtitle={subtitle}>
      {body}
    </BottomSheet>
  );
}
