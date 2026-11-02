import type { TranslationKey } from '@/i18n';

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** "1,250 ₪" — Latin digits, shekel after the amount, decimals only when needed. */
export function formatMoney(amount: number): string {
  const value = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${value} ₪`;
}

/** "12 نوفمبر" style short date in the app locale, Latin digits. */
export function formatDate(iso: string, dateLocale: string): string {
  return new Intl.DateTimeFormat(dateLocale, { day: 'numeric', month: 'short' }).format(new Date(iso));
}

export function formatDateTime(iso: string, dateLocale: string): string {
  return new Intl.DateTimeFormat(dateLocale, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** "قبل 5 دقيقة" / "قبل 3 يوم" — coarse relative time for freshness labels. */
export function formatRelative(iso: string, t: T): string {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (minutes < 1) return t('time.justNow');
  if (minutes < 60) return t('time.minutesAgo', { n: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t('time.hoursAgo', { n: hours });
  return t('time.daysAgo', { n: Math.round(hours / 24) });
}
