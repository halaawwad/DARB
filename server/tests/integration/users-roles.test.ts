import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import createApp from '../../src/app.js';
import prisma from '../../src/lib/prisma.js';

const run = Date.now().toString(36);
const password = 'Passw0rd!123';
const slugs = [`users-a-${run}`, `users-b-${run}`];

type Session = { token: string; userId: string; companyId: string };
type Employee = { id: string; email: string; token: string };

let server: Awaited<ReturnType<typeof createApp>>;
let a: Session; // company A manager
let b: Session; // company B manager
let rep: Employee;        // sales_rep in A
let accountant: Employee; // accountant in A

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

async function register(slug: string): Promise<Session> {
  const res = await request(server).post('/api/v1/auth/register').send({
    companyName: `Test ${slug}`, companySlug: slug, firstName: 'Manager', lastName: slug,
    email: `manager-${slug}@example.com`, password,
  });
  expect(res.status).toBe(201);
  return { token: res.body.token, userId: res.body.user.id, companyId: res.body.company.id };
}

async function login(email: string): Promise<string> {
  const res = await request(server).post('/api/v1/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return res.body.token as string;
}

function createEmployee(session: Session, role: string, label: string, email = `${label}-${run}@example.com`) {
  return request(server).post('/api/v1/users').set(bearer(session.token))
    .send({ firstName: label, lastName: 'Test', email, password, role });
}

async function roleId(session: Session, name: string): Promise<string> {
  const res = await request(server).get('/api/v1/roles').set(bearer(session.token));
  expect(res.status).toBe(200);
  return res.body.roles.find((role: { name: string }) => role.name === name).id as string;
}

async function makeEmployee(session: Session, role: string, label: string): Promise<Employee> {
  const email = `${label}-${run}@example.com`;
  const res = await createEmployee(session, role, label, email);
  expect(res.status).toBe(201);
  return { id: res.body.user.id, email, token: await login(email) };
}

beforeAll(async () => {
  server = await createApp();
  a = await register(slugs[0]);
  b = await register(slugs[1]);
  rep = await makeEmployee(a, 'sales_rep', 'rep');
  accountant = await makeEmployee(a, 'accountant', 'accountant');
});

afterAll(async () => {
  await prisma.company.deleteMany({ where: { slug: { in: slugs } } });
  await prisma.$disconnect();
  server.io.close();
});

describe('users', () => {
  it('lists only the caller company and never exposes password hashes', async () => {
    const res = await request(server).get('/api/v1/users').set(bearer(a.token));
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(3); // manager, rep, accountant
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(res.body.users.map((user: { id: string }) => user.id)).not.toContain(b.userId);
  });

  it('creates an employee with a role', async () => {
    const res = await request(server).get(`/api/v1/users/${rep.id}`).set(bearer(a.token));
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ role: 'sales_rep', isActive: true });
  });

  it('rejects an unknown role and a duplicate email across companies', async () => {
    expect((await createEmployee(a, 'no_such_role', 'ghost')).status).toBe(400);
    expect((await createEmployee(b, 'sales_rep', 'dup', rep.email)).status).toBe(409);
  });

  it('forbids users endpoints for a role without users:read', async () => {
    expect((await request(server).get('/api/v1/users').set(bearer(rep.token))).status).toBe(403);
    expect((await createEmployee({ ...a, token: rep.token }, 'sales_rep', 'blocked')).status).toBe(403);
  });

  it('hides another company\'s users completely (404, not 403)', async () => {
    const path = `/api/v1/users/${a.userId}`;
    expect((await request(server).get(path).set(bearer(b.token))).status).toBe(404);
    expect((await request(server).put(path).set(bearer(b.token)).send({ firstName: 'Hacked' })).status).toBe(404);
    expect((await request(server).delete(path).set(bearer(b.token))).status).toBe(404);
    const still = await request(server).get(path).set(bearer(a.token));
    expect(still.body.user.firstName).toBe('Manager');
  });

  it('stops you changing your own role or deactivating yourself', async () => {
    const path = `/api/v1/users/${a.userId}`;
    expect((await request(server).put(path).set(bearer(a.token)).send({ role: 'sales_rep' })).status).toBe(409);
    expect((await request(server).delete(path).set(bearer(a.token))).status).toBe(409);
  });

  it('lets a manager change a role and deactivate an employee, and logs both', async () => {
    const path = `/api/v1/users/${accountant.id}`;
    const changed = await request(server).put(path).set(bearer(a.token)).send({ role: 'delivery_rep' });
    expect(changed.status).toBe(200);
    expect(changed.body.user.role).toBe('delivery_rep');

    expect((await request(server).delete(path).set(bearer(a.token))).status).toBe(204);
    const after = await request(server).get(path).set(bearer(a.token));
    expect(after.body.user.isActive).toBe(false);
    // a deactivated user's existing token stops working immediately
    expect((await request(server).get('/api/v1/auth/me').set(bearer(accountant.token))).status).toBe(401);

    const actions = (await prisma.auditLog.findMany({ where: { companyId: a.companyId, entityType: 'user' } })).map((log) => log.action);
    expect(actions).toContain('user.create');
    expect(actions).toContain('user.update');
  });
});

describe('roles', () => {
  it('lists the roles with their permissions and all known keys', async () => {
    const res = await request(server).get('/api/v1/roles').set(bearer(a.token));
    expect(res.status).toBe(200);
    expect(res.body.permissions).toHaveLength(15);
    const names = res.body.roles.map((role: { name: string }) => role.name);
    expect(names).toEqual(expect.arrayContaining(['manager', 'admin', 'sales_rep', 'delivery_rep', 'accountant', 'warehouse_staff']));
    expect(res.body.roles.find((role: { name: string }) => role.name === 'manager').locked).toBe(true);
  });

  it('refuses to edit manager, unknown keys, and roles of another company', async () => {
    const manager = await roleId(a, 'manager');
    const accountantRole = await roleId(a, 'accountant');
    const put = (token: string, id: string, permissions: string[]) =>
      request(server).put(`/api/v1/roles/${id}/permissions`).set(bearer(token)).send({ permissions });

    expect((await put(a.token, manager, ['company:read'])).status).toBe(409);
    expect((await put(a.token, accountantRole, ['not:a:key'])).status).toBe(400);
    expect((await put(b.token, accountantRole, ['company:read'])).status).toBe(404);
  });

  it('applies a permission change immediately and writes an audit row', async () => {
    const delivery = await makeEmployee(a, 'accountant', 'accountant2');
    const before = await request(server).get('/api/v1/auth/me').set(bearer(delivery.token));
    expect(before.body.permissions).not.toContain('customers:write');

    const accountantRole = await roleId(a, 'accountant');
    const res = await request(server).put(`/api/v1/roles/${accountantRole}/permissions`).set(bearer(a.token))
      .send({ permissions: ['company:read', 'customers:read', 'customers:write', 'products:read', 'orders:read'] });
    expect(res.status).toBe(200);
    expect(res.body.role.permissions).toContain('customers:write');

    const after = await request(server).get('/api/v1/auth/me').set(bearer(delivery.token));
    expect(after.body.permissions).toContain('customers:write');

    const log = await prisma.auditLog.findFirst({ where: { companyId: a.companyId, action: 'role.permissions.update' } });
    expect(log).not.toBeNull();
  });

  it('forbids editing roles without roles:write, and stops privilege climbing', async () => {
    const repRole = await roleId(a, 'sales_rep');
    const accountantRole = await roleId(a, 'accountant');

    // a rep has no roles:write
    const denied = await request(server).put(`/api/v1/roles/${accountantRole}/permissions`).set(bearer(rep.token)).send({ permissions: ['company:read'] });
    expect(denied.status).toBe(403);

    // give reps users:write, then check they still cannot create a manager
    const grant = await request(server).put(`/api/v1/roles/${repRole}/permissions`).set(bearer(a.token)).send({
      permissions: ['company:read', 'customers:read', 'customers:write', 'products:read', 'orders:read', 'orders:create', 'checkpoints:read', 'incidents:create', 'users:write'],
    });
    expect(grant.status).toBe(200);
    expect((await createEmployee({ ...a, token: rep.token }, 'manager', 'climber')).status).toBe(403);
  });
});