# Server-Standalone

A minimal, standalone version of **LobeHub server** that runs as a plain Express + tRPC HTTP service.

## Features

- Pure Node.js server (no Next.js) – suitable for Docker or VM deployment.
- Exposes `/trpc` endpoint with all existing tRPC routers (import them from `apps/server/src/routers/*`).
- Health check at `/health`.
- CORS configurable via `CORS_ORIGIN`.
- Type‑safe request context (user ID from `Authorization: Bearer …`).

## Quick start

```bash
# Install deps (run from repository root)
pnpm add -w @lobechat/server-standalone
# Or cd into the folder and install locally
cd apps/server-standalone && pnpm install

# Development (watch)
pnpm dev

# Build
pnpm build

# Run
pnpm start
```

## Environment variables

| Variable      | Description                           |
| ------------- | ------------------------------------- |
| `PORT`        | Port number (default 3210)            |
| `CORS_ORIGIN` | Allowed origin for CORS (default `*`) |

## Adding existing routers

Edit `src/router.ts` and import any router from `apps/server/src/routers/*`:

```ts
import { asyncRouter } from '../../server/src/routers/async';
export const appRouter = router({
  async: asyncRouter,
  // …other routers
});
```

Use the path alias `@/server/*` (configured in `tsconfig.json`).

## Docker

A minimal Dockerfile is provided (see `Dockerfile`). Build and run:

```bash
docker build -t lobehub/server-standalone .
docker run -p 3210:3210 lobehub/server-standalone
```

## License

MIT – part of the LobeHub monorepo.
