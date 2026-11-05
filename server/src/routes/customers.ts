import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { requireAuth, requirePermission, assertPermission, type AuthenticatedRequest, requireCompanyAccess } from '../middleware/auth.js';

const router = Router();

const customerSchema = z.object({
  name: z.string().min(1),
  shopName: z.string().min(1),
  phone: z.string().optional(),
  area: z.string().optional(),
  address: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  preferredVisitTime: z.string().optional(),
  balance: z.string().or(z.number()).optional(),
});

router.get('/', requireAuth, requirePermission('customers:read'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const customers = await prisma.customer.findMany({
      where: { companyId: req.user!.companyId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ customers });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireAuth, requirePermission('customers:read'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const customer = await prisma.customer.findUnique({ where: { id: z.string().uuid().parse(req.params.id) } });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    requireCompanyAccess(customer.companyId, req);
    res.json({ customer });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, requirePermission('customers:write'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = customerSchema.parse(req.body);
    if (input.balance !== undefined) assertPermission(req.user, 'customers:balance');
    const customer = await prisma.customer.create({
      data: {
        companyId: req.user!.companyId,
        name: input.name,
        shopName: input.shopName,
        phone: input.phone ?? null,
        area: input.area ?? null,
        address: input.address ?? null,
        latitude: String(input.latitude),
        longitude: String(input.longitude),
        preferredVisitTime: input.preferredVisitTime ?? null,
        balance: input.balance ? String(input.balance) : '0',
      },
    });

    res.status(201).json({ customer });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireAuth, requirePermission('customers:write'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const customer = await prisma.customer.findUnique({ where: { id: z.string().uuid().parse(req.params.id) } });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    requireCompanyAccess(customer.companyId, req);

    const input = customerSchema.partial().parse(req.body);
    if (input.balance !== undefined) assertPermission(req.user, 'customers:balance');
    const updated = await prisma.customer.update({
      where: { id: customer.id },
      data: {
        name: input.name,
        shopName: input.shopName,
        phone: input.phone ?? undefined,
        area: input.area ?? undefined,
        address: input.address ?? undefined,
        latitude: input.latitude !== undefined ? String(input.latitude) : undefined,
        longitude: input.longitude !== undefined ? String(input.longitude) : undefined,
        preferredVisitTime: input.preferredVisitTime ?? undefined,
        balance: input.balance !== undefined ? String(input.balance) : undefined,
      },
    });

    res.json({ customer: updated });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAuth, requirePermission('customers:delete'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const customer = await prisma.customer.findUnique({ where: { id: z.string().uuid().parse(req.params.id) } });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    requireCompanyAccess(customer.companyId, req);

    await prisma.customer.update({
      where: { id: customer.id },
      data: { isActive: false },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
