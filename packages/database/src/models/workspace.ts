import { and, count, desc, eq, isNull, ne } from 'drizzle-orm';

import {
  type NewWorkspace,
  type WorkspaceItem,
  workspaceMembers,
  workspaces,
} from '../schemas/workspace';
import type { LobeChatDatabase } from '../type';

type KetoRelation = 'members' | 'owners' | 'viewers';

const KETO_WRITE_URL = process.env.KETO_WRITE_URL;

/**
 * Best-effort Keto tuple write. Fires after DB commits so a Keto failure
 * never rolls back the transaction. Monitor `[keto-sync]` log lines for
 * drift between DB state and Keto tuples.
 */
const syncKetoTuple = (
  workspaceId: string,
  userId: string,
  relation: KetoRelation,
  action: 'delete' | 'put',
): void => {
  if (!KETO_WRITE_URL) return;

  const tuple = {
    namespace: 'workspace',
    object: workspaceId,
    relation,
    subject_id: userId,
  };

  const doSync = async () => {
    try {
      if (action === 'put') {
        const res = await fetch(`${KETO_WRITE_URL}/admin/relation-tuples`, {
          body: JSON.stringify(tuple),
          headers: { 'Content-Type': 'application/json' },
          method: 'PUT',
        });
        if (!res.ok) {
          console.error(
            `[keto-sync] PUT failed: workspace:${workspaceId}#${relation}@user:${userId} → ${res.status}`,
          );
        }
      } else {
        const params = new URLSearchParams(tuple);
        const res = await fetch(`${KETO_WRITE_URL}/admin/relation-tuples?${params}`, {
          method: 'DELETE',
        });
        if (!res.ok && res.status !== 404) {
          console.error(
            `[keto-sync] DELETE failed: workspace:${workspaceId}#${relation}@user:${userId} → ${res.status}`,
          );
        }
      }
    } catch (error) {
      console.error(
        `[keto-sync] ${action.toUpperCase()} error: workspace:${workspaceId}#${relation}@user:${userId}`,
        error,
      );
    }
  };

  void doSync();
};

export class WorkspaceModel {
  protected readonly db: LobeChatDatabase;
  protected readonly userId: string;

  constructor(db: LobeChatDatabase, userId: string) {
    this.db = db;
    this.userId = userId;
  }

  create = async (params: {
    avatar?: string;
    description?: string;
    name: string;
    slug: string;
  }) => {
    return this.db.transaction(async (tx) => {
      const [workspace] = await tx
        .insert(workspaces)
        .values({
          avatar: params.avatar,
          description: params.description,
          name: params.name,
          primaryOwnerId: this.userId,
          slug: params.slug,
        } satisfies NewWorkspace)
        .returning();

      await tx.insert(workspaceMembers).values({
        role: 'owner',
        userId: this.userId,
        workspaceId: workspace.id,
      });

      return workspace;
    }).then((workspace) => {
      syncKetoTuple(workspace.id, this.userId, 'owners', 'put');
      return workspace;
    });
  };

  delete = async (id: string) => {
    return this.db
      .delete(workspaces)
      .where(and(eq(workspaces.id, id), eq(workspaces.primaryOwnerId, this.userId)));
  };

  findById = async (id: string) => {
    return this.db.query.workspaces.findFirst({
      where: eq(workspaces.id, id),
    });
  };

  findBySlug = async (slug: string) => {
    return this.db.query.workspaces.findFirst({
      where: eq(workspaces.slug, slug),
    });
  };

  /**
   * List ids of workspaces where this user is the primary (Stripe-bound) owner.
   * Cloud callers combine with subscription-status data to enforce the Free
   * workspace cap; OSS callers can use the raw count.
   */
  listOwnedWorkspaceIds = async (): Promise<string[]> => {
    const owned = await this.db.query.workspaces.findMany({
      columns: { id: true },
      where: eq(workspaces.primaryOwnerId, this.userId),
    });
    return owned.map((w) => w.id);
  };

  getSettings = async (id: string) => {
    const workspace = await this.db.query.workspaces.findFirst({
      columns: { settings: true },
      where: eq(workspaces.id, id),
    });
    return workspace?.settings ?? {};
  };

  /**
   * Count every workspace this user belongs to — owned + joined. Reads the
   * membership table directly because owners are always inserted as members on
   * `create`, so a single count covers both shapes.
   */
  countUserMemberships = async (): Promise<number> => {
    const result = await this.db
      .select({ count: count() })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.userId, this.userId), isNull(workspaceMembers.deletedAt)));
    return result[0]?.count ?? 0;
  };

  listUserWorkspaces = async () => {
    const memberships = await this.db.query.workspaceMembers.findMany({
      where: and(eq(workspaceMembers.userId, this.userId), isNull(workspaceMembers.deletedAt)),
    });

    if (memberships.length === 0) return [];

    const workspaceIds = memberships.map((m) => m.workspaceId);

    const results = await this.db.query.workspaces.findMany({
      orderBy: [desc(workspaces.updatedAt)],
      where: (ws, { inArray }) => inArray(ws.id, workspaceIds),
    });

    return results.map((ws) => ({
      ...ws,
      role: memberships.find((m) => m.workspaceId === ws.id)?.role ?? 'viewer',
    }));
  };

  update = async (
    id: string,
    value: Partial<Pick<WorkspaceItem, 'avatar' | 'description' | 'name' | 'slug'>>,
  ) => {
    return this.db
      .update(workspaces)
      .set({ ...value, updatedAt: new Date() })
      .where(eq(workspaces.id, id));
  };

  updateSettings = async (id: string, settings: Record<string, any>) => {
    return this.db
      .update(workspaces)
      .set({ settings, updatedAt: new Date() })
      .where(eq(workspaces.id, id));
  };

  /**
   * Transfer the Stripe binding (primary owner) to another existing `owner`
   * member. Both users keep role='owner' afterwards — only the Stripe binding
   * moves. Use `promoteToOwner` first if the target isn't already an owner.
   */
  transferPrimaryOwnership = async (id: string, newPrimaryOwnerUserId: string) => {
    if (newPrimaryOwnerUserId === this.userId)
      throw new Error('New primary owner must be a different user');

    return this.db.transaction(async (tx) => {
      const current = await tx.query.workspaces.findFirst({
        where: eq(workspaces.id, id),
      });

      if (!current) throw new Error('Workspace not found');
      if (current.primaryOwnerId !== this.userId)
        throw new Error('Only the primary owner can transfer primary ownership');

      const targetMembership = await tx.query.workspaceMembers.findFirst({
        where: and(
          eq(workspaceMembers.workspaceId, id),
          eq(workspaceMembers.userId, newPrimaryOwnerUserId),
          isNull(workspaceMembers.deletedAt),
        ),
      });
      if (!targetMembership)
        throw new Error('Target user must already be a member of the workspace');
      if (targetMembership.role !== 'owner')
        throw new Error('Target user must already be an owner — promote them first');

      await tx
        .update(workspaces)
        .set({ primaryOwnerId: newPrimaryOwnerUserId, updatedAt: new Date() })
        .where(eq(workspaces.id, id));

      return {
        newPrimaryOwnerUserId,
        previousPrimaryOwnerUserId: this.userId,
        workspaceId: id,
      };
    });
  };

  promoteToOwner = async (id: string, targetUserId: string) => {
    return this.db.transaction(async (tx) => {
      const actor = await tx.query.workspaceMembers.findFirst({
        where: and(
          eq(workspaceMembers.workspaceId, id),
          eq(workspaceMembers.userId, this.userId),
          isNull(workspaceMembers.deletedAt),
        ),
      });
      if (actor?.role !== 'owner')
        throw new Error('Only an owner can promote other members to owner');

      const target = await tx.query.workspaceMembers.findFirst({
        where: and(
          eq(workspaceMembers.workspaceId, id),
          eq(workspaceMembers.userId, targetUserId),
          isNull(workspaceMembers.deletedAt),
        ),
      });
      if (!target) throw new Error('Target user is not a member of this workspace');
      if (target.role === 'owner') return target;

      await tx
        .update(workspaceMembers)
        .set({ role: 'owner' })
        .where(
          and(eq(workspaceMembers.workspaceId, id), eq(workspaceMembers.userId, targetUserId)),
        );

      return { ...target, role: 'owner' };
    }).then((result) => {
      syncKetoTuple(id, targetUserId, 'members', 'delete');
      syncKetoTuple(id, targetUserId, 'owners', 'put');
      return result;
    });
  };

  demoteFromOwner = async (id: string, targetUserId: string) => {
    return this.db.transaction(async (tx) => {
      const workspace = await tx.query.workspaces.findFirst({
        where: eq(workspaces.id, id),
      });
      if (!workspace) throw new Error('Workspace not found');
      if (workspace.primaryOwnerId === targetUserId)
        throw new Error(
          'Cannot demote the primary owner — transfer primary ownership to another owner first',
        );

      const actor = await tx.query.workspaceMembers.findFirst({
        where: and(
          eq(workspaceMembers.workspaceId, id),
          eq(workspaceMembers.userId, this.userId),
          isNull(workspaceMembers.deletedAt),
        ),
      });
      if (actor?.role !== 'owner') throw new Error('Only an owner can demote other owners');

      const target = await tx.query.workspaceMembers.findFirst({
        where: and(
          eq(workspaceMembers.workspaceId, id),
          eq(workspaceMembers.userId, targetUserId),
          isNull(workspaceMembers.deletedAt),
        ),
      });
      if (!target) throw new Error('Target user is not a member of this workspace');
      if (target.role !== 'owner') return target;

      await tx
        .update(workspaceMembers)
        .set({ role: 'member' })
        .where(
          and(eq(workspaceMembers.workspaceId, id), eq(workspaceMembers.userId, targetUserId)),
        );

      return { ...target, role: 'member' };
    }).then((result) => {
      syncKetoTuple(id, targetUserId, 'owners', 'delete');
      syncKetoTuple(id, targetUserId, 'members', 'put');
      return result;
    });
  };

  countOtherOwners = async (workspaceId: string, excludeUserId: string): Promise<number> => {
    const result = await this.db
      .select({ count: count() })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.role, 'owner'),
          ne(workspaceMembers.userId, excludeUserId),
          isNull(workspaceMembers.deletedAt),
        ),
      );
    return result[0]?.count ?? 0;
  };

  /**
   * Demote the workspace to single-owner: remove every non-owner member and
   * clear the grace-period marker. Called when a subscription is cancelled.
   * Workspace-scoped resources (agents/sessions/etc.) stay attached to the
   * workspace and remain accessible to the primary owner.
   */
  downgradeToSolo = async (id: string) => {
    return this.db.transaction(async (tx) => {
      const current = await tx.query.workspaces.findFirst({
        where: eq(workspaces.id, id),
      });

      if (!current) throw new Error('Workspace not found');
      if (current.primaryOwnerId !== this.userId)
        throw new Error('Only the primary owner can downgrade this workspace');

      const removedMembers = await tx
        .update(workspaceMembers)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(workspaceMembers.workspaceId, id),
            ne(workspaceMembers.userId, current.primaryOwnerId),
            isNull(workspaceMembers.deletedAt),
          ),
        )
        .returning();

      const currentSettings = (current.settings as Record<string, any> | null) ?? {};
      const { gracePeriodUntil: _drop, ...restSettings } = currentSettings;

      const [updated] = await tx
        .update(workspaces)
        .set({
          settings: restSettings,
          updatedAt: new Date(),
        })
        .where(eq(workspaces.id, id))
        .returning();

      return {
        removedUserIds: removedMembers.map((m) => m.userId),
        workspace: updated,
      };
    }).then((result) => {
      for (const uid of result.removedUserIds) {
        syncKetoTuple(id, uid, 'owners', 'delete');
        syncKetoTuple(id, uid, 'members', 'delete');
        syncKetoTuple(id, uid, 'viewers', 'delete');
      }
      return result;
    });
  };

  setGracePeriod = async (id: string, gracePeriodUntil: number | null) => {
    const current = await this.db.query.workspaces.findFirst({
      columns: { settings: true },
      where: eq(workspaces.id, id),
    });
    if (!current) throw new Error('Workspace not found');

    const prev = (current.settings as Record<string, any> | null) ?? {};
    const next =
      gracePeriodUntil === null
        ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== 'gracePeriodUntil'))
        : { ...prev, gracePeriodUntil };

    await this.db
      .update(workspaces)
      .set({ settings: next, updatedAt: new Date() })
      .where(eq(workspaces.id, id));
  };
}
