import { PrismaClient } from '@prisma/client';
import { provisionCompanyPermissions } from '../src/features/auth/permissions.js';
import { z } from 'zod';

const flag = process.argv.indexOf('--company-id');
const companyId = flag >= 0 ? process.argv[flag + 1] : undefined;
if (!z.string().uuid().safeParse(companyId).success) throw new Error('Usage: npm run permissions:provision -- --company-id <UUID>');
const db = new PrismaClient();
try {
  await provisionCompanyPermissions(db, companyId!);
  console.log(`Provisioned reviewed baseline roles and permissions for ${companyId}`);
} finally { await db.$disconnect(); }
