import type { Order } from '@/types';
import type { OrderService, ProductService } from '../types';
import { ORDERS } from '@/data/mock/orders';
import { PRODUCTS } from '@/data/mock/products';
import { COMPANY } from '@/data/mock/users';
import { respond } from './delay';

/** In-memory for this run only: new orders are lost on reload, like any mock. */
const orders: Order[] = [...ORDERS];

export const mockOrderService: OrderService = {
  list: (filter) =>
    respond(
      orders
        .filter((o) => !filter?.customerId || o.customerId === filter.customerId)
        .filter((o) => !filter?.repId || o.repId === filter.repId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    ),
  get: (id) => respond(orders.find((o) => o.id === id)),
  create: (input) => {
    const order: Order = {
      id: `o_${String(orders.length + 1).padStart(2, '0')}`,
      companyId: COMPANY.id,
      customerId: input.customerId,
      repId: input.repId,
      createdAt: new Date().toISOString(),
      items: input.items,
      total: input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
      status: 'pending',
      source: input.source,
    };
    orders.push(order);
    return respond(order, 400);
  },
};

export const mockProductService: ProductService = {
  list: () => respond(PRODUCTS),
};
