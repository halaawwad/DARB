import { ar, type TranslationKey } from '@/i18n/ar';

type Translate = (key: TranslationKey) => string;

/** Uses the Arabic label when one exists, otherwise shows the raw name. */
function labelFor(t: Translate, prefix: string, name: string): string {
  const key = `${prefix}.${name}` as TranslationKey;
  return key in ar ? t(key) : name;
}

export const roleLabel = (t: Translate, name: string | null) => (name ? labelFor(t, 'role', name) : '—');
export const permissionLabel = (t: Translate, key: string) => labelFor(t, 'perm', key);
export const permissionGroupLabel = (t: Translate, group: string) => labelFor(t, 'permGroup', group);