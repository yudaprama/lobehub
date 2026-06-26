import { type AgentGroupDetail } from '@lobechat/types';

import {
  type ChatGroupAgentItem,
  type ChatGroupItem,
  type NewChatGroup,
  type NewChatGroupAgent,
} from '@/database/schemas';
import { getLobehubQueryClient } from '@/libs/prest/client';
import { lambdaClient } from '@/libs/trpc/client';

export interface GroupMemberConfig {
  avatar?: string;
  backgroundColor?: string;
  description?: string;
  model?: string;
  plugins?: string[];
  provider?: string;
  systemRole?: string;
  tags?: string[];
  title?: string;
}

export interface SupervisorConfig {
  avatar?: string;
  backgroundColor?: string;
  description?: string;
  model?: string;
  params?: any;
  provider?: string;
  systemRole?: string;
  tags?: string[];
  title?: string;
}

class ChatGroupService {
  /**
   * Get a group by forkedFromIdentifier stored in config
   * @returns group id if exists, null otherwise
   */
  getGroupByForkedFromIdentifier = async (forkedFromIdentifier: string): Promise<string | null> => {
    return lambdaClient.group.getGroupByForkedFromIdentifier.query({ forkedFromIdentifier });
  };

  /**
   * Create a group with a supervisor agent.
   * The supervisor agent is automatically created as a virtual agent.
   */
  createGroup = (
    params: Omit<NewChatGroup, 'userId'>,
  ): Promise<{ group: ChatGroupItem; supervisorAgentId: string }> => {
    return lambdaClient.group.createGroup.mutate({
      ...params,
      config: params.config as any,
    });
  };

  /**
   * Create a group with virtual member agents in one request.
   * This is the recommended way to create a group from a template.
   * Returns groupId, supervisorAgentId, and member agentIds.
   */
  createGroupWithMembers = (
    groupConfig: Omit<NewChatGroup, 'userId'>,
    members: GroupMemberConfig[],
    supervisorConfig?: SupervisorConfig,
  ): Promise<{ agentIds: string[]; groupId: string; supervisorAgentId: string }> => {
    return lambdaClient.group.createGroupWithMembers.mutate({
      groupConfig: {
        ...groupConfig,
        config: groupConfig.config as any,
      },
      members,
      supervisorConfig,
    });
  };

  updateGroup = async (id: string, value: Partial<ChatGroupItem>): Promise<ChatGroupItem> => {
    const db = await getLobehubQueryClient();
    const patch: Record<string, unknown> = {};
    if (value.title !== undefined) patch.title = value.title;
    if (value.description !== undefined) patch.description = value.description;
    if (value.config !== undefined) patch.config = value.config as any;
    if (value.avatar !== undefined) patch.avatar = value.avatar;
    if (value.backgroundColor !== undefined) patch.background_color = value.backgroundColor;
    await db.update('chat_groups', { id }, patch as any);
    return { id, ...value } as ChatGroupItem;
  };

  deleteGroup = async (id: string) => {
    const db = await getLobehubQueryClient();
    await db.delete('chat_groups', { id });
  };

  getGroup = async (id: string): Promise<ChatGroupItem | undefined> => {
    const db = await getLobehubQueryClient();
    const rows = await db.select('chat_groups', {
      camelCase: true,
      where: { id },
    });
    return rows?.[0] as unknown as ChatGroupItem | undefined;
  };

  getGroups = async (): Promise<ChatGroupItem[]> => {
    const db = await getLobehubQueryClient();
    const rows = await db.select('chat_groups', {
      camelCase: true,
      order: ['updated_at:desc'],
    });
    return (rows ?? []) as unknown as ChatGroupItem[];
  };

  getGroupDetail = (id: string): Promise<AgentGroupDetail | null> => {
    return lambdaClient.group.getGroupDetail.query({ id });
  };

  addAgentsToGroup = (
    groupId: string,
    agentIds: string[],
  ): Promise<{ added: NewChatGroupAgent[]; existing: string[] }> => {
    return lambdaClient.group.addAgentsToGroup.mutate({ agentIds, groupId });
  };

  /**
   * Batch create virtual agents and add them to an existing group.
   * This is more efficient than calling createAgentOnly multiple times.
   */
  batchCreateAgentsInGroup = (groupId: string, agents: GroupMemberConfig[]) => {
    return lambdaClient.group.batchCreateAgentsInGroup.mutate({
      agents,
      groupId,
    });
  };

  removeAgentsFromGroup = async (groupId: string, agentIds: string[]) => {
    const db = await getLobehubQueryClient();
    await db.delete('chat_groups_agents', { chat_group_id: groupId, agent_id: { in: agentIds } });
  };

  updateAgentInGroup = async (
    groupId: string,
    agentId: string,
    updates: Partial<Pick<NewChatGroupAgent, 'order' | 'role'>>,
  ): Promise<NewChatGroupAgent> => {
    // Tier 1: single-row update on chat_groups_agents (composite PK: chat_group_id + agent_id).
    const db = await getLobehubQueryClient();
    const patch: Record<string, unknown> = {};
    if (updates.order !== undefined && updates.order !== null) patch.order = updates.order;
    if (updates.role !== undefined && updates.role !== null) patch.role = updates.role;
    const [row] = await db.update('chat_groups_agents', { chat_group_id: groupId, agent_id: agentId }, patch as any);
    return row as unknown as NewChatGroupAgent;
  };

  getGroupAgents = async (groupId: string): Promise<ChatGroupAgentItem[]> => {
    const db = await getLobehubQueryClient();
    const rows = await db.select('chat_groups_agents', {
      camelCase: true,
      where: { chat_group_id: groupId },
      order: ['order:asc'],
    });
    return (rows ?? []) as unknown as ChatGroupAgentItem[];
  };

  /**
   * Duplicate a chat group with all its members.
   * Returns the new group ID and supervisor agent ID.
   */
  duplicateGroup = (
    groupId: string,
    newTitle?: string,
  ): Promise<{ groupId: string; supervisorAgentId: string } | null> => {
    return lambdaClient.group.duplicateGroup.mutate({ groupId, newTitle });
  };

  transferGroup = (
    groupId: string,
    targetWorkspaceId: string | null,
  ): Promise<{ groupId: string } | null> => {
    return lambdaClient.group.transferGroup.mutate({ groupId, targetWorkspaceId });
  };
}

export const chatGroupService = new ChatGroupService();
