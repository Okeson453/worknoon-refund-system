import type { ApiErrorEnvelope } from '../types/api';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';
const REQUEST_TIMEOUT_MS = 20_000;
const ADMIN_KEY_STORAGE = 'worknoon.adminKey';

export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId: string;
  readonly details: Array<{ path: string; message: string }>;

  constructor(status: number, envelope: ApiErrorEnvelope) {
    super(envelope.error.message);
    this.name = 'ApiRequestError';
    this.code = envelope.error.code;
    this.status = status;
    this.requestId = envelope.error.requestId;
    this.details = envelope.error.details ?? [];
  }
}

/** The admin key is entered at runtime and kept in session storage; it never ships in the bundle. */
export function getAdminKey(): string {
  try {
    return window.sessionStorage.getItem(ADMIN_KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

export function setAdminKey(value: string): void {
  try {
    if (value.length === 0) window.sessionStorage.removeItem(ADMIN_KEY_STORAGE);
    else window.sessionStorage.setItem(ADMIN_KEY_STORAGE, value);
  } catch {
    // Storage is unavailable in private browsing modes; the session simply stays unauthenticated.
  }
}

function buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return `${url.pathname}${url.search}`;
}

async function request<T>(
  method: 'GET' | 'POST',
  path: string,
  body: unknown,
  signal: AbortSignal | undefined,
  query?: Record<string, string | number | undefined>,
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = (): void => controller.abort();
  signal?.addEventListener('abort', onAbort);

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const adminKey = getAdminKey();
  if (adminKey.length > 0) headers.Authorization = `Bearer ${adminKey}`;

  try {
    const response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const envelope = payload as ApiErrorEnvelope | null;
      throw new ApiRequestError(
        response.status,
        envelope?.error
          ? envelope
          : { error: { code: 'INTERNAL_ERROR', message: 'The service returned an unexpected response.', requestId: 'n/a' } },
      );
    }
    return payload as T;
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiRequestError(408, { error: { code: 'INTERNAL_ERROR', message: 'The request took too long. Please try again.', requestId: 'timeout' } });
    }
    throw new ApiRequestError(0, { error: { code: 'INTERNAL_ERROR', message: 'Cannot reach the refund service.', requestId: 'offline' } });
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
  }
}

export const api = {
  get: <T>(path: string, options: { signal?: AbortSignal; query?: Record<string, string | number | undefined> } = {}): Promise<T> =>
    request<T>('GET', path, undefined, options.signal, options.query),
  post: <T>(path: string, body: unknown, options: { signal?: AbortSignal } = {}): Promise<T> =>
    request<T>('POST', path, body, options.signal),
};
