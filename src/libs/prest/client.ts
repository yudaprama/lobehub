import { PrestClient } from 'prest-js-sdk';
import { lobehubClient, type TableTypes } from 'prest-js-sdk/lobehub';

import { fileEnv } from '@/envs/file';

const DEFAULT_PREST_URL = 'http://localhost:3000';
const DEFAULT_KRATOS_URL = 'http://localhost:4433';

let cachedClient: PrestClient | null = null;
let clientPromise: Promise<PrestClient> | null = null;

/**
 * Browser-side PrestClient singleton.
 *
 * Validates the Kratos session up front (one round trip, cached afterwards)
 * and stores it as a Bearer header. pREST's `[auth.kratos]` middleware
 * re-checks on every request, so the up-front check is just a fast-fail
 * that turns "not logged in" into a clear thrown error instead of a 401
 * storm on the first service call.
 *
 * Throws when:
 *  - the Kratos session cookie is missing or invalid (user is not logged in)
 *
 * Uses `DEFAULT_PREST_URL` (`http://localhost:3000`) when
 * `NEXT_PUBLIC_PREST_URL` is unset — the migration assumes pREST is always
 * available. Configure the env var in production to point at the deployed
 * pREST instance.
 */
export function getPrestClient(): Promise<PrestClient> {
  if (cachedClient) return Promise.resolve(cachedClient);
  if (clientPromise) return clientPromise;

  const prestUrl = fileEnv.NEXT_PUBLIC_PREST_URL || DEFAULT_PREST_URL;
  const kratosUrl = fileEnv.NEXT_PUBLIC_KRATOS_PUBLIC_URL || DEFAULT_KRATOS_URL;

  clientPromise = PrestClient.fromKratosSession(kratosUrl, prestUrl)
    .then((client) => {
      clientPromise = null;
      if (!client) {
        // Don't cache — next call (e.g. after the user logs in) should retry.
        throw new Error('[prest] No Kratos session — redirect to login.');
      }
      cachedClient = client;
      return client;
    })
    .catch((err) => {
      clientPromise = null;
      throw err;
    });

  return clientPromise;
}

/**
 * Pre-bound typed client for `lobehub/public`.
 *
 * Convenience wrapper that avoids repeating `'lobehub', 'public'` and
 * the generic type parameters on every call. Table columns are inferred
 * from the SDK's `TableTypes` (auto-generated from the Supabase schema).
 *
 * NOTE: `TypedPrestClient<TableTypes>` returns snake_case keys by
 * default (matches Postgres column names). For auto-camelCased output
 * that lines up with LobeHub's frontend types, prefer
 * `getLobehubQueryClient()` which wraps `LobehubClient` — that class
 * defaults `camelCase: true` and is typed with `CamelTableTypes`.
 *
 * @example
 *   const db = await getLobehubClient();
 *   const topics = await db.select('topics', { where: { agent_id: 'a1' } });
 *   // topics is TableTypes['topics']['select'][] (snake_case keys)
 */
export async function getLobehubClient() {
  const client = await getPrestClient();
  return client.forSchema<TableTypes>('lobehub', 'public');
}

/**
 * LobehubClient — typed, auto-camelCased.
 *
 * Most insert/update payloads no longer need `as any` (SDK 0.10.0
 * types match runtime after DB migration 0114 + pg-to-ts fork's
 * DB DEFAULT detection). Remaining `as any` casts are limited to:
 *
 *  1. `(params as any).property` — property access on loosely-typed
 *     zod schemas (e.g. userMemory service)
 *  2. `(row as any) ?? undefined` — return type coercions
 *  3. `client.insert(...)` — old PrestClient calls (untyped, being
 *     migrated to LobehubClient)
 *  4. `Record<string, any>` — dynamic records where tsgo can't narrow
 */
export async function getLobehubQueryClient() {
  const client = await getPrestClient();
  return lobehubClient(client);
}

export { getWorkspaceParams } from './workspaceScope';
export { PrestApiError, PrestClient, tsquery, TypedPrestClient } from 'prest-js-sdk';
export type {
  AgentShareRow,
  LobehubClient,
  RecentItem as PrestRecentItem,
} from 'prest-js-sdk/lobehub';
