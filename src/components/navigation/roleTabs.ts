import type { TranslationKey } from '@/i18n';
import type { Role } from '@/types';

export type TabName = 'finance' | 'map' | 'customers' | 'orders' | 'profile';

/** Which tabs each role sees, in order. The first one is the role's home. */
export const ROLE_TABS: Record<Role, TabName[]> = {
  sales_rep: ['map', 'customers', 'orders', 'finance', 'profile'],
  delivery_rep: ['map', 'orders', 'finance', 'profile'],
  manager: ['map', 'customers', 'orders', 'finance', 'profile'],
  warehouse_staff: ['finance', 'orders', 'profile'],
  accountant: ['finance', 'customers', 'orders', 'profile'],
};

export const homeRoute = (role: Role) => `/(tabs)/${ROLE_TABS[role][0]}` as const;

/** Delivery reps see the orders tab as today's deliveries. */
export function tabLabel(tab: TabName, role?: Role): TranslationKey {
  if (tab === 'orders' && role === 'delivery_rep') return 'tabs.deliveries';
  return `tabs.${tab}`;
}

/** Roles that take orders, and so get the voice order button. */
export const canTakeOrders = (role?: Role) => role === 'sales_rep' || role === 'manager';
