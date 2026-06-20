import { type GenerationBatchItem } from '@/database/schemas';
import { getLobehubClient, getPrestClient } from '@/libs/prest/client';
import { type Generation, type GenerationBatch } from '@/types/generation';

type GenerationBatchWithAsyncTaskId = GenerationBatch & {
  generations: (Generation & { asyncTaskId?: string | null })[];
};

class GenerationBatchService {
  /**
   * Get generation batches for a specific topic.
   *
   * Tier 2 stored SQL template joins generation_batches + generations +
   * async_tasks in one round trip. The `type` param is forwarded; the
   * template currently returns all types and the caller filters client-side.
   */
  async getGenerationBatches(
    topicId: string,
    type?: 'image' | 'video',
  ): Promise<GenerationBatchWithAsyncTaskId[]> {
    const client = await getPrestClient();

    const params: Record<string, string | number | boolean> = { topicId };
    if (type) params.type = type;

    return client.query<GenerationBatchWithAsyncTaskId>(
      'lobehub',
      'generationBatchesWithGenerations',
      params,
    );
  }

  /**
   * Delete a generation batch.
   *
   * Tier 1 delete on `generation_batches` — auto-scoped by user_id via
   * [[auth.user_id_filters]]. FK CASCADE removes child `generations` rows.
   */
  async deleteGenerationBatch(batchId: string): Promise<GenerationBatchItem | undefined> {
    const db = await getLobehubClient();
    const [row] = await db.delete('generation_batches', { id: batchId });
    return (row as any) ?? undefined;
  }
}

export const generationBatchService = new GenerationBatchService();
