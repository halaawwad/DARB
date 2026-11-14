import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import {
  requireAuth,
  requirePermission,
  assertPermission,
  type AuthenticatedRequest,
} from '../middleware/auth.js';
import { HttpError } from '../lib/errors.js';
import {
  applyOperation,
  balance,
  cents,
  FinanceError,
  type FinanceState,
  type Operation,
} from '../features/finance/domain.js';

const router = Router();
const common = { id: z.string().uuid(), actorId: z.string().uuid(), date: z.string().datetime() };
const money = z.number().int().positive().max(100_000_000);
const returned = z
  .object({
    productId: z.string(),
    quantity: z.number().int().positive().max(100000),
    unitCodes: z.array(z.string().min(1).max(160)).max(100000).optional(),
  })
  .strict();
const schema = z.discriminatedUnion('kind', [
  z.object({ ...common, kind: z.literal('returnCheck'), returnId: z.string().uuid() }).strict(),
  z
    .object({
      ...common,
      kind: z.literal('receipt'),
      customerId: z.string().uuid(),
      amount: money,
      method: z.enum(['cash', 'digital', 'cheque']),
      note: z.string().max(500),
      cheque: z
        .object({
          number: z.string().trim().min(1).max(80),
          bank: z.string().trim().min(1).max(100),
          due: z.string().max(10),
        })
        .strict()
        .optional(),
    })
    .strict(),
  z
    .object({
      ...common,
      kind: z.literal('cheque'),
      receiptId: z.string().uuid(),
      status: z.enum(['cleared', 'bounced']),
    })
    .strict(),
  z.object({ ...common, kind: z.literal('invoice'), orderId: z.string().uuid() }).strict(),
  z
    .object({
      ...common,
      kind: z.literal('returnReview'),
      returnId: z.string().uuid(),
      decision: z.enum(['accepted', 'rejected']),
      note: z.string().trim().min(3).max(500),
      inspection: z
        .object({
          identityMatched: z.boolean(),
          quantityMatched: z.boolean(),
          conditionChecked: z.boolean(),
          received: z
            .array(
              z
                .object({
                  productId: z.string(),
                  quantity: z.number().int().positive().max(100000),
                  observedCode: z.string().trim().max(120).optional(),
                })
                .strict(),
            )
            .min(1)
            .max(100),
        })
        .strict()
        .optional(),
    })
    .strict(),
  z
    .object({
      ...common,
      kind: z.literal('return'),
      verification: z.enum(['sales_record', 'unit_codes']).optional(),
      customerId: z.string().uuid().optional(),
      invoiceId: z.string().uuid(),
      items: z.array(returned).min(1).max(100),
      reason: z.string().min(3).max(500),
      photo: z.string().max(450000),
    })
    .strict(),
  z
    .object({ ...common, kind: z.literal('deposit'), amount: money, note: z.string().min(3).max(500) })
    .strict(),
  z
    .object({
      ...common,
      kind: z.literal('order'),
      customerId: z.string().uuid(),
      source: z.enum(['manual', 'voice']).optional(),
      items: z
        .array(
          z
            .object({
              productId: z.string().uuid(),
              name: z.string().max(200),
              quantity: z.number().int().positive().max(100000),
              unitPrice: money,
            })
            .strict(),
        )
        .min(1)
        .max(100),
    })
    .strict(),
]);
async function initial(tx: Prisma.TransactionClient, companyId: string): Promise<FinanceState> {
  const [company, customers, orders, products] = await Promise.all([
    tx.company.findUniqueOrThrow({ where: { id: companyId } }),
    tx.customer.findMany({ where: { companyId, isActive: true } }),
    tx.salesOrder.findMany({
      where: { companyId },
      include: { invoices: true, items: { include: { product: true } } },
    }),
    tx.product.findMany({ where: { companyId, isActive: true } }),
  ]);
  return {
    version: 1,
    companyId,
    companyName: company.name,
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      price: cents(Number(p.price)),
      sku: p.sku,
      unit: p.unit,
    })),
    customers: customers.map((c) => ({
      id: c.id,
      name: c.shopName,
      phone: c.phone ?? '',
      opening: cents(Number(c.balance)),
    })),
    orders: orders.map((o) => ({
      id: o.id,
      customerId: o.customerId,
      actorId: o.repId,
      date: o.createdAt.toISOString(),
      total: cents(Number(o.total)),
      status: o.status,
      items: o.items.map((i) => ({
        productId: i.productId,
        name: i.product.name,
        sku: i.product.sku,
        unit: i.product.unit,
        quantity: Number(i.quantity),
        unitPrice: cents(Number(i.unitPrice)),
      })),
    })),
    invoices: orders.flatMap((o) =>
      o.invoices.map((i) => ({
        id: i.id,
        orderId: o.id,
        customerId: o.customerId,
        date: i.createdAt.toISOString(),
        total: cents(Number(i.total)),
        items: o.items.map((item) => ({
          productId: item.productId,
          name: item.product.name,
          sku: item.product.sku,
          unit: item.product.unit,
          quantity: Number(item.quantity),
          unitPrice: cents(Number(item.unitPrice)),
        })),
      })),
    ),
    receipts: [],
    returns: [],
    deposits: [],
    accepted: [],
    entries: customers.map((c) => {
      const n = cents(Number(c.balance));
      return {
        id: `opening_${c.id}`,
        customerId: c.id,
        date: new Date().toISOString(),
        kind: 'opening',
        debit: Math.max(n, 0),
        credit: Math.max(-n, 0),
        reference: 'opening',
      };
    }),
  };
}
async function workspace(tx: Prisma.TransactionClient, companyId: string) {
  // Serializes bootstrap, retries and concurrent devices for this tenant only.
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${companyId}, 0))`;
  const existing = await tx.financeWorkspace.findUnique({ where: { companyId } });
  let state = existing ? (existing.state as unknown as FinanceState) : await initial(tx, companyId);
  // Refresh authoritative catalog and pre-existing orders without removing offline orders.
  if (existing) {
    const fresh = await initial(tx, companyId);
    const known = new Set(state.customers.map((c) => c.id));
    state = {
      ...state,
      products: fresh.products,
      customers: [...state.customers, ...fresh.customers.filter((c) => !known.has(c.id))],
      orders: [...state.orders.filter((o) => !fresh.orders.some((n) => n.id === o.id)), ...fresh.orders],
      invoices: [
        ...state.invoices,
        ...fresh.invoices.filter((i) => !state.invoices.some((old) => old.id === i.id)),
      ],
    };
    state.entries.push(...fresh.entries.filter((e) => !known.has(e.customerId)));
    // Preserve explicit balance adjustments made through the existing customer API.
    for (const customer of fresh.customers) {
      if (!known.has(customer.id)) continue;
      const adjustment = customer.opening - balance(state, customer.id);
      if (adjustment)
        state.entries.push({
          id: randomUUID(),
          customerId: customer.id,
          date: new Date().toISOString(),
          kind: 'opening',
          debit: Math.max(adjustment, 0),
          credit: Math.max(-adjustment, 0),
          reference: 'balanceAdjustment',
        });
    }
    state.customers = state.customers.map((c) => {
      const current = fresh.customers.find((n) => n.id === c.id);
      return current ? { ...c, name: current.name, phone: current.phone } : c;
    });
    await tx.financeWorkspace.update({
      where: { companyId },
      data: { state: state as unknown as Prisma.InputJsonValue },
    });
  }
  if (!existing)
    await tx.financeWorkspace.create({
      data: { companyId, state: state as unknown as Prisma.InputJsonValue },
    });
  return state;
}
router.get(
  '/',
  requireAuth,
  requirePermission('finance:read'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const state = await prisma.$transaction((tx) => workspace(tx, req.user!.companyId), { timeout: 15000 });
      res.json({ state, permissions: [...req.user!.permissions] });
    } catch (error) {
      next(error);
    }
  },
);
router.post(
  '/sync',
  requireAuth,
  requirePermission('finance:read'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const op = schema.parse(req.body) as Operation;
      if (op.actorId !== req.user!.id) throw new HttpError(403, 'Operation belongs to a different user');
      assertPermission(
        req.user,
        op.kind === 'returnReview'
          ? 'returns:review'
          : op.kind === 'return' || op.kind === 'returnCheck'
            ? 'returns:create'
            : op.kind === 'cheque'
              ? 'finance:manage'
              : op.kind === 'order'
                ? 'orders:create'
                : 'finance:collect',
      );
      const state = await prisma.$transaction(
        async (tx) => {
          const state = await workspace(tx, req.user!.companyId);
          if (state.accepted.includes(op.id)) {
            const audit = await tx.auditLog.findFirst({
              where: { companyId: req.user!.companyId, entityType: 'finance', entityId: op.id },
            });
            if (!audit || JSON.stringify(audit.payload) !== JSON.stringify(JSON.parse(JSON.stringify(op)))) {
              // PostgreSQL JSONB changes object key order: compare canonical keys below.
              const canonical = (value: unknown): string =>
                JSON.stringify(value, (_k, v) =>
                  v && typeof v === 'object' && !Array.isArray(v)
                    ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
                    : v,
                );
              if (!audit || canonical(audit.payload) !== canonical(op))
                throw new HttpError(409, 'Idempotency key reused with different content');
            }
            return state;
          }
          if (op.kind === 'order')
            for (const item of op.items) {
              const product = state.products.find((p) => p.id === item.productId);
              if (!product || product.price !== item.unitPrice || product.name !== item.name)
                throw new FinanceError('conflict');
            }
          const customerId =
            op.kind === 'receipt' || op.kind === 'order'
              ? op.customerId
              : op.kind === 'invoice'
                ? state.orders.find((o) => o.id === op.orderId)?.customerId
                : op.kind === 'return'
                  ? state.invoices.find((i) => i.id === op.invoiceId)?.customerId
                  : op.kind === 'returnReview' || op.kind === 'returnCheck'
                    ? state.returns.find((r) => r.id === op.returnId)?.customerId
                    : op.kind === 'cheque'
                      ? state.receipts.find((r) => r.id === op.receiptId)?.customerId
                      : undefined;
          if (
            customerId &&
            !(await tx.customer.findFirst({
              where: { id: customerId, companyId: req.user!.companyId, isActive: true },
            }))
          )
            throw new FinanceError('customer');
          if (
            (op.kind === 'return' &&
              (op.verification === 'sales_record' || op.verification === 'unit_codes')) ||
            op.kind === 'returnCheck'
          ) {
            const request =
              op.kind === 'returnCheck' ? state.returns.find((r) => r.id === op.returnId) : undefined;
            const invoiceId = op.kind === 'return' ? op.invoiceId : request?.invoiceId;
            const claimedCustomer = op.kind === 'return' ? op.customerId : request?.customerId;
            if (!invoiceId || !claimedCustomer) throw new FinanceError('saleRecord');
            const persistedSale = await tx.invoice.findFirst({
              where: { id: invoiceId, companyId: req.user!.companyId },
              include: { order: true },
            });
            if (
              !persistedSale ||
              persistedSale.order.companyId !== req.user!.companyId ||
              persistedSale.order.customerId !== claimedCustomer ||
              persistedSale.order.status === 'cancelled'
            )
              throw new FinanceError('saleRecord');
            const snapshot = state.invoices.find((i) => i.id === invoiceId);
            if (
              !snapshot ||
              snapshot.orderId !== persistedSale.orderId ||
              snapshot.total !== cents(Number(persistedSale.total))
            )
              throw new FinanceError('saleRecord');
          }
          const verified =
            op.kind === 'order'
              ? {
                  ...op,
                  items: op.items.map((item) => {
                    const product = state.products.find((p) => p.id === item.productId)!;
                    return { ...item, sku: product.sku, unit: product.unit };
                  }),
                }
              : op;
          const nextState = applyOperation(state, verified, new Date().toISOString());
          if (op.kind === 'invoice') {
            const invoice = nextState.invoices.find((i) => i.id === op.id)!;
            await tx.invoice.create({
              data: {
                id: op.id,
                companyId: req.user!.companyId,
                orderId: invoice.orderId,
                invoiceNumber: `INV-${op.id}`,
                total: (invoice.total / 100).toFixed(2),
              },
            });
          }
          if (op.kind === 'order') {
            const order = nextState.orders.find((o) => o.id === op.id)!;
            await tx.salesOrder.create({
              data: {
                id: op.id,
                companyId: req.user!.companyId,
                customerId: op.customerId,
                repId: req.user!.id,
                orderNumber: `OFF-${op.id}`,
                source: 'manual',
                status: 'pending',
                total: (order.total / 100).toFixed(2),
                items: {
                  create: op.items.map((i) => ({
                    productId: i.productId,
                    quantity: i.quantity,
                    unitPrice: (i.unitPrice / 100).toFixed(2),
                    lineTotal: ((i.unitPrice * i.quantity) / 100).toFixed(2),
                  })),
                },
              },
            });
          }
          // Materialize balances in the existing customer table in this same transaction.
          const affected = new Set(nextState.entries.filter((e) => e.id === op.id).map((e) => e.customerId));
          for (const customerId of affected) {
            const updated = await tx.customer.updateMany({
              where: {
                id: customerId,
                companyId: req.user!.companyId,
                balance: (balance(state, customerId) / 100).toFixed(2),
              },
              data: { balance: (balance(nextState, customerId) / 100).toFixed(2) },
            });
            if (updated.count !== 1) throw new FinanceError('conflict');
          }
          await tx.financeWorkspace.update({
            where: { companyId: req.user!.companyId },
            data: { state: nextState as unknown as Prisma.InputJsonValue, revision: { increment: 1 } },
          });
          await tx.auditLog.create({
            data: {
              companyId: req.user!.companyId,
              userId: req.user!.id,
              entityType: 'finance',
              entityId: op.id,
              action: op.kind,
              payload: op as unknown as Prisma.InputJsonValue,
            },
          });
          return nextState;
        },
        { timeout: 15000 },
      );
      res.json({ state });
    } catch (error) {
      if (error instanceof FinanceError) {
        res.status(409).json({ code: error.code });
        return;
      }
      next(error);
    }
  },
);
export default router;
