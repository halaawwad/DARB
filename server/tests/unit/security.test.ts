import { beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

const db = vi.hoisted(() => ({ user: { findUnique: vi.fn() } }));
vi.mock('../../src/lib/prisma.js', () => ({ default: db, prisma: db }));
vi.mock('../../src/config/env.js', () => ({ env: { jwtSecret: 'unit-only-fictional-secret', jwtExpiresIn: '7d' } }));
import { authenticateToken, assertPermission, requireAuth, requirePermission } from '../../src/middleware/auth.js';
import { normalizeError, HttpError } from '../../src/lib/errors.js';
import { permissionKeys, rolePermissions } from '../../src/features/auth/permissions.js';

const companyId = '11111111-1111-4111-8111-111111111111';
const otherCompany = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';
const token = () => jwt.sign({ sub: userId, companyId, email: 'fictional@example.invalid', role: 'admin' }, 'unit-only-fictional-secret');
const grant = (key: string, tenant: string | null = companyId) => ({ permission: { key, companyId: tenant } });
const user = () => ({ id: userId, companyId, email: 'fictional@example.invalid', isActive: true, company: { isActive: true }, userRoles: [{ role: { name: 'warehouse_staff', companyId, permissions: [] as ReturnType<typeof grant>[] } }] });

beforeEach(() => vi.clearAllMocks());
describe('database-backed authorization (explicit Prisma mock)', () => {
  it('does not authorize the JWT admin role', async () => {
    db.user.findUnique.mockResolvedValue(user());
    const principal = await authenticateToken(token());
    expect(principal.role).toBe('warehouse_staff');
    expect(() => assertPermission(principal, 'products:write')).toThrow('Permission required');
  });
  it('accepts only same-company or global permission grants on same-company roles', async () => {
    const record = user();
    record.userRoles[0].role.permissions = [grant('products:read'), grant('orders:read', null), grant('products:write', otherCompany)];
    record.userRoles.push({ role: { name: 'foreign', companyId: otherCompany, permissions: [grant('customers:delete', otherCompany)] } });
    db.user.findUnique.mockResolvedValue(record);
    expect([...(await authenticateToken(token())).permissions].sort()).toEqual(['orders:read', 'products:read']);
  });
  it.each(['user', 'company'])('rejects disabled %s', async (target) => {
    const record = user();
    if (target === 'user') record.isActive = false; else record.company.isActive = false;
    db.user.findUnique.mockResolvedValue(record);
    await expect(authenticateToken(token())).rejects.toMatchObject({ statusCode: 401 });
  });
  it('rejects a token whose company differs from the database', async () => {
    db.user.findUnique.mockResolvedValue({ ...user(), companyId: otherCompany });
    await expect(authenticateToken(token())).rejects.toMatchObject({ statusCode: 401 });
  });
  it('rejects removed users', async () => {
    db.user.findUnique.mockResolvedValue(null);
    await expect(authenticateToken(token())).rejects.toMatchObject({ statusCode: 401 });
  });
  it('rejects malformed claims before querying the database', async () => {
    await expect(authenticateToken(jwt.sign({ sub: 'not-a-uuid' }, 'unit-only-fictional-secret'))).rejects.toMatchObject({ statusCode: 401 });
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
  it('passes permission denial to Express next', () => {
    const next = vi.fn();
    requirePermission('products:write')({ user: { permissions: new Set() } } as any, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });
  it('passes missing-token failures to Express next', async () => {
    const next = vi.fn();
    await requireAuth({ headers: {} } as any, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });
});

describe('least privilege baseline', () => {
  it('gives manager the reviewed permissions', () => expect(rolePermissions.manager).toEqual(permissionKeys));
  it.each(['sales_rep', 'delivery_rep', 'accountant', 'warehouse_staff'])('%s cannot modify the product catalogue', (role) => {
    expect(rolePermissions[role]).not.toContain('products:write');
    expect(rolePermissions[role]).not.toContain('products:delete');
  });
  it('reserves order creation for manager and sales', () => {
    expect(rolePermissions.sales_rep).toContain('orders:create');
    for (const role of ['delivery_rep', 'accountant', 'warehouse_staff']) expect(rolePermissions[role]).not.toContain('orders:create');
  });
});

describe('safe API errors', () => {
  it('preserves deliberate HTTP errors', () => expect(normalizeError(new HttpError(403, 'Denied'))).toEqual({ statusCode: 403, message: 'Denied' }));
  it('maps request validation to 400', () => expect(normalizeError(z.string().safeParse(12).error)).toMatchObject({ statusCode: 400 }));
  it('does not expose internal errors', () => expect(normalizeError(new Error('database secret detail'))).toEqual({ statusCode: 500, message: 'Unexpected server error' }));
  it.each([['P2002', 409], ['P2003', 400], ['P2025', 404]])('maps Prisma %s safely', (code, status) => {
    expect(normalizeError(new Prisma.PrismaClientKnownRequestError('internal SQL', { code: String(code), clientVersion: '6' }))).toMatchObject({ statusCode: status });
  });
});
