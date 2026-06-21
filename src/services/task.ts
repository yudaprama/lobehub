import type { CheckpointConfig, TaskAutomationMode, TaskStatus } from '@lobechat/types';

import { getPrestClient, getWorkspaceParams } from '@/libs/prest/client';
import { lambdaClient } from '@/libs/trpc/client';

import { briefService } from './brief';

/**
 * Shape returned by the `taskCreate` stored query and by SELECT on the
 * `tasks` table after SDK 0.7.0's auto-camelCase mapping. Declared here
 * (rather than inferred) because the SDK's `query<T>()` default is `unknown`.
 */
export interface CreatedTask {
  assigneeAgentId?: string | null;
  assigneeUserId?: string | null;
  automationMode?: TaskAutomationMode | null;
  createdAt: string;
  id: string;
  identifier: string;
  instruction: string;
  name?: string | null;
  parentTaskId?: string | null;
  priority?: number | null;
  status: TaskStatus;
  updatedAt: string;
}

class TaskService {
  // ── Queries ──

  find = async (id: string) => {
    const client = await getPrestClient();
    const rows = await client.select('lobehub', 'public', 'tasks', {
      where: { id },
      limit: 1,
    });
    return rows[0] ?? null;
  };

  getDetail = async (id: string) => lambdaClient.task.detail.query({ id });

  list = async (params: {
    assigneeAgentId?: string;
    limit?: number;
    offset?: number;
    parentIdentifier?: string;
    parentTaskId?: string | null;
    priorities?: number[];
    statuses?: TaskStatus[];
  }) => {
    const client = await getPrestClient();
    const where: Record<string, any> = { ...getWorkspaceParams() };
    if (params.assigneeAgentId) where.assignee_agent_id = params.assigneeAgentId;
    if (params.parentTaskId) where.parent_task_id = params.parentTaskId;
    if (params.parentTaskId === null) where.parent_task_id = null;
    if (params.statuses?.length) where.status = { in: params.statuses };
    if (params.priorities?.length) where.priority = { in: params.priorities };
    const data = (await client.select('lobehub', 'public', 'tasks', {
      where,
      limit: params.limit,
      offset: params.offset,
      order: ['sort_order', 'created_at:desc'],
    })) as unknown[];
    return { data: data as any, success: true, total: data.length };
  };

  groupList = async (params: {
    assigneeAgentId?: string;
    groups: Array<{
      key: string;
      limit?: number;
      offset?: number;
      statuses: string[];
    }>;
    parentTaskId?: string | null;
  }) => lambdaClient.task.groupList.query(params);

  getSubtasks = async (id: string) => {
    const client = await getPrestClient();
    return client.select('lobehub', 'public', 'tasks', {
      where: { parent_task_id: id, ...getWorkspaceParams() },
      order: ['sort_order', 'created_at:desc'],
    });
  };

  getTaskTree = async (id: string) => lambdaClient.task.getTaskTree.query({ id });

  getTopics = async (id: string) => {
    const client = await getPrestClient();
    return client.select('lobehub', 'public', 'task_topics', {
      where: { task_id: id },
      order: ['created_at:desc'],
    });
  };

  getDependencies = async (id: string) => {
    const client = await getPrestClient();
    return client.select('lobehub', 'public', 'task_dependencies', {
      where: { task_id: id },
    });
  };

  getPinnedDocuments = async (id: string) => {
    const client = await getPrestClient();
    return client.select('lobehub', 'public', 'task_documents', {
      where: { task_id: id },
      order: ['created_at:desc'],
    });
  };

  getCheckpoint = async (id: string) => {
    const client = await getPrestClient();
    const rows = (await client.select('lobehub', 'public', 'tasks', {
      where: { id },
      limit: 1,
    })) as Array<{ config: Record<string, any> | null }>;
    const config = rows[0]?.config as Record<string, any> | null;
    return config?.checkpoint ?? null;
  };

  getReview = async (id: string) => {
    const client = await getPrestClient();
    const rows = (await client.select('lobehub', 'public', 'tasks', {
      where: { id },
      limit: 1,
    })) as Array<{ config: Record<string, any> | null }>;
    const config = rows[0]?.config as Record<string, any> | null;
    return config?.review ?? null;
  };

  // ── Mutations ──

  create = async (params: {
    assigneeAgentId?: string;
    assigneeUserId?: string;
    automationMode?: TaskAutomationMode;
    createdByAgentId?: string;
    description?: string;
    editorData?: unknown;
    identifierPrefix?: string;
    instruction: string;
    name?: string;
    parentTaskId?: string;
    priority?: number;
    schedulePattern?: string;
    scheduleTimezone?: string;
  }) => {
    const client = await getPrestClient();
    const query: Record<string, any> = {
      instruction: params.instruction,
      ...getWorkspaceParams(),
    };
    if (params.name) query.name = params.name;
    if (params.description) query.description = params.description;
    if (params.identifierPrefix) query.identifierPrefix = params.identifierPrefix;
    if (params.assigneeAgentId) query.assigneeAgentId = params.assigneeAgentId;
    if (params.assigneeUserId) query.assigneeUserId = params.assigneeUserId;
    if (params.parentTaskId) query.parentTaskId = params.parentTaskId;
    if (params.priority !== undefined) query.priority = params.priority;
    if (params.automationMode) query.automationMode = params.automationMode;
    if (params.schedulePattern) query.schedulePattern = params.schedulePattern;
    if (params.scheduleTimezone) query.scheduleTimezone = params.scheduleTimezone;
    if (params.createdByAgentId) query.createdByAgentId = params.createdByAgentId;
    if (params.editorData) query.editorData = JSON.stringify(params.editorData);

    const rows = await client.query<CreatedTask>('lobehub', 'taskCreate', query);
    return { data: rows[0], message: 'Task created', success: true };
  };

  update = async (
    id: string,
    data: {
      assigneeAgentId?: string | null;
      assigneeUserId?: string | null;
      automationMode?: TaskAutomationMode | null;
      config?: Record<string, unknown>;
      context?: Record<string, unknown>;
      description?: string;
      editorData?: unknown;
      heartbeatInterval?: number;
      heartbeatTimeout?: number | null;
      instruction?: string;
      name?: string;
      parentTaskId?: string | null;
      priority?: number;
      schedulePattern?: string | null;
      scheduleTimezone?: string | null;
    },
  ) => {
    const client = await getPrestClient();
    const dbRow: Record<string, any> = {};
    if (data.assigneeAgentId !== undefined) dbRow.assignee_agent_id = data.assigneeAgentId;
    if (data.assigneeUserId !== undefined) dbRow.assignee_user_id = data.assigneeUserId;
    if (data.automationMode !== undefined) dbRow.automation_mode = data.automationMode;
    if (data.config !== undefined) dbRow.config = data.config;
    if (data.context !== undefined) dbRow.context = data.context;
    if (data.description !== undefined) dbRow.description = data.description;
    if (data.editorData !== undefined) dbRow.editor_data = data.editorData;
    if (data.heartbeatInterval !== undefined) dbRow.heartbeat_interval = data.heartbeatInterval;
    if (data.heartbeatTimeout !== undefined) dbRow.heartbeat_timeout = data.heartbeatTimeout;
    if (data.instruction !== undefined) dbRow.instruction = data.instruction;
    if (data.name !== undefined) dbRow.name = data.name;
    if (data.parentTaskId !== undefined) dbRow.parent_task_id = data.parentTaskId;
    if (data.priority !== undefined) dbRow.priority = data.priority;
    if (data.schedulePattern !== undefined) dbRow.schedule_pattern = data.schedulePattern;
    if (data.scheduleTimezone !== undefined) dbRow.schedule_timezone = data.scheduleTimezone;
    await client.update('lobehub', 'public', 'tasks', { id }, dbRow);
  };

  delete = async (id: string) => {
    const client = await getPrestClient();
    const rows = (await client.select('lobehub', 'public', 'tasks', {
      where: { id },
      limit: 1,
    })) as Array<{ id: string; identifier: string; name: string | null }>;
    await client.delete('lobehub', 'public', 'tasks', { id });
    return { data: rows[0] ?? { id }, success: true };
  };

  clearAll = async () => {
    const client = await getPrestClient();
    await client.delete('lobehub', 'public', 'tasks', getWorkspaceParams());
  };

  updateStatus = async (id: string, status: TaskStatus, error?: string) => {
    const client = await getPrestClient();
    const data: Record<string, any> = { status };
    if (error !== undefined) data.error = error;
    await client.update('lobehub', 'public', 'tasks', { id }, data);
  };

  // Stays on tRPC — starts Temporal workflow
  run = async (id: string, params?: { continueTopicId?: string; prompt?: string }) =>
    lambdaClient.task.run.mutate({ id, ...params });

  previewSubtaskLayers = async (id: string) => lambdaClient.task.previewSubtaskLayers.query({ id });

  runReadySubtasks = async (id: string) => lambdaClient.task.runReadySubtasks.mutate({ id });

  addComment = async (
    id: string,
    content: string,
    opts?: {
      authorAgentId?: string;
      briefId?: string;
      editorData?: unknown;
      topicId?: string;
    },
  ) => {
    const client = await getPrestClient();
    const row: Record<string, any> = {
      task_id: id,
      content,
    };
    if (opts?.topicId) row.topic_id = opts.topicId;
    await client.insert('lobehub', 'public', 'task_comments', row);
  };

  deleteComment = async (commentId: string) => {
    const client = await getPrestClient();
    await client.delete('lobehub', 'public', 'task_comments', { id: commentId });
  };

  updateComment = async (commentId: string, content: string, opts?: { editorData?: unknown }) => {
    const client = await getPrestClient();
    const data: Record<string, any> = { content };
    if (opts?.editorData !== undefined) data.editor_data = opts.editorData;
    await client.update('lobehub', 'public', 'task_comments', { id: commentId }, data);
  };

  addDependency = async (
    taskId: string,
    dependsOnId: string,
    type: 'blocks' | 'relates' = 'blocks',
  ) => {
    const client = await getPrestClient();
    await client.insert('lobehub', 'public', 'task_dependencies', {
      task_id: taskId,
      depends_on_id: dependsOnId,
      type,
      ...getWorkspaceParams(),
    });
  };

  removeDependency = async (taskId: string, dependsOnId: string) => {
    const client = await getPrestClient();
    await client.delete('lobehub', 'public', 'task_dependencies', {
      task_id: taskId,
      depends_on_id: dependsOnId,
    });
  };

  reorderSubtasks = async (id: string, order: string[]) => {
    const client = await getPrestClient();
    await Promise.all(
      order.map((subtaskId, index) =>
        client.update('lobehub', 'public', 'tasks', { id: subtaskId }, { sort_order: index }),
      ),
    );
  };

  cancelTopic = async (topicId: string) => {
    const client = await getPrestClient();
    await client.update(
      'lobehub',
      'public',
      'task_topics',
      { id: topicId },
      { status: 'canceled' },
    );
  };

  deleteTopic = async (topicId: string) => {
    const client = await getPrestClient();
    await client.delete('lobehub', 'public', 'task_topics', { id: topicId });
  };

  updateConfig = async (id: string, config: Record<string, unknown>) => {
    const client = await getPrestClient();
    const rows = (await client.select('lobehub', 'public', 'tasks', {
      where: { id },
      limit: 1,
    })) as Array<{ config: Record<string, any> | null }>;
    const existing = (rows[0]?.config as Record<string, any>) ?? {};
    await client.update(
      'lobehub',
      'public',
      'tasks',
      { id },
      {
        config: { ...existing, ...config },
      },
    );
  };

  updateCheckpoint = async (id: string, checkpoint: CheckpointConfig) => {
    const client = await getPrestClient();
    const rows = (await client.select('lobehub', 'public', 'tasks', {
      where: { id },
      limit: 1,
    })) as Array<{ config: Record<string, any> | null }>;
    const existing = (rows[0]?.config as Record<string, any>) ?? {};
    await client.update(
      'lobehub',
      'public',
      'tasks',
      { id },
      {
        config: { ...existing, checkpoint },
      },
    );
  };

  updateReview = async (...args: Parameters<typeof lambdaClient.task.updateReview.mutate>) =>
    lambdaClient.task.updateReview.mutate(...args);

  runReview = async (id: string, params?: { content?: string; topicId?: string }) =>
    lambdaClient.task.runReview.mutate({ id, ...params });

  pinDocument = async (taskId: string, documentId: string, pinnedBy?: string) => {
    const client = await getPrestClient();
    await client.insert('lobehub', 'public', 'task_documents', {
      task_id: taskId,
      document_id: documentId,
      pinned_by: pinnedBy ?? 'agent',
      ...getWorkspaceParams(),
    });
  };

  unpinDocument = async (taskId: string, documentId: string) => {
    const client = await getPrestClient();
    await client.delete('lobehub', 'public', 'task_documents', {
      task_id: taskId,
      document_id: documentId,
    });
  };

  // ── Brief operations ──

  resolveBrief = async (id: string, opts?: { action?: string; comment?: string }) =>
    briefService.resolve(id, opts);

  markBriefRead = async (id: string) => briefService.markRead(id);

  // ── Transfer / Copy ──

  transferTask = async (taskId: string, targetWorkspaceId: string | null) => {
    const client = await getPrestClient();
    await client.update(
      'lobehub',
      'public',
      'tasks',
      { id: taskId },
      {
        workspace_id: targetWorkspaceId,
      },
    );
  };

  copyTaskToWorkspace = async (taskId: string, targetWorkspaceId: string | null) =>
    lambdaClient.task.copyTaskToWorkspace.mutate({ targetWorkspaceId, taskId });
}

export const taskService = new TaskService();
