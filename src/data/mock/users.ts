import type { Company, Role, TodayPlan, User } from '@/types';

export const COMPANY: Company = { id: 'co_najma', name: 'شركة النجمة للتوزيع' };

export const USERS: User[] = [
  { id: 'u_warehouse', companyId: COMPANY.id, name: 'مسؤول المستودع', role: 'warehouse_staff', phone: '' },
  { id: 'u_manager', companyId: COMPANY.id, name: 'سامي الخطيب', role: 'manager', phone: '0599 120 450' },
  { id: 'u_sales', companyId: COMPANY.id, name: 'محمود عودة', role: 'sales_rep', phone: '0598 334 210' },
  { id: 'u_delivery', companyId: COMPANY.id, name: 'رامي نصار', role: 'delivery_rep', phone: '0597 551 902' },
  { id: 'u_accountant', companyId: COMPANY.id, name: 'لينا حداد', role: 'accountant', phone: '0599 778 013' },
];

/** The demo signs in as the first user with the chosen role. */
export const userForRole = (role: Role): User => USERS.find((user) => user.role === role)!;

/** Route order matters: stops are numbered and joined by the map polyline in this order. */
export const TODAY_PLANS: TodayPlan[] = [
  {
    userId: 'u_sales',
    kind: 'visits',
    stops: [
      { sequence: 1, customerId: 'cu_03' },
      { sequence: 2, customerId: 'cu_02' },
      { sequence: 3, customerId: 'cu_08' },
      { sequence: 4, customerId: 'cu_09' },
      { sequence: 5, customerId: 'cu_07' },
      { sequence: 6, customerId: 'cu_06' },
    ],
  },
  {
    userId: 'u_delivery',
    kind: 'deliveries',
    stops: [
      { sequence: 1, customerId: 'cu_11', orderId: 'o_21' },
      { sequence: 2, customerId: 'cu_14', orderId: 'o_22' },
      { sequence: 3, customerId: 'cu_01', orderId: 'o_23' },
      { sequence: 4, customerId: 'cu_10', orderId: 'o_24' },
      { sequence: 5, customerId: 'cu_13', orderId: 'o_25' },
    ],
  },
];
