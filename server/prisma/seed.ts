import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { provisionCompanyPermissions } from '../src/features/auth/permissions.js';

const prisma = new PrismaClient();

async function main() {
  const seedPassword = process.env.DARB_SEED_PASSWORD;
  if (!seedPassword || seedPassword.length < 16) throw new Error('Set DARB_SEED_PASSWORD to a private development password of at least 16 characters before seeding');
  const companies = [
    { id: '11111111-1111-4111-8111-111111111111', slug: 'najma', name: 'Najma Distribution', timezone: 'Asia/Gaza' },
    { id: '22222222-2222-4222-8222-222222222222', slug: 'rose', name: 'Rose Logistics', timezone: 'Asia/Gaza' },
  ];

  for (const company of companies) {
    await prisma.company.upsert({
      where: { id: company.id },
      update: {},
      create: {
        ...company,
        roles: {
          create: [
            { name: 'admin' },
            { name: 'sales_rep' },
            { name: 'delivery_rep' },
            { name: 'accountant' },
          ],
        },
      },
    });

    await provisionCompanyPermissions(prisma, company.id);
    const roleRecords = await prisma.role.findMany({ where: { companyId: company.id } });
    const roleMap = Object.fromEntries(
      roleRecords.map((role: { name: string; id: string }) => [role.name, role.id]),
    ) as Record<string, string>;

    const users = [
      { email: company.slug === 'najma' ? 'admin@najma.example' : 'admin@rose.example', firstName: company.slug === 'najma' ? 'Sami' : 'Lina', lastName: company.slug === 'najma' ? 'Khatib' : 'Haddad', role: 'admin' },
      { email: company.slug === 'najma' ? 'sales@najma.example' : 'sales@rose.example', firstName: 'Mahmoud', lastName: 'Auda', role: 'sales_rep' },
      { email: company.slug === 'najma' ? 'delivery@najma.example' : 'delivery@rose.example', firstName: 'Rami', lastName: 'Nassar', role: 'delivery_rep' },
      { email: company.slug === 'najma' ? 'accountant@najma.example' : 'accountant@rose.example', firstName: 'Nour', lastName: 'Rahman', role: 'accountant' },
    ];

    for (const user of users) {
      const created = await prisma.user.upsert({
        where: { companyId_email: { companyId: company.id, email: user.email } },
        update: {},
        create: {
          companyId: company.id,
          email: user.email,
          passwordHash: await bcrypt.hash(seedPassword, 10),
          firstName: user.firstName,
          lastName: user.lastName,
          phone: '0599000000',
          userRoles: {
            create: [{ roleId: roleMap[user.role] }],
          },
        },
      });

      const roleId = roleMap[user.role];
      if (!roleId) continue;

      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: created.id, roleId } },
        update: {},
        create: { userId: created.id, roleId },
      });
    }

    const customers = [
      { name: 'Ahmad Yusuf', shopName: 'Abo Ahmad Mini Market', phone: '0599210331', area: 'Ramallah', address: 'Street 4', latitude: '31.8995', longitude: '35.2075' },
      { name: 'Khalid Mahmoud', shopName: 'Al Amal Store', phone: '0598442107', area: 'Al-Masiyoun', address: 'Main Street', latitude: '31.9152', longitude: '35.1958' },
    ];

    for (const customer of customers) {
      const created = await prisma.customer.upsert({
        where: {
          id: company.slug === 'najma' ? '33333333-3333-4333-8333-333333333333' : '44444444-4444-4444-8444-444444444444',
        },
        update: {},
        create: {
          id: company.slug === 'najma' ? '33333333-3333-4333-8333-333333333333' : '44444444-4444-4444-8444-444444444444',
          companyId: company.id,
          name: customer.name,
          shopName: customer.shopName,
          phone: customer.phone,
          area: customer.area,
          address: customer.address,
          latitude: customer.latitude,
          longitude: customer.longitude,
          preferredVisitTime: 'Tuesday morning',
          balance: '0',
        },
      });

      await prisma.customerAssignment.upsert({
        where: { customerId_salespersonId: { customerId: created.id, salespersonId: (await prisma.user.findFirst({ where: { companyId: company.id, userRoles: { some: { role: { name: 'sales_rep' } } } } }))!.id } },
        update: {},
        create: {
          customerId: created.id,
          salespersonId: (await prisma.user.findFirst({ where: { companyId: company.id, userRoles: { some: { role: { name: 'sales_rep' } } } } }))!.id,
          companyId: company.id,
        },
      });
    }

    const product = await prisma.product.upsert({
      where: { companyId_sku: { companyId: company.id, sku: 'WATER-1L' } },
      update: {},
      create: {
        companyId: company.id,
        name: 'Water 1L',
        sku: 'WATER-1L',
        unit: 'bottle',
        price: '12.50',
        description: 'Imported water',
      },
    });

    await prisma.inventory.upsert({
      where: { productId_warehouse: { productId: product.id, warehouse: 'main' } },
      update: {},
      create: {
        productId: product.id,
        warehouse: 'main',
        quantity: '120',
      },
    });

    await prisma.checkpoint.upsert({
      where: { id: company.slug === 'najma' ? '55555555-5555-4555-8555-555555555555' : '66666666-6666-4666-8666-666666666666' },
      update: {},
      create: {
        id: company.slug === 'najma' ? '55555555-5555-4555-8555-555555555555' : '66666666-6666-4666-8666-666666666666',
        companyId: company.id,
        name: `${company.name} checkpoint`,
        latitude: '31.90',
        longitude: '35.21',
        status: 'open',
      },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    return prisma.$disconnect().then(() => process.exit(1));
  });
