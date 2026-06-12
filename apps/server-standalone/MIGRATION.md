# Migration Guide: Using Existing LobeHub Routers

This guide shows how to integrate the existing tRPC routers from `apps/server/src/routers/*` into the standalone server.

## Understanding the Router Structure

LobeHub's `apps/server/src/routers/` contains three main router trees:

- **`lambda/`** – Main API routers (agent, AI chat, bots, etc.) – 80+ routers
- **`async/`** – Asynchronous operation routers (file, image, video processing)
- **`tools/`** – Tool-related routers (search, MCP, market)

Each router file exports a tRPC router using procedures from `@/libs/trpc/lambda` or `@/libs/trpc/async`.

## Option 1: Full Monorepo Integration (Recommended for Development)

This option keeps the standalone server inside the monorepo and imports routers directly.

### Step 1: Update `tsconfig.json` paths

The default `tsconfig.json` already includes path aliases to the monorepo. Verify these are present:

```json
{
  "paths": {
    "@/server/*": ["../server/src/*"],
    "@/libs/trpc/*": ["../../packages/trpc/src/*", "../../src/libs/trpc/*"],
    "@/database/*": ["../../packages/database/src/*"]
    // …other aliases
  }
}
```

### Step 2: Update `src/router.ts` to import existing routers

```ts
import { router } from './context.js';

// Import existing routers from the monorepo
import { asyncRouter } from '../../server/src/routers/async';
import { toolsRouter } from '../../server/src/routers/tools';

// For the lambda router, you need to handle the full dependency tree
// import { lambdaRouter } from '../../server/src/routers/lambda';

export const appRouter = router({
  healthcheck: publicProcedure.query(() => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  })),

  // Add existing routers
  async: asyncRouter,
  tools: toolsRouter,
  // lambda: lambdaRouter, // Requires full database/redis setup

  echo: publicProcedure
    .input((input: unknown) => input as { message: string })
    .query(({ input }) => ({
      echoed: input.message,
    })),
});
```

### Step 3: Install monorepo dependencies

The routers depend on packages in the monorepo. From the repository root:

```bash
pnpm install
```

### Step 4: Build and run

```bash
cd apps/server-standalone
pnpm dev
```

## Option 2: Selective Router Extraction (Production-Ready Standalone)

For a truly standalone deployment, extract only the routers you need and bundle their dependencies.

### Step 1: Identify required routers

Choose routers that don't require heavy infrastructure (database, Redis, etc.). Good candidates:

- `routers/async/healthcheck` (already included)
- `routers/tools/search` (requires API keys but no DB)

### Step 2: Create a minimal router bundle

Create `src/routers/search.ts`:

```ts
import { router, publicProcedure } from '../context.js';
import { z } from 'zod';

export const searchRouter = router({
  web: publicProcedure.input(z.object({ query: z.string() })).query(async ({ input }) => {
    // Implement search logic or import from packages
    return { results: [] };
  }),
});
```

### Step 3: Update `src/router.ts`

```ts
import { searchRouter } from './routers/search.js';

export const appRouter = router({
  search: searchRouter,
  // …other minimal routers
});
```

## Handling Common Dependencies

### Database Access

Routers that use the database need a Drizzle client. Create `src/db.ts`:

```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../packages/database/src/schemas';

const client = postgres(process.env.DATABASE_URL!);
export const db = drizzle(client, { schema });
```

### Redis Access

```ts
import { Redis } from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL!);
```

### Environment Variables

Use a validation library like `zod` or `envalid`:

```ts
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  PORT: z.coerce.number().default(3210),
});

export const env = envSchema.parse(process.env);
```

## Limitations

⚠️ **Not all routers can be easily extracted** because they depend on:

- Next.js-specific APIs (some routers use `next/server`)
- Authentication middleware (tied to Next.js session)
- File system access (tied to Next.js project structure)
- Build-time generated code

For a production-ready standalone, you may need to:

1. Refactor routers to remove Next.js dependencies
2. Create a standalone auth middleware
3. Mock or replace file system operations
4. Bundle the entire monorepo with `tsup` (Option 1)

## Testing Your Integration

After adding routers, test them:

```bash
# Start the server
pnpm dev

# Test health check
curl http://localhost:3210/health

# Test tRPC endpoint
curl 'http://localhost:3210/trpc/healthcheck'
curl 'http://localhost:3210/trpc/echo?input=%7B%22message%22%3A%22hello%22%7D'
```

## Next Steps

1. Start with **Option 1** (full monorepo integration) for development
2. Identify which routers you need for production
3. Use **Option 2** for a lean production build
4. Consider bundling the entire monorepo with `tsup` if you need most routers
