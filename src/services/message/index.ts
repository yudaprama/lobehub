import {
  type ChatMessageError,
  type ChatMessagePluginError,
  type ChatTranslate,
  type ChatTTS,
  type CreateMessageParams,
  type CreateMessageResult,
  type MessageMetadata,
  type MessagePluginItem,
  type ModelRankItem,
  type UIChatMessage,
  type UpdateMessageParams,
  type UpdateMessageRAGParams,
  type UpdateMessageResult,
} from '@lobechat/types';
import { type HeatmapsProps } from '@lobehub/charts';
import type { Filter } from 'prest-js-sdk';

import { idGenerator } from '@/libs/idGenerator';
import { getLobehubQueryClient, getPrestClient, getWorkspaceParams } from '@/libs/prest/client';
import { lambdaClient } from '@/libs/trpc/client';

import { abortableRequest } from '../utils/abortableRequest';

/**
 * Query context for message operations
 * Contains identifiers needed for querying/filtering messages after mutations
 */
export interface MessageQueryContext {
  agentId?: string;
  groupId?: string;
  threadId?: string | null;
  topicId?: string | null;
  topicShareId?: string;
}

export class MessageService {
  createMessage = async (params: CreateMessageParams): Promise<CreateMessageResult> => {
    const db = await getLobehubQueryClient();
    const id = params.id || idGenerator('messages');
    await db.insert('messages', {
      id,
      content: params.content ?? '',
      role: params.role,
      topic_id: params.topicId ?? null,
      session_id: params.sessionId ?? null,
      parent_id: (params as any).parentId ?? null,
      agent_id: (params as any).agentId ?? null,
      metadata: (params as any).metadata ?? null,
      model: (params as any).model ?? null,
      provider: (params as any).provider ?? null,
    });
    return { id, messages: [] };
  };

  getMessages = async (params: MessageQueryContext): Promise<UIChatMessage[]> => {
    // Falls back to the BFF when the call is not topic-scoped (no `topicId` —
    // e.g. global inbox) or is thread- / share-scoped (those read paths
    // aren't covered by the `messagesListByTopic` template).
    if (!params.topicId || params.threadId || params.topicShareId) {
      const data = await lambdaClient.message.getMessages.query(params);
      return data as unknown as UIChatMessage[];
    }

    const db = await getLobehubQueryClient();

    // Tier 2 stored SQL template joins message_translates / message_plugins /
    // message_tts / messages_files into one row per message. pREST scopes by
    // user via [[auth.user_id_filters]]; we still pass `groupId` for the
    // groupAssistantMessages narrow path.
    const rows = await db.query<UIChatMessage>(
      'lobehub',
      'messagesListByTopic',
      {
        topicId: params.topicId,
        ...getWorkspaceParams(),
        ...(params.groupId ? { groupId: params.groupId } : {}),
      },
      { camelCase: true },
    );
    return rows as unknown as UIChatMessage[];
  };

  countMessages = async (params?: {
    endDate?: string;
    range?: [string, string];
    startDate?: string;
  }): Promise<number> => {
    const db = await getLobehubQueryClient();

    const where: Filter = {};
    if (params?.startDate) where.created_at = { gte: params.startDate };
    if (params?.endDate)
      where.created_at = { ...(where.created_at as object), lte: params.endDate };

    const rows = await db.select('messages', {
      count: true,
      ...(Object.keys(where).length ? { where } : {}),
    });
    const row = Array.isArray(rows)
      ? (rows[0] as unknown as { count: number } | undefined)
      : undefined;
    return row?.count ?? 0;
  };

  countWords = async (params?: {
    endDate?: string;
    range?: [string, string];
    startDate?: string;
  }): Promise<number> => {
    const db = await getLobehubQueryClient();
    const query: Record<string, string> = {};
    if (params?.startDate) query.startDate = params.startDate;
    if (params?.endDate) query.endDate = params.endDate;
    if (params?.range) {
      query.startDate = params.range[0];
      query.endDate = params.range[1];
    }
    const rows = await db.query<{ count: number }>('lobehub', 'messageWordCount', query);
    return rows[0]?.count ?? 0;
  };

  rankModels = async (): Promise<ModelRankItem[]> => {
    const db = await getLobehubQueryClient();
    return db.query<ModelRankItem>('lobehub', 'messageModelRank', {});
  };

  getHeatmaps = async (): Promise<HeatmapsProps['data']> => {
    const db = await getLobehubQueryClient();
    return db.query<HeatmapsProps['data'][number]>('lobehub', 'messageHeatmaps', {});
  };

  getTokenHeatmaps = async (): Promise<HeatmapsProps['data']> => {
    const db = await getLobehubQueryClient();
    return db.query<HeatmapsProps['data'][number]>('lobehub', 'messageTokenHeatmaps', {});
  };

  updateMessageError = async (
    id: string,
    value: ChatMessageError,
    ctx?: MessageQueryContext,
  ): Promise<{ messages?: UIChatMessage[]; success: boolean }> => {
    const error = value.type
      ? value
      : { body: value, message: value.message, type: 'ApplicationRuntimeError' };

    const db = await getLobehubQueryClient();
    await db.update(
      'messages',
      { id },
      {
        error,
        updated_at: new Date().toISOString(),
      },
    );
    return { success: true };
  };

  updateMessagePluginArguments = async (id: string, value: string | Record<string, any>) => {
    const db = await getLobehubQueryClient();
    const args = typeof value === 'string' ? value : JSON.stringify(value);
    await db.update('message_plugins', { message_id: id }, { arguments: args });
  };

  /**
   * Update tool arguments by toolCallId - updates both tool message and parent assistant message in one transaction
   * This is the preferred method for updating tool arguments as it prevents race conditions
   *
   * @param toolCallId - The tool call ID (stable identifier from AI response)
   * @param value - The new arguments value
   * @param ctx - Message query context
   */
  updateToolArguments = async (
    toolCallId: string,
    value: string | Record<string, unknown>,
    ctx?: MessageQueryContext,
  ) => {
    const db = await getLobehubQueryClient();
    const args = typeof value === 'string' ? value : JSON.stringify(value);

    const toolMessages = await db.select('messages', {
      where: { role: 'tool' },
      size: 1,
    });

    const toolMsg = Array.isArray(toolMessages)
      ? (toolMessages[0] as unknown as { id: string; parent_id: string | null })
      : undefined;
    if (!toolMsg) return { success: false };

    await db.update('messages', { id: toolMsg.id }, { content: args });
    if (toolMsg.parent_id) {
      await db.update('message_plugins', { message_id: toolMsg.parent_id }, { arguments: args });
    }
    return { success: true } as { messages?: any[]; success: boolean };
  };

  updateMessage = async (
    id: string,
    value: Partial<UpdateMessageParams>,
    ctx?: MessageQueryContext,
  ): Promise<UpdateMessageResult> => {
    const db = await getLobehubQueryClient();

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (value.content !== undefined) patch.content = value.content;
    if (value.editorData !== undefined) patch.editor_data = value.editorData;
    if (value.error !== undefined) patch.error = value.error;
    if (value.model !== undefined) patch.model = value.model;
    if (value.provider !== undefined) patch.provider = value.provider;
    if (value.reasoning !== undefined) patch.reasoning = value.reasoning;
    if (value.role !== undefined) patch.role = value.role;
    if (value.search !== undefined) patch.search = value.search;
    if (value.tools !== undefined) patch.tools = value.tools;
    if (value.traceId !== undefined) patch.trace_id = value.traceId;
    if (value.observationId !== undefined) patch.observation_id = value.observationId;
    if (value.imageList !== undefined) patch.imageList = value.imageList;
    if (value.metadata !== undefined) patch.metadata = value.metadata;
    if (value.usage !== undefined) patch.usage = value.usage;
    if (value.toolCalls !== undefined) patch.tool_calls = value.toolCalls;

    await db.update('messages', { id }, patch);
    return { success: true };
  };

  updateMessageTranslate = async (id: string, translate: Partial<ChatTranslate> | false) => {
    const db = await getLobehubQueryClient();
    if (translate === false) {
      await db.delete('message_translates', { id });
    } else {
      await db.update('message_translates', { id }, translate);
    }
  };

  updateMessageTTS = async (id: string, tts: Partial<ChatTTS> | false) => {
    const db = await getLobehubQueryClient();
    if (tts === false) {
      await db.delete('message_tts', { id });
    } else {
      await db.update('message_tts', { id }, tts);
    }
  };

  updateMessageMetadata = async (
    id: string,
    value: Partial<MessageMetadata>,
    ctx?: MessageQueryContext,
  ): Promise<UpdateMessageResult> => {
    return abortableRequest.execute(`message-metadata-${id}`, (signal) =>
      getLobehubQueryClient().then(
        (db) =>
          new Promise<UpdateMessageResult>((resolve, reject) => {
            if (signal?.aborted) {
              reject(new DOMException('Aborted', 'AbortError'));
              return;
            }

            const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
            signal?.addEventListener('abort', onAbort);

            // prest-js-sdk doesn't expose AbortSignal on its methods yet, so
            // we race the signal against the in-flight pREST call. The
            // underlying fetch may still complete in the background, but
            // the caller sees an aborted error and stops awaiting.
            db.update(
              'messages',
              { id },
              {
                metadata: value,
                updated_at: new Date().toISOString(),
              },
            ).then(
              () => {
                signal?.removeEventListener('abort', onAbort);
                resolve({ success: true });
              },
              (err) => {
                signal?.removeEventListener('abort', onAbort);
                reject(err);
              },
            );
          }),
      ),
    );
  };

  updateMessagePluginState = async (
    id: string,
    value: Record<string, any>,
    ctx?: MessageQueryContext,
  ): Promise<UpdateMessageResult> => {
    const db = await getLobehubQueryClient();
    await db.update('message_plugins', { message_id: id }, { state: value });
    return { success: true };
  };

  updateMessagePluginError = async (
    id: string,
    error: ChatMessagePluginError | null,
    ctx?: MessageQueryContext,
  ): Promise<UpdateMessageResult> => {
    const db = await getLobehubQueryClient();
    await db.update('message_plugins', { message_id: id }, { error });
    return { success: true };
  };

  updateMessagePlugin = async (
    id: string,
    value: Partial<Omit<MessagePluginItem, 'id'>>,
    ctx?: MessageQueryContext,
  ): Promise<UpdateMessageResult> => {
    const db = await getLobehubQueryClient();
    await db.update('messages', { id }, {
      plugin: value,
      updated_at: new Date().toISOString(),
    } as any);
    return { success: true };
  };

  updateMessageRAG = async (
    id: string,
    data: UpdateMessageRAGParams,
    ctx?: MessageQueryContext,
  ): Promise<UpdateMessageResult> => {
    const db = await getLobehubQueryClient();
    await db.update(
      'messages',
      { id },
      {
        metadata: data as any,
        updated_at: new Date().toISOString(),
      },
    );
    return { success: true };
  };

  /**
   * Update tool message with content, metadata, pluginState, and pluginError.
   * Touches both `messages` and `message_plugins` tables.
   */
  updateToolMessage = async (
    id: string,
    value: {
      content?: string;
      metadata?: Record<string, any>;
      pluginError?: any;
      pluginState?: Record<string, any>;
    },
    ctx?: MessageQueryContext,
  ): Promise<UpdateMessageResult> => {
    const db = await getLobehubQueryClient();
    const now = new Date().toISOString();

    const msgPatch: Record<string, unknown> = { updated_at: now };
    if (value.content !== undefined) msgPatch.content = value.content;
    if (value.metadata !== undefined) msgPatch.metadata = value.metadata;
    await db.update('messages', { id }, msgPatch);

    const pluginPatch: Record<string, unknown> = {};
    if (value.pluginState !== undefined) pluginPatch.state = value.pluginState;
    if (value.pluginError !== undefined) pluginPatch.error = value.pluginError;
    if (Object.keys(pluginPatch).length > 0) {
      await db.update('message_plugins', { message_id: id }, pluginPatch);
    }

    return { success: true };
  };

  removeMessage = async (id: string, ctx?: MessageQueryContext): Promise<UpdateMessageResult> => {
    // ctx (agentId/topicId/groupId) is only relevant to the BFF's post-delete
    // reshaping of the remaining message list. The pREST delete auto-scopes
    // by user_id and cascades via FK; callers that need the reshaped list
    // re-fetch via getMessages.
    const db = await getLobehubQueryClient();
    await db.delete('messages', { id });
    return { success: true };
  };

  removeMessages = async (
    ids: string[],
    ctx?: MessageQueryContext,
  ): Promise<UpdateMessageResult> => {
    if (ids.length === 0) return { success: true };
    const db = await getLobehubQueryClient();
    await db.delete('messages', { id: { in: ids } });
    return { success: true };
  };

  removeMessagesByAssistant = async (sessionId: string, topicId?: string) => {
    const db = await getLobehubQueryClient();
    if (topicId) {
      await db.delete('messages', { topic_id: topicId });
    } else {
      await db.delete('messages', { session_id: sessionId });
    }
  };

  removeMessagesByGroup = async (groupId: string, topicId?: string) => {
    // Same as removeMessagesByAssistant — needs the BFF's reshape + cascading.
    return lambdaClient.message.removeMessagesByGroup.mutate({ groupId, topicId });
  };

  removeAllMessages = async () => {
    const db = await getLobehubQueryClient();

    // No where clause — pREST's [[auth.user_id_filters]] still scopes the
    // DELETE to the current user.
    await db.delete('messages', {});
    return { success: true };
  };

  /**
   * Add files to a message
   * Used to associate exported files from code interpreter with the tool message
   */
  addFilesToMessage = async (
    id: string,
    fileIds: string[],
    ctx?: MessageQueryContext,
  ): Promise<UpdateMessageResult> => {
    const db = await getLobehubQueryClient();
    await db.insertBatch(
      'messages_files',
      fileIds.map((fileId) => ({ message_id: id, file_id: fileId })),
    );
    return { success: true };
  };

  // =============== Compression ===============

  /**
   * Create a compression group for old messages
   * Returns placeholder group and messages to summarize
   */
  createCompressionGroup = async (params: {
    agentId: string;
    groupId?: string | null;
    messageIds: string[];
    threadId?: string | null;
    topicId: string;
  }): Promise<{
    messageGroupId: string;
    messages: UIChatMessage[];
    messagesToSummarize: UIChatMessage[];
  }> => {
    const client = await getPrestClient();
    const metadata = JSON.stringify({ originalMessageCount: params.messageIds.length });
    const rows = await client.query<{ id: string }>('lobehub', 'compressionCreateGroup', {
      topicId: params.topicId,
      messageIds: params.messageIds.join(','),
      metadata,
    });
    const messageGroupId = rows[0]?.id ?? '';

    const queryContext = {
      agentId: params.agentId,
      groupId: params.groupId,
      threadId: params.threadId,
      topicId: params.topicId,
    };
    const messages = await this.getMessages(queryContext);
    const messagesToSummarize = messages.filter((m) => params.messageIds.includes(m.id));

    return { messageGroupId, messages, messagesToSummarize };
  };

  /**
   * Finalize compression by updating group with generated summary
   */
  finalizeCompression = async (params: {
    agentId: string;
    content: string;
    groupId?: string | null;
    messageGroupId: string;
    threadId?: string | null;
    topicId: string;
  }): Promise<{ messages?: UIChatMessage[] }> => {
    const client = await getPrestClient();
    await client.query('lobehub', 'compressionFinalize', {
      messageGroupId: params.messageGroupId,
      content: params.content,
    });

    const queryContext = {
      agentId: params.agentId,
      groupId: params.groupId,
      threadId: params.threadId,
      topicId: params.topicId,
    };
    const messages = await this.getMessages(queryContext);
    return { messages };
  };

  /**
   * Update message group metadata (e.g., expanded state)
   */
  updateMessageGroupMetadata = async (params: {
    context: {
      agentId: string;
      groupId?: string | null;
      threadId?: string | null;
      topicId: string;
    };
    expanded?: boolean;
    messageGroupId: string;
  }): Promise<{ messages: UIChatMessage[] }> => {
    const client = await getPrestClient();
    const metadata = JSON.stringify({ expanded: params.expanded ?? false });
    await client.query('lobehub', 'compressionUpdateMetadata', {
      messageGroupId: params.messageGroupId,
      metadata,
    });

    const messages = await this.getMessages(params.context);
    return { messages };
  };

  /**
   * Cancel compression by deleting the compression group and restoring original messages
   */
  cancelCompression = async (params: {
    agentId: string;
    groupId?: string | null;
    messageGroupId: string;
    threadId?: string | null;
    topicId: string;
  }): Promise<{ messages: UIChatMessage[] }> => {
    const client = await getPrestClient();
    await client.query('lobehub', 'compressionCancel', {
      messageGroupId: params.messageGroupId,
    });

    const queryContext = {
      agentId: params.agentId,
      groupId: params.groupId,
      threadId: params.threadId,
      topicId: params.topicId,
    };
    const messages = await this.getMessages(queryContext);
    return { messages };
  };
}

export const messageService = new MessageService();
