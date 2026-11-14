import { View } from 'react-native';
import { Check, FileCheck2, Info } from 'lucide-react-native';
import { AppText, Card } from '@/components/ui';
import { useLocale } from '@/hooks/useLocale';
import { useTheme } from '@/theme/ThemeProvider';
import { ar, type TranslationKey } from '@/i18n';
import { checkReturnUnits, type FinanceState } from './domain';
import { financeRepository } from './repository';
import { money } from './documents';
export function SaleCheckSummary({
  state,
  invoiceId,
  customerId,
  productId,
  quantity,
  unitCodes,
}: {
  state: FinanceState;
  invoiceId: string;
  customerId: string;
  productId: string;
  quantity: number;
  unitCodes: string[];
}) {
  const { t, row } = useLocale();
  const { colors } = useTheme();
  let result: ReturnType<typeof checkReturnUnits> | undefined;
  let error = '';
  if (Number.isSafeInteger(quantity) && quantity > 0) {
    try {
      result = checkReturnUnits(
        state,
        invoiceId,
        customerId,
        [{ productId, quantity, unitCodes }],
        new Date().toISOString(),
      );
    } catch (e) {
      error = e instanceof Error ? e.message : 'invalid';
    }
  }
  const key = `finance.error.${error}`;
  const errorKey = (key in ar ? key : 'finance.error.server') as TranslationKey;
  return (
    <Card tone="brand" style={{ gap: 12, padding: 16 }}>
      <View style={{ flexDirection: row, gap: 8, alignItems: 'center' }}>
        <FileCheck2 size={22} color={colors.brand} />
        <AppText variant="title" weight="semibold">
          {t('finance.saleCheck.title')}
        </AppText>
      </View>
      {result ? (
        <>
          {[
            'finance.saleCheck.invoice',
            'finance.saleCheck.customer',
            'finance.saleCheck.item',
            'finance.saleCheck.quantity',
          ].map((label) => (
            <View key={label} style={{ flexDirection: row, alignItems: 'center', gap: 8 }}>
              <Check size={17} color={colors.success} />
              <AppText variant="bodySm" color="successText" style={{ flex: 1 }}>
                {t(label as TranslationKey)}
              </AppText>
            </View>
          ))}
          <AppText variant="bodySm" weight="semibold">
            {t('finance.saleCheck.credit', {
              amount: money(result.items.reduce((n, i) => n + i.quantity * i.unitPrice, 0)),
            })}
          </AppText>
        </>
      ) : (
        <AppText variant="bodySm" color={error ? 'dangerText' : 'textSecondary'}>
          {error ? t(errorKey) : t('finance.saleCheck.enterQuantity')}
        </AppText>
      )}
      <View style={{ flexDirection: row, alignItems: 'flex-start', gap: 7 }}>
        <Info size={15} color={colors.textSecondary} />
        <AppText variant="caption" color="textSecondary" style={{ flex: 1 }}>
          {t('finance.unitCodes.help')}
        </AppText>
      </View>
      {financeRepository.getSnapshot().mode === 'server' ? (
        <AppText variant="caption" color="textTertiary">
          {t('finance.saleCheck.serverRecheck')}
        </AppText>
      ) : null}
    </Card>
  );
}
