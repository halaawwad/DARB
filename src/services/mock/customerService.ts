import type { CustomerService } from '../types';
import { CUSTOMERS } from '@/data/mock/customers';
import { INSIGHTS } from '@/data/mock/insights';
import { LEDGER } from '@/data/mock/ledger';
import { financeRepository } from '@/features/finance/repository';
import { balance } from '@/features/finance/domain';
import { ar } from '@/i18n';
import { respond } from './delay';
async function current() {
  await financeRepository.init();
  const f = financeRepository.getSnapshot();
  return f.mode === 'demo' ? f.state : undefined;
}
export const mockCustomerService: CustomerService = {
  list: async () => {
    const s = await current();
    return respond(CUSTOMERS.map((c) => ({ ...c, balance: s ? balance(s, c.id) / 100 : c.balance })));
  },
  get: async (id) => {
    const s = await current();
    const c = CUSTOMERS.find((c) => c.id === id);
    return respond(c ? { ...c, balance: s ? balance(s, c.id) / 100 : c.balance } : undefined);
  },
  ledger: async (customerId) => {
    const s = await current();
    return respond(
      s
        ? s.entries
            .filter((e) => e.customerId === customerId)
            .slice()
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((e) => ({
              id: e.id,
              customerId: e.customerId,
              date: e.date,
              description:
                e.kind === 'opening'
                  ? e.reference
                  : `${ar[`finance.${e.kind}`]} ${e.reference.slice(0, 8).toUpperCase()}`,
              debit: e.debit / 100,
              credit: e.credit / 100,
            }))
        : LEDGER.filter((e) => e.customerId === customerId),
    );
  },
  insight: (customerId) => respond(INSIGHTS.find((i) => i.customerId === customerId)),
};
