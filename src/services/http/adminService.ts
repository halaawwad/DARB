import { api } from './apiClient';

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  role: string | null;
  createdAt: string;
}

export interface EmployeeCreateInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  role: string;
}

export interface EmployeeUpdateInput {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  password?: string;
  role?: string;
  isActive?: boolean;
}

export interface RoleInfo {
  id: string;
  name: string;
  description: string | null;
  locked: boolean;
  userCount: number;
  permissions: string[];
}

export interface RoleList {
  roles: RoleInfo[];
  permissions: string[];
}

export const adminService = {
  async listEmployees(): Promise<Employee[]> {
    return (await api<{ users: Employee[] }>('/api/v1/users')).users;
  },
  async createEmployee(input: EmployeeCreateInput): Promise<Employee> {
    return (await api<{ user: Employee }>('/api/v1/users', { method: 'POST', body: input })).user;
  },
  async updateEmployee(id: string, input: EmployeeUpdateInput): Promise<Employee> {
    return (await api<{ user: Employee }>(`/api/v1/users/${id}`, { method: 'PUT', body: input })).user;
  },
  listRoles(): Promise<RoleList> {
    return api<RoleList>('/api/v1/roles');
  },
  /** Replaces the role's whole permission set. The server rejects manager/admin and keys you don't hold. */
  async updateRolePermissions(id: string, permissions: string[]): Promise<void> {
    await api(`/api/v1/roles/${id}/permissions`, { method: 'PUT', body: { permissions } });
  },
};