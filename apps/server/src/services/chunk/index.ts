import { type LobeChatDatabase } from '@lobechat/database';

import { AsyncTaskModel } from '@/database/models/asyncTask';
import { FileModel } from '@/database/models/file';
import { type ChunkContentParams } from '@/server/modules/ContentChunk';
import { ContentChunk } from '@/server/modules/ContentChunk';
import {
  AsyncTaskError,
  AsyncTaskErrorType,
  AsyncTaskStatus,
  AsyncTaskType,
} from '@/types/asyncTask';
import {
  enqueueEmbedFileChunks,
  enqueueParseFileToChunks,
  isRiverHealthy,
} from '@/server/rivers/riverProducer';

/**
 * Two enqueue paths:
 *
 *  1. **River (preferred)** — if the river_job table exists and egent-jobs
 *     is the active worker, jobs are INSERTed into river_job directly.
 *     egent-jobs picks them up off the file_ingest queue.
 *
 *  2. **Legacy self-HTTP** — if River isn't available (table missing,
 *     worker not deployed, migrations not run), the call falls back to
 *     the original createAsyncCaller().file.* path that hits the
 *     /trpc/async tRPC router. This keeps the BFF working end-to-end
 *     during the migration.
 */
export class ChunkService {
  private userId: string;
  private workspaceId?: string;
  private chunkClient: ContentChunk;
  private fileModel: FileModel;
  private asyncTaskModel: AsyncTaskModel;

  constructor(serverDB: LobeChatDatabase, userId: string, workspaceId?: string) {
    this.userId = userId;
    this.workspaceId = workspaceId;

    this.chunkClient = new ContentChunk();

    this.fileModel = new FileModel(serverDB, userId, workspaceId);
    this.asyncTaskModel = new AsyncTaskModel(serverDB, userId, workspaceId);
  }

  async chunkContent(params: ChunkContentParams) {
    return this.chunkClient.chunkContent(params);
  }

  async asyncEmbeddingFileChunks(fileId: string) {
    const result = await this.fileModel.findById(fileId);
    if (!result) return;

    const asyncTaskId = await this.asyncTaskModel.create({
      status: AsyncTaskStatus.Pending,
      type: AsyncTaskType.Embedding,
    });
    await this.fileModel.update(fileId, { embeddingTaskId: asyncTaskId });

    if (await isRiverHealthy()) {
      try {
        await enqueueEmbedFileChunks({
          fileId,
          taskId: asyncTaskId,
          userId: this.userId,
          workspaceId: this.workspaceId,
        });
      } catch (e) {
        console.error('[embeddingFileChunks] river enqueue failed:', e);
        await this.asyncTaskModel.update(asyncTaskId, {
          error: new AsyncTaskError(
            AsyncTaskErrorType.TaskTriggerError,
            'trigger chunk embedding async task error via River',
          ),
          status: AsyncTaskStatus.Error,
        });
      }
      return asyncTaskId;
    }

    // Legacy fallback — self-HTTP to /trpc/async/file.embeddingChunks.
    const { createAsyncCaller } = await import('@/server/routers/async');
    const asyncCaller = await createAsyncCaller({ userId: this.userId });
    try {
      await asyncCaller.file.embeddingChunks({
        fileId,
        taskId: asyncTaskId,
        workspaceId: this.workspaceId,
      });
    } catch (e) {
      console.error('[embeddingFileChunks] error:', e);
      await this.asyncTaskModel.update(asyncTaskId, {
        error: new AsyncTaskError(
          AsyncTaskErrorType.TaskTriggerError,
          'trigger chunk embedding async task error. Please make sure the APP_URL is available from your server. You can check the proxy config or WAF blocking',
        ),
        status: AsyncTaskStatus.Error,
      });
    }
    return asyncTaskId;
  }

  /**
   * parse file to chunks with async task
   */
  async asyncParseFileToChunks(fileId: string, skipExist?: boolean) {
    const result = await this.fileModel.findById(fileId);
    if (!result) return;

    if (skipExist && result.chunkTaskId) return;

    const asyncTaskId = await this.asyncTaskModel.create({
      status: AsyncTaskStatus.Processing,
      type: AsyncTaskType.Chunking,
    });
    await this.fileModel.update(fileId, { chunkTaskId: asyncTaskId });

    if (await isRiverHealthy()) {
      enqueueParseFileToChunks({
        fileId,
        taskId: asyncTaskId,
        userId: this.userId,
        workspaceId: this.workspaceId,
        skipExist,
      }).catch(async (e) => {
        console.error('[ParseFileToChunks] river enqueue failed:', e);
        await this.asyncTaskModel.update(asyncTaskId, {
          error: new AsyncTaskError(
            AsyncTaskErrorType.TaskTriggerError,
            'trigger chunk embedding async task error via River',
          ),
          status: AsyncTaskStatus.Error,
        });
      });
      return asyncTaskId;
    }

    // Legacy fallback.
    const { createAsyncCaller } = await import('@/server/routers/async');
    const asyncCaller = await createAsyncCaller({ userId: this.userId });
    asyncCaller.file
      .parseFileToChunks({ fileId, taskId: asyncTaskId, workspaceId: this.workspaceId })
      .catch(async (e) => {
        console.error('[ParseFileToChunks] error:', e);
        await this.asyncTaskModel.update(asyncTaskId, {
          error: new AsyncTaskError(
            AsyncTaskErrorType.TaskTriggerError,
            'trigger chunk embedding async task error. Please make sure the APP_URL is available from your server. You can check the proxy config or WAF blocking',
          ),
          status: AsyncTaskStatus.Error,
        });
      });
    return asyncTaskId;
  }
}
