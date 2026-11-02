import type { CustomerService } from '../types';
import { CUSTOMERS } from '@/data/mock/customers';
import { INSIGHTS } from '@/data/mock/insights';
import { LEDGER } from '@/data/mock/ledger';
import { respond } from './delay';

export const mockCustomerService: CustomerService = {
  list: () => respond(CUSTOMERS),
  get: (id) => respond(CUSTOMERS.find((customer) => customer.id === id)),
  ledger: (customerId) => respond(LEDGER.filter((entry) => entry.customerId === customerId)),
  insight: (customerId) => respond(INSIGHTS.find((insight) => insight.customerId === customerId)),
};
