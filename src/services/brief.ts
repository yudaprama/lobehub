import { normalizeInboxAgentAvatar, normalizeInboxAgentTitle } from '@/database/utils/inboxAgent';
import { getLobehubQueryClient } from '@/libs/prest/client';
import { lambdaClient } from '@/libs/trpc/client';

interface UnresolvedBriefRow {
  agentAvatar: string | null;
  agentBackgroundColor: string | null;
  agentRowId: string | null;
  agentSlug: string | null;
  agentTitle: string | null;
  taskStatus: string | null;
  [key: string]: unknown;
}

class BriefService {
  delete = async (id: string) => {
    const db = await getLobehubQueryClient();
    await db.delete('briefs', { id });
  };

  listUnresolved = async () => {
    // Tier 2 template: briefs ⨝ agents ⨝ tasks, scoped to the caller, ordered
    // urgent→normal→info then newest-first, capped at 20. Mirrors the BFF's
    // BriefModel.listUnresolvedEnriched. The agent object + inbox normalization
    // are assembled here (the same shaping the TS BriefService did), so the UI
    // still receives `agent` / `agents` / `taskStatus`.
    const db = await getLobehubQueryClient();
    const rows = await db.query<UnresolvedBriefRow>('lobehub', 'briefsListUnresolved', {});

    const data = rows.map((row) => {
      const {
        agentAvatar,
        agentBackgroundColor,
        agentRowId,
        agentSlug,
        agentTitle,
        taskStatus,
        ...brief
      } = row;

      return {
        ...brief,
        agent: agentRowId
          ? {
              avatar: normalizeInboxAgentAvatar(agentAvatar, { slug: agentSlug }),
              backgroundColor: agentBackgroundColor,
              id: agentRowId,
              title: normalizeInboxAgentTitle(agentTitle, { slug: agentSlug }),
            }
          : null,
        agents: [],
        taskStatus: taskStatus ?? null,
      };
    });

    return { data, success: true };
  };

  markRead = async (id: string) => {
    const db = await getLobehubQueryClient();
    const [row] = await db.update('briefs', { id }, { read_at: new Date().toISOString() });
    return row ?? null;
  };

  resolve = async (id: string, params?: { action?: string; comment?: string }) => {
    return lambdaClient.brief.resolve.mutate({ id, ...params });
  };
}

export const briefService = new BriefService();
