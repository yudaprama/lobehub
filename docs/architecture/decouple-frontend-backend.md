# Decoupling Frontend & Backend in LobeHub

Status: planning / work-in-progress. This document records the analysis and
migration plan for extracting the LobeHub backend out of the Next.js
monolith, so it can be developed and deployed independently.

## Goal

Split the current Next.js monolithic repo (frontend + backend combined)
into two deployable units:

1. **Frontend** — the SPA (`src/spa/`, `src/routes/`, `src/features/`,
   `src/app/spa/**`). Static SPA bundle, deployable to Vercel / any static
   host.
2. **Backend** — every server-side piece currently bundled by Next.js
   (`src/app/(backend)/**`, `src/app/api/**`, `src/app/[variants]/(auth)/**`,
   `src/server/**`, `apps/server/src/**`). Deployable as a long-running
   Node service (Docker / Fly.io / Railway / VPS).

The two communicate over HTTP (tRPC over `/trpc/*` and a small set of REST
webhooks for billing / OIDC / third-party callbacks).

## Current Architecture

The repo is a single Next.js 16 application. Even though it is technically
"monolithic", the backend code is hidden behind a path-alias trick so the
file layout feels like two projects side by side.

### Path alias (root `tsconfig.json`)

```jsonc
"paths": {
  "@/server/*": [
    "./apps/server/src/*",   // priority 1
    "./src/server/*"         // fallback
  ],
  "@/*": ["./src/*"],
  // ...other shared-package aliases
}
```

Implication: any `import from "@/server/..."` resolves to
`apps/server/src/...` first. This is what makes `apps/server/` appear to
be "imported by" `src/app/(backend)/`.

### Folders involved in the server side

| Folder                                            | Role                                                                                                            | Lives in Next.js runtime?  |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `src/app/(backend)/**`                            | HTTP entry points (route handlers, tRPC adapters)                                                               | Yes                        |
| `src/app/api/**`                                  | Webhook + agent-hono adapter (`/api/agent/[[...route]]`, `/api/workflows/[[...route]]`, logto/casdoor webhooks) | Yes                        |
| `src/app/[variants]/(auth)/**`                    | SSR auth pages (signin, signup, verify, oauth)                                                                  | Yes (uses Next.js session) |
| `src/app/spa/[variants]/[[...path]]/route.ts`     | SPA HTML template (uses `@/server/globalConfig`, `@/server/translation`, `@/server/utils/serializeForHtml`)     | Yes                        |
| `src/app/[variants]/metadata.ts`                  | Uses `@/server/translation`                                                                                     | Yes                        |
| `src/instrumentation.ts`                          | Server start hook — auto-starts `GatewayService`                                                                | Yes                        |
| `src/server/**`                                   | Business logic (routers, modules, services, workflows)                                                          | Yes                        |
| `apps/server/src/**`                              | Mirror of `src/server/**` (resolved by `@/server/*` first)                                                      | Yes (bundled)              |
| `src/store/**`, `src/services/**`, `src/const/**` | **Frontend code** that imports types from `@/server/*` (e.g. `@/server/routers/lambda`)                         | Frontend (type-only)       |

### Build pipeline (Vercel)

`vercel.json` →

```json
"buildCommand": "bun run build:vercel"
```

`build:vercel` = `build:raw` + `db:migrate`
`build:raw` = `build:spa:raw` (Vite SPA) + `build:spa:copy` + `build:next:raw` (`next build`)

So Vercel currently runs:

1. Vite SPA build (output → `public/_spa/`).
2. `next build` — bundles **all** `src/app/(backend)/**`, `src/app/api/**`,
   `src/app/[variants]/(auth)/**`, `src/server/**`, `apps/server/src/**`
   into a single Next.js app.
3. `db:migrate` — runs Drizzle migrations against `DATABASE_URL`.

`apps/server/` and `src/server/` are bundled into the same Vercel
deployment; they are not separately deployed.

## Constraints & Risks

1. **Many tRPC type imports in frontend code.** Files under `src/store/**`,
   `src/services/**`, `src/const/**`, and a few `src/routes/**` import
   `type ... from "@/server/routers/lambda/..."` etc. They are mostly
   `import type`, so they are erased at build time, but they still couple
   the frontend repo to the `@/server/*` path and its source.
2. **SSR auth pages** (`src/app/[variants]/(auth)/**`) use the Next.js
   request context (cookies, headers) to talk to the auth provider (Kratos,
   Logto, Casdoor, NextAuth). They cannot trivially be moved to a static
   SPA — they need an SSR host or a server-rendered replacement.
3. **SPA template renderer** (`src/app/spa/[variants]/[[...path]]/route.ts`)
   uses `getServerGlobalConfig`, `translation`, `serializeForHtml` to
   inject runtime config into the HTML. This must be replaced with a
   build-time inlining or a tiny SSR shim.
4. **Vercel cron-style gateways.** `src/instrumentation.ts` auto-starts
   `GatewayService` outside Vercel and uses `/api/agent/gateway` cron on
   Vercel. A decoupled backend replaces the cron with an always-on worker.
5. **Database migrations on Vercel.** `bun run db:migrate` runs at build
   time. Decoupled backend means migrations move to the backend deploy
   pipeline (Fly release command / GitHub Action).
6. **Long-lived state.** Several subsystems (GatewayManager, QStash
   workflows, agent runtime, memory extraction) need a persistent process
   — they are not a good fit for Vercel serverless. They were already
   designed to run as a service; we are just making the boundary explicit.

## Decoupling Strategy

The work is structured in three phases. Each phase ends with a green build
on Vercel and a green test run.

### Phase 1 — Repository preparation

Goal: make the boundary between "server" and "SPA" explicit, without
moving files yet.

1. Confirm the split by listing the actual `@/server/*` consumers:
   - Run `rg "from ['\"]@/server/" src` and partition results into:
     - `src/app/(backend)/**`, `src/app/api/**`, `src/app/[variants]/**`,
       `src/server/**` → server.
     - `src/store/**`, `src/services/**`, `src/const/**`,
       `src/routes/**`, `src/libs/**`, `src/utils/**`,
       `src/features/**` → frontend.
2. For each frontend consumer that imports **values** (not just types) from
   `@/server/*`, replace the import with a generated client call or a
   shared types-only package.
3. Introduce a `packages/contracts/` (or similar) package that re-exports
   the tRPC `AppRouter` type and input/output zod schemas. Frontend imports
   types from `@lobechat/contracts`; backend keeps the implementation in
   `apps/server/src/routers/**` and `src/server/**`.
4. Add `packages/contracts` to `pnpm-workspace.yaml`.

### Phase 2 — Extract a standalone backend

Goal: produce a deployable Node service that owns all the business logic
and the SSR auth pages.

1. Create (or reuse) a new app workspace, e.g. `apps/server-deploy/`:
   - Bundle entrypoints: `apps/server-deploy/src/index.ts` (Hono or
     Express) that mounts:
     - `tRPC` adapters at `/trpc/lambda`, `/trpc/async`, `/trpc/mobile`,
       `/trpc/tools`.
     - REST routes: `/api/agent/[[...route]]`, `/api/workflows/[[...route]]`,
       `/api/webhooks/**`, `/api/dev/**`, `/market/**`, `/oidc/**`,
       `/oauth/connector/callback`, `/f/[id]`, `/webapi/chat/[provider]`,
       `/webapi/models/[provider]`, `/webapi/tts/*`, `/webapi/create-image/*`,
       `/webapi/user/avatar/[id]/[image]`.
     - SSR auth pages: render `src/app/[variants]/(auth)/**` as a Hono
       route per page (or move them to a thin Next.js instance behind a
       single `/auth/*` reverse proxy).
2. Move or symlink source ownership:
   - `apps/server-deploy/src/server/` ← re-export from `src/server/` and
     `apps/server/src/`.
   - `apps/server-deploy/src/routers/` ← import tRPC routers from
     `@/server/routers/...`.
3. Database, Redis, QStash, S3, encryption keys: each becomes a config
   value loaded in `apps/server-deploy/src/env.ts`.
4. Replace `src/instrumentation.ts` Gateway auto-start with a startup
   function in the new service.
5. Provide a `Dockerfile` (multi-stage, pnpm + tsup) and a `docker-compose`
   snippet for local development.

### Phase 3 — Strip the backend out of the Next.js app

Goal: deploy the root repo to Vercel as a pure SPA.

1. Delete (or move to backend) the following top-level folders:
   - `src/app/(backend)/**`
   - `src/app/api/**`
   - `src/app/[variants]/(auth)/**` (replace with SPA-only auth flow that
     calls backend endpoints)
   - `src/instrumentation.ts`
2. Replace `src/app/spa/[variants]/[[...path]]/route.ts` with either:
   - a fully static `index.html` (build-time inlining of `getServerGlobalConfig`
     and translations), **or**
   - a thin Hono route in the new backend that serves the SPA template
     (recommended — keeps dynamic per-request config).
3. Update `vercel.json`:
   - `buildCommand` → `bun run build:raw` (drop `db:migrate`).
   - Remove or repoint any rewrites that referenced backend pages.
4. Update `package.json`:
   - Remove `db:migrate` from `build:vercel`.
   - Add `NEXT_PUBLIC_API_URL` (or whatever the frontend uses today to
     reach tRPC) and document it in `.env.example`.
5. Update frontend stores / services that still import from `@/server/*`:
   - Switch to `import type { ... } from '@lobechat/contracts'`.
   - Replace value imports with a call to `trpc.<router>.<procedure>`. The
     `useClientDataSWR` / `lambdaClient` layer (see `.cursor/skills/data-fetching-architecture`)
     already wraps most of these calls; only wiring changes.
6. Run `bun run type-check` and the relevant Vitest suites.

## Migration Checklist

- [ ] Inventory all `@/server/*` consumers (`rg "from '@/server/" src`).
- [ ] Decide ownership of `src/server/workflows-hono/**` and
      `src/server/agent-hono/**` (these are the Hono apps mounted at
      `/api/workflows/[[...route]]` and `/api/agent/[[...route]]`).
- [ ] Decide where SSR auth pages live:
  - Option A — small Next.js instance in `apps/server-deploy/` rendering
    only `src/app/[variants]/(auth)/**`.
  - Option B — convert each auth page to a server-rendered Hono route
    (or pure client-side React page).
- [ ] Decide where `src/app/spa/[variants]/[[...path]]/route.ts` lives:
  - Option A — Vercel edge function that fetches `/api/server-config` from
    the backend and injects inline `<script>` config.
  - Option B — Reverse-proxy `/spa` to the backend.
- [ ] Create `packages/contracts/` with:
  - `export type { AppRouter } from '@lobechat/server/routers/...'` (or
    copy zod schemas into a self-contained file).
  - Re-export any shared enum / type used by the frontend.
- [ ] Build `apps/server-deploy/` Dockerfile + compose file.
- [ ] Update CI:
  - Frontend CI: `bun run type-check` + Vitest + Vite build.
  - Backend CI: `tsc --noEmit` + Vitest (server) + `tsup` build.
- [ ] Update Vercel env: add `NEXT_PUBLIC_API_URL` pointing to backend
      staging, then prod.
- [ ] Move `db:migrate` from Vercel build to backend release pipeline.
- [ ] Document the new `apps/server-deploy/` in `docs/self-hosting/`.

## Things That Stay in the Frontend Repo

- All React UI, zustand stores, i18n, vite SPA build.
- `@lobehub/ui`, antd, antd-style, theme tokens.
- `src/store/**` and `src/services/**` — but only their **type** imports
  from `@lobechat/contracts`.
- `src/libs/**` utilities that run in the browser.
- Static assets in `public/`.

## Things That Move to the Backend

- Every tRPC router under `src/server/routers/**` and
  `apps/server/src/routers/**`.
- Every Hono app under `src/server/workflows-hono/**` and
  `src/server/agent-hono/**`.
- `src/server/services/**` (DB, Redis, S3, encryption, AI providers,
  market, OIDC, OAuth, etc.).
- `src/server/modules/**` (KeyVaultsEncrypt, ModelRuntime, AgentRuntime,
  etc.).
- `src/server/globalConfig/**`, `src/server/featureFlags/**`,
  `src/server/utils/**`, `src/server/translation.ts` (server-side i18n).
- All `src/app/(backend)/**`, `src/app/api/**`,
  `src/app/[variants]/(auth)/**` route handlers.
- `src/instrumentation.ts` → backend startup hook.

## Vercel Configuration Changes

`vercel.json` after Phase 3 (illustrative):

```jsonc
{
  "buildCommand": "bun run build:raw",
  "installCommand": "npx pnpm@10.26.2 install",
  "headers": [
    /* keep only the SPA cache headers */
  ],
  "rewrites": [],
}
```

`package.json` snippet:

```jsonc
{
  "scripts": {
    "build:vercel": "cross-env-shell NODE_OPTIONS=--max-old-space-size=8192 bun run build:raw",
  },
}
```

## Reference — Files & Line Numbers (snapshot)

These were correct at the time of writing; re-run the greps before
making changes because the tree moves fast.

- `vercel.json:2` — current build command (`bun run build:vercel`).
- `package.json:47` — `build:vercel` script.
- `tsconfig.json` — `@/server/*` path alias.
- `src/instrumentation.ts:18` — auto-start `GatewayService`.
- `src/app/spa/[variants]/[[...path]]/route.ts:12-14` — server-side
  config + translation + serializer for the SPA shell.
- `src/app/[variants]/(auth)/**` — SSR auth pages.
- `src/app/(backend)/trpc/lambda/[trpc]/route.ts:7` — tRPC adapter.
- `src/app/(backend)/api/agent/[[...route]]/route.ts:1` — Hono agent
  gateway.
- `src/app/(backend)/api/workflows/[[...route]]/route.ts:1` — Hono
  workflows gateway.
- `src/app/(backend)/oidc/[...oidc]/route.ts:9` — OIDC provider.

## Open Questions

1. Will the backend live in the same monorepo (`apps/server-deploy/`) or
   in a separate repository? Same repo is easier for shared types but
   slower CI; separate repo is cleaner deploys but requires publishing
   `@lobechat/contracts`.
2. Where do SSR auth pages go after Phase 3? See "Decide where SSR auth
   pages live" in the checklist.
3. What happens to `apps/server/` (the legacy path-mirrored source)? It
   can be kept as a folder, deleted once the alias fallback is no longer
   needed, or moved into `apps/server-deploy/`.
4. How are feature flags (`src/server/featureFlags/**`) exposed to the
   SPA? Either as a `/api/feature-flags` endpoint or inlined at build time.
