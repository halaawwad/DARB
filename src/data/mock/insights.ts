import type { CustomerInsight } from '@/types';
import { CUSTOMERS } from './customers';
import { ORDERS } from './orders';
import { productById } from './products';

/** Stand-in for the AI analysis: derived from each customer's mock orders. */
function insightFor(customerId: string): CustomerInsight {
  const customer = CUSTOMERS.find((c) => c.id === customerId)!;
  const quantities = new Map<string, number>();
  ORDERS.filter((o) => o.customerId === customerId).forEach((o) =>
    o.items.forEach((item) => quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity)),
  );
  const favourite = [...quantities.entries()].sort((a, b) => b[1] - a[1])[0];
  const product = favourite ? productById(favourite[0]) : undefined;

  const preferences = [
    product ? `يفضّل ${product.brand} (${product.name})` : 'لا يوجد صنف مفضّل واضح بعد',
    `يطلب عادةً ${customer.preferredVisitTime}`,
    customer.status === 'owes' ? 'يدفع على دفعات — يُفضّل التذكير قبل الطلبية التالية' : 'يدفع غالباً عند التسليم',
  ];

  const byStatus = {
    active: { score: 88, note: 'زبون منتظم وراضٍ عن التوصيل والأسعار.' },
    owes: { score: 66, note: 'رضا متوسط؛ اشتكى من تأخر توصيل سابق.' },
    stale: { score: 54, note: 'لم يُزر منذ فترة — احتمال انتقاله لمورّد آخر.' },
  }[customer.status];

  return { customerId, preferences, satisfactionScore: byStatus.score, satisfactionNote: byStatus.note };
}

export const INSIGHTS: CustomerInsight[] = CUSTOMERS.map((customer) => insightFor(customer.id));
