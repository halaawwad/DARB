import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  adminService,
  type EmployeeCreateInput,
  type EmployeeUpdateInput,
} from '@/services/http/adminService';
import { refreshUser } from '@/store/authStore';

export const adminKeys = {
  employees: ['admin', 'employees'] as const,
  roles: ['admin', 'roles'] as const,
};

/** `enabled` stays false in demo mode (no token) or without the permission. */
export const useEmployees = (enabled = true) =>
  useQuery({ queryKey: adminKeys.employees, queryFn: () => adminService.listEmployees(), enabled });

export const useRoleList = (enabled = true) =>
  useQuery({ queryKey: adminKeys.roles, queryFn: () => adminService.listRoles(), enabled });

function useRefreshAdminData() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.employees }),
      queryClient.invalidateQueries({ queryKey: adminKeys.roles }),
    ]);
}

export function useCreateEmployee() {
  const refresh = useRefreshAdminData();
  return useMutation({
    mutationFn: (input: EmployeeCreateInput) => adminService.createEmployee(input),
    onSuccess: refresh,
  });
}

export function useUpdateEmployee() {
  const refresh = useRefreshAdminData();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: EmployeeUpdateInput }) => adminService.updateEmployee(id, input),
    onSuccess: refresh,
  });
}

export function useUpdateRolePermissions() {
  const refresh = useRefreshAdminData();
  return useMutation({
    mutationFn: ({ id, permissions }: { id: string; permissions: string[] }) =>
      adminService.updateRolePermissions(id, permissions),
    onSuccess: async () => {
      await refresh();
      // If the edited role is your own, your cached buttons update right away.
      void refreshUser();
    },
  });
}