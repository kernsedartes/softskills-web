const BASE = '/api';

async function request(method: string, path: string, token?: string | null, body?: unknown) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка запроса');
  return data;
}

export const api = {
  get:    (path: string, token?: string | null) => request('GET', path, token),
  post:   (path: string, body: unknown, token?: string | null) => request('POST', path, token, body),
  patch:  (path: string, body: unknown, token?: string | null) => request('PATCH', path, token, body),
  delete: (path: string, token?: string | null) => request('DELETE', path, token),
};
