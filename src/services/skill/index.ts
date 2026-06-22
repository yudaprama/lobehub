import type {
  CreateSkillInput,
  ImportGitHubInput,
  ImportUrlInput,
  ImportZipInput,
  SkillImportResult,
  SkillItem,
  SkillListItem,
  SkillResourceContent,
  SkillResourceTreeNode,
  SkillSource,
  UpdateSkillInput,
} from '@lobechat/types';

import { idGenerator } from '@/libs/idGenerator';
import { getLobehubQueryClient } from '@/libs/prest/client';
import { lambdaClient } from '@/libs/trpc/client';

class AgentSkillService {
  // ===== Create =====

  async createSkill(params: CreateSkillInput): Promise<SkillItem | undefined> {
    const db = await getLobehubQueryClient();
    const id = params.id || idGenerator('agentSkills');
    await db.insert('agent_skills', {
      id,
      name: params.name,
      description: params.description ?? '',
      identifier: params.identifier,
      source: params.source ?? 'custom',
      manifest: params.manifest ?? null,
      content: params.content ?? null,
    } as any);
    return { id } as any;
  }

  // ===== Import (Tier 3 — server-side logic) =====

  async importFromGitHub(params: ImportGitHubInput): Promise<SkillImportResult | undefined> {
    return lambdaClient.agentSkills.importFromGitHub.mutate(params);
  }

  async importFromUrl(params: ImportUrlInput): Promise<SkillImportResult | undefined> {
    return lambdaClient.agentSkills.importFromUrl.mutate(params);
  }

  async importFromZip(params: ImportZipInput): Promise<SkillImportResult | undefined> {
    return lambdaClient.agentSkills.importFromZip.mutate(params);
  }

  async importFromMarket(identifier: string): Promise<SkillImportResult | undefined> {
    return lambdaClient.agentSkills.importFromMarket.mutate({ identifier });
  }

  // ===== Query =====

  async getById(id: string): Promise<SkillItem | undefined> {
    const db = await getLobehubQueryClient();
    const rows = await db.select('agent_skills', {
      camelCase: true,
      where: { id },
    });
    return rows?.[0] as SkillItem | undefined;
  }

  async getZipUrl(id: string): Promise<{ name: string; url: string | null }> {
    return lambdaClient.agentSkills.getByIdWithZipUrl.query({ id });
  }

  async getByIdentifier(identifier: string): Promise<SkillItem | undefined> {
    const db = await getLobehubQueryClient();
    const rows = await db.select('agent_skills', {
      camelCase: true,
      where: { identifier },
    });
    return rows?.[0] as SkillItem | undefined;
  }

  async getByName(name: string): Promise<SkillItem | undefined> {
    const db = await getLobehubQueryClient();
    const rows = await db.select('agent_skills', {
      camelCase: true,
      where: { name },
    });
    return rows?.[0] as SkillItem | undefined;
  }

  async list(source?: SkillSource): Promise<{ data: SkillListItem[]; total: number }> {
    const db = await getLobehubQueryClient();
    const where = source ? { source } : {};
    const rows = await db.select('agent_skills', {
      camelCase: true,
      order: ['updated_at:desc'],
      ...(Object.keys(where).length ? { where } : {}),
    });
    return { data: (rows ?? []) as SkillListItem[], total: rows?.length ?? 0 };
  }

  async search(query: string): Promise<{ data: SkillListItem[]; total: number }> {
    const db = await getLobehubQueryClient();
    const rows = await db.select('agent_skills', {
      camelCase: true,
      where: { name: { ilike: `%${query}%` } },
    });
    return { data: (rows ?? []) as SkillListItem[], total: rows?.length ?? 0 };
  }

  // ===== Resources (Tier 3 — server-side file reading from ZIP) =====

  async listResources(id: string, includeContent?: boolean): Promise<SkillResourceTreeNode[]> {
    return lambdaClient.agentSkills.listResources.query({ id, includeContent });
  }

  async readResource(id: string, path: string): Promise<SkillResourceContent> {
    return lambdaClient.agentSkills.readResource.query({ id, path });
  }

  // ===== Update =====

  async updateSkill(params: UpdateSkillInput): Promise<SkillItem> {
    const db = await getLobehubQueryClient();
    const patch: Record<string, unknown> = {};
    if (params.content !== undefined) patch.content = params.content;
    if (params.manifest !== undefined) patch.manifest = params.manifest;
    await db.update('agent_skills', { id: params.id }, patch as any);
    return { id: params.id } as any;
  }

  // ===== Delete =====

  async deleteSkill(id: string): Promise<{ success: boolean }> {
    const db = await getLobehubQueryClient();
    await db.delete('agent_skills', { id });
    return { success: true };
  }
}

export const agentSkillService = new AgentSkillService();
