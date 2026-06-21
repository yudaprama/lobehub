import {
  type ActivityMemoryItemSchema,
  type AddIdentityActionSchema,
  type ContextMemoryItemSchema,
  type ExperienceMemoryItemSchema,
  type PreferenceMemoryItemSchema,
  type RemoveIdentityActionSchema,
  type UpdateIdentityActionSchema,
} from '@lobechat/memory-user-memory/schemas';
import {
  type ActivityListParams,
  type ActivityListResult,
  type AddActivityMemoryResult,
  type AddContextMemoryResult,
  type AddExperienceMemoryResult,
  type AddIdentityMemoryResult,
  type AddPreferenceMemoryResult,
  type ExperienceListParams,
  type ExperienceListResult,
  type IdentityListParams,
  type IdentityListResult,
  type LayersEnum,
  type QueryTaxonomyOptionsParams,
  type QueryTaxonomyOptionsResult,
  type RemoveIdentityMemoryResult,
  type SearchMemoryParams,
  type SearchMemoryResult,
  type TypesEnum,
  type UpdateIdentityMemoryResult,
} from '@lobechat/types';
import { type z } from 'zod';

import { idGenerator } from '@/libs/idGenerator';
import { getLobehubQueryClient } from '@/libs/prest/client';
import { lambdaClient } from '@/libs/trpc/client';

class UserMemoryService {
  // ── Add methods (parent insert + child insert) ──

  addActivityMemory = async (
    params: z.infer<typeof ActivityMemoryItemSchema>,
  ): Promise<AddActivityMemoryResult> => {
    const db = await getLobehubQueryClient();
    const parentId = idGenerator('memory');
    await db.insert('user_memories', {
      id: parentId,
      memory_layer: 'activity',
      memory_category: (params as any).category ?? null,
      memory_type: (params as any).type ?? null,
      title: (params as any).title ?? null,
      summary: (params as any).summary ?? null,
      details: (params as any).details ?? null,
      tags: (params as any).tags ?? null,
      metadata: (params as any).metadata ?? null,
      status: 'active',
    });
    await db.insert('user_memories_activities', {
      user_memory_id: parentId,
      type: (params as any).type ?? 'general',
      status: (params as any).status ?? 'pending',
      timezone: (params as any).timezone ?? null,
      starts_at: (params as any).startsAt ?? null,
      ends_at: (params as any).endsAt ?? null,
      associated_objects: (params as any).associatedObjects ?? null,
      associated_subjects: (params as any).associatedSubjects ?? null,
      associated_locations: (params as any).associatedLocations ?? null,
      notes: (params as any).notes ?? null,
      narrative: (params as any).narrative ?? null,
      feedback: (params as any).feedback ?? null,
      metadata: (params as any).metadata ?? null,
      tags: (params as any).tags ?? null,
    });
    return { id: parentId, success: true } as unknown as AddActivityMemoryResult;
  };

  addContextMemory = async (
    params: z.infer<typeof ContextMemoryItemSchema>,
  ): Promise<AddContextMemoryResult> => {
    const db = await getLobehubQueryClient();
    const parentId = idGenerator('memory');
    await db.insert('user_memories', {
      id: parentId,
      memory_layer: 'context',
      memory_category: (params as any).category ?? null,
      memory_type: (params as any).type ?? null,
      title: (params as any).title ?? null,
      summary: (params as any).summary ?? null,
      details: (params as any).details ?? null,
      tags: (params as any).tags ?? null,
      metadata: (params as any).metadata ?? null,
      status: 'active',
    });
    await db.insert('user_memories_contexts', {
      user_memory_ids: (params as any).userMemoryIds ?? null,
      title: (params as any).title ?? null,
      description: (params as any).description ?? null,
      type: (params as any).type ?? null,
      current_status: (params as any).currentStatus ?? null,
      associated_objects: (params as any).associatedObjects ?? null,
      associated_subjects: (params as any).associatedSubjects ?? null,
      metadata: (params as any).metadata ?? null,
      tags: (params as any).tags ?? null,
    });
    return { id: parentId, success: true } as unknown as AddContextMemoryResult;
  };

  addExperienceMemory = async (
    params: z.infer<typeof ExperienceMemoryItemSchema>,
  ): Promise<AddExperienceMemoryResult> => {
    const db = await getLobehubQueryClient();
    const parentId = idGenerator('memory');
    await db.insert('user_memories', {
      id: parentId,
      memory_layer: 'experience',
      memory_category: (params as any).category ?? null,
      memory_type: (params as any).type ?? null,
      title: (params as any).title ?? null,
      summary: (params as any).summary ?? null,
      details: (params as any).details ?? null,
      tags: (params as any).tags ?? null,
      metadata: (params as any).metadata ?? null,
      status: 'active',
    });
    await db.insert('user_memories_experiences', {
      user_memory_id: parentId,
      type: (params as any).type ?? null,
      situation: (params as any).situation ?? null,
      reasoning: (params as any).reasoning ?? null,
      possible_outcome: (params as any).possibleOutcome ?? null,
      action: (params as any).action ?? null,
      key_learning: (params as any).keyLearning ?? null,
      score_confidence: (params as any).scoreConfidence ?? null,
      metadata: (params as any).metadata ?? null,
      tags: (params as any).tags ?? null,
    });
    return { id: parentId, success: true } as unknown as AddExperienceMemoryResult;
  };

  addIdentityMemory = async (
    params: z.infer<typeof AddIdentityActionSchema>,
  ): Promise<AddIdentityMemoryResult> => {
    const db = await getLobehubQueryClient();
    const parentId = idGenerator('memory');
    await db.insert('user_memories', {
      id: parentId,
      memory_layer: 'identity',
      memory_type: (params as any).type ?? null,
      title: (params as any).name ?? (params as any).title ?? null,
      summary: (params as any).description ?? null,
      tags: (params as any).tags ?? null,
      metadata: (params as any).metadata ?? null,
      status: 'active',
    });
    await db.insert('user_memories_identities', {
      user_memory_id: parentId,
      type: (params as any).type ?? null,
      description: (params as any).description ?? null,
      relationship: (params as any).relationship ?? null,
      role: (params as any).role ?? null,
      metadata: (params as any).metadata ?? null,
      tags: (params as any).tags ?? null,
    });
    return { id: parentId, success: true } as unknown as AddIdentityMemoryResult;
  };

  addPreferenceMemory = async (
    params: z.infer<typeof PreferenceMemoryItemSchema>,
  ): Promise<AddPreferenceMemoryResult> => {
    const db = await getLobehubQueryClient();
    const parentId = idGenerator('memory');
    await db.insert('user_memories', {
      id: parentId,
      memory_layer: 'preference',
      memory_category: (params as any).category ?? null,
      memory_type: (params as any).type ?? null,
      title: (params as any).title ?? null,
      summary: (params as any).summary ?? null,
      details: (params as any).details ?? null,
      tags: (params as any).tags ?? null,
      metadata: (params as any).metadata ?? null,
      status: 'active',
    });
    await db.insert('user_memories_preferences', {
      user_memory_id: parentId,
      type: (params as any).type ?? null,
      conclusion_directives: (params as any).conclusionDirectives ?? null,
      suggestions: (params as any).suggestions ?? null,
      score_priority: (params as any).scorePriority ?? null,
      metadata: (params as any).metadata ?? null,
      tags: (params as any).tags ?? null,
    });
    return { id: parentId, success: true } as unknown as AddPreferenceMemoryResult;
  };

  // ── Remove / Update ──

  removeIdentityMemory = async (
    params: z.infer<typeof RemoveIdentityActionSchema>,
  ): Promise<RemoveIdentityMemoryResult> => {
    const db = await getLobehubQueryClient();
    await db.delete('user_memories', {
      id: { eq: (params as any).id },
    });
    return { success: true } as RemoveIdentityMemoryResult;
  };

  updateIdentityMemory = async (
    params: z.infer<typeof UpdateIdentityActionSchema>,
  ): Promise<UpdateIdentityMemoryResult> => {
    const db = await getLobehubQueryClient();
    const updates: Record<string, any> = {};
    if ((params as any).title) updates.title = (params as any).title;
    if ((params as any).summary) updates.summary = (params as any).summary;
    if ((params as any).details) updates.details = (params as any).details;
    if ((params as any).tags) updates.tags = (params as any).tags;
    if ((params as any).metadata) updates.metadata = (params as any).metadata;
    await db.update(
      'user_memories',
      {
        id: { eq: (params as any).id },
      },
      updates,
    );
    return { success: true } as UpdateIdentityMemoryResult;
  };

  // ── Query methods ──

  getMemoryDetail = async (params: { id: string; layer: LayersEnum }) => {
    const db = await getLobehubQueryClient();
    const rows = await db.select('user_memories', {
      where: { id: params.id },
      limit: 1,
    });
    return (rows[0] ?? null) as any;
  };

  getPersona = async () => {
    return lambdaClient.userMemory.getPersona.query();
  };

  queryExperiences = async (params?: ExperienceListParams): Promise<ExperienceListResult> => {
    const db = await getLobehubQueryClient();
    const where: Record<string, any> = {};
    const p = params as any;
    if (p?.type ?? params?.types?.[0]) where.type = p?.type ?? params?.types?.[0];
    const rows = await db.select('user_memories_experiences', {
      where: Object.keys(where).length ? where : undefined,
      limit: p?.size ?? 50,
      offset: p?.page ? (p.page - 1) * (p.size ?? 50) : 0,
      order: ['captured_at:desc'],
    });
    return { items: rows, total: rows.length } as unknown as ExperienceListResult;
  };

  queryActivities = async (params?: ActivityListParams): Promise<ActivityListResult> => {
    const db = await getLobehubQueryClient();
    const where: Record<string, any> = {};
    const p = params as any;
    if (p?.type ?? params?.types?.[0]) where.type = p?.type ?? params?.types?.[0];
    if (p?.status) where.status = p.status;
    const rows = await db.select('user_memories_activities', {
      where: Object.keys(where).length ? where : undefined,
      limit: p?.size ?? 50,
      offset: p?.page ? (p.page - 1) * (p.size ?? 50) : 0,
      order: ['captured_at:desc'],
    });
    return { items: rows, total: rows.length } as unknown as ActivityListResult;
  };

  queryIdentities = async (params?: IdentityListParams): Promise<IdentityListResult> => {
    const db = await getLobehubQueryClient();
    const where: Record<string, any> = {};
    const p = params as any;
    if (p?.type ?? params?.types?.[0]) where.type = p?.type ?? params?.types?.[0];
    const rows = await db.select('user_memories_identities', {
      where: Object.keys(where).length ? where : undefined,
      limit: p?.size ?? 50,
      offset: p?.page ? (p.page - 1) * (p.size ?? 50) : 0,
      order: ['captured_at:desc'],
    });
    return { items: rows, total: rows.length } as unknown as IdentityListResult;
  };

  retrieveMemory = async (params: SearchMemoryParams): Promise<SearchMemoryResult> => {
    const db = await getLobehubQueryClient();
    const where: Record<string, any> = {};
    const p = params as any;
    if (p?.q) where.title = { ilike: `%${p.q}%` };
    if (p?.layer) where.memory_layer = p.layer;
    const rows = await db.select('user_memories', {
      where: Object.keys(where).length ? where : undefined,
      limit: p?.limit ?? 20,
      order: ['captured_at:desc'],
    });
    return { memories: rows } as unknown as SearchMemoryResult;
  };

  retrieveMemoryForTopic = async (topicId: string): Promise<SearchMemoryResult> => {
    // For now, return all memories — proper implementation would use the
    // topic's historySummary as the search query for semantic search.
    const db = await getLobehubQueryClient();
    const rows = await db.select('user_memories', {
      where: { status: 'active' },
      limit: 20,
      order: ['accessed_count:desc'],
    });
    return { memories: rows } as unknown as SearchMemoryResult;
  };

  searchMemory = async (params: SearchMemoryParams): Promise<SearchMemoryResult> => {
    return this.retrieveMemory(params);
  };

  /**
   * Aggregate tags from user_memories grouped by layer.
   *
   * The Tier 2 `userMemoriesByLayer` template returns `{ tags, count }`
   * (already snake_case-ish; no transformation needed). Preserve via
   * { camelCase: false } to keep the typed result shape.
   */
  queryTags = async (params?: { layers?: LayersEnum[]; page?: number; size?: number }) => {
    const db = await getLobehubQueryClient();
    const rows = await db.query<{ tags: string[]; count: number }>(
      'lobehub',
      'userMemoriesByLayer',
      {
        layers: params?.layers?.join(',') ?? '',
        limit: params?.size ?? 50,
      },
      { camelCase: false },
    );
    return rows;
  };

  queryIdentityRoles = async (params?: { page?: number; size?: number }) => {
    const db = await getLobehubQueryClient();
    const rows = await db.select('user_memories_identities', {
      select: ['role'],
      distinct: true,
      limit: params?.size ?? 50,
    });
    return rows.map((r: any) => r.role).filter(Boolean) as any;
  };

  queryTaxonomyOptions = async (
    params?: QueryTaxonomyOptionsParams,
  ): Promise<QueryTaxonomyOptionsResult> => {
    // Taxonomy options are relatively static — return from tRPC for now.
    return lambdaClient.userMemories.queryTaxonomyOptions.query(params);
  };

  queryIdentitiesForInjection = async (params?: { limit?: number }) => {
    const db = await getLobehubQueryClient();
    const rows = await db.select('user_memories_identities', {
      where: { relationship: { in: ['self', null] as any } },
      limit: params?.limit ?? 10,
      order: ['captured_at:desc'],
    });
    return rows as any;
  };

  queryMemories = async (params?: {
    categories?: string[];
    layer?: LayersEnum;
    order?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
    q?: string;
    sort?:
      | 'capturedAt'
      | 'scoreConfidence'
      | 'scoreImpact'
      | 'scorePriority'
      | 'scoreUrgency'
      | 'startsAt';
    status?: string[];
    tags?: string[];
    types?: TypesEnum[];
  }) => {
    const db = await getLobehubQueryClient();
    const where: Record<string, any> = {};
    if (params?.layer) where.memory_layer = params.layer;
    if (params?.status?.length) where.status = { in: params.status };
    if (params?.categories?.length) where.memory_category = { in: params.categories };
    if (params?.types?.length) where.memory_type = { in: params.types };
    if (params?.q) where.title = { ilike: `%${params.q}%` };
    const rows = await db.select('user_memories', {
      where: Object.keys(where).length ? where : undefined,
      limit: params?.pageSize ?? 50,
      offset: params?.page ? (params.page - 1) * (params.pageSize ?? 50) : 0,
      order: [`captured_at:${params?.order ?? 'desc'}`],
    });
    return rows;
  };
}

export const userMemoryService = new UserMemoryService();
export { memoryCRUDService } from './crud';
export { memoryExtractionService } from './extraction';
