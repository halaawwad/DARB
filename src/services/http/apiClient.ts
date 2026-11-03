/**
 * HTTP client for the temporary real login test. Other feature services remain mocked.
 * To plug other backend endpoints in,
 * write `src/services/http/<name>Service.ts` implementations of the interfaces
 * in `services/types.ts` using `api()`, then swap them in `services/index.ts`.
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

export async function api<T>(path: string, { method = 'GET', body, signal }: RequestOptions = {}): Promise<T> {
  if (!API_BASE_URL) throw new ApiError('EXPO_PUBLIC_API_URL is not set. Restart Expo after configuring the local environment.');
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      signal,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(signal?.aborted ? 'The connection timed out. Please try again.' : 'Cannot reach the server. Check your connection and that the phone and computer are on the same Wi-Fi.');
  }
  if (!response.ok) throw new ApiError(`Request failed: ${method} ${path}`, response.status);
  return (response.status === 204 ? undefined : await response.json()) as T;
}

/** Connection test only: return a display name, never a JWT or persistent session. */
export async function testLogin(email: string, password: string, companySlug?: string): Promise<string> {
  const slug = companySlug?.trim() || (typeof __DEV__ !== 'undefined' && __DEV__ ? process.env.EXPO_PUBLIC_DEV_COMPANY_SLUG?.trim() : undefined);
  if (!email.trim() || !password || !slug) throw new ApiError('Email, password and company are required.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const result = await api<{ user?: { fullName?: string; firstName?: string; lastName?: string; email?: string } }>('/api/v1/auth/login', {
      method: 'POST', signal: controller.signal, body: { email: email.trim(), password, companySlug: slug },
    });
    const user = result?.user;
    const name = user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email;
    if (!name) throw new ApiError('The server returned an unexpected login response.');
    return name;
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) throw new ApiError('Incorrect email, password or company.', 401);
      if (error.status === 400) throw new ApiError('Check your email, password and company.', 400);
      throw error;
    }
    throw new ApiError('Login could not be completed. Please try again.');
  } finally { clearTimeout(timer); }
}
