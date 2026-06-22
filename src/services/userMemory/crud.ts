import { type NewUserMemoryIdentity } from '@lobechat/types';

import { idGenerator } from '@/libs/idGenerator';
import { getLobehubQueryClient } from '@/libs/prest/client';

class MemoryCRUDService {
  // ============ Identity CRUD ============

  deleteAll = async () => {
    const db = await getLobehubQueryClient();
    await db.delete('user_memories', {});
  };

  createIdentity = async (data: NewUserMemoryIdentity) => {
    const db = await getLobehubQueryClient();
    const id = idGenerator('memory');
    await db.insert('user_memories_identities', {
      id,
      description: data.description ?? null,
      episodic_date: data.episodicDate ?? null,
      tags: data.extractedLabels ?? null,
      metadata: data.labels ?? null,
      relationship: data.relationship ?? null,
      role: data.role ?? null,
      type: data.type ?? null,
      user_memory_id: data.userMemoryId ?? null,
    } as any);
    return id;
  };

  deleteIdentity = async (id: string) => {
    const db = await getLobehubQueryClient();
    await db.delete('user_memories_identities', { id });
  };

  getIdentities = async () => {
    const db = await getLobehubQueryClient();
    return db.select('user_memories_identities', { camelCase: true });
  };

  updateIdentity = async (id: string, data: Partial<NewUserMemoryIdentity>) => {
    const db = await getLobehubQueryClient();
    const patch: Record<string, unknown> = {};
    if (data.description !== undefined) patch.description = data.description;
    if (data.episodicDate !== undefined) patch.episodic_date = data.episodicDate;
    if (data.extractedLabels !== undefined) patch.tags = data.extractedLabels;
    if (data.labels !== undefined) patch.metadata = data.labels;
    if (data.relationship !== undefined) patch.relationship = data.relationship;
    if (data.role !== undefined) patch.role = data.role;
    if (data.type !== undefined) patch.type = data.type;
    await db.update('user_memories_identities', { id }, patch as any);
  };

  // ============ Context CRUD ============

  deleteContext = async (id: string) => {
    const db = await getLobehubQueryClient();
    await db.delete('user_memories_contexts', { id });
  };

  getContexts = async () => {
    const db = await getLobehubQueryClient();
    return db.select('user_memories_contexts', { camelCase: true });
  };

  updateContext = async (
    id: string,
    data: { currentStatus?: string; description?: string; title?: string },
  ) => {
    const db = await getLobehubQueryClient();
    const patch: Record<string, unknown> = {};
    if (data.currentStatus !== undefined) patch.current_status = data.currentStatus;
    if (data.description !== undefined) patch.description = data.description;
    if (data.title !== undefined) patch.title = data.title;
    await db.update('user_memories_contexts', { id }, patch as any);
  };

  // ============ Activity CRUD ============

  deleteActivity = async (id: string) => {
    const db = await getLobehubQueryClient();
    await db.delete('user_memories_activities', { id });
  };

  getActivities = async () => {
    const db = await getLobehubQueryClient();
    return db.select('user_memories_activities', { camelCase: true });
  };

  updateActivity = async (
    id: string,
    data: { narrative?: string; notes?: string; status?: string },
  ) => {
    const db = await getLobehubQueryClient();
    const patch: Record<string, unknown> = {};
    if (data.narrative !== undefined) patch.narrative = data.narrative;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.status !== undefined) patch.status = data.status;
    await db.update('user_memories_activities', { id }, patch as any);
  };

  // ============ Experience CRUD ============

  deleteExperience = async (id: string) => {
    const db = await getLobehubQueryClient();
    await db.delete('user_memories_experiences', { id });
  };

  getExperiences = async () => {
    const db = await getLobehubQueryClient();
    return db.select('user_memories_experiences', { camelCase: true });
  };

  updateExperience = async (
    id: string,
    data: { action?: string; keyLearning?: string; situation?: string },
  ) => {
    const db = await getLobehubQueryClient();
    const patch: Record<string, unknown> = {};
    if (data.action !== undefined) patch.action = data.action;
    if (data.keyLearning !== undefined) patch.key_learning = data.keyLearning;
    if (data.situation !== undefined) patch.situation = data.situation;
    await db.update('user_memories_experiences', { id }, patch as any);
  };

  // ============ Preference CRUD ============

  deletePreference = async (id: string) => {
    const db = await getLobehubQueryClient();
    await db.delete('user_memories_preferences', { id });
  };

  getPreferences = async () => {
    const db = await getLobehubQueryClient();
    return db.select('user_memories_preferences', { camelCase: true });
  };

  updatePreference = async (
    id: string,
    data: { conclusionDirectives?: string; suggestions?: string },
  ) => {
    const db = await getLobehubQueryClient();
    const patch: Record<string, unknown> = {};
    if (data.conclusionDirectives !== undefined)
      patch.conclusion_directives = data.conclusionDirectives;
    if (data.suggestions !== undefined) patch.suggestions = data.suggestions;
    await db.update('user_memories_preferences', { id }, patch as any);
  };
}

export const memoryCRUDService = new MemoryCRUDService();
