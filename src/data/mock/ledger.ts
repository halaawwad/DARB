import type { LedgerEntry } from '@/types';
import { CUSTOMERS } from './customers';
import { ORDERS } from './orders';

/**
 * Each delivered order becomes an invoice. Customers who owe nothing paid every
 * invoice two days later; customers who owe left the latest one unpaid. An
 * opening balance line makes each ledger end exactly at the customer's balance.
 */
function ledgerFor(customerId: string, balance: number): LedgerEntry[] {
  const invoices = ORDERS.filter((o) => o.customerId === customerId && o.status === 'delivered').sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );

  const movements: LedgerEntry[] = [];
  invoices.forEach((invoice, index) => {
    movements.push({
      id: `le_${invoice.id}_inv`,
      customerId,
      date: invoice.createdAt,
      description: `فاتورة طلبية ${invoice.id.toUpperCase()}`,
      debit: invoice.total,
      credit: 0,
    });
    const isLatest = index === invoices.length - 1;
    if (balance <= 0 || !isLatest) {
      const paidAt = new Date(Date.parse(invoice.createdAt) + 2 * 86_400_000).toISOString();
      movements.push({
        id: `le_${invoice.id}_pay`,
        customerId,
        date: paidAt,
        description: 'دفعة نقدية',
        debit: 0,
        credit: invoice.total,
      });
    }
  });

  const net = movements.reduce((sum, entry) => sum + entry.debit - entry.credit, 0);
  const opening = balance - net;
  const firstDate = movements[0]?.date ?? new Date(Date.now() - 40 * 86_400_000).toISOString();
  const openingEntry: LedgerEntry = {
    id: `le_${customerId}_open`,
    customerId,
    date: new Date(Date.parse(firstDate) - 86_400_000).toISOString(),
    description: 'رصيد افتتاحي',
    debit: Math.max(opening, 0),
    credit: Math.max(-opening, 0),
  };

  return [openingEntry, ...movements].sort((a, b) => a.date.localeCompare(b.date));
}

export const LEDGER: LedgerEntry[] = CUSTOMERS.flatMap((customer) => ledgerFor(customer.id, customer.balance));
