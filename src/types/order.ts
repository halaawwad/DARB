import type { IsoDate } from './common';

export interface Product {
  id: string;
  companyId: string;
  name: string;
  brand: string;
  /** Selling unit, e.g. "كرتونة". */
  unit: string;
  /** Price per unit in ₪. */
  price: number;
  /** Spoken forms the voice parser recognises ("مي", "مية", "ماء"). */
  aliases: string[];
}

export interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export type OrderStatus = 'pending' | 'out_for_delivery' | 'delivered' | 'cancelled';

export interface Order {
  id: string;
  companyId: string;
  customerId: string;
  /** Sales rep who took the order. */
  repId: string;
  createdAt: IsoDate;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  source: 'manual' | 'voice';
}

export interface CreateOrderInput {
  customerId: string;
  repId: string;
  items: OrderItem[];
  source: Order['source'];
}
