import { API_BASE_URL } from '@/config';
import { tokenStorage } from '@/auth/tokenStorage';

export class ApiRequestError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

type Method = 'GET' | 'POST';

interface RequestOptions {
  method?: Method;
  body?: unknown;
  auth?: boolean;
}

let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

export async function storeTokens(tokens: TokenPair): Promise<void> {
  accessToken = tokens.accessToken;
  await tokenStorage.setRefreshToken(tokens.refreshToken);
}

export async function clearTokens(): Promise<void> {
  accessToken = null;
  await tokenStorage.clearRefreshToken();
}

async function send(path: string, options: RequestOptions, accept = 'application/json'): Promise<Response> {
  const headers: Record<string, string> = { Accept: accept };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.auth !== false && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    });
  } catch {
    throw new ApiRequestError(0, 'NETWORK');
  }
}

async function errorFrom(response: Response): Promise<ApiRequestError> {
  let message = `Request failed (${response.status})`;
  try {
    const body = await response.json();
    message = body?.error?.message || body?.message || message;
  } catch {
    // Non-JSON error body (e.g. proxy error page)
  }
  return new ApiRequestError(response.status, message);
}

/** Exchanges the stored refresh token for new tokens. Concurrent callers share one request. */
export function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = await tokenStorage.getRefreshToken();
      if (!refreshToken) return false;
      const response = await send('/auth/refresh', { method: 'POST', body: { refreshToken }, auth: false });
      if (!response.ok) {
        if (response.status === 401) await clearTokens();
        return false;
      }
      const { data } = await response.json();
      await storeTokens(data);
      return true;
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function authorizedFetch(path: string, options: RequestOptions, accept?: string): Promise<Response> {
  let response = await send(path, options, accept);
  if (response.status === 401 && options.auth !== false) {
    const refreshed = await refreshSession();
    if (refreshed) {
      response = await send(path, options, accept);
    }
    if (response.status === 401) {
      onSessionExpired?.();
    }
  }
  return response;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await authorizedFetch(path, options);
  if (!response.ok) throw await errorFrom(response);
  const body = await response.json();
  return body.data as T;
}

/** For server-rendered HTML (receipts) shown in a WebView. */
export async function apiHtml(path: string): Promise<string> {
  const response = await authorizedFetch(path, {}, 'text/html');
  if (!response.ok) throw await errorFrom(response);
  return response.text();
}
