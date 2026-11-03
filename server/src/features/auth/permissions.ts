import type { PrismaClient } from '@prisma/client';

export const permissionKeys = [
  'company:read', 'customers:read', 'customers:write', 'customers:delete',
  'customers:balance', 'products:read', 'products:write', 'products:delete',
  'orders:read', 'orders:create', 'checkpoints:read', 'incidents:create',
] as const;
export type PermissionKey = typeof permissionKeys[number];

// Provisioning is explicit. Role names are never authorization shortcuts.
export const rolePermissions: Record<string, readonly PermissionKey[]> = {
  manager: permissionKeys,
  admin: permissionKeys,
  sales_rep: ['company:read', 'customers:read', 'customers:write', 'products:read', 'orders:read', 'orders:create', 'checkpoints:read', 'incidents:create'],
  delivery_rep: ['company:read', 'customers:read', 'products:read', 'orders:read', 'checkpoints:read', 'incidents:create'],
  accountant: ['company:read', 'customers:read', 'products:read', 'orders:read'],
  warehouse_staff: ['company:read', 'products:read', 'orders:read'],
};

export async function provisionCompanyPermissions(db: PrismaClient, companyId: string) {
  // Add only the reviewed baseline; preserve existing custom grants.
  await db.company.findUniqueOrThrow({ where: { id: companyId } });
  await db.$transaction(async (tx) => {
    for (const key of permissionKeys) {
      await tx.permission.upsert({ where: { companyId_key: { companyId, key } }, create: { companyId, key }, update: {} });
    }
    for (const [name, keys] of Object.entries(rolePermissions)) {
      const role = await tx.role.upsert({ where: { companyId_name: { companyId, name } }, create: { companyId, name }, update: {} });
      for (const key of keys) {
        const permission = await tx.permission.findUniqueOrThrow({ where: { companyId_key: { companyId, key } } });
        await tx.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
          create: { roleId: role.id, permissionId: permission.id }, update: {},
        });
      }
    }
  });
}
