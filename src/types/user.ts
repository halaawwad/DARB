export type Role = 'manager' | 'sales_rep' | 'delivery_rep' | 'accountant';

export const ROLES: Role[] = ['manager', 'sales_rep', 'delivery_rep', 'accountant'];

/** A distribution company. Every record carries its `companyId`; data never crosses companies. */
export interface Company {
  id: string;
  name: string;
}

export interface User {
  id: string;
  companyId: string;
  name: string;
  role: Role;
  phone: string;
}
