'use client';

/**
 * Every mutating request carries the CSRF token from the readable cookie.
 * Centralised here so no call site can forget it.
 */
function csrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)baytna_csrf=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : '';
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly issues?: { path: string; message: string }[] | string[],
  ) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;

async function refreshOnce(): Promise<boolean> {
  // Collapse parallel 401s into a single refresh, otherwise every in-flight
  // request rotates the token and all but one of them fail.
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => { refreshing = null; });
  return refreshing;
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit & { json?: unknown; retry?: boolean } = {},
): Promise<T> {
  const { json, retry = true, ...rest } = init;
  const method = rest.method ?? (json ? 'POST' : 'GET');

  const headers = new Headers(rest.headers);
  if (json !== undefined) headers.set('Content-Type', 'application/json');
  if (method !== 'GET' && method !== 'HEAD') headers.set('x-csrf-token', csrfToken());

  const res = await fetch(path, {
    ...rest,
    method,
    headers,
    credentials: 'same-origin',
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  // A 15-minute access token will expire mid-session; refresh and replay once.
  if (res.status === 401 && retry && !path.startsWith('/api/auth/refresh')) {
    if (await refreshOnce()) return api<T>(path, { ...init, retry: false });
  }

  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return { error: text }; } })() : {};

  if (!res.ok) {
    throw new ApiError(data.error ?? 'Request failed', res.status, data.code, data.issues);
  }
  return data as T;
}

export async function upload<T = unknown>(path: string, files: File[]): Promise<T> {
  const form = new FormData();
  for (const f of files) form.append('files', f);
  const res = await fetch(path, {
    method: 'POST',
    body: form,
    credentials: 'same-origin',
    headers: { 'x-csrf-token': csrfToken() },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? 'Upload failed', res.status, data.code);
  return data as T;
}
