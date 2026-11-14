const uuid = { type: 'string', format: 'uuid' };
const text = { type: 'string' };
const amount = {
  type: 'integer',
  minimum: 1,
  maximum: 100000000,
  description: 'Integer agorot: 1250 means 12.50 ILS.',
};
const item = {
  type: 'object',
  additionalProperties: false,
  required: ['productId', 'quantity'],
  properties: {
    productId: uuid,
    unitCodes: { type: 'array', items: { type: 'string' } },
    quantity: { type: 'integer', minimum: 1, maximum: 100000 },
  },
};
const header = { id: uuid, actorId: uuid, date: { type: 'string', format: 'date-time' } };
function variant(kind: string, properties: Record<string, unknown>, required: string[]) {
  return {
    type: 'object',
    additionalProperties: false,
    properties: { ...header, kind: { type: 'string', enum: [kind] }, ...properties },
    required: ['id', 'actorId', 'date', 'kind', ...required],
  };
}
export const financeOperationSchema = {
  oneOf: [
    variant(
      'receipt',
      {
        customerId: uuid,
        amount,
        method: { type: 'string', enum: ['cash', 'digital', 'cheque'] },
        note: { type: 'string', maxLength: 500 },
        cheque: {
          type: 'object',
          required: ['number', 'bank', 'due'],
          properties: { number: text, bank: text, due: { type: 'string', format: 'date' } },
        },
      },
      ['customerId', 'amount', 'method', 'note'],
    ),
    variant('cheque', { receiptId: uuid, status: { type: 'string', enum: ['cleared', 'bounced'] } }, [
      'receiptId',
      'status',
    ]),
    variant('invoice', { orderId: uuid }, ['orderId']),
    variant(
      'return',
      {
        invoiceId: uuid,
        customerId: uuid,
        verification: { type: 'string', enum: ['sales_record', 'unit_codes'] },
        items: { type: 'array', minItems: 1, maxItems: 100, items: item },
        reason: { type: 'string', minLength: 3, maxLength: 500 },
        photo: {
          type: 'string',
          maxLength: 450000,
          description: 'Embedded JPEG, PNG or WebP data URI; required for durable offline evidence.',
        },
      },
      ['invoiceId', 'items', 'reason', 'photo'],
    ),
    variant(
      'returnReview',
      {
        returnId: uuid,
        decision: { type: 'string', enum: ['accepted', 'rejected'] },
        note: { type: 'string', minLength: 3, maxLength: 500 },
        inspection: {
          type: 'object',
          additionalProperties: false,
          required: ['identityMatched', 'quantityMatched', 'conditionChecked', 'received'],
          properties: {
            identityMatched: { type: 'boolean' },
            quantityMatched: { type: 'boolean' },
            conditionChecked: { type: 'boolean' },
            received: {
              type: 'array',
              minItems: 1,
              maxItems: 100,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['productId', 'quantity'],
                properties: {
                  productId: uuid,
                  quantity: { type: 'integer', minimum: 1, maximum: 100000 },
                  observedCode: { type: 'string', maxLength: 120 },
                },
              },
            },
          },
        },
      },
      ['returnId', 'decision', 'note'],
    ),
    variant('deposit', { amount, note: { type: 'string', minLength: 3, maxLength: 500 } }, [
      'amount',
      'note',
    ]),
    variant(
      'order',
      {
        customerId: uuid,
        items: {
          type: 'array',
          minItems: 1,
          maxItems: 100,
          items: {
            ...item,
            required: ['productId', 'quantity', 'name', 'unitPrice'],
            properties: { ...item.properties, name: text, unitPrice: amount },
          },
        },
      },
      ['customerId', 'items'],
    ),
  ],
  discriminator: { propertyName: 'kind' },
  description:
    'Use a stable UUID on every retry. actorId must equal the authenticated user. finance:manage is required for cheque resolution; returns:create for pending return requests; returns:review for warehouse decisions; orders:create for orders; finance:collect for other operations. Return requests without verification reserve quantity without changing debt. verification=unit_codes requires customerId and one invoice-assigned unique unit code per returned sales unit. It validates the persisted sale, reserves pending identifiers, rejects reused or foreign codes, and credits exactly once. verification=sales_record is retained for older clients but stays pending and does not credit. New finance invoices receive stable unit identifiers; historical invoices are never retroactively numbered. Its generated salesCheck always sets physicalIdentityVerified=false; this is not physical provenance proof. Acceptance requires another reviewer, all three inspection checks, exact received quantities and invoice SKU when available. Rejection releases quantities. Historical returns without status remain already accepted. All requests also require finance:read.',
};
export const financeStateSchema = {
  type: 'object',
  description:
    'Company-scoped accounting projection. Money values are integer agorot. Opening entries preserve balances predating this module. accepted contains committed operation UUIDs for retry reconciliation.',
  properties: {
    version: { type: 'integer', enum: [1] },
    companyId: uuid,
    companyName: text,
    ...Object.fromEntries(
      ['customers', 'products', 'orders', 'invoices', 'receipts', 'returns', 'deposits', 'entries'].map(
        (key) => [key, { type: 'array', items: { type: 'object' } }],
      ),
    ),
    accepted: { type: 'array', items: uuid },
  },
  required: ['version', 'companyId', 'customers', 'entries', 'accepted'],
};
