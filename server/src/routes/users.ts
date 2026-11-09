import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { hashPassword } from '../lib/hash.js';
import { HttpError } from '../lib/errors.js';
import { requireAuth, requirePermission, type AuthenticatedRequest, type AuthenticatedUser } from '../middleware/auth.js';
import { ADMIN_ROLES } from '../features/auth/permissions.js';

const router = Router();
router.use(requireAuth);


const userInclude = { userRoles: { include: { role: true } } } satisfies Prisma.UserInclude;
type UserRow = Prisma.UserGetPayload<{ include: typeof userInclude }>;
type Tx = Prisma.TransactionClient;

const createSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
  phone: z.string().trim().max(30).optional(),
  role: z.string().trim().min(1),
});

const updateSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  phone: z.string().trim().max(30).nullable(),
  password: z.string().min(8).max(72),
  role: z.string().trim().min(1),
  isActive: z.boolean(),
}).partial();

function toDto(user: UserRow) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`,
    email: user.email,
    phone: user.phone,
    isActive: user.isActive,
    role: user.userRoles[0]?.role.name ?? null,
    createdAt: user.createdAt,
  };
}

// An actor may only hand out roles whose permissions they already hold,
// so users:write can never be used to climb above your own access.
async function assertCanGrantRole(tx: Tx, actor: AuthenticatedUser, roleName: string) {
  const role = await tx.role.findUnique({
    where: { companyId_name: { companyId: actor.companyId, name: roleName } },
    include: { permissions: { include: { permission: true } } },
  });
  if (!role) throw new HttpError(400, `Unknown role: ${roleName}`);
  const missing = role.permissions.map((entry) => entry.permission.key).filter((key) => !actor.permissions.has(key));
  if (missing.length > 0) throw new HttpError(403, 'You cannot assign or change a role that has permissions you do not have');
  return role;
}

function audit(tx: Tx, actor: AuthenticatedUser, entityId: string, action: string, payload: Record<string, Prisma.InputJsonValue | null>) {
  return tx.auditLog.create({
    data: { companyId: actor.companyId, userId: actor.id, entityType: 'user', entityId, action, payload },
  });
}

async function updateUser(actor: AuthenticatedUser, id: string, input: z.infer<typeof updateSchema>) {
  const passwordHash = input.password ? await hashPassword(input.password) : undefined;

  return prisma.$transaction(async (tx) => {
    // Scoped by companyId, so a user from another company simply "does not exist".
    const target = await tx.user.findFirst({ where: { id, companyId: actor.companyId }, include: userInclude });
    if (!target) throw new HttpError(404, 'User not found');

    const currentRole = target.userRoles[0]?.role.name ?? null;
    const newRoleName = input.role !== undefined && input.role !== currentRole ? input.role : null;
    const deactivating = input.isActive === false && target.isActive;

    if (target.id === actor.id && (newRoleName !== null || input.isActive === false)) {
      throw new HttpError(409, 'You cannot change your own role or deactivate your own account');
    }

    if ((newRoleName !== null || deactivating) && currentRole) await assertCanGrantRole(tx, actor, currentRole);
    const newRole = newRoleName !== null ? await assertCanGrantRole(tx, actor, newRoleName) : null;

    const losesAdmin = currentRole !== null && ADMIN_ROLES.includes(currentRole) && target.isActive
      && (deactivating || (newRoleName !== null && !ADMIN_ROLES.includes(newRoleName)));
    if (losesAdmin) {
      const others = await tx.user.count({
        where: {
          companyId: actor.companyId,
          isActive: true,
          id: { not: target.id },
          userRoles: { some: { role: { name: { in: ADMIN_ROLES } } } },
        },
      });
      if (others === 0) throw new HttpError(409, 'A company must keep at least one active manager');
    }

    await tx.user.update({
      where: { id: target.id },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        isActive: input.isActive,
        passwordHash,
      },
    });

    if (newRole) {
      await tx.userRole.deleteMany({ where: { userId: target.id } });
      await tx.userRole.create({ data: { userId: target.id, roleId: newRole.id } });
    }

    const payload: Record<string, Prisma.InputJsonValue | null> = {};
    if (newRoleName !== null) payload.role = { from: currentRole, to: newRoleName };
    if (input.isActive !== undefined && input.isActive !== target.isActive) payload.isActive = input.isActive;
    if (passwordHash) payload.passwordReset = true;
    if (input.firstName !== undefined || input.lastName !== undefined || input.phone !== undefined) payload.profileEdited = true;
    await audit(tx, actor, target.id, 'user.update', payload);

    return tx.user.findUniqueOrThrow({ where: { id: target.id }, include: userInclude });
  });
}

router.get('/', requirePermission('users:read'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { companyId: req.user!.companyId },
      include: userInclude,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    res.json({ users: users.map(toDto) });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requirePermission('users:read'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: z.string().uuid().parse(req.params.id), companyId: req.user!.companyId },
      include: userInclude,
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: toDto(user) });
  } catch (error) {
    next(error);
  }
});

router.post('/', requirePermission('users:write'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const actor = req.user!;
    const input = createSchema.parse(req.body);

    // Login looks users up by email alone, so an email must be unique across all companies.
    const taken = await prisma.user.findFirst({ where: { email: input.email }, select: { id: true } });
    if (taken) throw new HttpError(409, 'This email is already registered');

    const passwordHash = await hashPassword(input.password);
    const user = await prisma.$transaction(async (tx) => {
      const role = await assertCanGrantRole(tx, actor, input.role);
      const created = await tx.user.create({
        data: {
          companyId: actor.companyId,
          email: input.email,
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone ?? null,
          userRoles: { create: { roleId: role.id } },
        },
        include: userInclude,
      });
      await audit(tx, actor, created.id, 'user.create', { role: role.name });
      return created;
    });

    res.status(201).json({ user: toDto(user) });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requirePermission('users:write'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const input = updateSchema.parse(req.body);
    const user = await updateUser(req.user!, id, input);
    res.json({ user: toDto(user) });
  } catch (error) {
    next(error);
  }
});

// Soft delete: same guardrails as PUT { isActive: false }.
router.delete('/:id', requirePermission('users:write'), async (req: AuthenticatedRequest, res, next) => {
  try {
    await updateUser(req.user!, z.string().uuid().parse(req.params.id), { isActive: false });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;