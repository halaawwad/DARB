import type { Role } from '@/types';

export const PERMISSION_KEYS = [
  'company:read',
  'customers:read', 'customers:write', 'customers:delete', 'customers:balance',
  'products:read', 'products:write', 'products:delete',
  'orders:read', 'orders:create',
  'checkpoints:read', 'incidents:create',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

/** Backend role name -> mobile role. Roles without mobile screens map to undefined. */
export const ROLE_FROM_BACKEND: Record<string, Role | undefined> = {
  manager: 'manager',
  admin: 'manager',
  sales_rep: 'sales_rep',
  delivery_rep: 'delivery_rep',
  accountant: 'accountant',
  // warehouse_staff, employee: no mobile UI yet
};

/** Demo mode only (no server). Copy of `rolePermissions` in permissions.ts. */
export const DEMO_GRANTS: Record<Role, readonly PermissionKey[]> = {
  manager: PERMISSION_KEYS,
  sales_rep: ['company:read', 'customers:read', 'customers:write', 'products:read', 'orders:read', 'orders:create', 'checkpoints:read', 'incidents:create'],
  delivery_rep: ['company:read', 'customers:read', 'products:read', 'orders:read', 'checkpoints:read', 'incidents:create'],
  accountant: ['company:read', 'customers:read', 'products:read', 'orders:read'],
};