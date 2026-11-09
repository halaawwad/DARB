import type { Role } from './user';

export interface AuthUser {
  id: string;
  companyId: string;
  companyName: string;
  email: string;
  fullName: string;
  phone?: string | null;
  roleName: string;
  role?: Role;
  permissions: string[];
}

export interface LoginInput {
  email: string;
  password: string;
  companySlug?: string;
}

export interface RegisterInput {
  companyName: string;
  companySlug: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}