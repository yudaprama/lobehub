import type { Filter } from 'prest-js-sdk';

import { INBOX_SESSION_ID } from '@/const/session';
import { getPrestClient, getWorkspaceParams } from '@/libs/prest/client';
import { lambdaClient } from '@/libs/trpc/client';
import { type BatchTaskResult } from '@/types/service';
import {
  type ChatTopic,
  type ChatTopicMetadata,
  type CreateTopicParams,
  type QueryTopicParams,
  type RecentTopic,
  type TopicRankItem,
} from '@/types/topic';

type OnboardingSessionMetadataPatch = Partial<NonNullable<ChatTopicMetadata['onboardingSession']>>;

type UpdateTopicMetadataInput = Omit<Partial<ChatTopicMetadata>, 'onboardingSession'> & {
  onboardingSession?: OnboardingSessionMetadataPatch;
};

interface TopicRow {
  agent_id: string | null;
  client_id: string | null;
  completed_at: string | null;
  content: string | null;
  created_at: string;
  description: string | null;
  favorite: boolean;
  group_id: string | null;
  id: string;
  metadata: ChatTopicMetadata | null;
  mode: string | null;
  model: string | null;
  provider: string | null;
  session_id: string | null;
  status: string | null;
  title: string;
  total_cost: number | null;
  total_input_tokens: number | null;
  total_output_tokens: number | null;
  total_tokens: number | null;
  trigger: string | null;
  updated_at: string;
}

export class TopicService {
  createTopic = (params: CreateTopicParams): Promise<string> => {
    return lambdaClient.topic.createTopic.mutate({
      ...params,
      sessionId: this.toDbSessionId(params.sessionId),
    });
  };

  batchCreateTopics = (importTopics: ChatTopic[]): Promise<BatchTaskResult> => {
    return lambdaClient.topic.batchCreateTopics.mutate(importTopics);
  };

  cloneTopic = (id: string, newTitle?: string): Promise<string> => {
    return lambdaClient.topic.cloneTopic.mutate({ id, newTitle });
  };

  batchMoveTopics = (topicIds: string[], targetAgentId: string) => {
    return lambdaClient.topic.batchMoveTopics.mutate({ targetAgentId, topicIds });
  };

  importTopic = (params: {
    agentId: string;
    data: string;
    groupId?: string | null;
  }): Promise<{ messageCount: number; topicId: string }> => {
    return lambdaClient.topic.importTopic.mutate(params);
  };

  getTopics = async (params: QueryTopicParams): Promise<{ items: ChatTopic[]; total: number }> => {
    return lambdaClient.topic.getTopics.query({
      agentId: params.agentId,
      current: params.current,
      excludeStatuses: params.excludeStatuses,
      excludeTriggers: params.excludeTriggers,
      groupId: params.groupId,
      includeTriggers: params.includeTriggers,
      isInbox: params.isInbox,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      triggers: params.triggers,
      withDetails: params.withDetails,
    }) as any;
  };

  queryTopics = async (params?: {
    pageSize?: number;
    statuses?: string[];
  }): Promise<ChatTopic[]> => {
    const client = await getPrestClient();

    // Tier 1 read: `topics` is auto-scoped by pREST's [[auth.user_id_filters]].
    // The original lambdaClient path applies server-side status filtering; we
    // emulate it with `where: { status: { in: statuses } }` when provided.
    const rows = await client.select<TopicRow>('lobehub', 'public', 'topics', {
      order: ['updated_at:desc'],
      size: params?.pageSize ?? 20,
      ...(params?.statuses?.length ? { where: { status: { in: params.statuses } } } : {}),
    });
    return rows as unknown as ChatTopic[];
  };

  countTopics = async (params?: {
    agentId?: string;
    containerId?: string | null;
    endDate?: string;
    range?: [string, string];
    startDate?: string;
  }): Promise<number> => {
    const client = await getPrestClient();

    const where: Filter = {};
    if (params?.agentId) where.agent_id = params.agentId;
    if (params?.containerId) where.group_id = params.containerId;
    if (params?.startDate) where.created_at = { gte: params.startDate };
    if (params?.endDate) where.updated_at = { lte: params.endDate };

    const rows = await client.select<{ count: number }>('lobehub', 'public', 'topics', {
      count: true,
      ...(Object.keys(where).length ? { where } : {}),
    });
    const row = Array.isArray(rows) ? rows[0] : undefined;
    return row?.count ?? 0;
  };

  rankTopics = async (limit?: number): Promise<TopicRankItem[]> => {
    return lambdaClient.topic.rankTopics.query(limit);
  };

  getMaxTaskDuration = async (): Promise<number> => {
    return lambdaClient.topic.getMaxTaskDuration.query();
  };

  getRecentTopics = async (limit?: number): Promise<RecentTopic[]> => {
    return lambdaClient.topic.recentTopics.query({ limit });
  };

  searchTopics = (keywords: string, agentId?: string, groupId?: string): Promise<ChatTopic[]> => {
    const trimmed = keywords.trim();
    if (!trimmed) {
      return Promise.resolve([]);
    }

    return (async () => {
      const client = await getPrestClient();

      // Tier 2 stored SQL template wraps ts_rank(topics_tsv) — replaces the
      // legacy ParadeDB BM25 path. The `groupId` filter is not in the template
      // (pREST scopes by user via [[auth.user_id_filters]]); callers that need
      // group scoping still hit the BFF route, so we fall back when groupId is
      // present.
      if (groupId) {
        return lambdaClient.topic.searchTopics.query({
          agentId,
          groupId,
          keywords: trimmed,
        }) as any;
      }

      const rows = await client.query<TopicRow & { rank: number }>('lobehub', 'topicsSearchFts', {
        q: trimmed,
        ...getWorkspaceParams(),
        ...(agentId ? { agentId } : {}),
      });
      return rows as unknown as ChatTopic[];
    })();
  };

  updateTopic = async (id: string, data: Partial<ChatTopic>) => {
    const client = await getPrestClient();

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.title !== undefined) patch.title = data.title;
    if (data.favorite !== undefined) patch.favorite = data.favorite;
    if (data.description !== undefined) patch.description = data.description;
    if ((data as any).content !== undefined) patch.content = (data as any).content;
    if (data.status !== undefined) patch.status = data.status;
    if (data.trigger !== undefined) patch.trigger = data.trigger;
    if (data.metadata !== undefined) patch.metadata = data.metadata;

    await client.update('lobehub', 'public', 'topics', { id }, patch);
  };

  /**
   * Tier 3 — server-side joins topic + recent messages with a summary
   * fallback. No single pREST table/template covers this; stays on lambdaClient.
   */
  getTopicContext = (topicId: string): Promise<{ content: string; success: boolean }> => {
    return lambdaClient.topic.getTopicContext.query({ topicId });
  };

  updateTopicMetadata = (id: string, metadata: UpdateTopicMetadataInput) => {
    return lambdaClient.topic.updateTopicMetadata.mutate({ id, metadata });
  };

  getShareInfo = (topicId: string) => {
    return lambdaClient.topic.getShareInfo.query({ topicId });
  };

  enableSharing = (topicId: string, visibility?: 'private' | 'link') => {
    return lambdaClient.topic.enableSharing.mutate({ topicId, visibility });
  };

  updateShareVisibility = (topicId: string, visibility: 'private' | 'link') => {
    return lambdaClient.topic.updateShareVisibility.mutate({ topicId, visibility });
  };

  disableSharing = (topicId: string) => {
    return lambdaClient.topic.disableSharing.mutate({ topicId });
  };

  removeTopic = async (id: string) => {
    const client = await getPrestClient();
    await client.delete('lobehub', 'public', 'topics', { id });
  };

  removeTopics = async (sessionId: string) => {
    const client = await getPrestClient();

    const dbSessionId = this.toDbSessionId(sessionId);
    if (dbSessionId === null) {
      // INBOX: no session_id match — skip (BFF treats as no-op)
      return;
    }
    await client.delete('lobehub', 'public', 'topics', { session_id: dbSessionId });
  };

  removeTopicsByAgentId = async (agentId: string) => {
    const client = await getPrestClient();
    await client.delete('lobehub', 'public', 'topics', { agent_id: agentId });
  };

  batchRemoveTopics = async (topics: string[]) => {
    if (topics.length === 0) return;
    const client = await getPrestClient();
    await client.delete('lobehub', 'public', 'topics', { id: { in: topics } });
  };

  removeAllTopic = async () => {
    const client = await getPrestClient();

    // No where clause — pREST's [[auth.user_id_filters]] still scopes the
    // DELETE to the current user.
    await client.delete('lobehub', 'public', 'topics', {});
  };

  private toDbSessionId = (sessionId?: string | null) =>
    sessionId === INBOX_SESSION_ID || !sessionId ? null : sessionId;
}

export const topicService = new TopicService();
