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

import { getPrestClient, getWorkspaceParams } from '@/libs/prest/client';
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
    return lambdaClient.message.createMessage.mutate(params as any);
  };

  getMessages = async (params: MessageQueryContext): Promise<UIChatMessage[]> => {
    // Falls back to the BFF when the call is not topic-scoped (no `topicId` —
    // e.g. global inbox) or is thread- / share-scoped (those read paths
    // aren't covered by the `messagesListByTopic` template).
    if (!params.topicId || params.threadId || params.topicShareId) {
      const data = await lambdaClient.message.getMessages.query(params);
      return data as unknown as UIChatMessage[];
    }

    const client = await getPrestClient();

    // Tier 2 stored SQL template joins message_translates / message_plugins /
    // message_tts / messages_files into one row per message. pREST scopes by
    // user via [[auth.user_id_filters]]; we still pass `groupId` for the
    // groupAssistantMessages narrow path.
    const rows = await client.query<UIChatMessage>('lobehub', 'messagesListByTopic', {
      topicId: params.topicId,
      ...getWorkspaceParams(),
      ...(params.groupId ? { groupId: params.groupId } : {}),
    });
    return rows as unknown as UIChatMessage[];
  };

  countMessages = async (params?: {
    endDate?: string;
    range?: [string, string];
    startDate?: string;
  }): Promise<number> => {
    const client = await getPrestClient();

    const where: Filter = {};
    if (params?.startDate) where.created_at = { gte: params.startDate };
    if (params?.endDate)
      where.created_at = { ...(where.created_at as object), lte: params.endDate };

    const rows = await client.select<{ count: number }>('lobehub', 'public', 'messages', {
      count: true,
      ...(Object.keys(where).length ? { where } : {}),
    });
    const row = Array.isArray(rows) ? rows[0] : undefined;
    return row?.count ?? 0;
  };

  countWords = async (params?: {
    endDate?: string;
    range?: [string, string];
    startDate?: string;
  }): Promise<number> => {
    return lambdaClient.message.countWords.query(params);
  };

  rankModels = async (): Promise<ModelRankItem[]> => {
    return lambdaClient.message.rankModels.query();
  };

  getHeatmaps = async (): Promise<HeatmapsProps['data']> => {
    return lambdaClient.message.getHeatmaps.query();
  };

  getTokenHeatmaps = async (): Promise<HeatmapsProps['data']> => {
    return lambdaClient.message.getTokenHeatmaps.query();
  };

  updateMessageError = async (
    id: string,
    value: ChatMessageError,
    ctx?: MessageQueryContext,
  ): Promise<{ messages?: UIChatMessage[]; success: boolean }> => {
    const error = value.type
      ? value
      : { body: value, message: value.message, type: 'ApplicationRuntimeError' };

    const client = await getPrestClient();
    await client.update(
      'lobehub',
      'public',
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
    // Stored on the dedicated `message_plugins` table — needs a Tier 2
    // template that joins the message_plugins row to messages.user_id.
    const args = typeof value === 'string' ? value : JSON.stringify(value);
    return lambdaClient.message.updateMessagePlugin.mutate({ id, value: { arguments: args } });
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
    // Cross-table update (tool message + parent assistant) — needs a BFF
    // transaction until a `/_QUERIES/lobehub/messageUpdateToolArguments`
    // template exists.
    return lambdaClient.message.updateToolArguments.mutate({ ...ctx, toolCallId, value });
  };

  updateMessage = async (
    id: string,
    value: Partial<UpdateMessageParams>,
    ctx?: MessageQueryContext,
  ): Promise<UpdateMessageResult> => {
    const client = await getPrestClient();

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

    await client.update('lobehub', 'public', 'messages', { id }, patch);
    return { success: true };
  };

  updateMessageTranslate = async (id: string, translate: Partial<ChatTranslate> | false) => {
    // Translate lives in the dedicated `message_translates` table — the
    // BFF handler fans out the update there. Routing through pREST would
    // need a new Tier 1 entry (`message_translates.user_id` is not yet
    // auto-scoped), so keep this on the BFF for now.
    return lambdaClient.message.updateTranslate.mutate({ id, value: translate as ChatTranslate });
  };

  updateMessageTTS = async (id: string, tts: Partial<ChatTTS> | false) => {
    // Same as `updateMessageTranslate`: `message_tts.user_id` is not in
    // [[auth.user_id_filters]] yet.
    return lambdaClient.message.updateTTS.mutate({ id, value: tts });
  };

  updateMessageMetadata = async (
    id: string,
    value: Partial<MessageMetadata>,
    ctx?: MessageQueryContext,
  ): Promise<UpdateMessageResult> => {
    return abortableRequest.execute(`message-metadata-${id}`, (signal) =>
      getPrestClient().then(
        (client) =>
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
            client
              .update<UpdateMessageResult>(
                'lobehub',
                'public',
                'messages',
                { id },
                { metadata: value, updated_at: new Date().toISOString() },
              )
              .then(
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
    // Stored on `message_plugins.state` jsonb — the BFF's two-step write
    // (read plugin row + update) needs a Tier 2 template or a Tier 1
    // expansion of `message_plugins` into [[auth.user_id_filters]] first.
    return lambdaClient.message.updatePluginState.mutate({ ...ctx, id, value });
  };

  updateMessagePluginError = async (
    id: string,
    error: ChatMessagePluginError | null,
    ctx?: MessageQueryContext,
  ): Promise<UpdateMessageResult> => {
    // Same as `updateMessagePluginState` — lives on the `message_plugins`
    // table, not yet in [[auth.user_id_filters]].
    return lambdaClient.message.updatePluginError.mutate({ ...ctx, id, value: error as any });
  };

  updateMessagePlugin = async (
    id: string,
    value: Partial<Omit<MessagePluginItem, 'id'>>,
    ctx?: MessageQueryContext,
  ): Promise<UpdateMessageResult> => {
    return lambdaClient.message.updateMessagePlugin.mutate({ ...ctx, id, value });
  };

  updateMessageRAG = async (
    id: string,
    data: UpdateMessageRAGParams,
    ctx?: MessageQueryContext,
  ): Promise<UpdateMessageResult> => {
    // RAG metadata spans `messages.metadata` + a separate `message_plugin_datas`
    // row — BFF transaction.
    return lambdaClient.message.updateMessageRAG.mutate({ ...ctx, id, value: data });
  };

  /**
   * Update tool message with content, metadata, pluginState, and pluginError in a single request
   * This prevents race conditions when updating multiple fields
   * Uses abortableRequest to cancel previous requests for the same message
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
    return abortableRequest.execute(`tool-message-${id}`, (signal) =>
      lambdaClient.message.updateToolMessage.mutate({ ...ctx, id, value }, { signal }),
    );
  };

  removeMessage = async (id: string, ctx?: MessageQueryContext): Promise<UpdateMessageResult> => {
    // ctx (agentId/topicId/groupId) is only relevant to the BFF's post-delete
    // reshaping of the remaining message list. The pREST delete auto-scopes
    // by user_id and cascades via FK; callers that need the reshaped list
    // re-fetch via getMessages.
    const client = await getPrestClient();
    await client.delete('lobehub', 'public', 'messages', { id });
    return { success: true };
  };

  removeMessages = async (
    ids: string[],
    ctx?: MessageQueryContext,
  ): Promise<UpdateMessageResult> => {
    if (ids.length === 0) return { success: true };
    const client = await getPrestClient();
    await client.delete('lobehub', 'public', 'messages', { id: { in: ids } });
    return { success: true };
  };

  removeMessagesByAssistant = async (sessionId: string, topicId?: string) => {
    // Server-side cascade: BFF removes by (sessionId, topicId) and reshapes
    // the list. pREST can delete by topic_id (FK-scoped) but the
    // sessionId→messages mapping requires a join the template doesn't expose
    // yet. Keep on BFF until a Tier 2 template lands.
    return lambdaClient.message.removeMessagesByAssistant.mutate({ sessionId, topicId });
  };

  removeMessagesByGroup = async (groupId: string, topicId?: string) => {
    // Same as removeMessagesByAssistant — needs the BFF's reshape + cascading.
    return lambdaClient.message.removeMessagesByGroup.mutate({ groupId, topicId });
  };

  removeAllMessages = async () => {
    const client = await getPrestClient();

    // No where clause — pREST's [[auth.user_id_filters]] still scopes the
    // DELETE to the current user.
    await client.delete('lobehub', 'public', 'messages', {});
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
    // Inserts into the `messages_files` junction table — `messages_files` is
    // not yet in [[auth.user_id_filters]]. BFF does the join with the
    // message_id and re-validates file ownership.
    return lambdaClient.message.addFilesToMessage.mutate({ ...ctx, fileIds, id });
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
    const result = await lambdaClient.message.createCompressionGroup.mutate(params);
    return {
      messageGroupId: result.messageGroupId,
      messages: (result.messages || []) as unknown as UIChatMessage[],
      messagesToSummarize: (result.messagesToSummarize || []) as unknown as UIChatMessage[],
    };
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
    const result = await lambdaClient.message.finalizeCompression.mutate(params);
    return {
      messages: (result.messages || []) as unknown as UIChatMessage[],
    };
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
    const result = await lambdaClient.message.updateMessageGroupMetadata.mutate(params);
    return {
      messages: (result.messages || []) as unknown as UIChatMessage[],
    };
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
    const result = await lambdaClient.message.cancelCompression.mutate(params);
    return { messages: (result.messages || []) as unknown as UIChatMessage[] };
  };
}

export const messageService = new MessageService();
