import type { PermissionKey } from '@/features/admin/roles';
import { useAuthStore } from '@/store/authStore';

/** `const canEdit = useHasPermission('products:write');` re-renders if the grants change. */
export function useHasPermission(permission: PermissionKey): boolean {
  return useAuthStore((s) => s.user?.permissions.includes(permission) ?? false);
}