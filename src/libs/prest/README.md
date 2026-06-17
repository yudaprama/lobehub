# `src/libs/prest` — pREST browser/server client

Singleton wrapper around [`prest-js-sdk`](https://www.npmjs.com/package/prest-js-sdk)
for talking to pREST (`localhost:3000` in dev, `prest.getkawai.com` in prod)
from the LobeHub frontend.

## Why

We're migrating the LobeHub BFF (`apps/server/src/routers/lambda/`) from
tRPC to pREST, Tier 1 (table CRUD) and Tier 2 (stored SQL queries) — see
[`LOBEHUB_PREST_FRONTEND_MIGRATION.md`](../../../../LOBEHUB_PREST_FRONTEND_MIGRATION.md)
for the full plan.

The frontend swaps `lambdaClient.<router>.<proc>.query/mutate(...)` for
`prestClient.select("lobehub","public","<table>", {...})` inside service
files only — components and stores stay untouched.

## Files

| File               | Purpose                                                                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `client.ts`        | Browser-side `getPrestClient()` singleton, lazy + memoised. Uses `PrestClient.fromKratosSession()` so the `ory_kratos_session` cookie is auto-forwarded. |
| `client-server.ts` | Server-side `getPrestServerClient(headers)` factory for RSC / route handlers. Pulls the Kratos session from request headers.                             |
| `client.test.ts`   | Vitest covering singleton caching + null-URL fallback.                                                                                                   |

## Usage

```ts
// In a service file
import { getPrestClient, PrestApiError } from '@/libs/prest/client';

class NotificationService {
  list = async (params: { unreadOnly?: boolean } = {}) => {
    const client = await getPrestClient();
    if (!client) throw new PrestApiError(503, 'prest-js-sdk disabled');
    return client.select<Notification>('lobehub', 'public', 'notifications', {
      where: { is_read: params.unreadOnly ? false : undefined },
      order: ['created_at:desc'],
      page: 1,
      size: 20,
    });
  };
}
```

For Tier 2 stored SQL queries:

```ts
const groups = await client.query<SessionGroup>('lobehub', 'sessionsListGrouped', {});
```

## Env

| Var                             | Default                 | Description                                                                  |
| ------------------------------- | ----------------------- | ---------------------------------------------------------------------------- |
| `NEXT_PUBLIC_PREST_URL`         | unset                   | pREST base URL for the browser. If unset, `getPrestClient()` returns `null`. |
| `NEXT_PUBLIC_KRATOS_PUBLIC_URL` | `http://localhost:4433` | Kratos public URL used by `fromKratosSession`.                               |
| `PREST_URL` (server)            | `http://localhost:3000` | pREST base URL for server-side code.                                         |

## Conventions

- **Cache keys** for TanStack Query: `['prest', db, schema, table, opts]` or
  `['prest', location, script, params]`.
- **Error shape**: catch `PrestApiError` (not `TRPCClientError`).
  `.status` and `.body` are set; use them to map 401 → relogin, 403 → forbidden,
  503 → billing_unavailable.
- **Pagination**: prefer `page` + `size` (1-indexed) over `limit` + `offset`
  for pREST consistency.

## What does NOT migrate

`@/libs/trpc/client` is still used for Tier 3 (LLM, RAG, OIDC, external SDKs).
See the migration plan for the full list of stay-on-`lambdaClient` services.
