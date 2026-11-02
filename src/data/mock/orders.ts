import type { Order, OrderItem } from '@/types';
import { COMPANY } from './users';
import { daysAgo } from './dates';
import { productById } from './products';

type Line = [productId: string, quantity: number];

function order(
  id: string,
  customerId: string,
  createdDaysAgo: number,
  status: Order['status'],
  lines: Line[],
): Order {
  const items: OrderItem[] = lines.map(([productId, quantity]) => ({
    productId,
    quantity,
    unitPrice: productById(productId)?.price ?? 0,
  }));
  return {
    id,
    companyId: COMPANY.id,
    customerId,
    repId: 'u_sales',
    createdAt: daysAgo(createdDaysAgo, 9 + (Number(id.slice(2)) % 6)),
    items,
    total: items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    status,
    source: 'manual',
  };
}

/** o_21…o_25 are today's delivery route (see TODAY_PLANS). */
export const ORDERS: Order[] = [
  order('o_01', 'cu_01', 30, 'delivered', [['p_water', 5], ['p_chips', 2]]),
  order('o_02', 'cu_02', 28, 'delivered', [['p_milk', 6], ['p_rice', 10]]),
  order('o_03', 'cu_07', 26, 'delivered', [['p_water', 20], ['p_juice', 8], ['p_milk', 10]]),
  order('o_04', 'cu_04', 24, 'delivered', [['p_chips', 3], ['p_juice', 2]]),
  order('o_05', 'cu_05', 21, 'delivered', [['p_rice', 6], ['p_milk', 4]]),
  order('o_06', 'cu_09', 20, 'delivered', [['p_water', 8]]),
  order('o_07', 'cu_13', 18, 'delivered', [['p_juice', 6], ['p_chips', 4]]),
  order('o_08', 'cu_02', 15, 'delivered', [['p_water', 10], ['p_juice', 5]]),
  order('o_09', 'cu_10', 14, 'delivered', [['p_milk', 5], ['p_chips', 2]]),
  order('o_10', 'cu_07', 12, 'delivered', [['p_rice', 15], ['p_water', 15]]),
  order('o_11', 'cu_11', 11, 'delivered', [['p_water', 6], ['p_chips', 3]]),
  order('o_12', 'cu_14', 10, 'delivered', [['p_chips', 6]]),
  order('o_13', 'cu_08', 9, 'delivered', [['p_juice', 3], ['p_water', 4]]),
  order('o_14', 'cu_15', 8, 'delivered', [['p_rice', 4], ['p_milk', 2]]),
  order('o_15', 'cu_12', 21, 'cancelled', [['p_water', 3]]),
  order('o_16', 'cu_04', 6, 'delivered', [['p_water', 6]]),
  order('o_17', 'cu_07', 5, 'delivered', [['p_milk', 12], ['p_juice', 6]]),
  order('o_18', 'cu_05', 4, 'delivered', [['p_chips', 4], ['p_water', 6]]),
  order('o_19', 'cu_09', 2, 'pending', [['p_rice', 8]]),
  order('o_20', 'cu_15', 1, 'pending', [['p_water', 10], ['p_chips', 2]]),
  order('o_21', 'cu_11', 1, 'out_for_delivery', [['p_water', 8], ['p_juice', 2]]),
  order('o_22', 'cu_14', 1, 'out_for_delivery', [['p_chips', 5]]),
  order('o_23', 'cu_01', 1, 'out_for_delivery', [['p_water', 3], ['p_chips', 1]]),
  order('o_24', 'cu_10', 1, 'out_for_delivery', [['p_milk', 4], ['p_rice', 5]]),
  order('o_25', 'cu_13', 1, 'out_for_delivery', [['p_juice', 4], ['p_water', 6]]),
];
