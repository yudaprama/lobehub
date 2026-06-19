# Sync with origin/canary (Kratos fork)

This fork replaces upstream's `better-auth` with Ory Kratos. The auth area
(`src/app/[variants]/(auth)/`, `src/libs/better-auth/`, `src/libs/kratos/`,
`src/features/Auth/`, `src/layout/AuthProvider/`) **diverges permanently**
from upstream and must never be merged or rebased against `origin/canary`.

For everything else, this document describes how an AI agent should sync
upstream `origin/canary` into the fork safely.

## Remotes

| Remote     | URL                                        | Role                        |
| ---------- | ------------------------------------------ | --------------------------- |
| `origin`   | `https://github.com/lobehub/lobehub`       | Upstream canary (read-only) |
| `personal` | `https://github.com/yudaprama/lobehub.git` | This fork (read/write)      |

## Branch layout

```
personal/main                         — fork's "default" branch
  └── feat/kratos-auth                — Kratos auth implementation
  └── chore/canary-sync-<date>        — temporary branch for one sync pass
  └── feat/<other>                    — other feature work
```

`main` is the single source of truth. Feature branches (`feat/*`) and sync
branches (`chore/canary-sync-*`) are merged into `main` (fast-forward) when
done, then deleted.

## Sync workflow

### 1. List candidates

Run the helper script to partition canary commits into SKIP (touches auth)
and SAFE (everything else):

```bash
./scripts/sync-canary.sh "1 month ago" 200
```

The script excludes:

- `src/app/[variants]/(auth)/**`
- `src/features/Auth/**`
- `src/libs/better-auth/**`
- `src/libs/kratos/**`
- `src/app/(backend)/middleware/auth/**`
- `src/app/(backend)/api/auth/**`
- `src/layout/AuthProvider/**`
- `package.json`, `pnpm-lock.yaml`

### 2. Branch

Create a short-lived sync branch off `main`:

```bash
git fetch origin canary
git checkout -b chore/canary-sync-$(date +%Y%m%d) main
```

### 3. Pick commits

For each commit in the SAFE list:

1. **Inspect**: `git show <sha> --stat`
2. **Identify dependencies**: list all files the commit touches. Some commits
   pull in new files that the local tree may not have. If a new file's parent
   directory or import target is missing, the commit depends on a prior
   canary commit that wasn't synced yet.
3. **Sync the file(s)**: `git checkout origin/canary -- <path>...`
4. **Validate**: `bun run type-check` (this fork uses `tsgo --noEmit`).

If validation fails, the typical causes are:

- **Missing dependency file**: another canary commit introduced a file this
  one imports. Find it via `git show origin/canary -- <missing-file>` and
  checkout that file too.
- **Cross-package type drift**: e.g. `packages/device-gateway-client` adds a
  param that the calling `apps/server` already passes. Sync the package too.
- **Reverted upstream commit**: the commit is in `git log` but later
  reverted. Check `git log --oneline <sha>..origin/canary` to see follow-ups.

### 4. Skip-list scenarios

A commit is in the SAFE list but unsafe to sync if it:

- Touches `package.json` or `pnpm-lock.yaml` (deps bumps cause widespread
  changes — defer).
- Touches an area where this fork has local customizations (check
  `git diff origin/canary..main -- <path>` before applying).
- Has been reverted upstream (check if a later canary commit reverts it).
- Is a large cross-cutting refactor (>20 files) without prior smaller
  foundations in this fork's base.

### 5. Commit

One commit per upstream canary commit, prefixed with `🔀 sync(canary):`:

```bash
git add -A
git commit -m "🔀 sync(canary): <subject> (<sha7>)

<bullet list of changes>

Source: <sha> <emoji> <upstream commit subject>"
```

The gitmojis follow the repo's existing convention (see recent commits).

### 6. Test

Before merging the sync branch, run the targeted tests for the changed
files. Many tests run only from the package root:

```bash
# Repo root runs most tests
bunx vitest run --silent='passed-only' <path>

# For shared-tool-ui, model-runtime, device-gateway-client
cd packages/<name> && bunx vitest run --silent='passed-only' <path>
```

### 7. Merge

```bash
git checkout main
git merge --ff-only chore/canary-sync-<date>
git push personal main
git branch -d chore/canary-sync-<date>
```

If the fast-forward fails because `main` has moved, rebase the sync
branch onto the new `main` first:

```bash
git checkout chore/canary-sync-<date>
git rebase main
```

## Auth area (Kratos) — DO NOT TOUCH

The following areas are owned by this fork and must never be touched by
sync commits. If a canary commit's diff is in these areas, skip it.

| Path                                   | Owner | Why                                  |
| -------------------------------------- | ----- | ------------------------------------ |
| `src/app/[variants]/(auth)/**`         | fork  | Kratos replaces Next.js auth pages   |
| `src/features/Auth/**`                 | fork  | Kratos-specific auth flow components |
| `src/libs/better-auth/**`              | fork  | Deleted; replaced by `libs/kratos/`  |
| `src/libs/kratos/**`                   | fork  | Ory Kratos client + helpers          |
| `src/layout/AuthProvider/**`           | fork  | Kratos auth provider                 |
| `src/app/(backend)/api/auth/**`        | fork  | Custom auth API routes               |
| `src/app/(backend)/middleware/auth/**` | fork  | Custom auth middleware               |

When reviewing any sync diff, if a file imports from these paths or vice
versa, that import is local-only and must not be removed.

## Tracking

| Metric           | Target                                              |
| ---------------- | --------------------------------------------------- |
| Sync cadence     | weekly, or before a feature work block              |
| Commits per sync | 3–8 (small, self-contained)                         |
| Validation       | `bun run type-check` must pass per commit           |
| Branch lifetime  | <1 day for `chore/canary-sync-*`                    |
| Rollback         | `git reset --hard HEAD~1` per commit, or rebase-out |

## Quick reference

```bash
# Inspect
git fetch origin canary
./scripts/sync-canary.sh "1 month ago" 200
git show <sha> --stat
git diff origin/canary..main -- <path>

# Apply
git checkout origin/canary -- <files...>
bun run type-check
bunx vitest run --silent='passed-only' <test-path>

# Ship
git commit -m "🔀 sync(canary): ..."
git checkout main
git merge --ff-only chore/canary-sync-$(date +%Y%m%d)
git push personal main
git branch -d chore/canary-sync-$(date +%Y%m%d)
```

## Anti-patterns

- `git merge origin/canary` — will re-introduce better-auth and conflict
  with Kratos. **Never do this.**
- `git rebase origin/canary` onto a Kratos branch — same conflicts.
- `git pull origin canary` — same as merge; will fail.
- Cherry-picking auth-area commits — skip them, they break Kratos.
- Syncing `package.json` changes without re-running `bun install` — type
  drift will surface as missing-module errors.
