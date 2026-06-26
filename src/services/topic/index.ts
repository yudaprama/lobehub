import { createNanoId } from '@lobechat/utils';
import type { Filter } from 'prest-js-sdk';

import { INBOX_SESSION_ID } from '@/const/session';
import { idGenerator } from '@/libs/idGenerator';
import { getLobehubQueryClient, getWorkspaceParams } from '@/libs/prest/client';
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
  createTopic = async (params: CreateTopicParams): Promise<string> => {
    const db = await getLobehubQueryClient();
    const id = idGenerator('topics');
    await db.insert('topics', {
      id,
      title: params.title ?? null,
      favorite: params.favorite ?? false,
      session_id: this.toDbSessionId(params.sessionId),
      trigger: params.trigger ?? null,
    });
    return id;
  };

  batchCreateTopics = async (importTopics: ChatTopic[]): Promise<BatchTaskResult> => {
    const db = await getLobehubQueryClient();
    const results = await Promise.allSettled(
      importTopics.map((topic) =>
        db.insert('topics', {
          id: topic.id || idGenerator('topics'),
          title: topic.title ?? null,
          favorite: topic.favorite ?? false,
          session_id: this.toDbSessionId(topic.sessionId),
          agent_id: (topic as any).agentId ?? null,
          metadata: (topic as any).metadata ?? null,
        }),
      ),
    );
    const success = results.filter((r) => r.status === 'fulfilled').length;
    const errors = results
      .map((r, i) =>
        r.status === 'rejected' ? { id: importTopics[i].id, error: String(r.reason) } : null,
      )
      .filter(Boolean) as any[];
    return {
      added: success,
      errors,
      ids: importTopics.map((t) => t.id),
      skips: [],
      success: errors.length === 0,
    };
  };

  cloneTopic = (id: string, newTitle?: string): Promise<string> => {
    return lambdaClient.topic.cloneTopic.mutate({ id, newTitle });
  };

  batchMoveTopics = async (topicIds: string[], targetAgentId: string) => {
    const db = await getLobehubQueryClient();
    await Promise.all(
      topicIds.map((id) => db.update('topics', { id }, { agent_id: targetAgentId })),
    );
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
    const db = await getLobehubQueryClient();

    // Tier 1 read: `topics` is auto-scoped by pREST's [[auth.user_id_filters]].
    // The original lambdaClient path applies server-side status filtering; we
    // emulate it with `where: { status: { in: statuses } }` when provided.
    const rows = await db.select('topics', {
      camelCase: true,
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
    const db = await getLobehubQueryClient();

    const where: Filter = {};
    if (params?.agentId) where.agent_id = params.agentId;
    if (params?.containerId) where.group_id = params.containerId;
    if (params?.startDate) where.created_at = { gte: params.startDate };
    if (params?.endDate) where.updated_at = { lte: params.endDate };

    const rows = await db.select('topics', {
      count: true,
      ...(Object.keys(where).length ? { where } : {}),
    });
    const row = Array.isArray(rows)
      ? (rows[0] as unknown as { count: number } | undefined)
      : undefined;
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
      const db = await getLobehubQueryClient();

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

      const rows = await db.query<TopicRow & { rank: number }>(
        'lobehub',
        'topicsSearchFts',
        {
          q: trimmed,
          ...getWorkspaceParams(),
          ...(agentId ? { agentId } : {}),
        },
        { camelCase: true },
      );
      return rows as unknown as ChatTopic[];
    })();
  };

  updateTopic = async (id: string, data: Partial<ChatTopic>) => {
    const db = await getLobehubQueryClient();

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.title !== undefined) patch.title = data.title;
    if (data.favorite !== undefined) patch.favorite = data.favorite;
    if (data.description !== undefined) patch.description = data.description;
    if ((data as any).content !== undefined) patch.content = (data as any).content;
    if (data.status !== undefined) patch.status = data.status;
    if (data.trigger !== undefined) patch.trigger = data.trigger;
    if (data.metadata !== undefined) patch.metadata = data.metadata;

    await db.update('topics', { id }, patch);
  };

  /**
   * Tier 3 — server-side joins topic + recent messages with a summary
   * fallback. No single pREST table/template covers this; stays on lambdaClient.
   */
  getTopicContext = (topicId: string): Promise<{ content: string; success: boolean }> => {
    return lambdaClient.topic.getTopicContext.query({ topicId });
  };

  updateTopicMetadata = async (id: string, metadata: UpdateTopicMetadataInput) => {
    const db = await getLobehubQueryClient();
    await db.update('topics', { id }, { metadata });
  };

  getShareInfo = async (topicId: string) => {
    const db = await getLobehubQueryClient();
    const rows = await db.select('topic_shares', {
      camelCase: true,
      where: { topic_id: topicId },
    });
    return rows?.[0] ?? null;
  };

  enableSharing = async (topicId: string, visibility: 'private' | 'link' = 'link') => {
    const db = await getLobehubQueryClient();
    const id = `tsh_${createNanoId(8)()}`;
    await db.insert('topic_shares', {
      id,
      topic_id: topicId,
      visibility,
    } as any);
    return { id };
  };

  updateShareVisibility = async (topicId: string, visibility: 'private' | 'link') => {
    const db = await getLobehubQueryClient();
    await db.update('topic_shares', { topic_id: topicId }, { visibility } as any);
  };

  disableSharing = async (topicId: string) => {
    const db = await getLobehubQueryClient();
    await db.delete('topic_shares', { topic_id: topicId });
  };

  removeTopic = async (id: string) => {
    const db = await getLobehubQueryClient();
    await db.delete('topics', { id });
  };

  removeTopics = async (sessionId: string) => {
    const db = await getLobehubQueryClient();

    const dbSessionId = this.toDbSessionId(sessionId);
    if (dbSessionId === null) {
      // INBOX: no session_id match — skip (BFF treats as no-op)
      return;
    }
    await db.delete('topics', { session_id: dbSessionId });
  };

  removeTopicsByAgentId = async (agentId: string) => {
    const db = await getLobehubQueryClient();
    await db.delete('topics', { agent_id: agentId });
  };

  batchRemoveTopics = async (topics: string[]) => {
    if (topics.length === 0) return;
    const db = await getLobehubQueryClient();
    await db.delete('topics', { id: { in: topics } });
  };

  removeAllTopic = async () => {
    const db = await getLobehubQueryClient();

    // No where clause — pREST's [[auth.user_id_filters]] still scopes the
    // DELETE to the current user.
    await db.delete('topics', {});
  };

  private toDbSessionId = (sessionId?: string | null) =>
    sessionId === INBOX_SESSION_ID || !sessionId ? null : sessionId;
}

export const topicService = new TopicService();
