import { type PartialDeep } from 'type-fest';

import { getPrestClient } from '@/libs/prest/client';
import { lambdaClient } from '@/libs/trpc/client';
import { type LobeAgentChatConfig, type LobeAgentConfig } from '@/types/agent';
import { type MetaData } from '@/types/meta';
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
    const { config, group, meta, ...session } = data;
    return lambdaClient.session.createSession.mutate({
      config: { ...config, ...meta } as any,
      session: { ...session, groupId: group },
      type,
    });
  };

  cloneSession = (id: string, newTitle: string): Promise<string | undefined> => {
    return lambdaClient.session.cloneSession.mutate({ id, newTitle });
  };

  getGroupedSessions = async (): Promise<ChatSessionList> => {
    const client = await getPrestClient();

    // Tier 2 stored SQL template handles userId scoping + session/group join
    // + last-message preview. The shape matches ChatSessionList by
    // construction — the template was authored against this consumer.
    return client.query<ChatSessionList>('lobehub', 'sessionsListGrouped', {});
  };

  countSessions = async (params?: {
    endDate?: string;
    range?: [string, string];
    startDate?: string;
  }): Promise<number> => {
    return lambdaClient.session.countSessions.query(params);
  };

  updateSession = (id: string, data: Partial<UpdateSessionParams>) => {
    const { group, pinned, meta, updatedAt } = data;
    return lambdaClient.session.updateSession.mutate({
      id,
      value: { groupId: group === 'default' ? null : group, pinned, ...meta, updatedAt },
    });
  };

  // TODO: Need to be fixed
  getSessionConfig = async (id: string): Promise<LobeAgentConfig> => {
    // @ts-ignore
    return lambdaClient.agent.getAgentConfig.query({ sessionId: id });
  };

  updateSessionConfig = (
    id: string,
    config: PartialDeep<LobeAgentConfig>,
    signal?: AbortSignal,
  ) => {
    return lambdaClient.session.updateSessionConfig.mutate(
      { id, value: config },
      {
        context: { showNotification: false },
        signal,
      },
    );
  };

  updateSessionMeta = (id: string, meta: Partial<MetaData>, signal?: AbortSignal) => {
    return lambdaClient.session.updateSessionConfig.mutate({ id, value: meta }, { signal });
  };

  updateSessionChatConfig = (
    id: string,
    value: Partial<LobeAgentChatConfig>,
    signal?: AbortSignal,
  ) => {
    return lambdaClient.session.updateSessionChatConfig.mutate({ id, value }, { signal });
  };

  searchSessions = (keywords: string): Promise<LobeSessions> => {
    return lambdaClient.session.searchSessions.query({ keywords });
  };

  removeSession = (id: string) => {
    return lambdaClient.session.removeSession.mutate({ id });
  };

  removeAllSessions = () => {
    return lambdaClient.session.removeAllSessions.mutate();
  };

  // ************************************** //
  // ***********  SessionGroup  *********** //
  // ************************************** //

  createSessionGroup = async (name: string, sort?: number): Promise<string> => {
    const client = await getPrestClient();
    const { data } = await client
      .from('session_groups')
      .insert({ name, sort })
      .single();
    return data?.id;
  };

  removeSessionGroup = async (id: string) => {
    const client = await getPrestClient();
    await client.from('session_groups').eq('id', id).delete();
  };

  removeSessionGroups = async () => {
    const client = await getPrestClient();
    await client.from('session_groups').delete();
  };

  updateSessionGroup = async (id: string, value: Partial<SessionGroupItem>) => {
    const client = await getPrestClient();
    await client.from('session_groups').eq('id', id).patch(value);
  };

  updateSessionGroupOrder = async (sortMap: { id: string; sort: number }[]) => {
    const client = await getPrestClient();
    await Promise.all(
      sortMap.map(({ id, sort }) =>
        client.from('session_groups').eq('id', id).patch({ sort }),
      ),
    );
  };
}

export const sessionService = new SessionService();
