import { getLobehubQueryClient } from '@/libs/prest/client';

class GenerationService {
  /**
   * Look up a generation row + its async task status by id.
   *
   * Tier 1 select for generation (auto-scoped by user_id). The async_task
   * lookup is also Tier 1 (async_tasks is in [[auth.user_id_filters]]).
   * The original BFF path merged both into one response shape.
   */
  async getGenerationStatus(generationId: string, asyncTaskId: string) {
    const db = await getLobehubQueryClient();
    const [gen] = await db.select('generations', { where: { id: generationId }, size: 1 });
    if (!gen) return null;

    const [task] = await db.select('async_tasks', {
      where: { id: asyncTaskId },
      size: 1,
    });

    const taskRow = task ?? null;
    return { ...gen, async_task: taskRow, status: taskRow?.status ?? null, generation: gen };
  }

  /**
   * Delete a single generation.
   *
   * Tier 1 delete on the `generations` table — pREST scopes by `user_id`
   * via [[auth.user_id_filters]]. FK CASCADE removes the associated
   * `async_tasks` row when the generation's `async_task_id` points to it.
   */
  async deleteGeneration(generationId: string) {
    const db = await getLobehubQueryClient();
    await db.delete('generations', { id: generationId });
  }
}

export const generationService = new GenerationService();
