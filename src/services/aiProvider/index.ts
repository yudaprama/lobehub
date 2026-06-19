import { getLobehubClient } from '@/libs/prest/client';
import { lambdaClient } from '@/libs/trpc/client';
import {
  type AiProviderDetailItem,
  type AiProviderRuntimeState,
  type AiProviderSortMap,
  type CreateAiProviderParams,
  type UpdateAiProviderConfigParams,
} from '@/types/aiProvider';

export class AiProviderService {
  createAiProvider = async (params: CreateAiProviderParams) => {
    const db = await getLobehubClient();
    return db.insert('ai_providers', params);
  };

  getAiProviderList = async () => {
    const db = await getLobehubClient();
    return db.select('ai_providers', { order: ['sort:asc'] });
  };

  getAiProviderById = async (id: string): Promise<AiProviderDetailItem | undefined> => {
    const db = await getLobehubClient();
    const [provider] = await db.select('ai_providers', { where: { id }, size: 1 });
    return provider as AiProviderDetailItem | undefined;
  };

  toggleProviderEnabled = async (id: string, enabled: boolean) => {
    const db = await getLobehubClient();
    await db.update('ai_providers', { id }, { enabled });
  };

  updateAiProvider = async (id: string, value: any) => {
    const db = await getLobehubClient();
    await db.update('ai_providers', { id }, value);
  };

  // Stays on BFF — encrypts key vaults via KeyVaultsGateKeeper
  updateAiProviderConfig = async (id: string, value: UpdateAiProviderConfigParams) => {
    return lambdaClient.aiProvider.updateAiProviderConfig.mutate({ id, value });
  };

  updateAiProviderOrder = async (items: AiProviderSortMap[]) => {
    const db = await getLobehubClient();
    await Promise.all(
      items.map((item) => db.update('ai_providers', { id: item.id }, { sort: item.sort })),
    );
  };

  deleteAiProvider = async (id: string) => {
    const db = await getLobehubClient();
    await db.delete('ai_providers', { id });
  };

  // Stays on BFF — reads key vaults + checks connectivity via LLM call
  getAiProviderRuntimeState = async (isLogin?: boolean): Promise<AiProviderRuntimeState> => {
    return lambdaClient.aiProvider.getAiProviderRuntimeState.query({ isLogin });
  };
}

export const aiProviderService = new AiProviderService();
