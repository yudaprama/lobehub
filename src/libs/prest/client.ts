import { PrestClient } from 'prest-js-sdk';

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

export { PrestApiError, PrestClient, tsquery } from 'prest-js-sdk';
