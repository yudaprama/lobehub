import type { Filter } from 'prest-js-sdk';

import { idGenerator } from '@/libs/idGenerator';
import { getLobehubClient, getPrestClient, getWorkspaceParams } from '@/libs/prest/client';
import { lambdaClient } from '@/libs/trpc/client';
import {
  type ChatSessionList,
  type LobeAgentSession,
  type LobeSessions,
  type LobeSessionType,
  type SessionGroupItem,
  type UpdateSessionParams,
} from '@/types/session';

/**
 * @deprecated Session service is legacy. Use agentService for agent CRUD operations.
 * Mobile still uses this, but should migrate to agentService.
 */
export class SessionService {
  hasSessions = async (): Promise<boolean> => {
    const result = await this.countSessions();
    return result === 0;
  };

  /** @deprecated Use agentService.createAgent instead */
  createSession = async (
    type: LobeSessionType,
    data: Partial<LobeAgentSession>,
  ): Promise<string> => {
    const db = await getLobehubClient();
    const id = idGenerator('sessions');
    const { config, group, meta, ...session } = data;
    await db.insert('sessions', {
      id,
      title: (meta as any)?.title ?? null,
      type,
      group_id: group === 'default' ? null : (group ?? null),
      pinned: session.pinned ?? false,
      metadata: { ...config, ...meta },
    });
    return id;
  };

  cloneSession = (id: string, newTitle: string): Promise<string | undefined> => {
    return lambdaClient.session.cloneSession.mutate({ id, newTitle });
  };

  getGroupedSessions = async (): Promise<ChatSessionList> => {
    const client = await getPrestClient();

    // Tier 2 stored SQL template handles userId scoping + session/group join
    // + last-message preview. The shape matches ChatSessionList by
    // construction — the template was authored against this consumer.
    const [result] = await client.query<ChatSessionList>('lobehub', 'sessionsListGrouped', {
      ...getWorkspaceParams(),
    });
    return result;
  };

  countSessions = async (params?: {
    endDate?: string;
    range?: [string, string];
    startDate?: string;
  }): Promise<number> => {
    const client = await getPrestClient();
    const where: Filter = {};
    if (params?.startDate) where.created_at = { gte: params.startDate };
    if (params?.endDate)
      where.created_at = { ...(where.created_at as object), lte: params.endDate };
    const rows = await client.select<{ count: number }>('lobehub', 'public', 'sessions', {
      count: true,
      ...(Object.keys(where).length ? { where } : {}),
    });
    const row = Array.isArray(rows) ? rows[0] : undefined;
    return row?.count ?? 0;
  };

  updateSession = async (id: string, data: Partial<UpdateSessionParams>) => {
    const db = await getLobehubClient();
    const patch: Record<string, unknown> = {};
    if (data.group !== undefined) patch.group_id = data.group === 'default' ? null : data.group;
    if (data.pinned !== undefined) patch.pinned = data.pinned;
    if (data.meta !== undefined) patch.metadata = data.meta;
    if (data.updatedAt !== undefined) patch.updated_at = data.updatedAt;
    await db.update('sessions', { id }, patch);
  };

  searchSessions = (keywords: string): Promise<LobeSessions> => {
    return lambdaClient.session.searchSessions.query({ keywords });
  };

  removeSession = async (id: string) => {
    const db = await getLobehubClient();
    await db.delete('sessions', { id });
  };

  removeAllSessions = async () => {
    const db = await getLobehubClient();
    await db.delete('sessions', {});
  };

  // ************************************** //
  // ***********  SessionGroup  *********** //
  // ************************************** //

  createSessionGroup = async (name: string, sort?: number): Promise<string> => {
    const db = await getLobehubClient();
    const [row] = await db.insert('session_groups', { id: crypto.randomUUID(), name, sort });
    return row?.id;
  };

  removeSessionGroup = async (id: string) => {
    const db = await getLobehubClient();
    await db.delete('session_groups', { id });
  };

  removeSessionGroups = async () => {
    const db = await getLobehubClient();
    await db.delete('session_groups', {});
  };

  updateSessionGroup = async (id: string, value: Partial<SessionGroupItem>) => {
    const db = await getLobehubClient();
    await db.update('session_groups', { id }, value);
  };

  updateSessionGroupOrder = async (sortMap: { id: string; sort: number }[]) => {
    const db = await getLobehubClient();
    await Promise.all(sortMap.map(({ id, sort }) => db.update('session_groups', { id }, { sort })));
  };
}

export const sessionService = new SessionService();
