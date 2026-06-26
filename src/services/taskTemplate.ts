import type { TaskTemplate } from '@lobechat/const';

import { deferredEmpty } from '@/libs/deferred';

/**
 * @deferred(M2) taskTemplate.* → recommendations backend. The lambda router was
 * removed for the MVP TS-backend cut; daily task-template recommendations are an
 * M2 feature. Method signatures are preserved so the RecommendTaskTemplates UI
 * compiles and runs — recommendations degrade to "empty" until the feature is
 * re-wired at milestone M2. See MVP_ROADMAP.md (Track B).
 */
class TaskTemplateService {
  dismiss = async (_templateId: number) => {
    return deferredEmpty('M2', 'taskTemplate.dismiss', undefined);
  };

  listDailyRecommend = async (
    _interestKeys: string[],
    _options: { count?: number; locale?: string; refreshSeed?: string } = {},
  ): Promise<{ data: TaskTemplate[] }> => {
    return deferredEmpty('M2', 'taskTemplate.listDailyRecommend', { data: [] as TaskTemplate[] });
  };

  recordCreated = async (_templateId: number) => {
    return deferredEmpty('M2', 'taskTemplate.recordCreated', undefined);
  };
}

export const taskTemplateService = new TaskTemplateService();
