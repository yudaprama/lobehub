import { getLobehubQueryClient } from '@/libs/prest/client';
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
    const db = await getLobehubQueryClient();
    return db.insert('ai_providers', params);
  };

  getAiProviderList = async () => {
    const db = await getLobehubQueryClient();
    return db.select('ai_providers', { order: ['sort:asc'] }) as unknown as AiProviderDetailItem[];
  };

  getAiProviderById = async (id: string): Promise<AiProviderDetailItem | undefined> => {
    const db = await getLobehubQueryClient();
    const [provider] = await db.select('ai_providers', {
      where: { id },
      size: 1,
    });
    return provider as unknown as AiProviderDetailItem | undefined;
  };

  toggleProviderEnabled = async (id: string, enabled: boolean) => {
    const db = await getLobehubQueryClient();
    await db.update('ai_providers', { id }, { enabled } as any);
  };

  updateAiProvider = async (id: string, value: any) => {
    const db = await getLobehubQueryClient();
    await db.update('ai_providers', { id }, value);
  };

  // Stays on BFF — encrypts key vaults via KeyVaultsGateKeeper
  updateAiProviderConfig = async (id: string, value: UpdateAiProviderConfigParams) => {
    return lambdaClient.aiProvider.updateAiProviderConfig.mutate({ id, value });
  };

  updateAiProviderOrder = async (items: AiProviderSortMap[]) => {
    const db = await getLobehubQueryClient();
    await Promise.all(
      items.map((item) => db.update('ai_providers', { id: item.id }, { sort: item.sort } as any)),
    );
  };

  deleteAiProvider = async (id: string) => {
    const db = await getLobehubQueryClient();
    await db.delete('ai_providers', { id });
  };

  // Stays on BFF — reads key vaults + checks connectivity via LLM call
  getAiProviderRuntimeState = async (isLogin?: boolean): Promise<AiProviderRuntimeState> => {
    return lambdaClient.aiProvider.getAiProviderRuntimeState.query({ isLogin });
  };
}

export const aiProviderService = new AiProviderService();
