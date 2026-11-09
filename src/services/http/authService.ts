import { ROLE_FROM_BACKEND } from '@/features/admin/roles';
import type { AuthUser, LoginInput , RegisterInput } from '@/types';

import { ApiError, api } from './apiClient';

interface LoginResponse {
  token: string;
}

interface MeResponse {
  user: {
    id: string;
    companyId: string;
    email: string;
    firstName: string;
    lastName: string;
    fullName?: string;
    phone?: string | null;
    role: string;
  };
  company: { id: string; name: string; slug: string };
  permissions: string[];
}

/** Returns the JWT. Role and permissions come from /auth/me, not from login. */
export async function requestLogin({ email, password, companySlug }: LoginInput): Promise<string> {
  const slug = companySlug?.trim();
  const data = await api<LoginResponse>('/api/v1/auth/login', {
    method: 'POST',
    auth: false,
    body: { email: email.trim().toLowerCase(), password, ...(slug ? { companySlug: slug } : {}) },
  });
  if (!data?.token) throw new ApiError('The server returned an unexpected login response.');
  return data.token;
}

export async function fetchMe(): Promise<AuthUser> {
  const data = await api<MeResponse>('/api/v1/auth/me');
  const { user, company } = data;
  return {
    id: user.id,
    companyId: user.companyId,
    companyName: company.name,
    email: user.email,
    fullName: user.fullName || `${user.firstName} ${user.lastName}`.trim(),
    phone: user.phone ?? null,
    roleName: user.role,
    role: ROLE_FROM_BACKEND[user.role],
    permissions: data.permissions ?? [],
  };
}

export async function requestRegister(input: RegisterInput): Promise<string> {
  const data = await api<LoginResponse>('/api/v1/auth/register', {
    method: 'POST',
    auth: false,
    body: {
      companyName: input.companyName.trim(),
      companySlug: input.companySlug.trim().toLowerCase(),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: input.email.trim().toLowerCase(),
      password: input.password,
    },
  });
  if (!data?.token) throw new ApiError('The server returned an unexpected response.');
  return data.token;
}