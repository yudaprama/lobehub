# LobeHub Development Guidelines

Guidelines for using AI coding agents in this LobeHub repository.

## Fork-specific rules (READ FIRST)

**This is `yudaprama/lobehub`, a fork of upstream `lobehub/lobehub`.**
The fork carries custom integrations (Kratos auth, AList file storage,
standalone server, pREST Tier 1/2). Read and follow these rules before
any git operation.

### Branch layout (authoritative, Jun 16 2026)

| Branch                        | Role                                                                                                                                                                                             | Remote                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| `canary`                      | Mirror of upstream `lobehub/lobehub:canary`. Updated by `scripts/daily-sync.sh`. **Do not commit fork work here.**                                                                               | `personal/canary`                  |
| `main`                        | Fork plumbing only: `.gitattributes` `merge=ours` driver, `scripts/daily-sync.sh`, disabled pg_search migrations, migration 0111 (FTS). **Does NOT contain Kratos or AList migration code yet.** | `personal/main`                    |
| `feat/kratos-auth`            | **Active.** 19 commits ahead of `main`. Full Kratos auth migration (flows, settings, session helper, Better Auth removal, `apps/server-standalone`).                                             | `personal/feat/kratos-auth`        |
| `feat/alist-file-storage`     | **Active.** 21 commits ahead of `main`. Superset of `feat/kratos-auth` plus AList upload pipeline.                                                                                               | `personal/feat/alist-file-storage` |
| ~~`feat/kratos-auth-backup`~~ | **Does NOT exist.** If you see it referenced in old notes, ignore — it was a temporary safety-net branch that has been deleted.                                                                  | n/a                                |

### Git rules

1. **NEVER force-push `feat/*` branches.** They contain ongoing
   migration work. Only `personal/main` and `personal/canary` may be
   force-pushed (and only via `--force-with-lease`).
2. **NEVER delete `feat/kratos-auth` or `feat/alist-file-storage`.**
   Their commits have not been merged into `main` yet. They are not
   "leftover" — deleting them loses the Kratos/AList migration.
3. **Do not trust older docs claiming `feat/alist-file-storage` is
   "merged via PR #1"** — that was an incorrect claim. Both feat
   branches are still on their own refs.
4. **`main` is rebased onto a newer `origin/canary` than the feat
   branches** (128 commits of merge drift). Merging a feat branch into
   `main` requires rebasing the feat branch onto current
   `origin/canary` first, or resolving drift manually.
5. **`scripts/daily-sync.sh` is the only mechanism for syncing
   `canary`** from upstream. It auto-checks out `canary`, rebases,
   type-checks, and pushes to `personal/canary`. It can be run from any
   branch — the trap handler restores the caller's branch.
6. **`origin` = upstream `lobehub/lobehub`.** `personal` =
   `yudaprama/lobehub`. Pushes go to `personal/*` only.

### Database rules

1. **The lobehub content DB is on Supabase**
   (`biyvcvoxtvezcpkjidai`), not a local
   `paradedb/paradedb:latest-pg17` image.
2. **ParadeDB `pg_search` extension is NOT available on this Supabase
   project.** Migrations `0090_enable_pg_search.sql` and
   `0093_add_bm25_indexes_with_icu.sql` are disabled (commented out).
3. **Postgres native FTS is used instead.** Migration
   `0111_add_postgres_fts.sql` adds 14 `*_tsv` generated columns + GIN
   indexes. Any code that previously called `paradedb.match()` /
   `paradedb.score()` / the `@@@` operator must use `to_tsquery()` +
   `ts_rank()` against the `*_tsv` columns instead.
4. **Migrations 0100–0110 are upstream Drizzle migrations** that
   arrived after the initial fork-DB setup. They have not been applied
   to the Supabase project yet — run
   `bun run scripts/migrateServerDB/index.ts` with
   `DATABASE_DRIVER=node MIGRATION_DB=1 KEY_VAULTS_SECRET=... NODE_TLS_REJECT_UNAUTHORIZED=0`
   to apply them.

### When in doubt

- Check branch state with `git rev-list --count main..<branch>` before
  claiming a branch is "merged", "obsolete", or "safe to delete".
- Check actual commit existence with `git log --oneline <sha>` before
  referencing a commit hash from docs (the doc may be stale).

---

## Tech Stack

- Next.js 16 + React 19 + TypeScript
- SPA inside Next.js with `react-router-dom`
- `@lobehub/ui`, antd for components; antd-style for CSS-in-JS — **prefer `createStaticStyles` with `cssVar.*`** (zero-runtime); only fall back to `createStyles` + `token` when styles genuinely need runtime computation. See `.cursor/docs/createStaticStyles_migration_guide.md`.
- **Component priority**: `@lobehub/ui/base-ui` (headless primitives) **first**, then `@lobehub/ui` root, then antd as last resort. When the component exists in base-ui, use it — never reach for the root or antd counterpart. Base-ui covers `Select`, `Modal` / `createModal` / `confirmModal`, `DropdownMenu`, `ContextMenu`, `Popover`, `ScrollArea`, `Switch`, `Toast`, `FloatingSheet`. Prefer `@lobehub/ui/base-ui` for new code and migrate root-package call sites opportunistically.
- react-i18next for i18n; zustand for state management
- SWR for data fetching; TRPC for type-safe backend
- Drizzle ORM with PostgreSQL; Vitest for testing

## Project Structure

```plaintext
lobehub/
├── apps/
│   ├── desktop/            # Electron desktop app
│   ├── cli/                # LobeHub CLI
│   └── server/             # Server service
├── packages/               # Shared packages (@lobechat/*)
│   ├── database/           # Database schemas, models, repositories
│   ├── agent-runtime/      # Agent runtime
│   └── ...
├── src/
│   ├── app/                # Next.js App Router (backend API + auth)
│   │   ├── (backend)/     # API routes (trpc, webapi, etc.)
│   │   ├── spa/            # SPA HTML template service
│   │   └── [variants]/(auth)/  # Auth pages (SSR required)
│   ├── routes/             # SPA page components (Vite)
│   │   ├── (main)/         # Desktop pages
│   │   ├── (mobile)/       # Mobile pages
│   │   ├── (desktop)/      # Desktop-specific pages
│   │   ├── (popup)/        # Popup window pages
│   │   ├── onboarding/     # Onboarding pages
│   │   └── share/          # Share pages
│   ├── spa/                # SPA entry points and router config
│   │   ├── entry.web.tsx   # Web entry
│   │   ├── entry.mobile.tsx
│   │   ├── entry.desktop.tsx
│   │   ├── entry.popup.tsx
│   │   └── router/         # React Router configuration
│   ├── store/              # Zustand stores
│   ├── services/           # Client services
│   ├── server/             # Server services and routers
│   └── ...
└── e2e/                    # E2E tests (Cucumber + Playwright)
```

## SPA Routes and Features

SPA-related code is grouped under `src/spa/` (entries + router) and `src/routes/` (page segments). We use a **roots vs features** split: route trees only hold page segments; business logic and UI live in features.

- **`src/spa/`** – SPA entry points (`entry.web.tsx`, `entry.mobile.tsx`, `entry.desktop.tsx`, `entry.popup.tsx`) and React Router config (`router/`, with `desktopRouter.config.*`, `mobileRouter.config.tsx`, `popupRouter.config.tsx`). Keeps router config next to entries to avoid confusion with `src/routes/`.

- **`src/routes/` (roots)**\
  Only page-segment files: `_layout/index.tsx`, `index.tsx` (or `page.tsx`), and dynamic segments like `[id]/index.tsx`. Keep these **thin**: they should only import from `@/features/*` and compose layout/page, with no business logic or heavy UI.

- **`src/features/`**\
  Business components by **domain** (e.g. `Pages`, `PageEditor`, `Home`). Put layout chunks (sidebar, header, body), hooks, and domain-specific UI here. Each feature exposes an `index.ts` (or `index.tsx`) with clear exports.

When adding or changing SPA routes:

1. In `src/routes/`, add only the route segment files (layout + page) that delegate to features.
2. Implement layout and page content under `src/features/<Domain>/` and export from there.
3. In route files, use `import { X } from '@/features/<Domain>'` (or `import Y from '@/features/<Domain>/...'`). Do not add new `features/` folders inside `src/routes/`.
4. **Register the desktop route tree in both configs:** `src/spa/router/desktopRouter.config.tsx` and `src/spa/router/desktopRouter.config.desktop.tsx` must stay in sync (same paths and nesting). Updating only one can cause **blank screens** if the other build path expects the route. `desktopRouter.sync.test.tsx` guards this invariant — keep it passing.

See the **spa-routes** skill (`.agents/skills/spa-routes/SKILL.md`) for the full convention and file-division rules.

## Development

### Starting the Dev Environment

```bash
# SPA dev mode (frontend only, proxies API to localhost:3010)
bun run dev:spa

# Full-stack dev (Next.js + Vite SPA concurrently)
bun run dev
```

After `dev:spa` starts, the terminal prints a **Debug Proxy** URL:

```plaintext
Debug Proxy: https://app.lobehub.com/_dangerous_local_dev_proxy?debug-host=http%3A%2F%2Flocalhost%3A9876
```

Open this URL to develop locally against the production backend (app.lobehub.com). The proxy page loads your local Vite dev server's SPA into the online environment, enabling HMR with real server config.

### Git Workflow

- **Branch strategy**: `canary` is the development branch (cloud production); `main` is the release branch (periodically cherry-picks from canary)
- New branches should be created from `canary`; PRs should target `canary`
- Use rebase for `git pull`
- Commit messages: prefix with gitmoji
- Branch format: `<type>/<feature-name>`

### Package Management

- `pnpm` for dependency management
- `bun` to run npm scripts
- `bunx` for executable npm packages

### Testing

```bash
# Run specific test (NEVER run `bun run test` - takes ~10 minutes)
bunx vitest run --silent='passed-only' '[file-path]'

# Database package
cd packages/database && bunx vitest run --silent='passed-only' '[file]'
```

- Prefer `vi.spyOn` over `vi.mock`

### Type Checking

```bash
bun run type-check
```

### i18n

- Add keys to a namespace file under `src/locales/default/` (e.g. `agent.ts`, `auth.ts`)
- Ship en-US and zh-CN by hand in the same PR: write the English source in `src/locales/default/*.ts` and mirror it to `locales/en-US/`; hand-translate `locales/zh-CN/`. Leave all other locales to CI.
- Don't run `pnpm i18n` manually by default — a daily CI workflow (`auto-i18n.yml`) runs it and opens an automated translation PR for any missing keys.
- Run `pnpm i18n` manually only when your branch needs the translated locales immediately, instead of waiting for the daily job (slow; requires `OPENAI_API_KEY`). Note it only fills keys missing from other locales — value-only edits never need it.

### Code Style

- When a single file grows beyond \~800 lines, consider splitting it into multiple files (extract sub-components, hooks, helpers, or types). Smaller, focused files are friendly to humans and agents.

### Code Review

Before reviewing a PR / diff / branch change, read the **review-checklist** skill (`.agents/skills/review-checklist/SKILL.md`) — it lists the recurring mistakes specific to this codebase.

When designing or reviewing user-facing flows (empty/loading/error states, confirmations, async feedback, button hierarchy, lists at scale, pickers), follow the **ux** skill (`.agents/skills/ux/SKILL.md`) — LobeHub's design values (自然 / 意义感 / 确定性) plus per-aspect execution checklists.
