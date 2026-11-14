import * as Crypto from 'expo-crypto';
import type { Order } from '@/types';
import type { OrderService, ProductService } from '../types';
import { ORDERS } from '@/data/mock/orders';
import { PRODUCTS } from '@/data/mock/products';
import { COMPANY } from '@/data/mock/users';
import { ar } from '@/i18n';
import { financeRepository } from '@/features/finance/repository';
import { cents, type FinanceOrder } from '@/features/finance/domain';
import { respond } from './delay';
const mapped = (o: FinanceOrder): Order => ({
  id: o.id,
  companyId: COMPANY.id,
  customerId: o.customerId,
  repId: o.actorId,
  createdAt: o.date,
  total: o.total / 100,
  status: o.status as Order['status'],
  source: o.source ?? 'manual',
  items: o.items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice / 100 })),
});
async function current() {
  await financeRepository.init();
  const f = financeRepository.getSnapshot();
  return f.mode === 'demo' && f.state ? f.state.orders.map(mapped) : ORDERS;
}
export const mockOrderService: OrderService = {
  list: async (filter) =>
    respond(
      (await current())
        .filter((o) => !filter?.customerId || o.customerId === filter.customerId)
        .filter((o) => !filter?.repId || o.repId === filter.repId)
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    ),
  get: async (id) => respond((await current()).find((o) => o.id === id)),
  create: async (input) => {
    await financeRepository.init();
    // Other app modules still use mock IDs; never push those into a live tenant.
    if (financeRepository.getSnapshot().mode !== 'demo') throw new Error(ar['finance.error.scope']);
    const op = {
      id: Crypto.randomUUID(),
      actorId: input.repId,
      date: new Date().toISOString(),
      kind: 'order' as const,
      customerId: input.customerId,
      source: input.source,
      items: input.items.map((i) => ({
        ...i,
        unitPrice: cents(i.unitPrice),
        name: PRODUCTS.find((p) => p.id === i.productId)?.name ?? i.productId,
      })),
    };
    await financeRepository.submit(op);
    return mapped(financeRepository.getSnapshot().state!.orders.find((o) => o.id === op.id)!);
  },
};
export const mockProductService: ProductService = { list: () => respond(PRODUCTS) };
