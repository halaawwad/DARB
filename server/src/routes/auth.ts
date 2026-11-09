import { Router } from 'express';
import { z } from 'zod';
import { login, registerCompany } from '../features/auth/authService.js';
import prisma from '../lib/prisma.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  companySlug: z.string().min(1).optional(),
});

const registerSchema = z.object({
  companyName: z.string().trim().min(2).max(100),
  companySlug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, digits and hyphens').min(3).max(40),
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
  phone: z.string().trim().max(30).optional(),
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
     fullName: `${user.firstName} ${user.lastName}`,
     phone: user.phone,
     role: req.user!.role,
   },
   company: {
     id: user.company.id,
     name: user.company.name,
     slug: user.company.slug,
   },
   permissions: [...req.user!.permissions].sort(),
 });
  } catch (error) {
    next(error);
  }
});

router.post('/register', async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const result = await registerCompany(body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
