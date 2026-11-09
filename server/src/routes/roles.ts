import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { HttpError } from '../lib/errors.js';
import { ADMIN_ROLES, permissionKeys } from '../features/auth/permissions.js';
import { requireAuth, requirePermission, type AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const updateSchema = z.object({ permissions: z.array(z.enum(permissionKeys)) });

// One call gives the role matrix screen everything it needs:
// the rows (roles with their keys) and the columns (all known keys).
router.get('/', requirePermission('users:read'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const roles = await prisma.role.findMany({
      where: { companyId: req.user!.companyId },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { userRoles: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json({
      roles: roles.map((role) => ({
        id: role.id,
        name: role.name,
        description: role.description,
        locked: ADMIN_ROLES.includes(role.name),
        userCount: role._count.userRoles,
        permissions: role.permissions.map((entry) => entry.permission.key).sort(),
      })),
      permissions: permissionKeys,
    });
  } catch (error) {
    next(error);
  }
});

// Replaces the role's whole permission set with the one sent.
router.put('/:id/permissions', requirePermission('roles:write'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const actor = req.user!;
    const id = z.string().uuid().parse(req.params.id);
    const desired = new Set<string>(updateSchema.parse(req.body).permissions);

    const role = await prisma.$transaction(async (tx) => {
      const found = await tx.role.findFirst({
        where: { id, companyId: actor.companyId },
        include: { permissions: { include: { permission: true } } },
      });
      if (!found) throw new HttpError(404, 'Role not found');
      if (ADMIN_ROLES.includes(found.name)) {
        throw new HttpError(409, 'The manager and admin roles always have every permission and cannot be edited');
      }

      const current = new Set(found.permissions.map((entry) => entry.permission.key));
      const added = [...desired].filter((key) => !current.has(key));
      const removed = [...current].filter((key) => !desired.has(key));

      // You can only grant what you hold yourself.
      const notHeld = added.filter((key) => !actor.permissions.has(key));
      if (notHeld.length > 0) throw new HttpError(403, `You cannot grant permissions you do not have: ${notHeld.join(', ')}`);

      if (removed.length > 0) {
        await tx.rolePermission.deleteMany({ where: { roleId: found.id, permission: { key: { in: removed } } } });
      }
      for (const key of added) {
        const permission = await tx.permission.upsert({
          where: { companyId_key: { companyId: actor.companyId, key } },
          create: { companyId: actor.companyId, key },
          update: {},
        });
        await tx.rolePermission.create({ data: { roleId: found.id, permissionId: permission.id } });
      }

      if (added.length > 0 || removed.length > 0) {
        await tx.auditLog.create({
          data: {
            companyId: actor.companyId,
            userId: actor.id,
            entityType: 'role',
            entityId: found.id,
            action: 'role.permissions.update',
            payload: { role: found.name, added, removed },
          },
        });
      }

      return { id: found.id, name: found.name, locked: false, permissions: [...desired].sort() };
    });

    res.json({ role });
  } catch (error) {
    next(error);
  }
});

export default router;