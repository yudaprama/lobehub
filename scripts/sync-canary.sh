#!/usr/bin/env bash
# List commits in origin/canary that are safe to sync (do not touch auth areas).
# Usage: ./scripts/sync-canary.sh [SINCE] [LIMIT]
# Example: ./scripts/sync-canary.sh "1 week ago" 30

set -euo pipefail

SINCE="${1:-2 weeks ago}"
LIMIT="${2:-50}"

echo "Fetching origin/canary..."
git fetch origin canary --quiet

AUTH_TOUCHING_REGEX='^((src/app/\[variants\]/\(auth\)/|src/features/Auth/|src/libs/better-auth/|src/libs/kratos/|src/app/\(backend\)/middleware/auth/|src/app/\(backend\)/api/auth/|src/layout/AuthProvider/|package\.json|pnpm-lock\.yaml))'

echo ""
echo "=== SKIP-LIST (commits in canary touching auth areas) ==="
git log origin/canary --oneline --since="$SINCE" -n "$LIMIT" | while read -r sha rest; do
  if git show --name-only --format= "$sha" 2>/dev/null | grep -E "$AUTH_TOUCHING_REGEX" >/dev/null; then
    echo "$sha $rest"
  fi
done

echo ""
echo "=== SAFE-TO-SYNC (commits in canary, auth areas excluded) ==="
git log origin/canary --oneline --since="$SINCE" -n "$LIMIT" | while read -r sha rest; do
  if ! git show --name-only --format= "$sha" 2>/dev/null | grep -E "$AUTH_TOUCHING_REGEX" >/dev/null; then
    echo "$sha $rest"
  fi
done

echo ""
echo "=== NEXT STEPS ==="
echo "1. Pick a safe commit:  git show <sha> --stat"
echo "2. Inspect a file:      git show <sha> -- <path>"
echo "3. Apply a single file: git checkout origin/canary -- <path>"
echo "4. Validate:            bun run type-check"
