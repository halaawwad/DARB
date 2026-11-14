import { describe, it, expect } from 'vitest';
import {
  applyOperation,
  balance,
  checkReturnSale,
  type FinanceState,
  type Operation,
} from '../../src/features/finance/domain.js';
const items = [
  {
    productId: 'p',
    name: 'Water 0.5L',
    quantity: 3,
    unitPrice: 1250,
    unitCodes: ['UNIT-1', 'UNIT-2', 'UNIT-3'],
    sku: 'W05',
    unit: 'carton',
  },
];
const base: FinanceState = {
  version: 1,
  companyId: 'company',
  companyName: 'Fictional',
  products: [],
  customers: [
    { id: 'c', name: 'Shop', phone: '', opening: 10000 },
    { id: 'other', name: 'Other Shop', phone: '', opening: 0 },
  ],
  orders: [
    {
      id: 'order-01',
      customerId: 'c',
      actorId: 'sales',
      date: '2026-11-01T00:00:00Z',
      items,
      total: 3750,
      status: 'delivered',
    },
  ],
  invoices: [
    {
      id: 'invoice-01',
      orderId: 'order-01',
      customerId: 'c',
      date: '2026-11-01T00:00:00Z',
      items,
      total: 3750,
    },
  ],
  receipts: [],
  returns: [],
  deposits: [],
  accepted: [],
  entries: [
    {
      id: 'opening',
      customerId: 'c',
      date: '2026-11-01T00:00:00Z',
      kind: 'opening',
      debit: 10000,
      credit: 0,
      reference: 'opening',
    },
  ],
};
const op: Extract<Operation, { kind: 'return' }> = {
  id: 'auto-return-01',
  actorId: 'sales',
  date: '2026-11-11T10:00:00Z',
  kind: 'return',
  invoiceId: 'invoice-01',
  customerId: 'c',
  verification: 'unit_codes',
  items: [{ productId: 'p', quantity: 2, unitCodes: ['UNIT-1', 'UNIT-2'] }],
  reason: 'Damaged packaging',
  photo: 'data:image/png;base64,iVBORw0KGgo=',
};
describe('automatic sale-record returns', () => {
  it('matches the original sale and credits once without inventing physical identity proof', () => {
    const s = applyOperation(base, op, '2026-11-11T11:00:00Z');
    expect(balance(s, 'c')).toBe(7500);
    expect(s.returns[0]).toMatchObject({
      status: 'accepted',
      reviewedBy: 'system:unit-codes',
      requestedBy: 'sales',
      salesCheck: {
        source: 'unit_codes',
        physicalIdentityVerified: false,
        invoiceId: op.invoiceId,
        customerId: 'c',
        checkedAt: '2026-11-11T11:00:00Z',
        items: [{ productId: 'p', quantity: 2, unitPrice: 1250, soldQuantity: 3, availableQuantity: 3 }],
      },
    });
    expect(applyOperation(s, op)).toBe(s);
    expect(s.entries.filter((e) => e.kind === 'return')).toHaveLength(1);
    expect(base.returns).toHaveLength(0);
  });
  it('requires the invoice to belong to the claimed customer', () => {
    expect(() => applyOperation(base, { ...op, customerId: 'other' })).toThrow('saleCustomer');
    expect(() => applyOperation(base, { ...op, customerId: undefined })).toThrow('saleCustomer');
  });
  it('does not auto-approve a missing or cancelled source sale', () => {
    expect(() => applyOperation({ ...base, orders: [] }, op)).toThrow('saleRecord');
    expect(() =>
      applyOperation({ ...base, orders: [{ ...base.orders[0], status: 'cancelled' }] }, op),
    ).toThrow('saleRecord');
    expect(() =>
      applyOperation({ ...base, orders: [{ ...base.orders[0], customerId: 'other' }] }, op),
    ).toThrow('saleRecord');
  });
  it('does not accept another product or altered original price/quantity', () => {
    expect(() =>
      applyOperation(base, { ...op, items: [{ productId: 'other-product', quantity: 1 }] }),
    ).toThrow('saleItem');
    expect(() =>
      applyOperation(
        { ...base, invoices: [{ ...base.invoices[0], items: [{ ...items[0], unitPrice: 1 }] }] },
        op,
      ),
    ).toThrow('saleItem');
    expect(() =>
      applyOperation(
        { ...base, invoices: [{ ...base.invoices[0], items: [{ ...items[0], quantity: 4 }] }] },
        op,
      ),
    ).toThrow('saleItem');
  });
  it('reserves pending manual quantities and prevents duplicate automatic credits', () => {
    const pending = applyOperation(base, { ...op, verification: undefined });
    expect(balance(pending, 'c')).toBe(10000);
    expect(() => applyOperation(pending, { ...op, id: 'auto-return-02' })).toThrow('quantity');
    const accepted = applyOperation(base, op);
    expect(() => applyOperation(accepted, { ...op, id: 'auto-return-02' })).toThrow('quantity');
    expect(balance(accepted, 'c')).toBe(7500);
  });
  it('keeps manual inspection available without changing its pending semantics', () => {
    const pending = applyOperation(base, { ...op, verification: undefined });
    expect(pending.returns[0].status).toBe('pending');
    expect(pending.returns[0].salesCheck).toBeUndefined();
    expect(balance(pending, 'c')).toBe(10000);
  });
  it('rejects duplicate line IDs, zero/negative quantities and unknown verification modes', () => {
    expect(() =>
      applyOperation(base, {
        ...op,
        items: [
          { productId: 'p', quantity: 1 },
          { productId: 'p', quantity: 1 },
        ],
      }),
    ).toThrow('quantity');
    for (const q of [0, -1, 1.5])
      expect(() => applyOperation(base, { ...op, items: [{ productId: 'p', quantity: q }] })).toThrow(
        'quantity',
      );
    expect(() =>
      applyOperation(base, { ...op, verification: 'image_proof' } as unknown as Operation),
    ).toThrow('invalid');
  });
  it('the preview does not mutate or credit the account', () => {
    const matched = checkReturnSale(base, 'invoice-01', 'c', [{ productId: 'p', quantity: 1 }], op.date);
    expect(matched.items[0].unitPrice).toBe(1250);
    expect(balance(base, 'c')).toBe(10000);
    expect(base.accepted).toHaveLength(0);
  });
});

describe('pending return automatic recheck', () => {
  const pending = () => applyOperation(base, { ...op, verification: undefined });
  const check: Operation = {
    kind: 'returnCheck',
    returnId: op.id,
    id: 'recheck-operation-01',
    actorId: op.actorId,
    date: op.date,
  };
  it('reuses the request and excludes only its own quantity reservation', () => {
    const before = pending();
    expect(balance(before, 'c')).toBe(10000);
    const after = applyOperation(before, check);
    expect(after.returns).toHaveLength(1);
    expect(after.returns[0].status).toBe('accepted');
    expect(after.returns[0].salesCheck?.physicalIdentityVerified).toBe(false);
    expect(balance(after, 'c')).toBe(7500);
    expect(applyOperation(after, check)).toBe(after);
    expect(() => applyOperation(after, { ...check, id: 'duplicate-check-02' })).toThrow('returnState');
  });
  it('allows only the original requester and requires a valid source sale', () => {
    expect(() => applyOperation(pending(), { ...check, actorId: 'someone-else' })).toThrow('reviewSelf');
    expect(() => applyOperation({ ...pending(), orders: [] }, check)).toThrow('saleRecord');
  });
  it('keeps other reservations and rejects altered return prices', () => {
    const s = pending();
    s.returns.push({ ...s.returns[0], id: 'other-pending', items: [{ productId: 'p', quantity: 2 }] });
    expect(() => applyOperation(s, check)).toThrow('quantity');
    const tampered = pending();
    tampered.returns[0].amount = 1;
    expect(() => applyOperation(tampered, check)).toThrow('saleItem');
  });
});

describe('unique sold-unit identifiers', () => {
  const tracked = () =>
    applyOperation(
      { ...base, invoices: [] },
      { kind: 'invoice', id: 'tracked-invoice-01', orderId: 'order-01', actorId: 'sales', date: op.date },
    );
  const returned = (
    s: FinanceState,
    codes: string[],
    id = 'tracked-return-01',
  ): Extract<Operation, { kind: 'return' }> => ({
    ...op,
    id,
    invoiceId: 'tracked-invoice-01',
    verification: 'unit_codes',
    items: [{ productId: 'p', quantity: codes.length, unitCodes: codes }],
  });
  it('issues one stable unique code per sales unit and verifies that exact invoice/customer/item', () => {
    const s = tracked();
    const codes = s.invoices[0].items[0].unitCodes!;
    expect(codes).toHaveLength(3);
    expect(new Set(codes).size).toBe(3);
    const next = applyOperation(s, returned(s, [codes[0]]));
    expect(next.returns[0].salesCheck).toMatchObject({
      source: 'unit_codes',
      physicalIdentityVerified: false,
      unitIdentityVerified: true,
    });
    expect(next.returns[0].items[0].unitCodes).toEqual([codes[0]]);
    expect(applyOperation(next, returned(s, [codes[0]]))).toBe(next);
    expect(() => applyOperation(next, returned(s, [codes[0]], 'another-return-02'))).toThrow('unitUsed');
  });
  it('rejects foreign codes, duplicates, missing identifiers and untracked historical invoices', () => {
    const s = tracked();
    const code = s.invoices[0].items[0].unitCodes![0];
    expect(() => applyOperation(s, returned(s, ['FOREIGN-CODE']))).toThrow('unitCode');
    expect(() => applyOperation(s, returned(s, [code, code]))).toThrow('unitCode');
    expect(() =>
      applyOperation(s, { ...op, invoiceId: 'tracked-invoice-01', verification: 'unit_codes' }),
    ).toThrow('unitCode');
    expect(() =>
      applyOperation(
        {
          ...base,
          invoices: [
            {
              ...base.invoices[0],
              items: base.invoices[0].items.map((i) => ({ ...i, unitCodes: undefined })),
            },
          ],
        },
        { ...op, verification: 'unit_codes' },
      ),
    ).toThrow('untrackedInvoice');
    expect(() => applyOperation(s, { ...returned(s, [code]), customerId: 'other' })).toThrow('saleCustomer');
  });
  it('reserves identifiers during manual inspection and releases rejected requests', () => {
    const s = tracked();
    const code = s.invoices[0].items[0].unitCodes![0];
    const manual = applyOperation(s, { ...returned(s, [code]), verification: undefined });
    expect(manual.returns[0].status).toBe('pending');
    expect(() => applyOperation(manual, returned(s, [code], 'second-return-02'))).toThrow('unitUsed');
    const rejected = applyOperation(manual, {
      kind: 'returnReview',
      id: 'reject-return-01',
      returnId: 'tracked-return-01',
      decision: 'rejected',
      note: 'Wrong condition',
      actorId: 'warehouse',
      date: op.date,
    });
    expect(applyOperation(rejected, returned(s, [code], 'third-return-03')).returns.at(-1)?.status).toBe(
      'accepted',
    );
  });
});

it('older sale-record clients cannot automatically credit returns without unique identifiers', () => {
  const pending = applyOperation(base, {
    ...op,
    verification: 'sales_record',
    items: [{ productId: 'p', quantity: 1 }],
  });
  expect(pending.returns[0].status).toBe('pending');
  expect(balance(pending, 'c')).toBe(10000);
  expect(() =>
    applyOperation(pending, {
      kind: 'returnCheck',
      returnId: op.id,
      id: 'legacy-recheck-01',
      actorId: op.actorId,
      date: op.date,
    }),
  ).toThrow('unitCode');
});
