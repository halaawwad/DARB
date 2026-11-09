import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { io, type Socket } from 'socket.io-client';
import { provisionCompanyPermissions, rolePermissions } from '../../src/features/auth/permissions.js';

const run = `integration-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
const companyA = randomUUID(), companyB = randomUUID();
const password = `Fictional-${randomUUID()}`;
const tokens: Record<string, string> = {}, users: Record<string, string> = {}, emails: Record<string, string> = {};
const sockets: Socket[] = [];
let db: PrismaClient;
let redis: ReturnType<typeof createClient>;
let base: string, customerA: string, customerB: string, productA: string, productB: string, secondProduct: string;
let checkpointA: string, checkpointB: string, farCheckpoint: string, orderId: string;
let socketA: Socket, socketB: Socket;
const eventsA: any[] = [], eventsB: any[] = [];
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function api(method: string, path: string, token?: string, data?: unknown) {
  const response = await fetch(`${base}${path}`, {
    method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(data ? { 'Content-Type': 'application/json' } : {}) },
    ...(data ? { body: JSON.stringify(data) } : {}), signal: AbortSignal.timeout(7000),
  });
  const text = await response.text();
  let body: any; try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, body };
}
async function login(name: string) { return api('POST', '/api/v1/auth/login', undefined, { email: emails[name], password }); }
async function socketConnect(token?: string) {
  const socket = io(base, { transports: ['websocket'], auth: token ? { token } : {}, autoConnect: false, reconnection: false, timeout: 3000 });
  sockets.push(socket);
  const result = await new Promise<{ connected: boolean; error?: string }>((resolve) => {
    const timer = setTimeout(() => resolve({ connected: false, error: 'timeout' }), 4000);
    socket.once('connect', () => { clearTimeout(timer); resolve({ connected: true }); });
    socket.once('connect_error', (error) => { clearTimeout(timer); resolve({ connected: false, error: error.message }); });
    socket.connect();
  });
  return { socket, ...result };
}
const customerInput = { name: `Fictional ${run}`, shopName: 'Fictional Integration Shop', phone: '0000000000', latitude: 31.9, longitude: 35.2 };
const productInput = { name: `Fictional ${run}`, sku: `${run}-product`, unit: 'unit', price: '12.50' };
const orderInput = () => ({ customerId: customerA, notes: run, items: [{ productId: productA, quantity: 2, unitPrice: '12.50' }, { productId: secondProduct, quantity: 3, unitPrice: '5.25' }] });

beforeAll(async () => {
  if (process.env.DARB_INTEGRATION !== '1' || !process.env.DARB_API_URL || !process.env.DATABASE_URL || !process.env.REDIS_URL || !process.env.JWT_SECRET) {
    throw new Error('Real integration requires DARB_INTEGRATION=1, DARB_API_URL, DATABASE_URL, REDIS_URL and JWT_SECRET. No fallbacks are permitted.');
  }
  if (process.env.NODE_ENV === 'test') throw new Error('Run integration in development mode, not NODE_ENV=test');
  base = process.env.DARB_API_URL.replace(/\/$/, '');
  db = new PrismaClient();
  redis = createClient({ url: process.env.REDIS_URL, socket: { connectTimeout: 5000, reconnectStrategy: false } });
  redis.on('error', () => undefined);
  await db.$connect(); await redis.connect();
  expect((await api('GET', '/ready')).status).toBe(200);
  await db.company.createMany({ data: [{ id: companyA, slug: `${run}-a`, name: 'Fictional Integration A' }, { id: companyB, slug: `${run}-b`, name: 'Fictional Integration B' }] });
  await provisionCompanyPermissions(db, companyA); await provisionCompanyPermissions(db, companyB);
  const hash = await bcrypt.hash(password, 10);
  for (const [name, tenant, role] of [
    ['managerA', companyA, 'manager'], ['managerB', companyB, 'manager'], ['sales', companyA, 'sales_rep'],
    ['delivery', companyA, 'delivery_rep'], ['accountant', companyA, 'accountant'], ['warehouse', companyA, 'warehouse_staff'],
    ['zero', companyA, 'ungranted'], ['revoked', companyA, 'sales_rep'],
  ]) {
    const assignedRole = await db.role.upsert({ where: { companyId_name: { companyId: tenant, name: role } }, create: { companyId: tenant, name: role }, update: {} });
    emails[name] = `${run}-${name.toLowerCase()}@example.invalid`;
    const user = await db.user.create({ data: { companyId: tenant, email: emails[name], firstName: 'Fictional', lastName: 'Integration', passwordHash: hash, userRoles: { create: { roleId: assignedRole.id } } } });
    users[name] = user.id;
    const result = await login(name);
    expect(result.status, `Login failed for ${name}`).toBe(200);
    tokens[name] = result.body.token;
  }
  for (const [name, tenant, lat] of [['nearA', companyA, '31.9'], ['nearB', companyB, '31.9'], ['farA', companyA, '32.5']]) {
    const checkpoint = await db.checkpoint.create({ data: { companyId: tenant, name: `${run}-${name}`, latitude: lat, longitude: '35.2' } });
    if (name === 'nearA') checkpointA = checkpoint.id;
    else if (name === 'nearB') checkpointB = checkpoint.id;
    else farCheckpoint = checkpoint.id;
  }
  console.log(JSON.stringify({ integrationRun: run, companyA, companyB, policy: 'Fixtures retained; their users are disabled after the run.' }));
});

afterAll(async () => {
  for (const socket of sockets) socket.disconnect();
  if (db) {
    // Restrict only this run's random tenant IDs. Never delete existing records.
    await db.user.updateMany({ where: { companyId: { in: [companyA, companyB] } }, data: { isActive: false } });
    await db.$disconnect();
  }
  if (redis?.isOpen) await redis.quit();
});

describe.sequential('real Docker backend integration', () => {
  it('provisions one explicit tenant idempotently through the development CLI', async () => {
    const snapshot = async (companyId: string) => ({
      roles: await db.role.count({ where: { companyId } }),
      permissions: await db.permission.count({ where: { companyId } }),
      grants: await db.rolePermission.count({ where: { role: { companyId } } }),
      memberships: await db.userRole.count({ where: { user: { companyId } } }),
    });
    const own = await snapshot(companyA), other = await snapshot(companyB);
    for (let attempt = 0; attempt < 2; attempt++) {
      execFileSync(process.execPath, ['--import', 'tsx', 'prisma/provision-permissions.ts', '--company-id', companyA], { env: process.env, timeout: 20000, stdio: 'pipe' });
    }
    expect(await snapshot(companyA)).toEqual(own);
    expect(await snapshot(companyB)).toEqual(other);
  });
  it('matches every default role grant to the documented least-privilege matrix', async () => {
    for (const [name, keys] of Object.entries(rolePermissions)) {
      const role = await db.role.findUniqueOrThrow({ where: { companyId_name: { companyId: companyA, name } }, include: { permissions: { include: { permission: true } } } });
      expect(role.permissions.map(({ permission }) => permission.key).sort()).toEqual([...keys].sort());
      expect(role.permissions.every(({ permission }) => permission.companyId === companyA)).toBe(true);
    }
    const zero = await db.role.findUniqueOrThrow({ where: { companyId_name: { companyId: companyA, name: 'ungranted' } }, include: { permissions: true } });
    expect(zero.permissions).toHaveLength(0);
  });
  it('checks PostgreSQL/PostGIS and real Redis NX/TTL semantics', async () => {
    const version = await db.$queryRaw<Array<{ db: string; postgis: string }>>`SELECT current_database() AS db, PostGIS_Lib_Version() AS postgis`;
    expect(version[0].postgis).toMatch(/^3\./);
    const key = `${run}:redis`;
    expect(await redis.ping()).toBe('PONG');
    expect(await redis.set(key, run, { EX: 30, NX: true })).toBe('OK');
    expect(await redis.get(key)).toBe(run);
    expect(await redis.set(key, 'duplicate', { NX: true, EX: 30 })).toBeNull();
    expect(await redis.ttl(key)).toBeGreaterThan(0);
  });
  it('serves health/readiness and nonempty live OpenAPI with bearer auth', async () => {
    expect((await api('GET', '/health')).body.ok).toBe(true);
    expect((await api('GET', '/ready')).body).toMatchObject({ ready: true, database: 'ok', redis: 'ok' });
    const document = await api('GET', '/openapi.json');
    expect(document.status).toBe(200);
    expect(Object.keys(document.body.paths)).toHaveLength(20);
    expect(document.body.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
    expect(document.body.servers).toEqual([{ url: '/' }]);
    expect((await api('GET', '/docs/')).status).toBe(200);
  });
  it('verifies signed JWT identity and current user', async () => {
    const claims = jwt.verify(tokens.managerA, process.env.JWT_SECRET!) as jwt.JwtPayload;
    expect(claims).toMatchObject({ sub: users.managerA, companyId: companyA });
    const response = await api('GET', '/api/v1/auth/me', tokens.managerA);
    expect(response.status).toBe(200); expect(response.body.user.id).toBe(users.managerA);
  });
  it('rejects invalid passwords and missing/forged/expired JWTs', async () => {
    expect((await api('POST', '/api/v1/auth/login', undefined, { email: emails.managerA, password: 'wrong-password' })).status).toBe(401);
    const claims = { sub: users.managerA, companyId: companyA, email: emails.managerA, role: 'manager' };
    for (const token of [undefined, 'invalid', jwt.sign(claims, 'fictional-wrong-secret'), jwt.sign(claims, process.env.JWT_SECRET!, { expiresIn: -1 })]) {
      expect((await api('GET', '/api/v1/companies/current', token)).status).toBe(401);
    }
  });
  it('returns each authenticated company', async () => {
    for (const [name, id] of [['managerA', companyA], ['managerB', companyB]]) {
      const response = await api('GET', '/api/v1/companies/current', tokens[name]);
      expect(response.status).toBe(200); expect(response.body.company.id).toBe(id);
    }
  });
  it('creates customers with trusted tenant identity', async () => {
    for (const name of ['managerA', 'managerB']) {
      const response = await api('POST', '/api/v1/customers', tokens[name], { ...customerInput, companyId: companyB });
      expect(response.status).toBe(201);
      if (name === 'managerA') { customerA = response.body.customer.id; expect(response.body.customer.companyId).toBe(companyA); }
      else customerB = response.body.customer.id;
    }
  });
  it('reads, updates, lists and verifies customers in PostgreSQL', async () => {
    expect((await api('GET', `/api/v1/customers/${customerA}`, tokens.managerA)).status).toBe(200);
    expect((await api('PUT', `/api/v1/customers/${customerA}`, tokens.managerA, { shopName: 'Updated fictional shop' })).status).toBe(200);
    expect((await db.customer.findUniqueOrThrow({ where: { id: customerA } })).shopName).toBe('Updated fictional shop');
    const list = await api('GET', '/api/v1/customers', tokens.managerA);
    expect(list.body.customers.some((row: any) => row.id === customerA)).toBe(true);
    expect(list.body.customers.every((row: any) => row.companyId === companyA)).toBe(true);
  });
  it.each(['GET', 'PUT', 'DELETE'])('rejects cross-tenant customer %s', async (method) => {
    expect((await api(method, `/api/v1/customers/${customerA}`, tokens.managerB, method === 'PUT' ? { name: 'Forbidden' } : undefined)).status).toBe(403);
  });
  it('creates products for each tenant and an additional order item', async () => {
    for (const [name, sku, price] of [['managerA', 'first', '12.50'], ['managerB', 'foreign', '9.50'], ['managerA', 'second', '5.25']]) {
      const response = await api('POST', '/api/v1/products', tokens[name], { ...productInput, sku: `${run}-${sku}`, price });
      expect(response.status).toBe(201);
      if (sku === 'first') productA = response.body.product.id;
      else if (sku === 'foreign') productB = response.body.product.id;
      else secondProduct = response.body.product.id;
    }
  });
  it('reads, updates, lists and verifies products in PostgreSQL', async () => {
    expect((await api('GET', `/api/v1/products/${productA}`, tokens.managerA)).status).toBe(200);
    expect((await api('PUT', `/api/v1/products/${productA}`, tokens.managerA, { description: 'Updated fictional product' })).status).toBe(200);
    expect((await db.product.findUniqueOrThrow({ where: { id: productA } })).description).toBe('Updated fictional product');
    const list = await api('GET', '/api/v1/products', tokens.managerB);
    expect(list.body.products.some((row: any) => row.id === productB)).toBe(true);
    expect(list.body.products.every((row: any) => row.companyId === companyB)).toBe(true);
  });
  it.each(['GET', 'PUT', 'DELETE'])('rejects cross-tenant product %s', async (method) => {
    expect((await api(method, `/api/v1/products/${productA}`, tokens.managerB, method === 'PUT' ? { name: 'Forbidden' } : undefined)).status).toBe(403);
  });
  it.each(['zero', 'warehouse', 'sales', 'delivery', 'accountant'])('denies catalogue writes by %s', async (name) => {
    expect((await api('POST', '/api/v1/products', tokens[name], { ...productInput, sku: `${run}-forbidden-${name}` })).status).toBe(403);
    expect(await db.product.count({ where: { sku: `${run}-forbidden-${name}` } })).toBe(0);
  });
  it('denies zero-grant users on every protected resource', async () => {
    for (const path of ['/api/v1/companies/current', '/api/v1/customers', '/api/v1/products', '/api/v1/orders', '/api/v1/checkpoints/nearby?lat=31.9&lng=35.2']) {
      expect((await api('GET', path, tokens.zero)).status).toBe(403);
    }
    expect((await api('POST', '/api/v1/orders', tokens.zero, orderInput())).status).toBe(403);
    expect((await api('POST', '/api/v1/customers', tokens.zero, customerInput)).status).toBe(403);
    expect((await api('POST', '/api/v1/checkpoints/reports', tokens.zero, { incidentType: 'accident', description: run, latitude: 31.9, longitude: 35.2 })).status).toBe(403);
  });
  it('ignores foreign-company role memberships and permission grants in real PostgreSQL', async () => {
    const foreignRole = await db.role.findUniqueOrThrow({ where: { companyId_name: { companyId: companyB, name: 'manager' } } });
    const probe = await db.role.create({ data: { companyId: companyA, name: 'foreign-grant-probe' } });
    const foreignPermission = await db.permission.findUniqueOrThrow({ where: { companyId_key: { companyId: companyB, key: 'products:write' } } });
    await db.userRole.createMany({ data: [{ userId: users.zero, roleId: foreignRole.id }, { userId: users.zero, roleId: probe.id }] });
    await db.rolePermission.create({ data: { roleId: probe.id, permissionId: foreignPermission.id } });
    expect((await api('GET', '/api/v1/products', tokens.zero)).status).toBe(403);
    expect((await api('POST', '/api/v1/products', tokens.zero, { ...productInput, sku: `${run}-foreign-grant` })).status).toBe(403);
  });
  it('restricts sales balance changes and destructive customer operations', async () => {
    expect((await api('PUT', `/api/v1/customers/${customerA}`, tokens.sales, { balance: '100' })).status).toBe(403);
    expect((await api('DELETE', `/api/v1/customers/${customerA}`, tokens.sales)).status).toBe(403);
    expect((await api('PUT', `/api/v1/customers/${customerA}`, tokens.sales, { area: 'Fictional Area' })).status).toBe(200);
  });
  it('rejects unauthenticated, forged, expired and zero-grant sockets', async () => {
    const claims = { sub: users.managerA, companyId: companyA, email: emails.managerA, role: 'manager' };
    for (const token of [undefined, jwt.sign(claims, 'fictional-wrong-secret'), jwt.sign(claims, process.env.JWT_SECRET!, { expiresIn: -1 }), tokens.zero]) {
      const result = await socketConnect(token); expect(result.connected).toBe(false); expect(result.error).not.toBe('timeout');
    }
  });
  it('authenticates sockets for two independent tenants', async () => {
    const a = await socketConnect(tokens.managerA), b = await socketConnect(tokens.managerB);
    expect(a.connected).toBe(true); expect(b.connected).toBe(true); socketA = a.socket; socketB = b.socket;
    socketA.on('order-created', (event) => eventsA.push(event)); socketB.on('order-created', (event) => eventsB.push(event));
  });
  it('rejects foreign room membership and acknowledges only the trusted company', async () => {
    const denied = new Promise<any>((resolve) => socketA.once('error', resolve));
    socketA.emit('join-company-room', { companyId: companyB });
    expect((await denied).message).toBe('You do not have access to this company room');
    const joined = new Promise<any>((resolve) => socketA.once('company-room-joined', resolve));
    socketA.emit('join-company-room', { companyId: companyA }); expect((await joined).companyId).toBe(companyA);
  });
  it('creates an order atomically with two persisted items and exact total', async () => {
    const response = await api('POST', '/api/v1/orders', tokens.sales, orderInput());
    expect(response.status).toBe(201); orderId = response.body.order.id;
    const order = await db.salesOrder.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    expect(order.companyId).toBe(companyA); expect(order.items).toHaveLength(2); expect(order.total.toFixed(2)).toBe('40.75');
  });
  it('delivers the real order-created event only to its company', async () => {
    await wait(500);
    expect(eventsA.some((event) => event.orderId === orderId && event.companyId === companyA)).toBe(true);
    expect(eventsB.some((event) => event.orderId === orderId)).toBe(false);
  });
  it('retrieves orders with items/customer and isolates lists and individual reads', async () => {
    const own = await api('GET', `/api/v1/orders/${orderId}`, tokens.managerA);
    expect(own.status).toBe(200); expect(own.body.order.items).toHaveLength(2); expect(own.body.order.customer.id).toBe(customerA);
    expect((await api('GET', `/api/v1/orders/${orderId}`, tokens.managerB)).status).toBe(403);
    const foreign = await api('GET', '/api/v1/orders', tokens.managerB);
    expect(foreign.body.orders.some((row: any) => row.id === orderId)).toBe(false);
  });
  it('rejects foreign customers and products without partial orders/items', async () => {
    const beforeOrders = await db.salesOrder.count({ where: { companyId: companyA } });
    const beforeItems = await db.orderItem.count({ where: { order: { companyId: companyA } } });
    expect((await api('POST', '/api/v1/orders', tokens.managerA, { ...orderInput(), customerId: customerB })).status).toBe(403);
    const invalid = await api('POST', '/api/v1/orders', tokens.managerA, { ...orderInput(), items: [...orderInput().items, { productId: productB, quantity: 1, unitPrice: '1.00' }] });
    expect(invalid.status).toBe(400); expect(invalid.body).toEqual({ error: 'Invalid product' });
    expect(await db.salesOrder.count({ where: { companyId: companyA } })).toBe(beforeOrders);
    expect(await db.orderItem.count({ where: { order: { companyId: companyA } } })).toBe(beforeItems);
  });
  it('queries real PostGIS with radius and tenant filtering', async () => {
    const response = await api('GET', '/api/v1/checkpoints/nearby?lat=31.9&lng=35.2&radiusM=1000', tokens.sales);
    expect(response.status).toBe(200);
    expect(response.body.checkpoints.some((row: any) => row.id === checkpointA && row.distance_m < 1)).toBe(true);
    expect(response.body.checkpoints.some((row: any) => [checkpointB, farCheckpoint].includes(row.id))).toBe(false);
  });
  it('creates own-company incidents but rejects foreign and missing checkpoints', async () => {
    const input = { incidentType: 'accident', description: `Fictional ${run}`, latitude: 31.9, longitude: 35.2 };
    const own = await api('POST', '/api/v1/checkpoints/reports', tokens.sales, { ...input, checkpointId: checkpointA });
    expect(own.status).toBe(201);
    const before = await db.roadIncident.count({ where: { companyId: companyA } });
    expect((await api('POST', '/api/v1/checkpoints/reports', tokens.sales, { ...input, checkpointId: checkpointB })).status).toBe(403);
    expect((await api('POST', '/api/v1/checkpoints/reports', tokens.sales, { ...input, checkpointId: randomUUID() })).status).toBe(404);
    expect(await db.roadIncident.count({ where: { companyId: companyA } })).toBe(before);
  });
  it('enforces checkpoint ownership in PostgreSQL independently of HTTP', async () => {
    await expect(db.roadIncident.create({ data: { companyId: companyA, checkpointId: checkpointB, incidentType: 'accident', description: `Forbidden ${run}`, latitude: '31.9', longitude: '35.2' } })).rejects.toMatchObject({ code: 'P2003' });
  });
  it('rejects inactive users at login, HTTP and socket handshake with an existing token', async () => {
    await db.user.update({ where: { id: users.revoked }, data: { isActive: false } });
    try {
      expect((await login('revoked')).status).toBe(401);
      expect((await api('GET', '/api/v1/companies/current', tokens.revoked)).status).toBe(401);
      expect((await socketConnect(tokens.revoked)).connected).toBe(false);
    } finally { await db.user.update({ where: { id: users.revoked }, data: { isActive: true } }); }
  });
  it('disconnects an already-connected user disabled before event delivery', async () => {
    const live = await socketConnect(tokens.revoked); expect(live.connected).toBe(true);
    const received: any[] = []; live.socket.on('order-created', (event) => received.push(event));
    await db.user.update({ where: { id: users.revoked }, data: { isActive: false } });
    try {
      const response = await api('POST', '/api/v1/orders', tokens.managerA, orderInput()); expect(response.status).toBe(201);
      await wait(300); expect(received).toHaveLength(0); expect(live.socket.connected).toBe(false);
    } finally { await db.user.update({ where: { id: users.revoked }, data: { isActive: true } }); }
  });
  it('rejects inactive companies at login, HTTP and socket handshake', async () => {
    await db.company.update({ where: { id: companyB }, data: { isActive: false } });
    try {
      expect((await login('managerB')).status).toBe(401);
      expect((await api('GET', '/api/v1/companies/current', tokens.managerB)).status).toBe(401);
      expect((await socketConnect(tokens.managerB)).connected).toBe(false);
    } finally { await db.company.update({ where: { id: companyB }, data: { isActive: true } }); }
  });
  it('uses current grants rather than stale JWT roles after permission revocation', async () => {
    const role = await db.role.findUniqueOrThrow({ where: { companyId_name: { companyId: companyA, name: 'sales_rep' } } });
    const permission = await db.permission.findUniqueOrThrow({ where: { companyId_key: { companyId: companyA, key: 'orders:create' } } });
    // This is a grant created by this test run, never an existing business grant.
    await db.rolePermission.delete({ where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } } });
    expect((await api('POST', '/api/v1/orders', tokens.sales, orderInput())).status).toBe(403);
  });
  it('returns safe validation errors and soft-deletes only its own fixtures', async () => {
    expect((await api('POST', '/api/v1/orders', tokens.managerA, { ...orderInput(), items: [] })).status).toBe(400);
    expect((await api('DELETE', `/api/v1/customers/${customerA}`, tokens.managerA)).status).toBe(204);
    expect((await db.customer.findUniqueOrThrow({ where: { id: customerA } })).isActive).toBe(false);
    expect((await api('DELETE', `/api/v1/products/${productA}`, tokens.managerA)).status).toBe(204);
    expect((await db.product.findUniqueOrThrow({ where: { id: productA } })).isActive).toBe(false);
    expect((await api('GET', '/api/v1/customers', tokens.managerA)).body.customers.some((row: any) => row.id === customerA)).toBe(false);
    expect((await api('GET', '/api/v1/products', tokens.managerA)).body.products.some((row: any) => row.id === productA)).toBe(false);
  });
});
