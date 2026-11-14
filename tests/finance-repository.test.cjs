const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, require, extra = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require,
    console,
    AbortController,
    setTimeout: () => 0,
    clearTimeout: () => {},
    ...extra,
  });
  return module.exports;
}
const domain = load('server/src/features/finance/domain.ts', () => {});
const clone = (v) => JSON.parse(JSON.stringify(v));
function fixture({ disk = new Map(), remote, failWrite = false } = {}) {
  const session = new Map();
  let calls = 0,
    lost = false;
  const storage = {
    getItem: async (k) => disk.get(k) ?? null,
    setItem: async (k, v) => {
      if (failWrite) throw new Error('quota');
      disk.set(k, v);
    },
  };
  const base = {
    version: 1,
    companyId: 'cloud',
    companyName: 'Cloud',
    products: [],
    customers: [{ id: 'c', name: 'Shop', phone: '', opening: 10000 }],
    orders: [],
    invoices: [],
    receipts: [],
    returns: [],
    deposits: [],
    accepted: [],
    entries: [
      {
        id: 'open',
        customerId: 'c',
        kind: 'opening',
        date: '2026-11-01T00:00:00Z',
        reference: 'opening',
        debit: 10000,
        credit: 0,
      },
    ],
  };
  let server = remote ?? base;
  const { financeRepository: repo } = load(
    'src/features/finance/repository.ts',
    (id) => {
      if (id.includes('async-storage')) return { __esModule: true, default: storage };
      if (id === 'react-native') return { Platform: { OS: 'web' } };
      if (id === 'expo-secure-store') return {};
      if (id === './domain') return domain;
      if (id.includes('/customers'))
        return { CUSTOMERS: [{ id: 'c', shopName: 'Shop', phone: '', balance: 100 }] };
      if (id.includes('/orders')) return { ORDERS: [] };
      if (id.includes('/products')) return { PRODUCTS: [] };
      if (id.includes('/users')) return { COMPANY: { id: 'demo', name: 'Demo' } };
      if (id.includes('/ledger'))
        return {
          LEDGER: [
            {
              id: 'open',
              customerId: 'c',
              date: '2026-11-01T00:00:00Z',
              description: 'opening',
              debit: 100,
              credit: 0,
            },
          ],
        };
      throw new Error(id);
    },
    {
      sessionStorage: {
        getItem: (k) => session.get(k),
        setItem: (k, v) => session.set(k, v),
        removeItem: (k) => session.delete(k),
      },
      fetch: async (url, opts) => {
        calls++;
        if (url.endsWith('/login'))
          return { ok: true, json: async () => ({ token: 'token', user: { id: 'u', companyId: 'cloud' } }) };
        if (url.endsWith('/sync')) {
          server = domain.applyOperation(server, JSON.parse(opts.body));
          if (lost) {
            lost = false;
            throw new Error('response lost after commit');
          }
        }
        return {
          ok: true,
          json: async () => ({ state: clone(server), permissions: ['finance:read', 'finance:collect'] }),
        };
      },
    },
  );
  return {
    repo,
    disk,
    get calls() {
      return calls;
    },
    get server() {
      return server;
    },
    fail() {
      failWrite = true;
    },
    loseResponse() {
      lost = true;
    },
  };
}
const receipt = {
  id: 'receipt-001',
  actorId: 'u',
  date: '2026-11-06T12:00:00Z',
  kind: 'receipt',
  customerId: 'c',
  method: 'cash',
  amount: 1000,
  note: '',
};
test('demo persists only after storage success and never sends mock financial data', async () => {
  const f = fixture();
  await f.repo.init();
  await f.repo.submit(receipt);
  await f.repo.sync();
  assert.equal(f.calls, 0);
  assert.equal(f.repo.getSnapshot().state.receipts.length, 1);
  const restored = fixture({ disk: f.disk });
  await restored.repo.init();
  assert.equal(restored.repo.getSnapshot().state.receipts.length, 1);
  f.fail();
  await assert.rejects(f.repo.submit({ ...receipt, id: 'receipt-002' }));
  assert.equal(f.repo.getSnapshot().state.receipts.length, 1);
});
test('offline authenticated outbox survives process restart without persisting token/password', async () => {
  const f = fixture();
  await f.repo.init();
  await f.repo.connect('http://local.test', 'user', 'private-password', 'cloud');
  f.repo.setOnline(false);
  await f.repo.submit(receipt);
  assert.equal(f.repo.getSnapshot().pending.length, 1);
  assert.equal(f.server.receipts.length, 0);
  const saved = Array.from(f.disk.values()).join('');
  assert.ok(!saved.includes('private-password'));
  assert.ok(!saved.includes('"token"'));
  const restored = fixture({ disk: f.disk });
  await restored.repo.init();
  assert.equal(restored.repo.getSnapshot().pending.length, 1);
  assert.equal(restored.repo.getSnapshot().authenticated, false);
});
test('lost POST response is reconciled by pulling accepted IDs without duplicating payment', async () => {
  const f = fixture();
  await f.repo.init();
  await f.repo.connect('http://local.test', 'user', 'private-password', 'cloud');
  await f.repo.submit(receipt);
  f.loseResponse();
  await f.repo.sync();
  assert.equal(f.server.receipts.length, 1);
  assert.equal(f.repo.getSnapshot().pending.length, 1);
  await f.repo.sync();
  assert.equal(f.repo.getSnapshot().pending.length, 0);
  assert.equal(f.server.receipts.length, 1);
  assert.equal(domain.balance(f.server, 'c'), 9000);
});
test('cloud outbox refuses operations attributed to another user', async () => {
  const f = fixture();
  await f.repo.init();
  await f.repo.connect('http://local.test', 'user', 'private-password', 'cloud');
  await assert.rejects(f.repo.submit({ ...receipt, actorId: 'other' }), /scope/);
});
test('corrupt storage is preserved and blocks writes instead of resetting financial data', async () => {
  const disk = new Map([['darb.finance.demo.v1', '{corrupt']]);
  const f = fixture({ disk });
  await f.repo.init();
  assert.equal(f.repo.getSnapshot().error, 'storage');
  await assert.rejects(f.repo.submit(receipt));
  assert.equal(disk.get('darb.finance.demo.v1'), '{corrupt');
});

test('presentation is isolated, survives reload and never uploads or erases previous demo data', async () => {
  const f = fixture();
  await f.repo.init();
  await f.repo.submit(receipt);
  const original = f.disk.get('darb.finance.demo.v1');
  await f.repo.startPresentation();
  const presentation = f.repo.getSnapshot().state;
  assert.equal(presentation.customers.length, 1);
  assert.equal(presentation.orders[0].total, 10000);
  assert.equal(presentation.receipts.length, 0);
  assert.equal(f.repo.getSnapshot().mode, 'demo');
  await f.repo.submit({
    kind: 'invoice',
    orderId: presentation.orders[0].id,
    id: 'presentation-invoice',
    actorId: 'u',
    date: receipt.date,
  });
  await f.repo.sync();
  assert.equal(f.calls, 0);
  assert.equal(f.disk.get('darb.finance.demo.v1'), original);
  const restored = fixture({ disk: f.disk });
  await restored.repo.init();
  assert.equal(restored.repo.getSnapshot().mode, 'demo');
  assert.equal(restored.repo.getSnapshot().state.invoices.length, 1);
  await restored.repo.exitPresentation();
  assert.equal(restored.repo.getSnapshot().state.receipts.length, 1);
});
test('presentation preserves authenticated company outbox and returns to its previous session', async () => {
  const f = fixture();
  await f.repo.init();
  await f.repo.connect('http://local.test', 'user', 'private-password', 'cloud');
  f.repo.setOnline(false);
  await f.repo.submit(receipt);
  const calls = f.calls;
  await f.repo.startPresentation();
  await f.repo.sync();
  assert.equal(f.calls, calls);
  await f.repo.startPresentation();
  await f.repo.exitPresentation();
  assert.equal(f.repo.getSnapshot().mode, 'server');
  assert.equal(f.repo.getSnapshot().authenticated, true);
  assert.equal(f.repo.getSnapshot().pending.length, 1);
  assert.equal(f.server.receipts.length, 0);
});
