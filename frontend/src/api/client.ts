export const API_BASE = (import.meta as any).env?.VITE_API_BASE || '/api/v1';
export const TOKEN_KEY = 'projectlvqi_token';
export const USER_KEY = 'projectlvqi_user';

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function buildHeaders(withJson = true): HeadersInit {
  const headers: Record<string, string> = {};
  if (withJson) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const activeOrgId = localStorage.getItem('activeOrgId');
  if (activeOrgId) {
    headers['X-Org-Id'] = activeOrgId;
  }
  return headers;
}

async function ensureOk(res: Response, method: string, path: string) {
  if (res.ok) {
    return;
  }
  let body: any = null;
  let message = '';
  try {
    body = await res.json();
    message = typeof body?.message === 'string' ? body.message : '';
  } catch {
    body = null;
    message = '';
  }
  if (res.status === 401) {
    const error = new Error(message || 'UNAUTHORIZED') as Error & { status?: number; errorCode?: string | null };
    error.status = 401;
    error.errorCode = typeof body?.errorCode === 'string' ? body.errorCode : 'HTTP-401';
    throw error;
  }
  if (res.status === 403) {
    const error = new Error(message || 'FORBIDDEN') as Error & { status?: number; errorCode?: string | null };
    error.status = 403;
    error.errorCode = typeof body?.errorCode === 'string' ? body.errorCode : 'HTTP-403';
    throw error;
  }
  const detail = message ? `: ${message}` : '';
  const error = new Error(`${method} ${path} failed${detail}`) as Error & { status?: number; errorCode?: string | null };
  error.status = res.status;
  error.errorCode = typeof body?.errorCode === 'string' ? body.errorCode : `HTTP-${res.status}`;
  throw error;
}

export async function apiGet<T>(path: string): Promise<T> {
  const url = `${API_BASE}${path}`;
  console.debug('[apiGet]', url);
  const res = await fetch(url, {
    headers: buildHeaders(false)
  });
  await ensureOk(res, 'GET', path);
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: buildHeaders(true),
    body: JSON.stringify(body)
  });
  await ensureOk(res, 'POST', path);
  return res.json() as Promise<T>;
}

export async function apiPatch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: buildHeaders(true),
    body: JSON.stringify(body)
  });
  await ensureOk(res, 'PATCH', path);
  return res.json() as Promise<T>;
}

export async function apiPut<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: buildHeaders(true),
    body: JSON.stringify(body)
  });
  await ensureOk(res, 'PUT', path);
  return res.json() as Promise<T>;
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: buildHeaders(false)
  });
  await ensureOk(res, 'DELETE', path);
}
