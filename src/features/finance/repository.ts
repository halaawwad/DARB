import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { CUSTOMERS } from '@/data/mock/customers';
import { ORDERS } from '@/data/mock/orders';
import { PRODUCTS } from '@/data/mock/products';
import { COMPANY } from '@/data/mock/users';
import { LEDGER } from '@/data/mock/ledger';
import { applyOperation, cents, type FinanceState, type Operation } from './domain';

export interface Pending {
  op: Operation;
  error?: string;
}
interface Disk {
  previousScope?: string;
  base: FinanceState;
  pending: Pending[];
  rejected?: Pending[];
  lastSync?: string;
  url?: string;
  actorId?: string;
  permissions?: string[];
}
export interface FinanceSnapshot {
  state?: FinanceState;
  pending: Pending[];
  rejected?: Pending[];
  ready: boolean;
  syncing: boolean;
  online: boolean;
  mode: 'demo' | 'server';
  error?: string;
  lastSync?: string;
  actorId?: string;
  authenticated: boolean;
  permissions?: string[];
}
const DEMO = 'darb.finance.demo.v1';
const PRESENTATION = 'darb.finance.presentation.';
const isDemo = () => scope === DEMO || scope.startsWith(PRESENTATION);
let scope = DEMO;
let disk: Disk;
let token: string | undefined;
let snapshot: FinanceSnapshot = {
  pending: [],
  ready: false,
  syncing: false,
  online: true,
  mode: 'demo',
  authenticated: false,
};
const listeners = new Set<() => void>();
let lock: Promise<unknown> = Promise.resolve();
const serial = <T>(fn: () => Promise<T>): Promise<T> => {
  const run = async () => {
    const execute = async () => {
      if (snapshot.ready && disk) {
        const latest = await AsyncStorage.getItem(scope);
        if (latest) disk = JSON.parse(latest);
      }
      return fn();
    };
    return Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.locks
      ? navigator.locks.request('darb.finance.writer', execute)
      : execute();
  };
  const next = lock.then(run, run);
  lock = next.catch(() => {});
  return next;
};
const publish = (patch: Partial<FinanceSnapshot>) => {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((fn) => fn());
};
function seed(): FinanceState {
  const orders = ORDERS.map((o) => ({
    id: o.id,
    customerId: o.customerId,
    actorId: o.repId,
    date: o.createdAt,
    total: cents(o.total),
    status: o.status,
    items: o.items.map((i) => ({
      ...i,
      unitPrice: cents(i.unitPrice),
      name: PRODUCTS.find((p) => p.id === i.productId)?.name ?? i.productId,
      unit: PRODUCTS.find((p) => p.id === i.productId)?.unit,
    })),
  }));
  return {
    version: 1,
    companyId: COMPANY.id,
    companyName: COMPANY.name,
    products: PRODUCTS.map((p) => ({ id: p.id, name: p.name, price: cents(p.price), unit: p.unit })),
    customers: CUSTOMERS.map((c) => ({
      id: c.id,
      name: c.shopName,
      phone: c.phone,
      opening: cents(c.balance),
    })),
    orders,
    invoices: orders
      .filter((o) => o.status === 'delivered')
      .map((o) => ({
        id: `inv_${o.id}`,
        orderId: o.id,
        customerId: o.customerId,
        date: o.date,
        total: o.total,
        items: o.items,
      })),
    entries: LEDGER.map((e) => ({
      id: e.id,
      customerId: e.customerId,
      date: e.date,
      kind: 'opening',
      debit: cents(e.debit),
      credit: cents(e.credit),
      reference: e.description,
    })),
    receipts: [],
    returns: [],
    deposits: [],
    accepted: [],
  };
}
function projected(d: Disk) {
  let state = d.base;
  for (const p of d.pending) {
    if (p.error) break;
    try {
      state = applyOperation(state, p.op);
    } catch {
      break;
    }
  }
  return state;
}
async function save(next: Disk) {
  try {
    await AsyncStorage.setItem(scope, JSON.stringify(next));
  } catch {
    throw new Error('storage');
  } // Publish only after durable storage succeeds.
  disk = next;
  publish({
    state: projected(next),
    pending: next.pending,
    rejected: next.rejected,
    lastSync: next.lastSync,
    actorId: next.actorId,
    permissions: next.permissions,
  });
}
async function request<T>(
  path: string,
  body?: unknown,
  override?: { url: string; token?: string },
): Promise<T> {
  const url = override?.url ?? disk.url;
  if (!url) throw new Error('connection');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${url}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...((override?.token ?? token) ? { Authorization: `Bearer ${override?.token ?? token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const value = await response.json();
    if (!response.ok)
      throw new Error(
        response.status === 401
          ? 'session'
          : (value.code ??
              (response.status === 403
                ? 'permission'
                : response.status === 409
                  ? 'conflict'
                  : response.status === 400
                    ? 'invalid'
                    : 'server')),
      );
    return value;
  } catch (error) {
    if (
      error instanceof Error &&
      [
        'server',
        'session',
        'permission',
        'amount',
        'quantity',
        'duplicateInvoice',
        'duplicateCheque',
        'chequeState',
        'saleCustomer',
        'saleRecord',
        'saleItem',
        'returnState',
        'inspection',
        'inspectionQuantity',
        'inspectionCode',
        'reviewNote',
        'reviewSelf',
        'wallet',
        'order',
        'customer',
        'reason',
        'photo',
        'invalid',
        'conflict',
        'scope',
      ].includes(error.message)
    )
      throw error;
    throw new Error('connection');
  } finally {
    clearTimeout(timer);
  }
}
async function storeToken(value?: string, tokenScope = scope) {
  const key = `${tokenScope}.token`;
  if (Platform.OS === 'web') {
    if (value) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  } else if (value) await SecureStore.setItemAsync(key, value);
  else await SecureStore.deleteItemAsync(key);
}
export const financeRepository = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  getSnapshot: () => snapshot,
  init: () =>
    serial(async () => {
      if (snapshot.ready) return;
      try {
        scope = (await AsyncStorage.getItem('darb.finance.active')) ?? DEMO;
        const raw = await AsyncStorage.getItem(scope);
        if (raw) {
          disk = JSON.parse(raw);
          if (disk.base.version !== 1) throw new Error('storage');
        } else {
          if (!isDemo()) throw new Error('storage');
          disk = { base: seed(), pending: [] };
          await AsyncStorage.setItem(scope, JSON.stringify(disk));
        }
        token =
          Platform.OS === 'web'
            ? (sessionStorage.getItem(`${scope}.token`) ?? undefined)
            : ((await SecureStore.getItemAsync(`${scope}.token`)) ?? undefined);
        publish({
          ready: true,
          state: projected(disk),
          pending: disk.pending,
          rejected: disk.rejected,
          mode: isDemo() ? 'demo' : 'server',
          actorId: disk.actorId,
          lastSync: disk.lastSync,
          authenticated: !!token,
          permissions: disk.permissions,
          error: undefined,
        });
      } catch {
        publish({ error: 'storage', ready: false });
      }
    }),
  setOnline(online: boolean) {
    publish({ online });
    if (online) void financeRepository.sync();
  },
  submit: (op: Operation) =>
    serial(async () => {
      if (!snapshot.ready || !disk) throw new Error('storage');
      if (disk.pending.some((p) => p.error)) throw new Error('blocked');
      if (!isDemo() && disk.actorId !== op.actorId) throw new Error('scope');
      applyOperation(projected(disk), op);
      if (isDemo()) await save({ ...disk, base: applyOperation(disk.base, op) });
      else await save({ ...disk, pending: [...disk.pending, { op }] });
      publish({ error: undefined });
      setTimeout(() => void financeRepository.sync(), 0);
    }),
  sync: () =>
    serial(async () => {
      if (!snapshot.ready || isDemo() || !snapshot.online || !token) return;
      publish({ syncing: true, error: undefined });
      try {
        // Always pull first: a previous POST may have committed before its response was lost.
        const result = await request<{ state: FinanceState; permissions: string[] }>('/api/v1/finance');
        if (result.state.companyId !== disk.base.companyId) throw new Error('scope');
        let pending = disk.pending.filter((p) => !result.state.accepted.includes(p.op.id));
        await save({ ...disk, base: result.state, pending, permissions: result.permissions });
        while (pending.length) {
          const first = pending[0];
          try {
            const response = await request<{ state: FinanceState }>('/api/v1/finance/sync', first.op);
            if (response.state.companyId !== disk.base.companyId) throw new Error('scope');
            pending = pending.slice(1);
            await save({ ...disk, base: response.state, pending, lastSync: new Date().toISOString() });
          } catch (error) {
            const code = error instanceof Error ? error.message : 'server';
            if (!['connection', 'session', 'server', 'storage'].includes(code))
              await save({ ...disk, pending: [{ ...first, error: code }, ...pending.slice(1)] });
            throw error;
          }
        }
        await save({ ...disk, lastSync: new Date().toISOString() });
      } catch (error) {
        publish({ error: error instanceof Error ? error.message : 'server' });
      } finally {
        publish({ syncing: false });
      }
    }),
  connect: (url: string, email: string, password: string, companySlug: string) =>
    serial(async () => {
      const normalized = url.trim().replace(/\/+$/, '');
      if (!/^https?:\/\/[^\s]+$/.test(normalized)) throw new Error('connection');
      // Credentials are sent only to the explicitly entered URL. Tokens never enter the outbox.
      const login = await request<{ token: string; user: { id: string; companyId: string } }>(
        '/api/v1/auth/login',
        { email, password, companySlug },
        { url: normalized },
      );
      if (!login.token || !login.user?.companyId) throw new Error('session');
      const result = await request<{ state: FinanceState; permissions: string[] }>(
        '/api/v1/finance',
        undefined,
        { url: normalized, token: login.token },
      );
      if (result.state.companyId !== login.user.companyId) throw new Error('scope');
      const nextScope = `darb.finance.${login.user.companyId}.${login.user.id}.v1`;
      const saved = await AsyncStorage.getItem(nextScope);
      const old: Disk | undefined = saved ? JSON.parse(saved) : undefined;
      const next: Disk = {
        base: result.state,
        pending: (old?.pending ?? []).filter((p) => !result.state.accepted.includes(p.op.id)),
        rejected: old?.rejected,
        url: normalized,
        actorId: login.user.id,
        lastSync: new Date().toISOString(),
        permissions: result.permissions,
      };
      await AsyncStorage.setItem(nextScope, JSON.stringify(next));
      await storeToken(login.token, nextScope);
      await AsyncStorage.setItem('darb.finance.active', nextScope);
      scope = nextScope;
      token = login.token;
      disk = next;
      publish({
        state: projected(next),
        pending: next.pending,
        rejected: next.rejected,
        actorId: next.actorId,
        lastSync: next.lastSync,
        mode: 'server',
        authenticated: true,
        permissions: next.permissions,
        error: undefined,
      });
      setTimeout(() => void financeRepository.sync(), 0);
    }),
  startPresentation: () =>
    serial(async () => {
      const previousScope = disk.previousScope ?? scope;
      const nextScope = PRESENTATION + Date.now() + '.' + Math.random().toString(36).slice(2);
      const date = new Date().toISOString();
      const items = [
        {
          productId: 'presentation-product',
          name: 'كرتونة مياه للعرض',
          quantity: 2,
          unitPrice: 5000,
          unit: 'كرتونة',
        },
      ];
      const next: Disk = {
        previousScope,
        pending: [],
        base: {
          version: 1,
          companyId: 'darb-presentation',
          companyName: 'شركة العرض — بيانات وهمية',
          customers: [{ id: 'presentation-customer', name: 'بقالة العرض', phone: '', opening: 0 }],
          products: [{ id: 'presentation-product', name: items[0].name, price: 5000, unit: 'كرتونة' }],
          orders: [
            {
              id: 'presentation-order',
              customerId: 'presentation-customer',
              actorId: 'u_accountant',
              date,
              items,
              total: 10000,
              status: 'delivered',
            },
          ],
          invoices: [],
          receipts: [],
          returns: [],
          entries: [],
          deposits: [],
          accepted: [],
        },
      };
      await AsyncStorage.setItem(nextScope, JSON.stringify(next));
      await AsyncStorage.setItem('darb.finance.active', nextScope);
      scope = nextScope;
      disk = next;
      token = undefined;
      await save(next);
      publish({ mode: 'demo', authenticated: false, error: undefined });
    }),
  exitPresentation: () =>
    serial(async () => {
      const previousScope = disk.previousScope;
      if (!scope.startsWith(PRESENTATION) || !previousScope) throw new Error('scope');
      const raw = await AsyncStorage.getItem(previousScope);
      if (!raw) throw new Error('storage');
      const previous: Disk = JSON.parse(raw);
      if (previous.base.version !== 1) throw new Error('storage');
      const previousToken =
        Platform.OS === 'web'
          ? (sessionStorage.getItem(previousScope + '.token') ?? undefined)
          : ((await SecureStore.getItemAsync(previousScope + '.token')) ?? undefined);
      await AsyncStorage.setItem('darb.finance.active', previousScope);
      scope = previousScope;
      disk = previous;
      token = previousToken;
      await save(previous);
      publish({ mode: isDemo() ? 'demo' : 'server', authenticated: !!token, error: undefined });
    }),
  useDemo: () =>
    serial(async () => {
      await storeToken();
      await AsyncStorage.setItem('darb.finance.active', DEMO);
      scope = DEMO;
      token = undefined;
      const saved = await AsyncStorage.getItem(scope);
      disk = saved ? JSON.parse(saved) : { base: seed(), pending: [] };
      await save(disk);
      publish({ mode: 'demo', authenticated: false, error: undefined });
    }),
  archiveRejected: (id: string) =>
    serial(async () => {
      const first = disk.pending[0];
      if (!first || first.op.id !== id || !first.error) throw new Error('invalid');
      await save({ ...disk, pending: disk.pending.slice(1), rejected: [...(disk.rejected ?? []), first] });
      publish({ error: undefined });
      setTimeout(() => void financeRepository.sync(), 0);
    }),
};
