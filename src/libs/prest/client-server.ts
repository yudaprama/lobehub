import { PrestClient } from 'prest-js-sdk';
import { lobehubClient } from 'prest-js-sdk/lobehub';

import { getKratosSession } from '@/libs/kratos/server-session';

const DEFAULT_PREST_URL = 'http://localhost:3000';

/**
 * Server-side PrestClient factory.
 *
 * Unlike the browser singleton (`getPrestClient`), each call builds a fresh
 * client scoped to the current request's Kratos session. This is the pattern
 * for RSC, route handlers, and any server-only code.
 *
 * Returns `null` when no Kratos session exists so callers can fall back to
 * the legacy `lambdaClient` tRPC path during the migration.
 */
export async function getPrestServerClient(headers: Headers): Promise<PrestClient | null> {
  const session = await getKratosSession(headers);
  if (!session) return null;

  const prestUrl = process.env.PREST_URL ?? DEFAULT_PREST_URL;
  return new PrestClient({ prestUrl, authToken: session.user.id });
}

export async function getLobehubServerQueryClient(headers: Headers) {
  const client = await getPrestServerClient(headers);
  return client ? lobehubClient(client) : null;
}
