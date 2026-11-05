import { prisma } from '../../lib/prisma.js';
import { hashPassword, verifyPassword } from '../../lib/hash.js';
import { signToken } from '../../lib/jwt.js';
import { HttpError } from '../../lib/errors.js';

export async function login(email: string, password: string, companySlug?: string) {
  const users = await prisma.user.findMany({
    where: { email, ...(companySlug ? { company: { slug: companySlug } } : {}) },
    include: { company: true },
    take: 2,
  });
  const user = users.length === 1 ? users[0] : undefined;
  if (!user?.isActive || !user.company.isActive) {
    throw new HttpError(401, 'Invalid email or password');
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new HttpError(401, 'Invalid email or password');
  }

  const roleRecord = await prisma.userRole.findFirst({
    where: { userId: user.id, role: { companyId: user.companyId } },
    include: { role: true },
  });

  const token = signToken({
    sub: user.id,
    companyId: user.companyId,
    email: user.email,
    role: roleRecord?.role.name ?? 'employee',
  });

  return {
    token,
    user: {
      id: user.id,
      companyId: user.companyId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      phone: user.phone,
    },
    company: {
      id: user.companyId,
      name: user.company.name,
      slug: user.company.slug,
    },
  };
}

export async function addSeedUser(input: { companyId: string; email: string; password: string; firstName: string; lastName: string; roleName: string }) {
  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      companyId: input.companyId,
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: '0500000000',
      userRoles: {
        create: {
          role: {
            connectOrCreate: {
              where: { companyId_name: { companyId: input.companyId, name: input.roleName } },
              create: { companyId: input.companyId, name: input.roleName },
            },
          },
        },
      },
    },
  });

  return user;
}
