import { describe, it, expect } from 'vitest';
import {
  applyOperation,
  balance,
  wallet,
  remaining,
  parseAmount,
  type FinanceState,
  type Operation,
} from '../../src/features/finance/domain.js';
const base: FinanceState = {
  version: 1,
  companyId: 'company',
  companyName: 'Fictional',
  products: [{ id: 'p', name: 'Item', price: 1250 }],
  customers: [{ id: 'c', name: 'Shop', phone: '', opening: 10000 }],
  orders: [
    {
      id: 'o',
      customerId: 'c',
      actorId: 'u',
      date: '2026-11-01T12:00:00Z',
      total: 3750,
      status: 'delivered',
      items: [{ productId: 'p', name: 'Item', quantity: 3, unitPrice: 1250 }],
    },
  ],
  invoices: [],
  receipts: [],
  returns: [],
  deposits: [],
  accepted: [],
  entries: [
    {
      id: 'open',
      customerId: 'c',
      date: '2026-11-01T00:00:00Z',
      kind: 'opening',
      debit: 10000,
      credit: 0,
      reference: 'opening',
    },
  ],
};
const header = { id: 'operation-01', actorId: 'u', date: '2026-11-06T12:00:00Z' };
const receipt: Operation = {
  ...header,
  kind: 'receipt',
  customerId: 'c',
  method: 'cash',
  amount: 1250,
  note: '',
};
const photo = 'data:image/png;base64,iVBORw0KGgo=';
describe('finance accounting invariants', () => {
  it('parses Arabic digits and exact cents, rejecting exponent, commas and fractions beyond cents', () => {
    expect(parseAmount('١٢٫٥٠')).toBe(1250);
    expect(parseAmount('0.10')).toBe(10);
    for (const n of ['0', '-2', '1e3', '1,000', '1.001', 'NaN', 'Infinity', '1000000.01'])
      expect(() => parseAmount(n)).toThrow();
  });
  it('records cash and wallet together without modifying the input', () => {
    const s = applyOperation(base, receipt);
    expect(balance(s, 'c')).toBe(8750);
    expect(wallet(s, 'u')).toBe(1250);
    expect(base.receipts).toHaveLength(0);
  });
  it('applies a retried operation exactly once', () => {
    const s = applyOperation(base, receipt);
    expect(applyOperation(s, receipt)).toBe(s);
    expect(s.entries).toHaveLength(2);
  });
  it('keeps digital receipts separate from cash custody', () => {
    const s = applyOperation(base, { ...receipt, method: 'digital' });
    expect(wallet(s, 'u')).toBe(0);
    expect(wallet(s, 'u', 'digital')).toBe(1250);
  });
  it('does not credit a cheque until clearance, and never adds it to cash', () => {
    const s = applyOperation(base, {
      ...receipt,
      method: 'cheque',
      cheque: { number: '123', bank: 'Bank', due: '2026-11-08' },
    });
    expect(balance(s, 'c')).toBe(10000);
    expect(wallet(s, 'u')).toBe(0);
    const cleared = applyOperation(s, {
      ...header,
      id: 'operation-02',
      kind: 'cheque',
      receiptId: receipt.id,
      status: 'cleared',
    });
    expect(balance(cleared, 'c')).toBe(8750);
    expect(wallet(cleared, 'u')).toBe(0);
    expect(() =>
      applyOperation(cleared, {
        ...header,
        id: 'operation-03',
        kind: 'cheque',
        receiptId: receipt.id,
        status: 'cleared',
      }),
    ).toThrow('chequeState');
  });
  it('bounced cheques retain the original debt', () => {
    const s = applyOperation(base, {
      ...receipt,
      method: 'cheque',
      cheque: { number: '123', bank: 'Bank', due: '2026-11-08' },
    });
    expect(
      balance(
        applyOperation(s, {
          ...header,
          id: 'operation-02',
          kind: 'cheque',
          receiptId: receipt.id,
          status: 'bounced',
        }),
        'c',
      ),
    ).toBe(10000);
  });
  it('rejects duplicate cheque numbers per bank and invalid calendar dates', () => {
    const op: Operation = {
      ...receipt,
      method: 'cheque',
      cheque: { number: '123', bank: 'Bank', due: '2026-11-08' },
    };
    const s = applyOperation(base, op);
    expect(() => applyOperation(s, { ...op, id: 'operation-02' })).toThrow('duplicateCheque');
    expect(() => applyOperation(base, { ...op, cheque: { ...op.cheque!, due: '2026-02-30' } })).toThrow(
      'cheque',
    );
  });
  it('issues one invoice per order and uses its original prices', () => {
    const s = applyOperation(base, { ...header, kind: 'invoice', orderId: 'o' });
    expect(balance(s, 'c')).toBe(13750);
    expect(s.invoices[0].total).toBe(3750);
    expect(() => applyOperation(s, { ...header, id: 'operation-02', kind: 'invoice', orderId: 'o' })).toThrow(
      'duplicateInvoice',
    );
  });
  it('credits partial returns at invoice price and enforces cumulative quantity', () => {
    const invoiced = applyOperation(base, { ...header, kind: 'invoice', orderId: 'o' });
    const op: Operation = {
      ...header,
      id: 'operation-02',
      kind: 'return',
      invoiceId: header.id,
      items: [{ productId: 'p', quantity: 2 }],
      reason: 'Damaged',
      photo,
    };
    const s = applyOperation(invoiced, op);
    expect(balance(s, 'c')).toBe(13750); // A request reserves stock but does not credit debt.
    const inspected = applyOperation(s, {
      ...header,
      id: 'inspection-01',
      actorId: 'warehouse',
      kind: 'returnReview',
      returnId: op.id,
      decision: 'accepted',
      note: 'Matched and counted',
      inspection: {
        identityMatched: true,
        quantityMatched: true,
        conditionChecked: true,
        received: [{ productId: 'p', quantity: 2 }],
      },
    });
    expect(balance(inspected, 'c')).toBe(11250);
    expect(remaining(s, header.id, 'p')).toBe(1);
    expect(() => applyOperation(s, { ...op, id: 'operation-03' })).toThrow('quantity');
    expect(() =>
      applyOperation(invoiced, {
        ...op,
        items: [
          { productId: 'p', quantity: 1 },
          { productId: 'p', quantity: 1 },
        ],
      }),
    ).toThrow('quantity');
  });
  it('requires a reason and embedded photo; does not accept arbitrary URLs', () => {
    const s = applyOperation(base, { ...header, kind: 'invoice', orderId: 'o' });
    expect(() =>
      applyOperation(s, {
        ...header,
        id: 'operation-02',
        kind: 'return',
        invoiceId: header.id,
        items: [{ productId: 'p', quantity: 1 }],
        reason: 'Damaged',
        photo: 'https://example.invalid/photo',
      }),
    ).toThrow('photo');
  });
  it('prevents cash handover beyond the current representative wallet', () => {
    const s = applyOperation(base, receipt);
    expect(() =>
      applyOperation(s, {
        ...header,
        id: 'operation-02',
        kind: 'deposit',
        amount: 1251,
        note: 'Office handover',
      }),
    ).toThrow('wallet');
    expect(
      wallet(
        applyOperation(s, {
          ...header,
          id: 'operation-02',
          kind: 'deposit',
          amount: 1000,
          note: 'Office handover',
        }),
        'u',
      ),
    ).toBe(250);
    expect(wallet(s, 'another-user')).toBe(0);
  });
  it('supports credit balances without floating point drift', () => {
    let s = base;
    for (let i = 0; i < 100; i++) s = applyOperation(s, { ...receipt, id: `receipt-${i}`, amount: 10 });
    expect(balance(s, 'c')).toBe(9000);
  });
  it('offline orders do not change debt until invoiced', () => {
    const s = applyOperation(base, {
      ...header,
      kind: 'order',
      customerId: 'c',
      items: [{ productId: 'p', name: 'Item', quantity: 2, unitPrice: 1250 }],
    });
    expect(balance(s, 'c')).toBe(10000);
    expect(s.orders.at(-1)?.total).toBe(2500);
  });
});
