import { type AgentItem, type AgentRankItem, type LobeAgentConfig } from '@lobechat/types';
import { type PartialDeep } from 'type-fest';

import { idGenerator } from '@/libs/idGenerator';
import { getPrestClient } from '@/libs/prest/client';
import { lambdaClient } from '@/libs/trpc/client';

export const AVAILABLE_AGENTS_CONTEXT_LIMIT = 10;
export const AVAILABLE_AGENTS_CONTEXT_QUERY_LIMIT = AVAILABLE_AGENTS_CONTEXT_LIMIT + 2;

export interface AvailableAgentItem {
  avatar: string | null;
  backgroundColor: string | null;
  description: string | null;
  id: string;
  title: string | null;
}

/**
 * Market agent model can be either a string or an object with model details
 */
type MarketAgentModel =
  | LobeAgentConfig['model']
  | {
      model: LobeAgentConfig['model'];
      parameters?: Partial<LobeAgentConfig['params']>;
      provider?: LobeAgentConfig['provider'];
    };

type AgentMetaUpdate = Partial<
  Pick<
    AgentItem,
    'avatar' | 'backgroundColor' | 'description' | 'marketIdentifier' | 'tags' | 'title'
  >
>;

/**
 * Normalize market agent config to standard agent config.
 * Handles the case where market returns model as an object instead of string.
 */
const normalizeMarketAgentModel = (config?: PartialDeep<AgentItem>): PartialDeep<AgentItem> => {
  if (!config) return {};

  const model = config.model as MarketAgentModel | undefined;

  // If model is not an object, return config as-is
  if (typeof model !== 'object' || model === null) {
    return config;
  }

  // Extract model info and merge parameters
  const { model: modelName, provider: modelProvider, parameters } = model;
  const existingParams = (config.params ?? {}) as Record<string, any>;
  const mergedParams = { ...parameters, ...existingParams };

  return {
    ...config,
    model: modelName,
    params: Object.keys(mergedParams).length > 0 ? mergedParams : undefined,
    provider: config.provider ?? modelProvider,
  };
};

export interface CreateAgentParams {
  config?: PartialDeep<AgentItem>;
  groupId?: string;
}

export interface CreateAgentResult {
  agentId: string;
}

export interface CreateAgentOnlyParams {
  config?: PartialDeep<AgentItem>;
  groupId: string;
}

export interface CreateAgentOnlyResult {
  agentId: string;
}

class AgentService {
  /**
   * Check if an agent with the given marketIdentifier already exists
   */
  checkByMarketIdentifier = async (marketIdentifier: string): Promise<boolean> => {
    return lambdaClient.agent.checkByMarketIdentifier.query({ marketIdentifier });
  };

  /**
   * Get an agent by marketIdentifier
   * @returns agent id if exists, null otherwise
   */
  getAgentByMarketIdentifier = async (marketIdentifier: string): Promise<string | null> => {
    return lambdaClient.agent.getAgentByMarketIdentifier.query({ marketIdentifier });
  };

  /**
   * Get an agent by forkedFromIdentifier stored in params
   * @returns agent id if exists, null otherwise
   */
  getAgentByForkedFromIdentifier = async (forkedFromIdentifier: string): Promise<string | null> => {
    return lambdaClient.agent.getAgentByForkedFromIdentifier.query({ forkedFromIdentifier });
  };

  /**
   * Create a new agent with session.
   * Automatically normalizes market agent config (handles model as object).
   */
  createAgent = async (params: CreateAgentParams): Promise<CreateAgentResult> => {
    const normalizedConfig = normalizeMarketAgentModel(params.config);
    const client = await getPrestClient();
    const agentId = idGenerator('agents');

    await client.insert('lobehub', 'public', 'agents', {
      id: agentId,
      title: (normalizedConfig as any)?.title ?? null,
      avatar: (normalizedConfig as any)?.avatar ?? null,
      description: (normalizedConfig as any)?.description ?? null,
      tags: (normalizedConfig as any)?.tags ?? null,
      model: (normalizedConfig as any)?.model ?? null,
      session_group_id: params.groupId ?? null,
      virtual: false,
    } as any);

    await client.insert('lobehub', 'public', 'sessions', {
      id: agentId,
      type: 'agent',
      group_id: params.groupId === 'default' ? null : (params.groupId ?? null),
      metadata: normalizedConfig as any,
    } as any);

    return { agentId };
  };

  /**
   * Create a virtual agent without session.
   * Used for Group Agent Builder to create virtual agents for groups.
   */
  createAgentOnly = async (params: CreateAgentOnlyParams): Promise<CreateAgentOnlyResult> => {
    const normalizedConfig = normalizeMarketAgentModel(params.config);
    const client = await getPrestClient();
    const agentId = idGenerator('agents');

    await client.insert('lobehub', 'public', 'agents', {
      id: agentId,
      title: (normalizedConfig as any)?.title ?? null,
      avatar: (normalizedConfig as any)?.avatar ?? null,
      description: (normalizedConfig as any)?.description ?? null,
      tags: (normalizedConfig as any)?.tags ?? null,
      model: (normalizedConfig as any)?.model ?? null,
      session_group_id: params.groupId ?? null,
      virtual: true,
    } as any);

    return { agentId };
  };

  createAgentKnowledgeBase = async (
    agentId: string,
    knowledgeBaseId: string,
    enabled?: boolean,
  ) => {
    return lambdaClient.agent.createAgentKnowledgeBase.mutate({
      agentId,
      enabled,
      knowledgeBaseId,
    });
  };

  deleteAgentKnowledgeBase = async (agentId: string, knowledgeBaseId: string) => {
    return lambdaClient.agent.deleteAgentKnowledgeBase.mutate({ agentId, knowledgeBaseId });
  };

  toggleKnowledgeBase = async (agentId: string, knowledgeBaseId: string, enabled?: boolean) => {
    return lambdaClient.agent.toggleKnowledgeBase.mutate({
      agentId,
      enabled,
      knowledgeBaseId,
    });
  };

  createAgentFiles = async (agentId: string, fileIds: string[], enabled?: boolean) => {
    return lambdaClient.agent.createAgentFiles.mutate({ agentId, enabled, fileIds });
  };

  deleteAgentFile = async (agentId: string, fileId: string) => {
    return lambdaClient.agent.deleteAgentFile.mutate({ agentId, fileId });
  };

  toggleFile = async (agentId: string, fileId: string, enabled?: boolean) => {
    return lambdaClient.agent.toggleFile.mutate({
      agentId,
      enabled,
      fileId,
    });
  };

  getFilesAndKnowledgeBases = async (agentId: string) => {
    return lambdaClient.agent.getKnowledgeBasesAndFiles.query({ agentId });
  };

  getAgentConfigById = async (agentId: string) => {
    return lambdaClient.agent.getAgentConfigById.query({ agentId });
  };

  updateAgentConfig = async (
    agentId: string,
    config: PartialDeep<LobeAgentConfig>,
    signal?: AbortSignal,
  ) => {
    const client = await getPrestClient();
    await client.update(
      'lobehub',
      'public',
      'sessions',
      { id: agentId },
      { metadata: config as any, updated_at: new Date().toISOString() },
    );
    return { success: true } as { agent?: any; success: boolean };
  };

  /**
   * Update agent meta and return the updated agent data
   */
  updateAgentMeta = async (agentId: string, meta: AgentMetaUpdate, signal?: AbortSignal) => {
    return lambdaClient.agent.updateAgentConfig.mutate({ agentId, value: meta }, { signal });
  };

  /**
   * Get a builtin agent by slug, creating it if it doesn't exist.
   * This is a generic interface for all builtin agents (page-copilot, inbox, etc.)
   */
  getBuiltinAgent = async (slug: string) => {
    return lambdaClient.agent.getBuiltinAgent.query({ slug });
  };

  removeAgent = async (agentId: string) => {
    const client = await getPrestClient();
    await client.delete('lobehub', 'public', 'sessions', { id: agentId });
    await client.delete('lobehub', 'public', 'agents', { id: agentId });
  };

  /**
   * Query non-virtual agents with optional keyword filter.
   * Returns agents with minimal info (id, title, description, avatar, backgroundColor).
   *
   * Tier 2 stored SQL template joins topics for topic_count + last_active_at.
   * The `virtual = false` filter is encoded in the template's WHERE clause.
   */
  queryAgents = async (params?: {
    keyword?: string;
    limit?: number;
    offset?: number;
  }): Promise<AvailableAgentItem[]> => {
    const client = await getPrestClient();

    const queryParams: Record<string, string | number | boolean> = {};
    if (params?.keyword) queryParams.keyword = params.keyword;
    if (params?.limit) queryParams.size = params.limit;
    if (params?.offset) queryParams.page = Math.floor(params.offset / (params.limit ?? 20)) + 1;

    return client.query<AvailableAgentItem>('lobehub', 'agentsListWithStats', queryParams, {
      camelCase: true,
    });
  };

  /**
   * Count non-virtual agents with optional keyword filter, matching queryAgents conditions.
   *
   * Tier 1 count when no keyword. Falls back to BFF for keyword searches
   * since the Tier 2 template doesn't expose a count endpoint.
   */
  countAgents = async (params?: { keyword?: string }) => {
    if (params?.keyword) {
      return lambdaClient.agent.countAgents.query(params);
    }

    const client = await getPrestClient();
    const rows = await client.select<{ count: number }>('lobehub', 'public', 'agents', {
      count: true,
      where: { virtual: false },
    });
    const row = Array.isArray(rows) ? rows[0] : undefined;
    return row?.count ?? 0;
  };

  /**
   * Pin or unpin an agent.
   *
   * Tier 1 update on `agents.pinned`.
   */
  updateAgentPinned = async (agentId: string, pinned: boolean) => {
    const client = await getPrestClient();
    await client.update('lobehub', 'public', 'agents', { id: agentId }, { pinned });
  };

  /**
   * Duplicate an agent.
   * Returns the new agent ID.
   */
  duplicateAgent = async (
    agentId: string,
    newTitle?: string,
  ): Promise<{ agentId: string } | null> => {
    return lambdaClient.agent.duplicateAgent.mutate({ agentId, newTitle });
  };

  /**
   * Rank the user's agents by topic count (agent usage ranking).
   */
  rankAgents = async (limit?: number): Promise<AgentRankItem[]> => {
    return lambdaClient.agent.rankAgents.query(limit);
  };

  transferAgent = async (
    agentId: string,
    targetWorkspaceId: string | null,
  ): Promise<{ agentId: string; slug: string | null }> => {
    return lambdaClient.agent.transferAgent.mutate({ agentId, targetWorkspaceId });
  };
}

export const agentService = new AgentService();
