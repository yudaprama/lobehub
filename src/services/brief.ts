import { getLobehubQueryClient } from '@/libs/prest/client';
import { lambdaClient } from '@/libs/trpc/client';

class BriefService {
  delete = async (id: string) => {
    const db = await getLobehubQueryClient();
    await db.delete('briefs', { id });
  };

  listUnresolved = async () => {
    return lambdaClient.brief.listUnresolved.query();
  };

  markRead = async (id: string) => {
    const db = await getLobehubQueryClient();
    const [row] = await db.update('briefs', { id }, { read_at: new Date().toISOString() } as any);
    return row ?? null;
  };

  resolve = async (id: string, params?: { action?: string; comment?: string }) => {
    return lambdaClient.brief.resolve.mutate({ id, ...params });
  };
}

export const briefService = new BriefService();
