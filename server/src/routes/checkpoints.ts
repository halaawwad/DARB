import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { requireAuth, requirePermission, requireCompanyAccess, type AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

const nearbySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusM: z.coerce.number().min(10).max(50000).default(5000),
});

router.get('/nearby', requireAuth, requirePermission('checkpoints:read'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const query = nearbySchema.parse(req.query);

    const results: Array<{ id: string; name: string; latitude: number; longitude: number; status: string; distance_m: number }> = await prisma.$queryRawUnsafe(`
      SELECT id, name, "latitude"::float8 AS latitude, "longitude"::float8 AS longitude, status,
             ST_Distance(
               geography(ST_SetSRID(ST_MakePoint("longitude"::float8, "latitude"::float8), 4326)),
               geography(ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326))
             ) AS distance_m
      FROM checkpoints
      WHERE "companyId" = $3::uuid
        AND ST_DWithin(
          geography(ST_SetSRID(ST_MakePoint("longitude"::float8, "latitude"::float8), 4326)),
          geography(ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)),
          $4::float8
        )
      ORDER BY distance_m ASC
      LIMIT 20;
    `, query.lng, query.lat, req.user!.companyId, query.radiusM);

    res.json({ checkpoints: results });
  } catch (error) {
    next(error);
  }
});

router.post('/reports', requireAuth, requirePermission('incidents:create'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const payload = z.object({
      checkpointId: z.string().uuid().optional(),
      incidentType: z.string().min(1),
      description: z.string().min(1),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      severity: z.enum(['low', 'medium', 'high']).default('medium'),
    }).parse(req.body);

    if (payload.checkpointId) {
      const checkpoint = await prisma.checkpoint.findUnique({ where: { id: payload.checkpointId } });
      if (!checkpoint) return res.status(404).json({ error: 'Checkpoint not found' });
      requireCompanyAccess(checkpoint.companyId, req);
    }

    const row = await prisma.roadIncident.create({
      data: {
        companyId: req.user!.companyId,
        checkpointId: payload.checkpointId ?? null,
        incidentType: payload.incidentType,
        description: payload.description,
        latitude: String(payload.latitude),
        longitude: String(payload.longitude),
        severity: payload.severity,
        status: 'open',
      },
    });

    res.status(201).json({ incident: row });
  } catch (error) {
    next(error);
  }
});

export default router;
