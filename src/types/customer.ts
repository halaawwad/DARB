import type { GeoPoint, IsoDate } from './common';

/** `owes` = outstanding balance; `stale` = not visited recently. */
export type CustomerStatus = 'active' | 'owes' | 'stale';

export interface Customer {
  id: string;
  companyId: string;
  name: string;
  /** What people actually call the owner ("أبو أحمد") — used by the voice parser. */
  nickname?: string;
  shopName: string;
  phone: string;
  area: string;
  address: string;
  location: GeoPoint;
  /** Amount the customer owes the company, in ₪. Zero or negative = nothing owed. */
  balance: number;
  lastVisit: IsoDate;
  status: CustomerStatus;
  assignedRepId: string;
  preferredVisitTime: string;
  notes?: string;
}

export interface LedgerEntry {
  id: string;
  customerId: string;
  date: IsoDate;
  description: string;
  /** Adds to what the customer owes (an invoice). */
  debit: number;
  /** Reduces what the customer owes (a payment). */
  credit: number;
}

/** Mock output of the future AI analysis for a customer. */
export interface CustomerInsight {
  customerId: string;
  preferences: string[];
  /** 0–100. */
  satisfactionScore: number;
  satisfactionNote: string;
}
