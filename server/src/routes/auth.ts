import { Router } from 'express';
import { z } from 'zod';
import { login } from '../features/auth/authService.js';
import prisma from '../lib/prisma.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  companySlug: z.string().min(1).optional(),
});

router.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const result = await login(body.email, body.password, body.companySlug);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { company: true, userRoles: { include: { role: true } } },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        companyId: user.companyId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: req.user!.role,
      },
      company: {
        id: user.company.id,
        name: user.company.name,
        slug: user.company.slug,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
