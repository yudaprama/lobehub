/**
 * Ory Keto RBAC client.
 *
 * Replaces the SQL-based RBAC system (rbac_roles, rbac_permissions,
 * rbac_role_permissions, rbac_user_roles) with Zanzibar-style relationship
 * tuple checks against Ory Keto.
 *
 * The workspace namespace defines three relations: owners, members, viewers.
 * Permission tiers map to Keto relations:
 *   - viewer → read-only workspace + content access
 *   - member → create + edit own content (app layer handles :owner filtering)
 *   - owner  → admin, billing, member management, edit all content
 *
 * Set `KETO_READ_URL` to enable. When unset, checks always pass (personal-scope
 * deployments that don't use workspaces).
 */

const KETO_READ_URL = process.env.KETO_READ_URL;

export type KetoRelation = 'manage' | 'view' | 'write';

/**
 * Map a LobeHub permission action code (e.g. 'agent:update') to the minimum
 * Keto relation required. Derived from WORKSPACE_ROLE_PERMISSIONS in
 * packages/const/src/rbac.ts:
 *   - viewer tier: read-only actions
 *   - member tier: content create/update/delete (own resources)
 *   - owner tier: admin, billing, member management
 */
const ACTION_TO_RELATION: Record<string, KetoRelation> = {
  'agent:create': 'write',
  'agent:delete': 'write',
  'agent:fork': 'write',
  'agent:read': 'view',
  'agent:update': 'write',
  'ai_model:create': 'write',
  'ai_model:delete': 'write',
  'ai_model:invoke': 'view',
  'ai_model:read': 'view',
  'ai_model:update': 'write',
  'ai_provider:create': 'write',
  'ai_provider:delete': 'write',
  'ai_provider:read': 'view',
  'ai_provider:update': 'write',
  'api_key:create': 'write',
  'api_key:delete': 'write',
  'api_key:read': 'view',
  'api_key:update': 'write',
  'document:create': 'write',
  'document:delete': 'write',
  'document:read': 'view',
  'document:update': 'write',
  'file:delete': 'write',
  'file:read': 'view',
  'file:update': 'write',
  'file:upload': 'write',
  'knowledge_base:create': 'write',
  'knowledge_base:delete': 'write',
  'knowledge_base:read': 'view',
  'knowledge_base:update': 'write',
  'message:create': 'write',
  'message:delete': 'write',
  'message:read': 'view',
  'message:update': 'write',
  'session:create': 'write',
  'session:delete': 'write',
  'session:read': 'view',
  'session:update': 'write',
  'session_group:create': 'write',
  'session_group:delete': 'write',
  'session_group:read': 'view',
  'session_group:update': 'write',
  'topic:create': 'write',
  'topic:delete': 'write',
  'topic:read': 'view',
  'topic:update': 'write',
  'translation:create': 'write',
  'translation:delete': 'write',
  'translation:read': 'view',
  'translation:update': 'write',
  'workspace:billing_manage': 'manage',
  'workspace:billing_read': 'view',
  'workspace:delete': 'manage',
  'workspace:read': 'view',
  'workspace:settings_update': 'manage',
  'workspace:update': 'manage',
  'workspace_audit:read': 'view',
  'workspace_member:invite': 'manage',
  'workspace_member:read': 'view',
  'workspace_member:remove': 'manage',
  'workspace_member:update_role': 'manage',
  'workspace_role:create': 'manage',
  'workspace_role:delete': 'manage',
  'workspace_role:read': 'view',
  'workspace_role:update': 'manage',
};

/**
 * Resolve the minimum Keto relation for an action code. Defaults to 'write'
 * for unknown actions — a safe default that requires at least member status.
 */
export const getRequiredRelation = (actionCode: string): KetoRelation =>
  ACTION_TO_RELATION[actionCode] ?? 'write';

/**
 * Check whether a user has the required relation on a workspace via Keto.
 *
 * Returns `true` when:
 * - `KETO_READ_URL` is not configured (personal-scope deployment)
 * - `workspaceId` is null/undefined (personal scope, no workspace check needed)
 * - Keto confirms the relation
 *
 * Returns `false` when Keto denies the check.
 * Throws on Keto errors (caller decides whether to fail-open or fail-closed).
 */
export const checkWorkspacePermission = async (
  userId: string,
  workspaceId: string | null | undefined,
  actionCode: string,
): Promise<boolean> => {
  if (!KETO_READ_URL || !workspaceId) return true;

  const relation = getRequiredRelation(actionCode);

  const res = await fetch(`${KETO_READ_URL}/relation-tuples/check`, {
    body: JSON.stringify({
      namespace: 'workspace',
      object: workspaceId,
      relation,
      subject_id: userId,
    }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Keto check failed: ${res.status} ${res.statusText} — ${body}`);
  }

  const data = (await res.json()) as { allowed: boolean };
  return data.allowed;
};

/**
 * Write a relationship tuple to Keto. Used when workspace roles change
 * (member added/removed/promoted/demoted).
 *
 * No-op when `KETO_WRITE_URL` is not configured.
 */
export const writeWorkspaceTuple = async (
  workspaceId: string,
  userId: string,
  relation: 'members' | 'owners' | 'viewers',
): Promise<void> => {
  const writeURL = process.env.KETO_WRITE_URL;
  if (!writeURL) return;

  const res = await fetch(`${writeURL}/admin/relation-tuples`, {
    body: JSON.stringify({
      namespace: 'workspace',
      object: workspaceId,
      relation,
      subject_id: userId,
    }),
    headers: { 'Content-Type': 'application/json' },
    method: 'PUT',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(
      `[keto] Failed to write tuple workspace:${workspaceId}#${relation}@user:${userId}: ${res.status} ${body}`,
    );
  }
};

/**
 * Delete a relationship tuple from Keto. Used when workspace roles are revoked.
 *
 * No-op when `KETO_WRITE_URL` is not configured.
 */
export const deleteWorkspaceTuple = async (
  workspaceId: string,
  userId: string,
  relation: 'members' | 'owners' | 'viewers',
): Promise<void> => {
  const writeURL = process.env.KETO_WRITE_URL;
  if (!writeURL) return;

  const params = new URLSearchParams({
    namespace: 'workspace',
    object: workspaceId,
    relation,
    subject_id: userId,
  });

  const res = await fetch(`${writeURL}/admin/relation-tuples?${params}`, {
    method: 'DELETE',
  });

  if (!res.ok && res.status !== 404) {
    const body = await res.text().catch(() => '');
    console.error(
      `[keto] Failed to delete tuple workspace:${workspaceId}#${relation}@user:${userId}: ${res.status} ${body}`,
    );
  }
};
