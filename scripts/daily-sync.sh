#!/usr/bin/env bash
# Daily sync from upstream canary. Pulls via rebase; .gitattributes
# merge=ours driver keeps fork customizations on Kratos/AList/standalone
# paths so they survive the rebase automatically.
#
# Usage: ./scripts/daily-sync.sh
# Cron:  0 6 * * * /path/to/repo/scripts/daily-sync.sh
set -euo pipefail

BRANCH="${BRANCH:-canary}"
UPSTREAM="${UPSTREAM_REMOTE:-origin}"
PERSONAL="${PERSONAL_REMOTE:-personal}"

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
