import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { services } from '@/services';
import { usePreferencesStore } from '@/store/preferencesStore';
import type { CreateOrderInput } from '@/types';

/** One place for query keys so invalidation never misses a screen. */
export const queryKeys = {
  user: (role: string) => ['user', role] as const,
  company: ['company'] as const,
  users: ['users'] as const,
  plan: (userId: string) => ['plan', userId] as const,
  customers: ['customers'] as const,
  customer: (id: string) => ['customers', id] as const,
  ledger: (customerId: string) => ['ledger', customerId] as const,
  insight: (customerId: string) => ['insight', customerId] as const,
  orders: (filter?: object) => ['orders', filter ?? {}] as const,
  products: ['products'] as const,
  checkpoints: ['checkpoints'] as const,
  roadReports: ['roadReports'] as const,
};

/** The signed-in user for the chosen demo role. */
export function useCurrentUser() {
  const role = usePreferencesStore((s) => s.role);
  return useQuery({
    queryKey: queryKeys.user(role ?? 'none'),
    queryFn: () => services.users.currentUser(role!),
    enabled: Boolean(role),
    staleTime: Infinity,
  });
}

export const useCompany = () =>
  useQuery({ queryKey: queryKeys.company, queryFn: () => services.users.company(), staleTime: Infinity });

export const useUsers = () => useQuery({ queryKey: queryKeys.users, queryFn: () => services.users.list() });

export function useTodayPlan(userId?: string) {
  return useQuery({
    queryKey: queryKeys.plan(userId ?? 'none'),
    queryFn: () => services.users.todayPlan(userId!),
    enabled: Boolean(userId),
  });
}

export const useCustomers = () =>
  useQuery({ queryKey: queryKeys.customers, queryFn: () => services.customers.list() });

export const useCustomer = (id: string) =>
  useQuery({ queryKey: queryKeys.customer(id), queryFn: () => services.customers.get(id) });

export const useLedger = (customerId: string) =>
  useQuery({ queryKey: queryKeys.ledger(customerId), queryFn: () => services.customers.ledger(customerId) });

export const useInsight = (customerId: string) =>
  useQuery({ queryKey: queryKeys.insight(customerId), queryFn: () => services.customers.insight(customerId) });

export const useOrders = (filter?: { customerId?: string; repId?: string }) =>
  useQuery({ queryKey: queryKeys.orders(filter), queryFn: () => services.orders.list(filter) });

export const useProducts = () =>
  useQuery({ queryKey: queryKeys.products, queryFn: () => services.products.list(), staleTime: Infinity });

export const useCheckpoints = () =>
  useQuery({ queryKey: queryKeys.checkpoints, queryFn: () => services.roads.checkpoints() });

export const useRoadReports = () =>
  useQuery({ queryKey: queryKeys.roadReports, queryFn: () => services.roads.roadReports() });

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrderInput) => services.orders.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
  });
}
