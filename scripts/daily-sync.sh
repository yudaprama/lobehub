#!/usr/bin/env bash
# Daily sync from upstream canary. Pulls via rebase; .gitattributes
# merge=ours driver keeps fork customizations on Kratos/AList/standalone
# paths so they survive the rebase automatically.
#
# Usage: ./scripts/daily-sync.sh
# Cron:  0 6 * * * /path/to/repo/scripts/daily-sync.sh
#
# This script can be run from any branch. It checks out $BRANCH (canary)
# at the start, syncs it with $UPSTREAM/$BRANCH, type-checks, and pushes
# the result to $PERSONAL/$BRANCH. The original branch is restored at the
# end so your working state is unchanged.
set -euo pipefail

BRANCH="${BRANCH:-canary}"
UPSTREAM="${UPSTREAM_REMOTE:-origin}"
PERSONAL="${PERSONAL_REMOTE:-personal}"

# Remember the branch we started on so we can restore it at the end.
# In a detached HEAD (rare for this script) the current branch is empty
# and we just stay on $BRANCH for the rest of the script.
ORIGINAL_BRANCH=$(git symbolic-ref --quiet --short HEAD 2>/dev/null || echo "")

restore_branch() {
  if [[ -n "$ORIGINAL_BRANCH" && "$ORIGINAL_BRANCH" != "$BRANCH" ]]; then
    echo "==> Restoring original branch $ORIGINAL_BRANCH..."
    git checkout "$ORIGINAL_BRANCH" --quiet
  fi
}
trap restore_branch EXIT

# Refuse to run with a dirty working tree on the original branch —
# `git checkout` below would carry those changes into $BRANCH and
# silently mix them into the rebase.
if [[ -n "$ORIGINAL_BRANCH" && "$ORIGINAL_BRANCH" != "$BRANCH" ]]; then
  if ! git diff --quiet --ignore-submodules HEAD 2>/dev/null; then
    echo "ERROR: Working tree has uncommitted changes."
    echo "Commit or stash them first, then re-run."
    exit 1
  fi
fi

echo "==> Switching to $BRANCH..."
git checkout "$BRANCH" --quiet

echo "==> Fetching $UPSTREAM/$BRANCH..."
git fetch "$UPSTREAM" "$BRANCH" --quiet

echo "==> Checking for upstream changes..."
LOCAL=$(git rev-parse "$BRANCH")
REMOTE=$(git rev-parse "$UPSTREAM/$BRANCH")
if [[ "$LOCAL" == "$REMOTE" ]]; then
  echo "Already up to date with $UPSTREAM/$BRANCH"
  exit 0
fi

echo "==> Rebasing $BRANCH onto $UPSTREAM/$BRANCH..."
if ! git rebase "$UPSTREAM/$BRANCH"; then
  echo "REBASE CONFLICT — resolve manually then run: git rebase --continue"
  echo "Conflicts typically only occur when upstream refactors files outside protected paths."
  exit 1
fi

echo "==> Installing deps (in case package.json changed)..."
if command -v bun >/dev/null 2>&1; then
  bun install --frozen-lockfile || bun install
else
  echo "WARN: bun not found, skipping install"
fi

echo "==> Type-check..."
if command -v bun >/dev/null 2>&1; then
  bun run type-check || { echo "type-check failed"; exit 1; }
fi

echo "==> Pushing to $PERSONAL/$BRANCH..."
git push "$PERSONAL" "$BRANCH" --force-with-lease

echo "==> Done."
