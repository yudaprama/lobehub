import { type SidebarAgentItem, type SidebarAgentListResponse } from '@/database/repositories/home';
import { getLobehubQueryClient } from '@/libs/prest/client';
import { lambdaClient } from '@/libs/trpc/client';

export interface HomeDailyBriefPair {
  hint: string;
  welcome: string;
}

export interface HomeDailyBriefResponse {
  pairs: HomeDailyBriefPair[];
}

export class HomeService {
  /**
   * Get sidebar agent list with pinned, grouped, and ungrouped items
   */
  getSidebarAgentList = (): Promise<SidebarAgentListResponse> => {
    return lambdaClient.home.getSidebarAgentList.query();
  };

  /**
   * Get daily brief — paired { welcome, hint } objects for the home page.
   * Server returns `{ pairs: [] }` when no data is cached.
   */
  getDailyBrief = (): Promise<HomeDailyBriefResponse> => {
    return lambdaClient.home.getDailyBrief.query();
  };

  /**
   * Search agents by keyword
   */
  searchAgents = async (keyword: string): Promise<SidebarAgentItem[]> => {
    const db = await getLobehubQueryClient();
    const rows = await db.select('agents', {
      camelCase: true,
      where: { title: { ilike: `%${keyword}%` } },
      order: ['updated_at:desc'],
      size: 20,
    });
    return (rows ?? []) as unknown as SidebarAgentItem[];
  };

  /**
   * Update an agent's session group
   */
  updateAgentSessionGroupId = async (
    agentId: string,
    sessionGroupId: string | null,
  ): Promise<void> => {
    const db = await getLobehubQueryClient();
    await db.update('agents', { id: agentId }, { session_group_id: sessionGroupId } as any);
  };
}

export const homeService = new HomeService();
