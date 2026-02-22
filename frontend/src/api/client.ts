const API_BASE = 'http://localhost:3000/api/v1';
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
  return headers;
}

async function ensureOk(res: Response, method: string, path: string) {
  if (res.ok) {
    return;
  }
  if (res.status === 401) {
    throw new Error('UNAUTHORIZED');
  }
  if (res.status === 403) {
    throw new Error('FORBIDDEN');
  }
  let detail = '';
  try {
    const body = await res.json();
    const raw = typeof body?.message === 'string' ? body.message : '';
    detail = raw ? `: ${raw}` : '';
  } catch {
    detail = '';
  }
  throw new Error(`${method} ${path} failed${detail}`);
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
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
