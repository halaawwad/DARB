/**
 * HTTP client. Callers pass the full path (`/api/v1/...`).
 * `configureApiAuth` (called once by authStore) supplies the bearer token and a
 * 401 handler, so this file never imports the store.
 * To plug other backend endpoints in, write `src/services/http/<name>Service.ts`
 * implementations of the interfaces in `services/types.ts` using `api()`,
 * then swap them in `services/index.ts`.
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

let getToken: () => string | undefined = () => undefined;
let onUnauthorized: () => void = () => {};

export function configureApiAuth(options: { getToken: () => string | undefined; onUnauthorized: () => void }) {
  getToken = options.getToken;
  onUnauthorized = options.onUnauthorized;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** Attach the bearer token (default true). */
  auth?: boolean;
  timeoutMs?: number;
}

export async function api<T>(
  path: string,
  { method = 'GET', body, signal, auth = true, timeoutMs = 12000 }: RequestOptions = {},
): Promise<T> {
  if (!API_BASE_URL) throw new ApiError('EXPO_PUBLIC_API_URL is not set. Restart Expo after configuring the local environment.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  const token = auth ? getToken() : undefined;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      signal: controller.signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      controller.signal.aborted
        ? 'The connection timed out. Please try again.'
        : 'Cannot reach the server. Check your connection and that the phone and computer are on the same Wi-Fi.',
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401 && token) onUnauthorized();

  if (!response.ok) {
    let message = `Request failed: ${method} ${path}`;
    try {
      const data = (await response.json()) as { error?: unknown };
      if (typeof data.error === 'string') message = data.error;
    } catch {
      /* body was not JSON */
    }
    throw new ApiError(message, response.status);
  }
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