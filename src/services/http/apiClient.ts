/**
 * HTTP client stub for the future backend (Node + Socket.IO + PostgreSQL/PostGIS).
 * Nothing calls this yet — every service is mocked. To plug the backend in,
 * write `src/services/http/<name>Service.ts` implementations of the interfaces
 * in `services/types.ts` using `api()`, then swap them in `services/index.ts`.
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '');

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
  if (!API_BASE_URL) throw new ApiError('EXPO_PUBLIC_API_BASE_URL is not set');
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    signal,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new ApiError(`Request failed: ${method} ${path}`, response.status);
  return (response.status === 204 ? undefined : await response.json()) as T;
}
