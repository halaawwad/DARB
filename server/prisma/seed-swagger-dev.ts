import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { permissionKeys } from '../src/features/auth/permissions.js';

// Reserved fictional identities. Refuse collisions rather than adopting records.
const companyId = 'da4b0000-0000-4000-8000-000000000001';
const userId = 'da4b0000-0000-4000-8000-000000000002';
const companySlug = 'darb-swagger-dev';
const companyName = 'DARB Fictional Swagger Development';
const email = 'manager@darb-dev.example';

async function main() {
  if (process.env.NODE_ENV !== 'development' || process.env.DARB_SWAGGER_SEED !== '1') {
    throw new Error('This seed requires NODE_ENV=development and explicit DARB_SWAGGER_SEED=1');
  }
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (url.hostname !== 'postgres' || (url.port && url.port !== '5432') || url.pathname !== '/darb') {
    throw new Error('Refusing a database outside the DARB Docker postgres service');
  }
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk.toString();
    if (input.length > 4096) throw new Error('Seed input is too large');
  }
  let payload: { password?: unknown; rotatePassword?: unknown };
  try { payload = JSON.parse(input); } catch { throw new Error('Expected private password input on stdin'); }
  const password = payload.password;
  if (typeof password !== 'string' || password.length < 16 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('Use a development password with at least 16 characters and at most 72 UTF-8 bytes');
  }
  const db = new PrismaClient({ log: [] });
  try {
    const identity = await db.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
    if (identity[0]?.name !== 'darb') throw new Error('Refusing a database other than darb');
    const result = await db.$transaction(async (tx) => {
      const bySlug = await tx.company.findUnique({ where: { slug: companySlug } });
      const byId = await tx.company.findUnique({ where: { id: companyId } });
      if ((bySlug && bySlug.id !== companyId) || (byId && (byId.slug !== companySlug || byId.name !== companyName))) {
        throw new Error('Reserved fictional company identity is already in use; refusing to overwrite it');
      }
      const existing = await tx.user.findUnique({ where: { id: userId }, include: { userRoles: { include: { role: true } } } });
      const byEmail = await tx.user.findUnique({ where: { companyId_email: { companyId, email } } });
      if ((byEmail && byEmail.id !== userId) || (existing && (existing.companyId !== companyId || existing.email !== email))) {
        throw new Error('Reserved fictional user identity is already in use; refusing to overwrite it');
      }
      if (existing?.userRoles.some(({ role }) => role.companyId !== companyId || role.name !== 'manager')) {
        throw new Error('Development user has unexpected role memberships; refusing to change them');
      }
      const passwordMatches = existing ? await bcrypt.compare(password, existing.passwordHash) : false;
      if (existing && !passwordMatches && payload.rotatePassword !== true) {
        throw new Error('Development account already has a different password; use -SetPassword to explicitly rotate only this fictional account');
      }
      await tx.company.upsert({
        where: { id: companyId },
        create: { id: companyId, slug: companySlug, name: companyName, isActive: true },
        update: byId?.isActive ? {} : { isActive: true },
      });
      const role = await tx.role.upsert({ where: { companyId_name: { companyId, name: 'manager' } }, create: { companyId, name: 'manager' }, update: {} });
      const grants = await tx.rolePermission.findMany({ where: { roleId: role.id }, include: { permission: true } });
      if (grants.some(({ permission }) => permission.companyId !== companyId || !permissionKeys.includes(permission.key as typeof permissionKeys[number]))) {
        throw new Error('Development manager has unexpected grants; refusing to change them');
      }
      for (const key of permissionKeys) {
        const permission = await tx.permission.upsert({ where: { companyId_key: { companyId, key } }, create: { companyId, key }, update: {} });
        await tx.rolePermission.upsert({ where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } }, create: { roleId: role.id, permissionId: permission.id }, update: {} });
      }
      const hash = passwordMatches ? existing!.passwordHash : await bcrypt.hash(password, 10);
      await tx.user.upsert({
        where: { id: userId },
        create: { id: userId, companyId, email, firstName: 'Fictional', lastName: 'Swagger Manager', isActive: true, passwordHash: hash },
        update: { ...(!existing?.isActive ? { isActive: true } : {}), ...(!passwordMatches ? { passwordHash: hash } : {}) },
      });
      await tx.userRole.upsert({ where: { userId_roleId: { userId, roleId: role.id } }, create: { userId, roleId: role.id }, update: {} });
      return { createdCompany: !byId, createdUser: !existing, passwordChanged: !passwordMatches };
    });
    console.log(JSON.stringify({ ...result, email, companySlug, companyId, userId, role: 'manager', permissionCount: permissionKeys.length }));
  } finally { await db.$disconnect(); }
}

main().catch((error: unknown) => {
  // Never print payloads, Prisma internals, hashes, URLs, or credentials.
  const allowed = [
    'This seed requires', 'Refusing a database', 'Seed input is too large', 'Expected private password',
    'Use a development password', 'Reserved fictional', 'Development user has',
    'Development account already', 'Development manager has',
  ];
  const message = error instanceof Error && allowed.some((prefix) => error.message.startsWith(prefix)) ? error.message : 'Development seed failed; no credentials were printed';
  console.error(message);
  process.exitCode = 1;
});
