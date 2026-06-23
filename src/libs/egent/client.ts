import { getActiveWorkspaceId } from '@/business/client/hooks/useActiveWorkspaceId';

// Default is the Ory Oathkeeper edge (:4455), which validates the Kratos
// session and injects X-User-Id before path-routing /v1/* to egent-lobehub
// (:10531, localhost-only). Do NOT bypass Oathkeeper by pointing this at
// :10531 directly — that skips authentication. Override via NEXT_PUBLIC_EGENT_URL.
const DEFAULT_EGENT_URL = 'http://localhost:4455';

let cachedUrl: string | null = null;

/**
 * Returns the egent-lobehub base URL (the Oathkeeper auth edge).
 * Reads NEXT_PUBLIC_EGENT_URL at runtime (browser-safe via window global).
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
