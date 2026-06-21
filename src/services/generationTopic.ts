import { type GenerationTopicItem } from '@/database/schemas';
import { getLobehubQueryClient } from '@/libs/prest/client';
import { lambdaClient } from '@/libs/trpc/client';
import { type UpdateTopicValue } from '@/server/routers/lambda/generationTopic';
import { type ImageGenerationTopic } from '@/types/generation';

export class ServerService {
  async getAllGenerationTopics(type?: 'image' | 'video'): Promise<ImageGenerationTopic[]> {
    const db = await getLobehubQueryClient();
    return db.select('generation_topics', {
      ...(type ? { where: { type } } : {}),
      order: ['created_at:desc'],
    }) as any;
  }

  async createTopic(type?: 'image' | 'video'): Promise<string> {
    const db = await getLobehubQueryClient();
    const [row] = await db.insert('generation_topics', {
      type: type ?? 'image',
    });
    return row?.id;
  }

  async updateTopic(id: string, data: UpdateTopicValue): Promise<GenerationTopicItem | undefined> {
    const db = await getLobehubQueryClient();
    const [row] = await db.update('generation_topics', { id }, data);
    return row as any;
  }

  // Stays on BFF — calls generationService.createCoverFromUrl (image processing)
  async updateTopicCover(id: string, coverUrl: string): Promise<GenerationTopicItem | undefined> {
    return lambdaClient.generationTopic.updateTopicCover.mutate({ coverUrl, id });
  }

  // Stays on BFF — deletes S3 files via fileService
  async deleteTopic(id: string): Promise<GenerationTopicItem | undefined> {
    return lambdaClient.generationTopic.deleteTopic.mutate({ id });
  }
}

export const generationTopicService = new ServerService();
