# Context: Lobehub ↔ prest-js-sdk Migration (Continuation)

## State saat ini (DONE)

### prest-js-sdk (npm: `prest-js-sdk@0.11.0`)

- ✅ `CamelTableTypes` — type-level snake→camel conversion
- ✅ `LobehubClient` defaults `camelCase: true` di semua method
- ✅ `user_id` optional di semua `*Input` types (pREST middleware injects it)
- ✅ `tsvector` → `string`, `vector` (pgvector) → `number[]`
- ✅ DB DEFAULT detection — `hasDefault` columns optional di `*Input` types
- ✅ UUID primary key detection — PK + UUID-ish type (uuid|text|varchar) optional
- ✅ Published via GitHub Actions CI (changeset flow)
- Repo: `github.com/yudaprama/prest-js-sdk` (branch `master`)

### lobehub (branch `main`)

- ✅ **17 services** converted dari `getPrestClient()`/`getLobehubClient()` ke `getLobehubQueryClient()` (LobehubClient):
  - brief, generation, usage, notification
  - aiModel, thread, user
  - aiProvider, knowledgeBase, agent
  - generationBatch, plugin, file, userMemory
  - generationTopic, notebook, ApiKey (React component)
  - task, session
- ✅ **Uniform `as any` policy** di semua insert/update payload (\~27-40 casts)
  - Decision: preserve casts — document Zod↔SDK type gaps, not missing id fields
  - SDK 0.11.0's UUID PK optional is nice-to-have, doesn't remove existing casts
- ✅ Removed `src/libs/prest/tables.ts` (hand-written duplicate) → consolidate ke SDK's `TableTypes`
- ✅ CI setup: `type-check.yml` (tsgo) + `type-check-failure.yml` (auto-file dedupe-hashed issues)
- ✅ Removed 31 other GitHub workflows (keep only type-check)
- ✅ AGENTS.md updated (rules #1-#7, including uniform as-any policy + service conversion pattern)

### pg-to-ts fork (local: `/Users/yuda/ai-orchestration/pg-to-ts/`)

- ✅ DB DEFAULT detection (`hasDefault` from `information_schema.columns`)
- ✅ UUID primary key detection (PK + UUID-ish type → optional in \*Input)
- ✅ `user_id` always optional in `*Input` types (pREST middleware injects it)
- ✅ `tsvector` → `string`, `vector` → `number[]`
- ❌ Not yet published to npm (still requires local `../pg-to-ts` sibling dir)

## Arsitektur sekarang

```
[Supabase DB]
     ↓
[pREST] (returns snake_case)
     ↓
[prest-js-sdk 0.11.0] (LobehubClient + CamelTableTypes → auto-camelCase)
     ↓
[lobehub services] (panggil db.select/insert/update/delete, uniform `as any`)
     ↓
[Zustand stores / UI] (expect camelCase)
```

## Uniform `as any` policy

**All** `db.insert()` / `db.update()` payloads cast to `as any`:

```ts
await db.insert('table_name', {
  snake_case_field: value,
  // ...
} as any);

await db.update('table_name', { id }, {
  snake_case_field: value,
} as any);
```

**Why uniform `as any`:**

- SDK's `*Input` types are auto-generated from DB schema
- Zod schemas (from `@lobechat/memory-user-memory/schemas`, etc.) differ from SDK types
- Some DB columns (`plugin`, `metadata`, `interests`) aren't in SDK types (JSONB not fully mapped)
- Legacy param types use different field names than SDK expects
- `as any` documents the gap — honest signal "SDK type doesn't match runtime"

**DO NOT try to remove `as any` casts** — they're not bugs, they're documentation. Proper fix would require:

1. Update all Zod schemas to match SDK types (breaking change)
2. Regenerate SDK types with full JSONB mapping (complex)
3. Align all legacy param types (large refactor)

**When to add `as any`:**

- New service method calls `db.insert()` or `db.update()` → add `as any` on payload
- Exception: payload is empty `{}` or single primitive field → skip cast

**Other `as any` patterns (not uniform policy, but common):**

```ts
// 1. Property access on loosely-typed zod schemas
(params as any).category ?? null;

// 2. Return type coercions
return (row as any) ?? undefined;

// 3. Dynamic Record types
const data: Record<string, any> = { status };
await db.update('tasks', { id }, data as any);
```

## Yang BELUM dikerjain (FUTURE WORK)

### 🟡 Priority: MEDIUM — Publish pg-to-ts fork (\~30 menit)

**Goal:** SDK bisa berdiri sendiri (gak butuh `../pg-to-ts` sibling dir).

**Steps:**

1. Fork `dankv/pg-to-ts` ke `yudaprama/pg-to-ts`
2. Apply local modifications (DB DEFAULT detection, tsvector/vector mappings)
3. Bump version ke `4.2.0`
4. `npm publish --scope @yudaprama`
5. Update SDK's `package.json`: `"gen-types": "PG_TO_TS_CONN=... bunx @yudaprama/pg-to-ts@4.2.0 generate ..."`
6. Commit + push SDK

**Benefit:** SDK self-contained, contributor gak perlu clone sibling repo
**Cost:** 30 menit

### 🟢 Priority: LOW — Update MIGRATION_CONTEXT.md when SDK version changes

**Goal:** Keep this doc in sync with SDK releases.

**When to update:**

- SDK publishes new version (0.12.0, 1.0.0, etc.)
- New features added to pg-to-ts fork
- AGENTS.md rules change

**Steps:**

1. Update "SDK version" in "State saat ini" section
2. Update "SDK features" list if new features added
3. Update TL;DR at bottom
4. Commit + push

**Cost:** 5 menit

---

## Key files

### prest-js-sdk

- `src/index.ts` — PrestClient + TypedPrestClient + camelize utilities
- `src/lobehub.ts` — LobehubClient + CamelTableTypes
- `src/lobehub-types.ts` — Auto-generated (90+ tables)
- `src/camelize.ts` — camelizeKey + camelizeKeys utilities

### lobehub

- `src/libs/prest/client.ts` — getPrestClient, getLobehubClient, getLobehubQueryClient
- `src/services/*/index.ts` — 17 converted services
- `packages/database/migrations/0114_close_type_gaps.sql` — DB migration for type gaps
- `AGENTS.md` — Rules #1-#7 (Go endpoints, camelCase, centralized types, CI-only type-check, Tier 1/2/3 routing, uniform as-any policy, service conversion pattern)
- `.github/workflows/type-check.yml` — tsgo CI
- `.github/workflows/type-check-failure.yml` — Auto-file dedupe-hashed issues

## Commands

### prest-js-sdk

```bash
# Regen types (butuh ../pg-to-ts sibling dir + $PREST_PG_URL_LOBEHUB)
bun run gen-types

# Build
bun run build

# Publish (via CI)
bun changeset          # pilih minor/patch
git push origin master # CI auto-publish
```

### lobehub

```bash
# Install/update SDK
bun install prest-js-sdk@latest

# Type-check (JANGAN lokal, 12GB RAM — push aja, CI jalanin)
git push origin main # CI auto type-check

# Verify CI
gh run list --workflow=type-check.yml --limit 5
```

## Decision log

| Decision                    | Reasoning                                                                              |
| --------------------------- | -------------------------------------------------------------------------------------- |
| Keep SDK (don't remove)     | SDK is force multiplier: 1 line = 20+ lines manual code                                |
| Uniform `as any` policy     | Documents Zod↔SDK gaps, not missing id fields; proper fix requires large refactor      |
| Don't downgrade SDK         | Would lose CamelTableTypes + user_id optional + vector mappings + DB DEFAULT detection |
| Don't `any`-in SDK          | Would lose type safety, 500+ manual casts spread across codebase                       |
| CI-only type-check          | tsgo eats 12GB RAM locally, not feasible                                               |
| Auto-file issues on CI fail | Dedupe-hashed, auto-close when fixed                                                   |

## AI Agent Conventions (for future sessions)

**When working on services / pREST-related changes:**

1. **Read `AGENTS.md` first** — contains 7 hard rules:
   - Rule #1: NEVER build Go endpoints for simple CRUD
   - Rule #2: NEVER skip snake_case → camelCase mapping (use `getLobehubQueryClient()`)
   - Rule #3: Type generation centralized in `prest-js-sdk` (SDK 0.11.0)
   - Rule #4: Type-check runs in CI, not locally (tsgo eats 12GB RAM)
   - Rule #5: pREST Tier 1 / Tier 2 routing
   - Rule #6: **Uniform `as any` policy** on insert/update payloads
   - Rule #7: Service conversion pattern (step-by-step guide)

2. **DO NOT try to remove `as any` casts** — they document real Zod↔SDK type gaps, not missing id fields. Proper fix requires:
   - Update all Zod schemas to match SDK types (breaking change)
   - Regenerate SDK types with full JSONB mapping (complex)
   - Align all legacy param types (large refactor)

3. **When adding new service methods:**
   - Use `getLobehubQueryClient()` (defaults `camelCase: true`)
   - Add `as any` on insert/update payloads (uniform policy)
   - Preserve snake_case in WHERE clauses / payloads (Postgres column names)
   - Response is camelCase by default (LobehubClient handles conversion)

4. **When converting old services:**
   - Replace `getPrestClient()` / `getLobehubClient()` → `getLobehubQueryClient()`
   - Remove `'lobehub', 'public'` prefixes from table names
   - Add `as any` on insert/update payloads
   - Test with CI (push to `main`, wait for `type-check.yml` to pass)

5. **SDK regeneration** (when Supabase schema changes):

   ```bash
   cd /Users/yuda/ai-orchestration/pg-to-ts
   bun run build
   
   cd /Users/yuda/ai-orchestration/prest-js-sdk
   bun run gen-types # requires $PREST_PG_URL_LOBEHUB
   git add src/lobehub-types.ts
   bun changeset # pilih minor/patch
   git commit -m "feat: regen lobehub-types.ts"
   git push origin master # CI auto-publish
   ```

6. **Type-check workflow:**
   - NEVER run `bun run type-check` locally (12GB RAM)
   - Push to `main`, CI runs `tsgo --noEmit`
   - If CI fails, `.github/workflows/type-check-failure.yml` auto-files dedupe-hashed issue
   - Close issue when errors resolved (new issue opens if they reappear)

**Key files:**

- `AGENTS.md` — hard rules for AI agents
- `src/libs/prest/client.ts` — `getPrestClient()`, `getLobehubClient()`, `getLobehubQueryClient()`
- `src/services/*/index.ts` — 17 converted services (use `getLobehubQueryClient()`)
- `.github/workflows/type-check.yml` — CI type-check
- `.github/workflows/type-check-failure.yml` — auto-file dedupe-hashed issues

---

## Next session action items

1. **Kalau ada waktu 30 menit:** Publish pg-to-ts fork ke npm (`@yudaprama/pg-to-ts`)
2. **Kalau ada waktu 5 menit:** Update MIGRATION_CONTEXT.md kalau SDK version berubah
3. **Kalau gak ada waktu:** Stop di sini, current state udah optimal

## Contact / repos

- **prest-js-sdk:** `github.com/yudaprama/prest-js-sdk` (branch `master`)
- **lobehub:** `github.com/yudaprama/lobehub` (branch `main`)
- **pg-to-ts fork:** `/Users/yuda/ai-orchestration/pg-to-ts/` (local, not yet published)

---

**TL;DR:** Migration DONE. SDK 0.11.0 published, 17 services converted, uniform `as any` policy preserved (documents Zod↔SDK gaps). CI jalan. Future work: publish pg-to-ts fork.
