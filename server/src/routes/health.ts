import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'darb-server', timestamp: new Date().toISOString() });
});

router.get('/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    res.status(200).json({ ready: true, database: 'ok', redis: 'ok' });
  } catch (error) {
    res.status(503).json({ ready: false, error: (error as Error).message });
  }
});

export default router;
