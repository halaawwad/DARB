import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { provisionCompanyPermissions } from '../../src/features/auth/permissions.js';
const db = new PrismaClient();
const tenant = randomUUID(),
  otherTenant = randomUUID(),
  run = `finance-${randomUUID()}`;
const password = `Fictional-${randomUUID()}`;
let customer: string,
  foreignCustomer: string,
  product: string,
  user: string,
  salesUser: string,
  warehouseUser: string,
  order: string,
  invoice: string,
  receipt: string;
const tokens: Record<string, string> = {};
let base: string;
async function request(method: string, path: string, token?: string, body?: unknown) {
  const r = await fetch(`${base}/api/v1${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  return { status: r.status, body: await r.json() };
}
const op = <T extends object>(payload: T, actorId = user) => ({
  id: randomUUID(),
  actorId,
  date: new Date().toISOString(),
  ...payload,
});
const post = (data: unknown, token = tokens.manager) => request('POST', '/finance/sync', token, data);
beforeAll(async () => {
  if (process.env.DARB_INTEGRATION !== '1' || !process.env.DARB_API_URL)
    throw new Error('Explicit real-service integration required');
  base = process.env.DARB_API_URL;
  await db.company.createMany({
    data: [
      { id: tenant, slug: run, name: 'Fictional Finance Integration' },
      { id: otherTenant, slug: `${run}-other`, name: 'Other Fictional Finance' },
    ],
  });
  await provisionCompanyPermissions(db, tenant);
  await provisionCompanyPermissions(db, otherTenant);
  for (const [name, companyId, role] of [
    ['manager', tenant, 'manager'],
    ['sales', tenant, 'sales_rep'],
    ['warehouse', tenant, 'warehouse_staff'],
    ['zero', tenant, 'ungranted'],
    ['other', otherTenant, 'manager'],
  ]) {
    const r = await db.role.upsert({
      where: { companyId_name: { companyId, name: role } },
      create: { companyId, name: role },
      update: {},
    });
    const u = await db.user.create({
      data: {
        companyId,
        email: `${name}-${run}@example.invalid`,
        firstName: 'Fictional',
        lastName: 'Finance',
        passwordHash: await bcrypt.hash(password, 10),
        userRoles: { create: { roleId: r.id } },
      },
    });
    if (name === 'manager') user = u.id;
    if (name === 'sales') salesUser = u.id;
    if (name === 'warehouse') warehouseUser = u.id;
    const login = await request('POST', '/auth/login', undefined, {
      email: u.email,
      password,
      companySlug: companyId === tenant ? run : `${run}-other`,
    });
    expect(login.status).toBe(200);
    tokens[name] = login.body.token;
  }
  customer = (
    await db.customer.create({
      data: {
        companyId: tenant,
        name: 'Fictional Shop',
        shopName: 'Fictional Shop',
        latitude: 31.9,
        longitude: 35.2,
        balance: 100,
      },
    })
  ).id;
  foreignCustomer = (
    await db.customer.create({
      data: {
        companyId: otherTenant,
        name: 'Other Shop',
        shopName: 'Other Shop',
        latitude: 31.9,
        longitude: 35.2,
      },
    })
  ).id;
  product = (
    await db.product.create({
      data: { companyId: tenant, name: 'Fictional Product', sku: run, unit: 'unit', price: 12.5 },
    })
  ).id;
  const created = await request('POST', '/orders', tokens.manager, {
    customerId: customer,
    items: [{ productId: product, quantity: 3, unitPrice: 12.5 }],
  });
  expect(created.status).toBe(201);
  order = created.body.order.id;
}, 60000);
afterAll(async () => {
  await db.user.updateMany({
    where: { companyId: { in: [tenant, otherTenant] } },
    data: { isActive: false },
  });
  await db.$disconnect();
});
describe.sequential('real finance API and database', () => {
  it('requires authentication and explicit grants', async () => {
    expect((await request('GET', '/finance')).status).toBe(401);
    expect((await request('GET', '/finance', tokens.zero)).status).toBe(403);
  });
  it('initializes one isolated workspace with opening balance and current catalog', async () => {
    const r = await request('GET', '/finance', tokens.manager);
    expect(r.status).toBe(200);
    expect(r.body.state.customers.map((c: any) => c.id)).toEqual([customer]);
    expect(r.body.state.products[0].price).toBe(1250);
    expect(r.body.permissions).toContain('finance:manage');
  });
  it('rejects foreign-company references and actor spoofing', async () => {
    expect(
      (
        await post(
          op({ kind: 'receipt', customerId: foreignCustomer, amount: 1000, method: 'cash', note: '' }),
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await post(
          op({ kind: 'receipt', customerId: customer, amount: 1000, method: 'cash', note: '' }, salesUser),
        )
      ).status,
    ).toBe(403);
  });
  it('issues one invoice and materializes exact customer debt', async () => {
    const invoiceOp = op({ kind: 'invoice', orderId: order });
    invoice = invoiceOp.id;
    const r = await post(invoiceOp);
    expect(r.status).toBe(200);
    expect(r.body.state.invoices[0].total).toBe(3750);
    expect(Number((await db.customer.findUniqueOrThrow({ where: { id: customer } })).balance)).toBe(137.5);
    expect((await db.invoice.findUnique({ where: { id: invoice } }))?.orderId).toBe(order);
    expect((await post(op({ kind: 'invoice', orderId: order }))).status).toBe(409);
  });
  it('processes concurrent duplicate cash receipts exactly once and rejects key reuse', async () => {
    const receiptOp = op({
      kind: 'receipt',
      customerId: customer,
      amount: 1000,
      method: 'cash',
      note: 'Fictional collection',
    });
    receipt = receiptOp.id;
    const responses = await Promise.all([post(receiptOp), post(receiptOp)]);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    expect(Number((await db.customer.findUniqueOrThrow({ where: { id: customer } })).balance)).toBe(127.5);
    expect(await db.auditLog.count({ where: { companyId: tenant, entityId: receipt } })).toBe(1);
    expect((await post({ ...receiptOp, amount: 1001 })).status).toBe(409);
  });
  it('resolves cheque clearance atomically and enforces manager grants', async () => {
    const cheque = op({
      kind: 'receipt',
      customerId: customer,
      amount: 5000,
      method: 'cheque',
      note: '',
      cheque: { number: 'TEST-001', bank: 'Fictional Bank', due: '2026-11-08' },
    });
    expect((await post(cheque)).status).toBe(200);
    expect(Number((await db.customer.findUniqueOrThrow({ where: { id: customer } })).balance)).toBe(127.5);
    expect(
      (await post(op({ kind: 'cheque', receiptId: cheque.id, status: 'cleared' }, salesUser), tokens.sales))
        .status,
    ).toBe(403);
    expect((await post(op({ kind: 'cheque', receiptId: cheque.id, status: 'cleared' }))).status).toBe(200);
    expect(Number((await db.customer.findUniqueOrThrow({ where: { id: customer } })).balance)).toBe(77.5);
    expect((await post(op({ kind: 'cheque', receiptId: cheque.id, status: 'bounced' }))).status).toBe(409);
  });
  it('reserves a return without money, checks SKU and reviewer grants, and credits only once', async () => {
    const payload = {
      kind: 'return' as const,
      invoiceId: invoice,
      items: [{ productId: product, quantity: 2 }],
      reason: 'Damaged packaging',
      photo: 'data:image/png;base64,iVBORw0KGgo=',
    };
    const requested = op(payload);
    const result = await post(requested);
    expect(result.status).toBe(200);
    expect(result.body.state.returns.find((r: any) => r.id === requested.id).status).toBe('pending');
    expect(Number((await db.customer.findUniqueOrThrow({ where: { id: customer } })).balance)).toBe(77.5);
    expect((await post({ ...op(payload), status: 'accepted' })).status).toBe(400);
    expect((await post(op(payload))).status).toBe(409);
    const inspection = {
      identityMatched: true,
      quantityMatched: true,
      conditionChecked: true,
      received: [{ productId: product, quantity: 2, observedCode: run }],
    };
    const review = {
      kind: 'returnReview' as const,
      returnId: requested.id,
      decision: 'accepted' as const,
      note: 'Counted, matched SKU and unit',
      inspection,
    };
    expect((await post(op(review, salesUser), tokens.sales)).status).toBe(403);
    expect((await post(op(review))).body.code).toBe('reviewSelf');
    expect(
      (
        await post(
          op(
            {
              ...review,
              inspection: {
                ...inspection,
                received: [{ productId: product, quantity: 2, observedCode: 'OTHER-PRODUCT' }],
              },
            },
            warehouseUser,
          ),
          tokens.warehouse,
        )
      ).body.code,
    ).toBe('inspectionCode');
    expect(
      (
        await post(
          op(
            {
              ...review,
              inspection: {
                ...inspection,
                received: [{ productId: product, quantity: 1, observedCode: run }],
              },
            },
            warehouseUser,
          ),
          tokens.warehouse,
        )
      ).body.code,
    ).toBe('inspectionQuantity');
    expect(Number((await db.customer.findUniqueOrThrow({ where: { id: customer } })).balance)).toBe(77.5);
    const accept = op(review, warehouseUser);
    const responses = await Promise.all([post(accept, tokens.warehouse), post(accept, tokens.warehouse)]);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    expect(Number((await db.customer.findUniqueOrThrow({ where: { id: customer } })).balance)).toBe(52.5);
    expect(await db.auditLog.count({ where: { companyId: tenant, entityId: accept.id } })).toBe(1);
    expect((await post(op(review, warehouseUser), tokens.warehouse)).body.code).toBe('returnState');
  });
  it('rejects a request without crediting it and releases its reserved quantity', async () => {
    const payload = {
      kind: 'return' as const,
      invoiceId: invoice,
      items: [{ productId: product, quantity: 1 }],
      reason: 'Incorrect physical item',
      photo: 'data:image/png;base64,iVBORw0KGgo=',
    };
    const requested = op(payload, salesUser);
    expect((await post(requested, tokens.sales)).status).toBe(200);
    expect((await post(op(payload, salesUser), tokens.sales)).status).toBe(409);
    const reject = {
      kind: 'returnReview' as const,
      returnId: requested.id,
      decision: 'rejected' as const,
      note: 'The item received is a different size',
    };
    expect((await post(op(reject), tokens.other)).status).toBe(403); // Actor spoofing is also blocked.
    expect((await post(op(reject, warehouseUser), tokens.warehouse)).status).toBe(200);
    expect(Number((await db.customer.findUniqueOrThrow({ where: { id: customer } })).balance)).toBe(52.5);
    expect((await post(op(payload, salesUser), tokens.sales)).status).toBe(200);
  });
  it('rejects wallet overdraft without changing the workspace revision', async () => {
    const before = await db.financeWorkspace.findUniqueOrThrow({ where: { companyId: tenant } });
    expect((await post(op({ kind: 'deposit', amount: 1001, note: 'Fictional handover' }))).status).toBe(409);
    const after = await db.financeWorkspace.findUniqueOrThrow({ where: { companyId: tenant } });
    expect(after.revision).toBe(before.revision);
    expect((await post(op({ kind: 'deposit', amount: 500, note: 'Fictional handover' }))).status).toBe(200);
  });
  it('creates offline orders once in the existing orders table and rejects stale prices', async () => {
    const offline = op(
      {
        kind: 'order',
        customerId: customer,
        items: [{ productId: product, name: 'Fictional Product', quantity: 2, unitPrice: 1250 }],
      },
      salesUser,
    );
    expect((await post(offline, tokens.sales)).status).toBe(200);
    expect((await post(offline, tokens.sales)).status).toBe(200);
    expect(await db.salesOrder.count({ where: { id: offline.id, companyId: tenant } })).toBe(1);
    expect(
      (
        await post(
          op({ ...offline, id: randomUUID(), items: [{ ...offline.items[0], unitPrice: 1 }] }, salesUser),
          tokens.sales,
        )
      ).status,
    ).toBe(409);
  });
  it('automatically checks persisted sales before crediting a return, once only', async () => {
    const freshOrder = await request('POST', '/orders', tokens.sales, {
      customerId: customer,
      items: [{ productId: product, quantity: 3, unitPrice: 12.5 }],
    });
    expect(freshOrder.status).toBe(201);
    const invoiceOp = op({ kind: 'invoice', orderId: freshOrder.body.order.id });
    const invoiceResponse = await post(invoiceOp);
    expect(invoiceResponse.status).toBe(200);
    const issuedCodes = invoiceResponse.body.state.invoices.find((i: any) => i.id === invoiceOp.id).items[0]
      .unitCodes;
    const before = Number((await db.customer.findUniqueOrThrow({ where: { id: customer } })).balance);
    const payload = op(
      {
        kind: 'return',
        verification: 'unit_codes',
        customerId: customer,
        invoiceId: invoiceOp.id,
        items: [{ productId: product, quantity: 2, unitCodes: issuedCodes.slice(0, 2) }],
        reason: 'Record-matched return',
        photo: 'data:image/png;base64,iVBORw0KGgo=',
      },
      salesUser,
    );
    const responses = await Promise.all([post(payload, tokens.sales), post(payload, tokens.sales)]);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    const result = responses[0].body.state.returns.find((r: any) => r.id === payload.id);
    expect(result.status).toBe('accepted');
    expect(result.salesCheck.physicalIdentityVerified).toBe(false);
    expect(result.reviewedBy).toBe('system:unit-codes');
    expect(Number((await db.customer.findUniqueOrThrow({ where: { id: customer } })).balance)).toBe(
      before - 25,
    );
    expect(await db.auditLog.count({ where: { companyId: tenant, entityId: payload.id } })).toBe(1);
    expect((await post({ ...payload, id: randomUUID() }, tokens.sales)).status).toBe(409);
    expect((await post({ ...payload, id: randomUUID(), status: 'accepted' }, tokens.sales)).status).toBe(400);
    expect(
      (
        await post(
          { ...payload, id: randomUUID(), salesCheck: { physicalIdentityVerified: true } },
          tokens.sales,
        )
      ).status,
    ).toBe(400);
    expect(
      (await post({ ...payload, id: randomUUID(), customerId: foreignCustomer }, tokens.sales)).status,
    ).toBe(409);
    expect(
      (
        await post(
          { ...payload, id: randomUUID(), items: [{ productId: randomUUID(), quantity: 1 }] },
          tokens.sales,
        )
      ).status,
    ).toBe(409);
  });
  it('persists unit identifiers and prevents concurrent duplicate unit returns', async () => {
    const order = await request('POST', '/orders', tokens.sales, {
      customerId: customer,
      items: [{ productId: product, quantity: 3, unitPrice: 12.5 }],
    });
    expect(order.status).toBe(201);
    const issued = op({ kind: 'invoice', orderId: order.body.order.id });
    const invoiceResult = await post(issued);
    expect(invoiceResult.status).toBe(200);
    const codes = invoiceResult.body.state.invoices.find((i: any) => i.id === issued.id).items[0].unitCodes;
    expect(codes).toHaveLength(3);
    const before = Number((await db.customer.findUniqueOrThrow({ where: { id: customer } })).balance);
    const payload = op(
      {
        kind: 'return',
        verification: 'unit_codes',
        customerId: customer,
        invoiceId: issued.id,
        items: [{ productId: product, quantity: 1, unitCodes: [codes[0]] }],
        reason: 'Damaged sold unit',
        photo: 'data:image/png;base64,iVBORw0KGgo=',
      },
      salesUser,
    );
    expect(
      (
        await post(
          {
            ...payload,
            id: randomUUID(),
            items: [{ productId: product, quantity: 1, unitCodes: ['FOREIGN-CODE'] }],
          },
          tokens.sales,
        )
      ).status,
    ).toBe(409);
    expect(
      (await post({ ...payload, id: randomUUID(), customerId: foreignCustomer }, tokens.sales)).status,
    ).toBe(409);
    const responses = await Promise.all([
      post(payload, tokens.sales),
      post({ ...payload, id: randomUUID() }, tokens.sales),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    const fresh = await request('GET', '/finance', tokens.sales);
    const accepted = fresh.body.state.returns.find((r: any) => r.invoiceId === issued.id);
    expect(accepted.salesCheck.source).toBe('unit_codes');
    expect(accepted.salesCheck.unitIdentityVerified).toBe(true);
    expect(Number((await db.customer.findUniqueOrThrow({ where: { id: customer } })).balance)).toBe(
      before - 12.5,
    );
    const persisted = await db.financeWorkspace.findUniqueOrThrow({ where: { companyId: tenant } });
    expect((persisted.state as any).invoices.find((i: any) => i.id === issued.id).items[0].unitCodes).toEqual(
      codes,
    );
  });
  it('does not expose the other company financial records', async () => {
    const r = await request('GET', '/finance', tokens.other);
    expect(r.status).toBe(200);
    expect(r.body.state.receipts).toHaveLength(0);
    expect(r.body.state.customers.map((c: any) => c.id)).toEqual([foreignCustomer]);
  });
});
