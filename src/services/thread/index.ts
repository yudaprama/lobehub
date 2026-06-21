import { type CreateMessageParams } from '@lobechat/types';

import { INBOX_SESSION_ID } from '@/const/session';
import { getLobehubQueryClient, getWorkspaceParams } from '@/libs/prest/client';
import { lambdaClient } from '@/libs/trpc/client';
import { type CreateThreadParams, type ThreadItem } from '@/types/topic';

interface CreateThreadWithMessageParams extends CreateThreadParams {
  message: CreateMessageParams;
}

export class ThreadService {
  getThreads = async (topicId: string): Promise<ThreadItem[]> => {
    const db = await getLobehubQueryClient();

    // Tier 2 stored SQL template handles userId scoping + message subqueries.
    return db.query<ThreadItem>('lobehub', 'threadMessages', {
      topicId,
      ...getWorkspaceParams(),
    });
  };

  createThreadWithMessage = async ({
    message,
    ...params
  }: CreateThreadWithMessageParams): Promise<{ messageId: string; threadId: string }> => {
    // createThreadWithMessage is a two-step write (thread + message) inside a
    // single transaction on the BFF. pREST does not expose a multi-write
    // endpoint, so the migration falls back to the legacy tRPC path until a
    // dedicated `/_QUERIES/lobehub/threadCreateWithMessage` template exists.
    return lambdaClient.thread.createThreadWithMessage.mutate({
      ...params,
      message: { ...message, sessionId: this.toDbSessionId(message.sessionId) },
    });
  };

  createThread = async (params: CreateThreadParams): Promise<string> => {
    const db = await getLobehubQueryClient();

    const [row] = await db.insert('threads', {
      id: params.id ?? crypto.randomUUID(),
      title: params.title ?? null,
      topic_id: params.topicId,
      type: params.type,
      source_message_id: params.sourceMessageId ?? null,
      parent_thread_id: params.parentThreadId ?? null,
      client_id: (params as any).clientId ?? null,
      agent_id: params.agentId ?? null,
      group_id: params.groupId ?? null,
      content: null,
      editor_data: null,
      metadata: params.metadata ?? null,
      last_active_at: new Date().toISOString(),
      accessed_at: new Date().toISOString(),
    } as any);
    return (row as { id: string })?.id;
  };

  updateThread = async (id: string, data: Partial<ThreadItem>) => {
    const db = await getLobehubQueryClient();
    const d = data as Record<string, any>;

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.title !== undefined) patch.title = data.title;
    if (data.status !== undefined) patch.status = data.status;
    if (data.metadata !== undefined) patch.metadata = data.metadata;
    if (d.content !== undefined) patch.content = d.content;
    if (d.editorData !== undefined) patch.editor_data = d.editorData;
    if (d.lastActiveAt) patch.last_active_at = d.lastActiveAt;

    await db.update('threads', { id }, patch);
  };

  removeThread = async (id: string) => {
    const db = await getLobehubQueryClient();

    await db.delete('threads', { id });
  };

  private toDbSessionId = (sessionId: string | undefined) => {
    return sessionId === INBOX_SESSION_ID ? null : sessionId;
  };
}

export const threadService = new ThreadService();
