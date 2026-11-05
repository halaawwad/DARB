import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { requireAuth, requirePermission, assertPermission, type AuthenticatedRequest, requireCompanyAccess } from '../middleware/auth.js';

const router = Router();

const productSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  unit: z.string().min(1),
  price: z.string().or(z.number()),
  description: z.string().optional(),
});

router.get('/', requireAuth, requirePermission('products:read'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { companyId: req.user!.companyId, isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json({ products });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireAuth, requirePermission('products:read'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: z.string().uuid().parse(req.params.id) } });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    requireCompanyAccess(product.companyId, req);
    res.json({ product });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, requirePermission('products:write'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = productSchema.parse(req.body);
    const product = await prisma.product.create({
      data: {
        companyId: req.user!.companyId,
        name: input.name,
        sku: input.sku,
        unit: input.unit,
        price: String(input.price),
        description: input.description ?? null,
      },
    });

    res.status(201).json({ product });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireAuth, requirePermission('products:write'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: z.string().uuid().parse(req.params.id) } });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    requireCompanyAccess(product.companyId, req);

    const input = productSchema.partial().parse(req.body);
    const updated = await prisma.product.update({
      where: { id: product.id },
      data: {
        name: input.name,
        sku: input.sku,
        unit: input.unit,
        price: input.price !== undefined ? String(input.price) : undefined,
        description: input.description ?? undefined,
      },
    });

    res.json({ product: updated });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAuth, requirePermission('products:delete'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: z.string().uuid().parse(req.params.id) } });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    requireCompanyAccess(product.companyId, req);

    await prisma.product.update({
      where: { id: product.id },
      data: { isActive: false },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
