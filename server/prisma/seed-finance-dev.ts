import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { provisionCompanyPermissions } from '../src/features/auth/permissions.js';
const db = new PrismaClient();
const companyId = 'da4b1000-0000-4000-8000-000000000001';
const userId = 'da4b1000-0000-4000-8000-000000000002';
const customerId = 'da4b1000-0000-4000-8000-000000000003';
const productId = 'da4b1000-0000-4000-8000-000000000004';
const orderId = 'da4b1000-0000-4000-8000-000000000005';
async function main() {
  if (process.env.NODE_ENV !== 'development' || process.env.DARB_FINANCE_SEED !== '1')
    throw new Error('Development seed requires explicit DARB_FINANCE_SEED=1');
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (url.hostname !== 'postgres' || url.pathname !== '/darb')
    throw new Error('Only the isolated DARB Docker database is supported');
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
    if (input.length > 4096) throw new Error('Seed input too large');
  }
  const { password } = JSON.parse(input);
  if (typeof password !== 'string' || password.length < 16 || password.length > 64)
    throw new Error('Private password input required');
  const company = await db.company.findFirst({
    where: { OR: [{ id: companyId }, { slug: 'noor-finance-dev' }] },
  });
  if (company && (company.id !== companyId || company.slug !== 'noor-finance-dev'))
    throw new Error('Reserved fictional company collision');
  const user = await db.user.findUnique({ where: { id: userId } });
  if (
    user &&
    (user.companyId !== companyId ||
      user.email !== 'noor@darb-dev.example' ||
      !(await bcrypt.compare(password, user.passwordHash)))
  )
    throw new Error('Reserved fictional account mismatch; no password was changed');
  await db.company.upsert({
    where: { id: companyId },
    create: { id: companyId, slug: 'noor-finance-dev', name: 'شركة نور التجريبية' },
    update: {},
  });
  await provisionCompanyPermissions(db, companyId);
  const role = await db.role.findUniqueOrThrow({ where: { companyId_name: { companyId, name: 'manager' } } });
  await db.user.upsert({
    where: { id: userId },
    create: {
      id: userId,
      companyId,
      email: 'noor@darb-dev.example',
      firstName: 'نور',
      lastName: 'تجربة المالية',
      passwordHash: await bcrypt.hash(password, 10),
      userRoles: { create: { roleId: role.id } },
    },
    update: {},
  });
  const warehouseId = 'da4b1000-0000-4000-8000-000000000006';
  const warehouseEmail = 'warehouse@darb-dev.example';
  const warehouse = await db.user.findUnique({ where: { id: warehouseId } });
  const byEmail = await db.user.findUnique({
    where: { companyId_email: { companyId, email: warehouseEmail } },
  });
  if (
    (warehouse &&
      (warehouse.companyId !== companyId ||
        warehouse.email !== warehouseEmail ||
        !(await bcrypt.compare(password, warehouse.passwordHash)))) ||
    (byEmail && byEmail.id !== warehouseId)
  )
    throw new Error('Reserved fictional warehouse account collision; no data was changed');
  const warehouseRole = await db.role.findUniqueOrThrow({
    where: { companyId_name: { companyId, name: 'warehouse_staff' } },
  });
  await db.user.upsert({
    where: { id: warehouseId },
    create: {
      id: warehouseId,
      companyId,
      email: warehouseEmail,
      firstName: 'مسؤول',
      lastName: 'المستودع التجريبي',
      passwordHash: await bcrypt.hash(password, 10),
      userRoles: { create: { roleId: warehouseRole.id } },
    },
    update: {},
  });
  for (const [model, id] of [
    ['customer', customerId],
    ['product', productId],
    ['salesOrder', orderId],
  ] as const) {
    const record = await (db[model] as any).findUnique({ where: { id } });
    if (record && record.companyId !== companyId) throw new Error('Reserved fictional record collision');
  }
  await db.customer.upsert({
    where: { id: customerId },
    create: {
      id: customerId,
      companyId,
      name: 'زبون تجريبي',
      shopName: 'بقالة التجربة',
      phone: '',
      latitude: 31.9,
      longitude: 35.2,
      balance: 100,
    },
    update: {},
  });
  await db.product.upsert({
    where: { id: productId },
    create: {
      id: productId,
      companyId,
      name: 'مياه — كرتونة تجريبية',
      sku: 'NOOR-DEV-WATER',
      unit: 'كرتونة',
      price: 12.5,
    },
    update: {},
  });
  await db.salesOrder.upsert({
    where: { id: orderId },
    create: {
      id: orderId,
      companyId,
      customerId,
      repId: userId,
      orderNumber: 'NOOR-DEV-001',
      status: 'pending',
      total: 62.5,
      items: { create: { productId, quantity: 5, unitPrice: 12.5, lineTotal: 62.5 } },
    },
    update: {},
  });
  console.log(
    'Fictional finance company is ready. No existing passwords, balances or business records were changed.',
  );
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
