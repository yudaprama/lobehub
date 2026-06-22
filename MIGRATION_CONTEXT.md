# Context: Lobehub ↔ prest-js-sdk Migration (Continuation)

## State saat ini (DONE)

### prest-js-sdk (npm: `prest-js-sdk@0.10.0`)

- ✅ `CamelTableTypes` — type-level snake→camel conversion
- ✅ `LobehubClient` defaults `camelCase: true` di semua method
- ✅ `user_id` optional di semua `*Input` types (DB DEFAULT server-side)
- ✅ `tsvector` → `string`, `vector` (pgvector) → `number[]`
- ✅ DB DEFAULT detection — `hasDefault` columns optional di `*Input` types
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
- ✅ **52 `as any` casts removed** — SDK 0.10.0 types match runtime after DB migration 0114
- ✅ **DB migration 0114** — adds `sessions.metadata`, `user_settings.interests/preference/guide/settings`, DEFAULTs for `user_memories.last_accessed_at`, child memory table IDs, `generation_topics.id`
- ✅ Removed `src/libs/prest/tables.ts` (hand-written duplicate) → consolidate ke SDK's `TableTypes`
- ✅ CI setup: `type-check.yml` (tsgo) + `type-check-failure.yml` (auto-file dedupe-hashed issues)
- ✅ Removed 31 other GitHub workflows (keep only type-check)
- ✅ AGENTS.md updated (rules #2-#5)

### pg-to-ts fork (local: `/Users/yuda/ai-orchestration/pg-to-ts/`)

- ✅ DB DEFAULT detection (`hasDefault` from `information_schema.columns`)
- ✅ `user_id` always optional in `*Input` types (pREST middleware injects it)
- ✅ `tsvector` → `string`, `vector` → `number[]`
- ❌ Not yet published to npm (still requires local `../pg-to-ts` sibling dir)

## Arsitektur sekarang

```
[Supabase DB]
     ↓
[pREST] (returns snake_case)
     ↓
[prest-js-sdk 0.10.0] (LobehubClient + CamelTableTypes → auto-camelCase)
     ↓
[lobehub services] (panggil db.select/insert/update/delete, minimal `as any`)
     ↓
[Zustand stores / UI] (expect camelCase)
```

## Remaining `as any` pattern

Most insert/update payloads no longer need `as any` (SDK 0.10.0 types match runtime).
Remaining casts are limited to:

```ts
// 1. Property access on loosely-typed zod schemas
(params as any).category ?? null;

// 2. Return type coercions
return (row as any) ?? undefined;

// 3. Old PrestClient calls (untyped, being migrated away)
await client.insert('lobehub', 'public', 'messages', data as any);

// 4. Dynamic Record types
const data: Record<string, any> = { status };
await db.update('tasks', { id }, data);
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

### 🟢 Priority: LOW — Migrate remaining old PrestClient calls

**Goal:** Convert remaining `getPrestClient()` / `getLobehubClient()` calls in message, file, and topic services to `getLobehubQueryClient()`.

**Files with old client usage:**

- `src/services/message/index.ts` — `client.insert/update/delete` on message_translates, message_tts, message_plugins
- `src/services/file/index.ts` — `client.delete` on knowledge_items
- `src/services/topic/index.ts` — `client.insert` on topics

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
- `AGENTS.md` — Rules #2-#5 (camelCase, centralized types, CI-only type-check, Tier 1/2/3 routing)
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

| Decision                           | Reasoning                                                                              |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| Keep SDK (don't remove)            | SDK is force multiplier: 1 line = 20+ lines manual code                                |
| Minimize `as any` via DB migration | Better to fix schema than cast around it                                               |
| Don't downgrade SDK                | Would lose CamelTableTypes + user_id optional + vector mappings + DB DEFAULT detection |
| Don't `any`-in SDK                 | Would lose type safety, 500+ manual casts spread across codebase                       |
| CI-only type-check                 | tsgo eats 12GB RAM locally, not feasible                                               |
| Auto-file issues on CI fail        | Dedupe-hashed, auto-close when fixed                                                   |

## Next session action items

1. **Kalau ada waktu 30 menit:** Publish pg-to-ts fork
2. **Kalau ada waktu 1-2 jam:** Migrate remaining old PrestClient calls (message, file, topic)
3. **Kalau gak ada waktu:** Stop di sini, current state udah optimal

## Contact / repos

- **prest-js-sdk:** `github.com/yudaprama/prest-js-sdk` (branch `master`)
- **lobehub:** `github.com/yudaprama/lobehub` (branch `main`)
- **pg-to-ts fork:** `/Users/yuda/ai-orchestration/pg-to-ts/` (local, not yet published)

---

**TL;DR:** Migration DONE. SDK 0.10.0 published, 17 services converted, 52 `as any` removed via DB migration 0114 + type regen. Remaining `as any` limited to property access casts, return coercions, and old PrestClient calls. CI jalan. Future work: publish pg-to-ts fork, migrate old PrestClient calls.
