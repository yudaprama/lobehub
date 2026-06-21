import { getActiveWorkspaceId } from '@/business/client/hooks/useActiveWorkspaceId';

const DEFAULT_EGENT_URL = 'http://localhost:10531';

let cachedUrl: string | null = null;

/**
 * Returns the egent-lobehub base URL.
 * Reads NEXT_PUBLIC_EGENT_URL at runtime (browser-safe via window global).
 * Falls back to localhost for local development.
 */
export function getEgentUrl(): string {
  if (cachedUrl !== null) return cachedUrl;
  const resolved: string =
    (typeof window !== 'undefined'
      ? (window as any).__EGENT_URL__
      : process.env.NEXT_PUBLIC_EGENT_URL) || DEFAULT_EGENT_URL;
  cachedUrl = resolved;
  return resolved;
}

/**
 * Authenticated fetch wrapper for egent-lobehub HTTP endpoints.
 * Forwards the Kratos session cookie (already in browser cookies)
 * and optional workspace header.
 *
 * Usage:
 *   const res = await egentFetch('/v1/files/create', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ name: 'test.txt', ... }),
 *   });
 *   return res.json();
 */
export async function egentFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${getEgentUrl()}${path}`;
  const headers = new Headers(init?.headers);

  const workspaceId = getActiveWorkspaceId();
  if (workspaceId) {
    headers.set('X-Workspace-ID', workspaceId);
  }

  return fetch(url, {
    ...init,
    headers,
    credentials: 'include',
  });
}
