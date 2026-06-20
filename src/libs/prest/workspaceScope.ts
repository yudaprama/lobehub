import { getActiveWorkspaceId } from '@/business/client/hooks/useActiveWorkspaceId';

/**
 * Return `{ workspaceId }` when a workspace is active, or `{}` for personal
 * scope. Spread into pREST Tier 2 query params so the server's
 * `WorkspaceAuthzGate` validates the workspace via Keto before the template
 * runs.
 *
 * Reads `getActiveWorkspaceId()` (non-React getter) so it works inside
 * imperative service code. When the OSS stub returns `null`, no param is
 * added — the template falls back to personal scope (`workspace_id IS NULL`),
 * matching pre-workspace behavior.
 */
export const getWorkspaceParams = (): { workspaceId: string } | Record<string, never> => {
  const id = getActiveWorkspaceId();
  return id ? { workspaceId: id } : {};
};
