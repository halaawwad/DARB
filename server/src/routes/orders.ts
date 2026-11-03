import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { Server } from 'socket.io';
import { emitTenantEvent } from '../lib/socket.js';
import { HttpError } from '../lib/errors.js';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { requireAuth, requirePermission, type AuthenticatedRequest, requireCompanyAccess } from '../middleware/auth.js';

const router = Router();

const itemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().positive(),
  unitPrice: z.union([z.string().regex(/^\d+(\.\d{1,2})?$/), z.number().finite().nonnegative().multipleOf(0.01)]),
});

const orderSchema = z.object({
  customerId: z.string().uuid(),
  items: z.array(itemSchema).min(1),
  notes: z.string().optional(),
});

router.get('/', requireAuth, requirePermission('orders:read'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const orders = await prisma.salesOrder.findMany({
      where: { companyId: req.user!.companyId },
      include: { items: true, customer: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ orders });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireAuth, requirePermission('orders:read'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const order = await prisma.salesOrder.findUnique({
      where: { id: z.string().uuid().parse(req.params.id) },
      include: { items: true, customer: true },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    requireCompanyAccess(order.companyId, req);
    res.json({ order });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, requirePermission('orders:create'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = orderSchema.parse(req.body);

    const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    requireCompanyAccess(customer.companyId, req);
    if (!customer.isActive) throw new HttpError(400, 'Customer is inactive');

    const orderNumber = `ORD-${randomUUID()}`;
    const itemPayload = await Promise.all(input.items.map(async (item) => {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product || product.companyId !== req.user!.companyId || !product.isActive) throw new HttpError(400, 'Invalid product');

      const unitPrice = String(item.unitPrice);
      const quantity = String(item.quantity);
      const lineTotal = new Prisma.Decimal(unitPrice).mul(quantity).toFixed(2);
      return { productId: item.productId, quantity, unitPrice, lineTotal };
    }));

    const totalAmount = itemPayload.reduce((sum, item) => sum.add(item.lineTotal), new Prisma.Decimal(0)).toFixed(2);

    const order = await prisma.salesOrder.create({
      data: {
        companyId: req.user!.companyId,
        customerId: input.customerId,
        repId: req.user!.id,
        orderNumber,
        status: 'pending',
        source: 'manual',
        total: totalAmount,
        notes: input.notes ?? null,
        items: {
          create: itemPayload.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
          })),
        },
      },
      include: { items: true },
    });

    const io = req.app.locals.io as Server | undefined;
    if (io) await emitTenantEvent(io, req.user!.companyId, 'order-created', { companyId: req.user!.companyId, orderId: order.id });

    res.status(201).json({ order });
  } catch (error) {
    next(error);
  }
});

export default router;
