import {
  type AsyncTaskStatus,
  type IAsyncTaskError,
  type UserMemoryExtractionMetadata,
} from '@lobechat/types';

import { egentFetch } from '@/libs/egent/client';

export interface MemoryExtractionTask {
  error?: IAsyncTaskError | null;
  id: string;
  metadata: UserMemoryExtractionMetadata;
  status: AsyncTaskStatus;
}

export interface RequestMemoryExtractionParams {
  fromDate?: Date;
  toDate?: Date;
}

export interface RequestMemoryExtractionResult extends MemoryExtractionTask {
  deduped: boolean;
}

class MemoryExtractionService {
  /**
   * Trigger memory extraction over the user's chat topics in the given
   * date range. Replaces lambda/userMemory.ts:requestMemoryFromChatTopic.
   *
   * The egent-lobehub binary:
   *   1. Inserts an async_tasks row so the existing polling hook
   *      (useMemoryAnalysisAsyncTask) keeps working unchanged.
   *   2. Enqueues one memory_ingest River job per topic — the
   *      egent-jobs memoryingest worker (Phase 3) handles each one.
   *   3. Returns the async_tasks id; the frontend polls
   *      async_tasks.status to track progress.
   */
  requestFromChatTopics = async (
    params: RequestMemoryExtractionParams,
  ): Promise<RequestMemoryExtractionResult> => {
    const body: Record<string, string> = {};
    if (params.fromDate) body.fromDate = params.fromDate.toISOString();
    if (params.toDate) body.toDate = params.toDate.toISOString();

    const res = await egentFetch('/v1/memory/extraction/start', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`memory extraction start failed: ${res.status} ${errText}`);
    }
    const data = (await res.json()) as {
      deduped: boolean;
      id: string;
      metadata: UserMemoryExtractionMetadata;
      status: AsyncTaskStatus;
    };
    return {
      deduped: data.deduped ?? false,
      error: null,
      id: data.id,
      metadata: data.metadata,
      status: data.status,
    };
  };

  /**
   * Poll the async_tasks row for status. Replaces
   * lambda/userMemory.ts:getMemoryExtractionTask.
   */
  getTask = async (taskId?: string): Promise<MemoryExtractionTask | null> => {
    const path = taskId ? `/v1/memory/extraction/task/${taskId}` : '/v1/memory/extraction/task/';
    const res = await egentFetch(path, { method: 'GET' });
    if (res.status === 404) return null;
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`memory extraction task fetch failed: ${res.status} ${errText}`);
    }
    const data = (await res.json()) as {
      error?: IAsyncTaskError | null;
      id: string;
      metadata: UserMemoryExtractionMetadata;
      status: AsyncTaskStatus;
      type?: string;
    };
    return {
      error: data.error ?? null,
      id: data.id,
      metadata: data.metadata,
      status: data.status,
    };
  };
}

export const memoryExtractionService = new MemoryExtractionService();
