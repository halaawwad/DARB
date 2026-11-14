import { describe, it, expect } from 'vitest';
import {
  applyOperation,
  balance,
  remaining,
  returnStatus,
  type FinanceState,
  type Operation,
} from '../../src/features/finance/domain.js';
const base: FinanceState = {
  version: 1,
  companyId: 'company',
  companyName: 'Fictional',
  products: [{ id: 'p', name: 'Water 0.5L', price: 1250, sku: 'WATER-05', unit: 'carton' }],
  customers: [{ id: 'c', name: 'Shop', phone: '', opening: 10000 }],
  orders: [],
  invoices: [
    {
      id: 'invoice-01',
      orderId: 'order-01',
      customerId: 'c',
      date: '2026-11-01T12:00:00Z',
      total: 3750,
      items: [
        { productId: 'p', name: 'Water 0.5L', quantity: 3, unitPrice: 1250, sku: 'WATER-05', unit: 'carton' },
      ],
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
const request: Extract<Operation, { kind: 'return' }> = {
  id: 'request-001',
  actorId: 'collector',
  date: '2026-11-11T10:00:00Z',
  kind: 'return',
  invoiceId: 'invoice-01',
  items: [{ productId: 'p', quantity: 2 }],
  reason: 'Damaged packaging',
  photo: 'data:image/png;base64,iVBORw0KGgo=',
};
const review: Extract<Operation, { kind: 'returnReview' }> = {
  id: 'review-001',
  actorId: 'warehouse',
  date: '2026-11-11T11:00:00Z',
  kind: 'returnReview',
  returnId: request.id,
  decision: 'accepted',
  note: 'Counted and matched the original SKU and unit',
  inspection: {
    identityMatched: true,
    quantityMatched: true,
    conditionChecked: true,
    received: [{ productId: 'p', quantity: 2, observedCode: 'WATER-05' }],
  },
};
describe('inspected return workflow', () => {
  it('reserves quantities but never credits a request before warehouse acceptance', () => {
    const s = applyOperation(base, request);
    expect(s.returns[0].status).toBe('pending');
    expect(s.returns[0].requestedBy).toBe('collector');
    expect(balance(s, 'c')).toBe(10000);
    expect(s.entries).toHaveLength(1);
    expect(remaining(s, 'invoice-01', 'p')).toBe(1);
    expect(() => applyOperation(s, { ...request, id: 'request-002' })).toThrow('quantity');
  });
  it('credits the original invoice price exactly once on inspected acceptance', () => {
    const s = applyOperation(applyOperation(base, request), review);
    expect(balance(s, 'c')).toBe(7500);
    expect(s.returns[0]).toMatchObject({
      status: 'accepted',
      reviewedBy: 'warehouse',
      reviewOperationId: 'review-001',
    });
    expect(s.entries.at(-1)?.reference).toBe(request.id);
    expect(applyOperation(s, review)).toBe(s);
    expect(() => applyOperation(s, { ...review, id: 'review-002' })).toThrow('returnState');
  });
  it('rejects arbitrary replacement products and incorrect physical quantities', () => {
    const s = applyOperation(base, request);
    expect(() =>
      applyOperation(s, {
        ...review,
        inspection: {
          ...review.inspection!,
          received: [{ productId: 'other-product', quantity: 2, observedCode: 'WATER-05' }],
        },
      }),
    ).toThrow('inspectionQuantity');
    expect(() =>
      applyOperation(s, {
        ...review,
        inspection: {
          ...review.inspection!,
          received: [{ productId: 'p', quantity: 1, observedCode: 'WATER-05' }],
        },
      }),
    ).toThrow('inspectionQuantity');
  });
  it('requires all physical inspection checks and the trusted invoice SKU when present', () => {
    const s = applyOperation(base, request);
    expect(() => applyOperation(s, { ...review, inspection: undefined })).toThrow('inspection');
    expect(() =>
      applyOperation(s, { ...review, inspection: { ...review.inspection!, identityMatched: false } }),
    ).toThrow('inspection');
    expect(() =>
      applyOperation(s, {
        ...review,
        inspection: {
          ...review.inspection!,
          received: [{ productId: 'p', quantity: 2, observedCode: 'OTHER-SIZE' }],
        },
      }),
    ).toThrow('inspectionCode');
    expect(() =>
      applyOperation(s, {
        ...review,
        inspection: { ...review.inspection!, received: [{ productId: 'p', quantity: 2 }] },
      }),
    ).toThrow('inspectionCode');
  });
  it('never lets the request creator approve or reject their own request', () => {
    const s = applyOperation(base, request);
    expect(() => applyOperation(s, { ...review, actorId: 'collector' })).toThrow('reviewSelf');
    expect(() => applyOperation(s, { ...review, actorId: 'collector', decision: 'rejected' })).toThrow(
      'reviewSelf',
    );
  });
  it('rejection releases reserved quantities without changing the customer balance', () => {
    const s = applyOperation(applyOperation(base, request), {
      ...review,
      decision: 'rejected',
      inspection: undefined,
      note: 'Physical SKU does not match the invoice',
    });
    expect(s.returns[0].status).toBe('rejected');
    expect(balance(s, 'c')).toBe(10000);
    expect(remaining(s, 'invoice-01', 'p')).toBe(3);
    expect(applyOperation(s, { ...request, id: 'request-002' }).returns[1].status).toBe('pending');
    expect(() => applyOperation(s, { ...review, id: 'review-002' })).toThrow('returnState');
  });
  it('retains historical already-credited returns without re-review or reversing their money', () => {
    const legacy: FinanceState = {
      ...base,
      returns: [
        {
          id: 'legacy-01',
          invoiceId: 'invoice-01',
          customerId: 'c',
          date: request.date,
          items: [{ productId: 'p', quantity: 1 }],
          amount: 1250,
          reason: 'Historical',
          photo: request.photo,
        },
      ],
      entries: [
        ...base.entries,
        {
          id: 'legacy-01',
          customerId: 'c',
          date: request.date,
          kind: 'return',
          debit: 0,
          credit: 1250,
          reference: 'legacy-01',
        },
      ],
    };
    expect(returnStatus(legacy.returns[0])).toBe('accepted');
    expect(balance(legacy, 'c')).toBe(8750);
    expect(remaining(legacy, 'invoice-01', 'p')).toBe(2);
    expect(() => applyOperation(legacy, { ...review, returnId: 'legacy-01' })).toThrow('returnState');
  });
  it('requires a review note on either decision and ignores a supplied replacement price', () => {
    const s = applyOperation(base, request);
    expect(() => applyOperation(s, { ...review, note: '' })).toThrow('reviewNote');
    const accepted = applyOperation(s, review);
    expect(accepted.returns[0].amount).toBe(2500);
    expect(accepted.entries.at(-1)?.credit).toBe(2500);
  });
});
