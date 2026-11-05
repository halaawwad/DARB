import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../lib/errors.js';
import { verifyToken } from '../lib/jwt.js';
import prisma from '../lib/prisma.js';
import type { PermissionKey } from '../features/auth/permissions.js';

export type AuthenticatedUser = {
  id: string; companyId: string; email: string; role: string; permissions: Set<string>;
};
export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

export async function authenticateToken(token: string): Promise<AuthenticatedUser> {
  let payload;
  try { payload = verifyToken(token); } catch { throw new HttpError(401, 'Invalid or expired token'); }
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { company: true, userRoles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
  });
  if (!user?.isActive || !user.company.isActive || user.companyId !== payload.companyId) {
    throw new HttpError(401, 'User or company is inactive or unavailable');
  }
  const roles = user.userRoles.map((entry) => entry.role).filter((role) => role.companyId === user.companyId);
  const permissions = new Set(roles.flatMap((role) => role.permissions
    .filter(({ permission }) => permission.companyId === user.companyId || permission.companyId === null)
    .map(({ permission }) => permission.key)));
  return { id: user.id, companyId: user.companyId, email: user.email, role: roles[0]?.name ?? 'employee', permissions };
}

export async function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization ?? '';
    if (!header.startsWith('Bearer ') || !header.slice(7)) throw new HttpError(401, 'Missing bearer token');
    req.user = await authenticateToken(header.slice(7));
    next();
  } catch (error) { next(error); }
}

export function assertPermission(user: AuthenticatedUser | undefined, permission: PermissionKey): void {
  if (!user) throw new HttpError(401, 'Authentication required');
  if (!user.permissions.has(permission)) throw new HttpError(403, `Permission required: ${permission}`);
}

export function requirePermission(permission: PermissionKey) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    try { assertPermission(req.user, permission); next(); } catch (error) { next(error); }
  };
}

export function requireCompanyAccess(companyId: string | undefined, req: AuthenticatedRequest): void {
  if (!companyId || !req.user || req.user.companyId !== companyId) {
    throw new HttpError(403, 'You do not have access to this company');
  }
}
