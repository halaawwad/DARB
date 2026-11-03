import { Router } from 'express';
import { requireAuth, requirePermission, type AuthenticatedRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';

const router = Router();

router.get('/current', requireAuth, requirePermission('company:read'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.user!.companyId },
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.status(200).json({ company });
  } catch (error) {
    next(error);
  }
});

export default router;
