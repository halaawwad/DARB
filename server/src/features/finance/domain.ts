// Platform-independent accounting rules, shared by the app and API.
export type Method = 'cash' | 'digital' | 'cheque';
export interface FinanceCustomer {
  id: string;
  name: string;
  phone: string;
  opening: number;
}
export interface FinanceItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  /** Trusted catalog snapshot; absent on older invoices. Not a fabricated barcode. */
  unitCodes?: string[];
  sku?: string;
  unit?: string;
}
export interface FinanceOrder {
  id: string;
  customerId: string;
  actorId: string;
  date: string;
  items: FinanceItem[];
  total: number;
  status: string;
  source?: 'voice' | 'manual';
}
export interface FinanceInvoice {
  id: string;
  orderId: string;
  customerId: string;
  date: string;
  total: number;
  items: FinanceItem[];
}
export interface Receipt {
  id: string;
  customerId: string;
  actorId: string;
  date: string;
  amount: number;
  method: Method;
  note: string;
  cheque?: { number: string; bank: string; due: string };
  status: 'pending' | 'cleared' | 'bounced';
}
export interface CreditReturn {
  id: string;
  invoiceId: string;
  customerId: string;
  date: string;
  items: { productId: string; quantity: number; unitCodes?: string[] }[];
  amount: number;
  reason: string;
  photo: string;
  /** Missing status means a legacy return already credited before inspection was introduced. */
  status?: 'pending' | 'accepted' | 'rejected';
  requestedBy?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewOperationId?: string;
  reviewNote?: string;
  inspection?: ReturnInspection;
  /** A match against sale records is deliberately NOT physical item provenance. */
  salesCheck?: SaleRecordCheck;
}
export interface SaleRecordCheck {
  source: 'sales_record' | 'unit_codes';
  invoiceId: string;
  customerId: string;
  checkedAt: string;
  physicalIdentityVerified: false;
  unitIdentityVerified?: boolean;
  items: {
    productId: string;
    quantity: number;
    unitPrice: number;
    soldQuantity: number;
    availableQuantity: number;
  }[];
}
export interface ReturnInspection {
  identityMatched: boolean;
  quantityMatched: boolean;
  conditionChecked: boolean;
  received: { productId: string; quantity: number; observedCode?: string }[];
}
export const returnStatus = (r: CreditReturn): 'pending' | 'accepted' | 'rejected' => r.status ?? 'accepted';
export interface FinanceEntry {
  id: string;
  customerId: string;
  date: string;
  kind: 'opening' | 'invoice' | 'receipt' | 'return';
  debit: number;
  credit: number;
  reference: string;
}
export interface FinanceState {
  version: 1;
  companyId: string;
  companyName: string;
  products: { id: string; name: string; price: number; sku?: string; unit?: string }[];
  customers: FinanceCustomer[];
  orders: FinanceOrder[];
  invoices: FinanceInvoice[];
  receipts: Receipt[];
  returns: CreditReturn[];
  entries: FinanceEntry[];
  deposits: { id: string; actorId: string; amount: number; date: string; note: string }[];
  accepted: string[];
}
export type Operation = { id: string; actorId: string; date: string } & (
  | {
      kind: 'receipt';
      customerId: string;
      amount: number;
      method: Method;
      note: string;
      cheque?: Receipt['cheque'];
    }
  | { kind: 'cheque'; receiptId: string; status: 'cleared' | 'bounced' }
  | { kind: 'invoice'; orderId: string }
  | {
      kind: 'return';
      invoiceId: string;
      items: CreditReturn['items'];
      reason: string;
      photo: string;
      verification?: 'sales_record' | 'unit_codes';
      customerId?: string;
    }
  | {
      kind: 'returnReview';
      returnId: string;
      decision: 'accepted' | 'rejected';
      note: string;
      inspection?: ReturnInspection;
    }
  | { kind: 'returnCheck'; returnId: string }
  | { kind: 'deposit'; amount: number; note: string }
  | { kind: 'order'; customerId: string; items: FinanceItem[]; source?: 'voice' | 'manual' }
);
export class FinanceError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
const ensure = (ok: unknown, code: string): void => {
  if (!ok) throw new FinanceError(code);
};
export const cents = (value: number) => Math.round(value * 100);
export function parseAmount(text: string): number {
  const normalized = text
    .trim()
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace('٫', '.');
  ensure(/^\d+(\.\d{1,2})?$/.test(normalized), 'amount');
  const amount = Math.round(Number(normalized) * 100);
  ensure(Number.isSafeInteger(amount) && amount > 0 && amount <= 100_000_000, 'amount');
  return amount;
}
export const balance = (s: FinanceState, customerId: string) =>
  s.entries.filter((e) => e.customerId === customerId).reduce((n, e) => n + e.debit - e.credit, 0);
export const wallet = (s: FinanceState, actorId: string, method: 'cash' | 'digital' = 'cash') =>
  s.receipts.filter((r) => r.actorId === actorId && r.method === method).reduce((n, r) => n + r.amount, 0) -
  (method === 'cash' ? s.deposits.filter((d) => d.actorId === actorId).reduce((n, d) => n + d.amount, 0) : 0);
export function remaining(s: FinanceState, invoiceId: string, productId: string) {
  const sold =
    s.invoices.find((i) => i.id === invoiceId)?.items.find((i) => i.productId === productId)?.quantity ?? 0;
  return (
    sold -
    s.returns
      .filter((r) => r.invoiceId === invoiceId && returnStatus(r) !== 'rejected')
      .flatMap((r) => r.items)
      .filter((i) => i.productId === productId)
      .reduce((n, i) => n + i.quantity, 0)
  );
}
export function checkReturnSale(
  state: FinanceState,
  invoiceId: string,
  customerId: string,
  items: CreditReturn['items'],
  checkedAt: string,
): SaleRecordCheck {
  const invoice = state.invoices.find((i) => i.id === invoiceId);
  ensure(invoice, 'invoice');
  ensure(
    invoice!.customerId === customerId && state.customers.some((c) => c.id === customerId),
    'saleCustomer',
  );
  const order = state.orders.find((o) => o.id === invoice!.orderId);
  ensure(order && order.customerId === customerId && order.status !== 'cancelled', 'saleRecord');
  ensure(items.length > 0 && new Set(items.map((i) => i.productId)).size === items.length, 'quantity');
  const matched = items.map((item) => {
    const original = invoice!.items.find((i) => i.productId === item.productId);
    const sold = order!.items.find((i) => i.productId === item.productId);
    ensure(
      original && sold && original.unitPrice === sold.unitPrice && original.quantity <= sold.quantity,
      'saleItem',
    );
    const available = remaining(state, invoiceId, item.productId);
    ensure(
      Number.isSafeInteger(item.quantity) && item.quantity > 0 && item.quantity <= available,
      'quantity',
    );
    return {
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: original!.unitPrice,
      soldQuantity: original!.quantity,
      availableQuantity: available,
    };
  });
  return {
    source: 'sales_record',
    invoiceId,
    customerId,
    checkedAt,
    physicalIdentityVerified: false,
    items: matched,
  };
}
export function checkReturnUnits(
  state: FinanceState,
  invoiceId: string,
  customerId: string,
  items: CreditReturn['items'],
  checkedAt: string,
): SaleRecordCheck {
  const check = checkReturnSale(state, invoiceId, customerId, items, checkedAt);
  const invoice = state.invoices.find((i) => i.id === invoiceId)!;
  const all = items.flatMap((item) => item.unitCodes ?? []);
  ensure(new Set(all).size === all.length, 'unitCode');
  for (const item of items) {
    const original = invoice.items.find((i) => i.productId === item.productId)!;
    ensure(original.unitCodes?.length === original.quantity, 'untrackedInvoice');
    ensure(item.unitCodes?.length === item.quantity, 'unitCode');
    for (const code of item.unitCodes!) {
      ensure(original.unitCodes!.includes(code), 'unitCode');
      ensure(
        !state.returns.some(
          (r) => returnStatus(r) !== 'rejected' && r.items.some((i) => i.unitCodes?.includes(code)),
        ),
        'unitUsed',
      );
    }
  }
  return { ...check, source: 'unit_codes', physicalIdentityVerified: false, unitIdentityVerified: true };
}
export function applyOperation(state: FinanceState, op: Operation, appliedAt = op.date): FinanceState {
  if (state.accepted.includes(op.id)) return state;
  ensure(op.id.length >= 8 && op.actorId && Number.isFinite(Date.parse(op.date)), 'invalid');
  const s: FinanceState = JSON.parse(JSON.stringify(state));
  const customer = (id: string) => {
    ensure(
      s.customers.some((c) => c.id === id),
      'customer',
    );
  };
  const amount = (n: number) => ensure(Number.isSafeInteger(n) && n > 0 && n <= 100_000_000, 'amount');
  const entry = (customerId: string, kind: FinanceEntry['kind'], debit: number, credit: number) =>
    s.entries.push({ id: op.id, customerId, date: op.date, kind, debit, credit, reference: op.id });
  if (op.kind === 'receipt') {
    customer(op.customerId);
    amount(op.amount);
    ensure(['cash', 'digital', 'cheque'].includes(op.method), 'invalid');
    if (op.method === 'cheque') {
      const c = op.cheque;
      ensure(
        c &&
          c.number.trim() &&
          c.bank.trim() &&
          /^\d{4}-\d{2}-\d{2}$/.test(c.due) &&
          Number.isFinite(Date.parse(c.due)) &&
          new Date(c.due).toISOString().slice(0, 10) === c.due,
        'cheque',
      );
      ensure(
        !s.receipts.some((r) => r.cheque?.number === c!.number.trim() && r.cheque?.bank === c!.bank.trim()),
        'duplicateCheque',
      );
    }
    s.receipts.push({
      ...op,
      cheque:
        op.method === 'cheque'
          ? { ...op.cheque!, number: op.cheque!.number.trim(), bank: op.cheque!.bank.trim() }
          : undefined,
      status: op.method === 'cheque' ? 'pending' : 'cleared',
    });
    if (op.method !== 'cheque') entry(op.customerId, 'receipt', 0, op.amount);
  } else if (op.kind === 'cheque') {
    const r = s.receipts.find((r) => r.id === op.receiptId && r.method === 'cheque');
    ensure(r && r.status === 'pending', 'chequeState');
    ensure(['cleared', 'bounced'].includes(op.status), 'invalid');
    r!.status = op.status;
    if (op.status === 'cleared') entry(r!.customerId, 'receipt', 0, r!.amount);
  } else if (op.kind === 'invoice') {
    const order = s.orders.find((o) => o.id === op.orderId);
    ensure(order && order.status !== 'cancelled', 'order');
    ensure(!s.invoices.some((i) => i.orderId === op.orderId), 'duplicateInvoice');
    s.invoices.push({
      id: op.id,
      orderId: order!.id,
      customerId: order!.customerId,
      date: op.date,
      total: order!.total,
      items: order!.items.map((item, index) => ({
        ...item,
        unitCodes: Array.from(
          { length: item.quantity },
          (_, unit) => 'DARB-' + op.id.toUpperCase() + '-' + (index + 1) + '-' + (unit + 1),
        ),
      })),
    });
    entry(order!.customerId, 'invoice', order!.total, 0);
  } else if (op.kind === 'return') {
    const invoice = s.invoices.find((i) => i.id === op.invoiceId);
    ensure(invoice, 'invoice');
    ensure(
      op.verification === undefined || op.verification === 'sales_record' || op.verification === 'unit_codes',
      'invalid',
    );
    const salesCheck =
      op.verification === 'unit_codes'
        ? checkReturnUnits(s, op.invoiceId, op.customerId ?? '', op.items, appliedAt)
        : op.verification === 'sales_record'
          ? checkReturnSale(s, op.invoiceId, op.customerId ?? '', op.items, appliedAt)
          : undefined;
    if (!op.verification && op.items.some((item) => item.unitCodes?.length))
      checkReturnUnits(s, op.invoiceId, invoice!.customerId, op.items, appliedAt);
    ensure(op.reason.trim().length >= 3 && op.reason.length <= 500, 'reason');
    ensure(
      /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(op.photo) && op.photo.length <= 450000,
      'photo',
    );
    ensure(
      op.items.length > 0 && new Set(op.items.map((i) => i.productId)).size === op.items.length,
      'quantity',
    );
    let total = 0;
    for (const item of op.items) {
      const original = invoice!.items.find((i) => i.productId === item.productId);
      ensure(
        original &&
          Number.isSafeInteger(item.quantity) &&
          item.quantity > 0 &&
          item.quantity <= remaining(s, op.invoiceId, item.productId),
        'quantity',
      );
      total += original!.unitPrice * item.quantity;
    }
    amount(total);
    const automaticallyAccepted = salesCheck?.source === 'unit_codes';
    s.returns.push({
      id: op.id,
      invoiceId: op.invoiceId,
      customerId: invoice!.customerId,
      date: op.date,
      items: op.items,
      amount: total,
      reason: op.reason.trim(),
      photo: op.photo,
      status: automaticallyAccepted ? 'accepted' : 'pending',
      requestedBy: op.actorId,
      salesCheck,
      reviewedBy: automaticallyAccepted ? 'system:unit-codes' : undefined,
      reviewedAt: automaticallyAccepted ? appliedAt : undefined,
      reviewOperationId: automaticallyAccepted ? op.id : undefined,
    });
    if (automaticallyAccepted) entry(invoice!.customerId, 'return', 0, total);
  } else if (op.kind === 'returnCheck') {
    const request = s.returns.find((r) => r.id === op.returnId);
    ensure(request && returnStatus(request) === 'pending', 'returnState');
    ensure(request!.requestedBy === op.actorId, 'reviewSelf');
    // Exclude this reservation only; other pending/accepted quantities remain reserved.
    const check = checkReturnUnits(
      { ...s, returns: s.returns.filter((r) => r.id !== request!.id) },
      request!.invoiceId,
      request!.customerId,
      request!.items,
      appliedAt,
    );
    const total = check.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    ensure(total === request!.amount, 'saleItem');
    request!.status = 'accepted';
    request!.salesCheck = check;
    request!.reviewedBy = 'system:unit-codes';
    request!.reviewedAt = appliedAt;
    request!.reviewOperationId = op.id;
    entry(request!.customerId, 'return', 0, total);
    s.entries[s.entries.length - 1].reference = request!.id;
  } else if (op.kind === 'returnReview') {
    const request = s.returns.find((r) => r.id === op.returnId);
    ensure(request && returnStatus(request) === 'pending', 'returnState');
    ensure(['accepted', 'rejected'].includes(op.decision), 'invalid');
    ensure(op.note.trim().length >= 3 && op.note.length <= 500, 'reviewNote');
    const invoice = s.invoices.find((i) => i.id === request!.invoiceId);
    ensure(invoice, 'invoice');
    ensure(request!.requestedBy !== op.actorId, 'reviewSelf');
    if (op.decision === 'accepted') {
      const inspection = op.inspection;
      ensure(
        inspection?.identityMatched === true &&
          inspection.quantityMatched === true &&
          inspection.conditionChecked === true,
        'inspection',
      );
      ensure(
        inspection!.received.length === request!.items.length &&
          new Set(inspection!.received.map((i) => i.productId)).size === inspection!.received.length,
        'inspection',
      );
      for (const item of request!.items) {
        const actual = inspection!.received.find((i) => i.productId === item.productId);
        const original = invoice!.items.find((i) => i.productId === item.productId);
        ensure(
          original && actual && Number.isSafeInteger(actual.quantity) && actual.quantity === item.quantity,
          'inspectionQuantity',
        );
        if (original!.sku) ensure(actual!.observedCode?.trim() === original!.sku, 'inspectionCode');
        ensure(remaining(s, request!.invoiceId, item.productId) >= 0, 'quantity');
      }
      // The review operation is the only new path that credits an inspected return.
      entry(request!.customerId, 'return', 0, request!.amount);
      s.entries[s.entries.length - 1].reference = request!.id;
    }
    request!.status = op.decision;
    request!.reviewedBy = op.actorId;
    request!.reviewedAt = op.date;
    request!.reviewOperationId = op.id;
    request!.reviewNote = op.note.trim();
    request!.inspection = op.inspection;
  } else if (op.kind === 'deposit') {
    amount(op.amount);
    ensure(op.amount <= wallet(s, op.actorId), 'wallet');
    ensure(op.note.trim().length >= 3, 'reason');
    s.deposits.push({
      id: op.id,
      actorId: op.actorId,
      amount: op.amount,
      date: op.date,
      note: op.note.trim(),
    });
  } else if (op.kind === 'order') {
    customer(op.customerId);
    ensure(
      op.items.length > 0 && new Set(op.items.map((i) => i.productId)).size === op.items.length,
      'quantity',
    );
    op.items.forEach((i) => {
      ensure(Number.isSafeInteger(i.quantity) && i.quantity > 0, 'quantity');
      amount(i.unitPrice);
    });
    const total = op.items.reduce((n, i) => n + i.unitPrice * i.quantity, 0);
    amount(total);
    s.orders.push({
      id: op.id,
      customerId: op.customerId,
      actorId: op.actorId,
      date: op.date,
      items: op.items,
      total,
      status: 'pending',
      source: op.source ?? 'manual',
    });
  } else {
    throw new FinanceError('invalid');
  }
  s.accepted.push(op.id);
  return s;
}
