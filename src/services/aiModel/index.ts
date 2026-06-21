import {
  type AiModelSortMap,
  type AiProviderModelListItem,
  type CreateAiModelParams,
  isAiModelVisible,
  type ToggleAiModelEnableParams,
  type UpdateAiModelParams,
} from 'model-bank';

import { getLobehubQueryClient } from '@/libs/prest/client';

export interface GetAiProviderModelListParams {
  enabled?: boolean;
  limit?: number;
  offset?: number;
}

export class AiModelService {
  createAiModel = async (params: CreateAiModelParams) => {
    const db = await getLobehubQueryClient();
    return db.insert('ai_models', params as any);
  };

  getAiProviderModelList = async (
    id: string,
    params?: GetAiProviderModelListParams,
  ): Promise<AiProviderModelListItem[]> => {
    const db = await getLobehubQueryClient();
    const models = await db.select('ai_models', {
      where: { provider_id: id, ...(params?.enabled != null ? { enabled: params.enabled } : {}) },
      size: params?.limit ?? 200,
      camelCase: false,
    });
    return (models as any[]).filter(isAiModelVisible);
  };

  getAiModelById = async (id: string) => {
    const db = await getLobehubQueryClient();
    const [model] = await db.select('ai_models', { where: { id }, size: 1, camelCase: false });
    return model;
  };

  toggleModelEnabled = async (params: ToggleAiModelEnableParams) => {
    const db = await getLobehubQueryClient();
    await db.update('ai_models', { id: params.id }, { enabled: params.enabled });
  };

  updateAiModel = async (id: string, providerId: string, value: UpdateAiModelParams) => {
    const db = await getLobehubQueryClient();
    await db.update('ai_models', { id, provider_id: providerId }, value);
  };

  batchUpdateAiModels = async (id: string, models: AiProviderModelListItem[]) => {
    const db = await getLobehubQueryClient();
    await Promise.all(
      models.map((m) => db.update('ai_models', { id: m.id, provider_id: id }, m as any)),
    );
  };

  batchToggleAiModels = async (id: string, models: string[], enabled: boolean) => {
    const db = await getLobehubQueryClient();
    await db.update('ai_models', { provider_id: id, id: { in: models } }, { enabled });
  };

  clearModelsByProvider = async (providerId: string) => {
    const db = await getLobehubQueryClient();
    await db.delete('ai_models', { provider_id: providerId });
  };

  clearRemoteModels = async (providerId: string) => {
    const db = await getLobehubQueryClient();
    await db.delete('ai_models', { provider_id: providerId, source: 'remote' });
  };

  updateAiModelOrder = async (providerId: string, items: AiModelSortMap[]) => {
    const db = await getLobehubQueryClient();
    await Promise.all(
      items.map((item) =>
        db.update('ai_models', { id: item.id, provider_id: providerId }, { sort: item.sort }),
      ),
    );
  };

  deleteAiModel = async (params: { id: string; providerId: string }) => {
    const db = await getLobehubQueryClient();
    await db.delete('ai_models', { id: params.id, provider_id: params.providerId });
  };
}

export const aiModelService = new AiModelService();
