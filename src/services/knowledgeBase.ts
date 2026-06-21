import { getLobehubClient, getPrestClient } from '@/libs/prest/client';
import { lambdaClient } from '@/libs/trpc/client';
import { type CreateKnowledgeBaseParams } from '@/types/knowledgeBase';

interface KnowledgeBaseRow {
  avatar: string | null;
  created_at: string;
  description: string | null;
  id: string;
  name: string;
  updated_at: string;
}

interface KnowledgeBaseFileRow {
  file_id: string;
  id: string;
  knowledge_base_id: string;
}

class KnowledgeBaseService {
  createKnowledgeBase = async (params: CreateKnowledgeBaseParams) => {
    const db = await getLobehubClient();
    const [row] = await db.insert('knowledge_bases', {
      id: (params as any).id ?? crypto.randomUUID(),
      name: params.name,
      description: params.description ?? null,
      avatar: (params as any).avatar ?? null,
    } as any);
    return row;
  };

  getKnowledgeBaseList = async () => {
    const db = await getLobehubClient();
    return db.select('knowledge_bases', {
      order: ['updated_at:desc'],
    });
  };

  getKnowledgeBaseById = async (id: string) => {
    const db = await getLobehubClient();
    const [row] = await db.select('knowledge_bases', {
      where: { id },
      size: 1,
    });
    return row ?? null;
  };

  updateKnowledgeBaseList = async (id: string, value: any) => {
    const db = await getLobehubClient();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (value?.name !== undefined) patch.name = value.name;
    if (value?.description !== undefined) patch.description = value.description;
    if (value?.avatar !== undefined) patch.avatar = value.avatar;

    await db.update('knowledge_bases', { id }, patch);
  };

  deleteKnowledgeBase = async (id: string) => {
    const db = await getLobehubClient();
    await db.delete('knowledge_bases', { id });
  };

  /**
   * Transfer a knowledge base between workspaces.
   * Stays on lambdaClient — the BFF validates workspace membership and
   * updates `workspace_id` on the KB + all child files/chunks atomically.
   */
  transferKnowledgeBase = async (id: string, targetWorkspaceId: string | null) => {
    return lambdaClient.knowledgeBase.transferKnowledgeBase.mutate({ id, targetWorkspaceId });
  };

  /**
   * Copy a knowledge base to another workspace.
   * Stays on lambdaClient — server-side deep-copy of KB + files + chunks.
   */
  copyKnowledgeBaseToWorkspace = async (id: string, targetWorkspaceId: string | null) => {
    return lambdaClient.knowledgeBase.copyKnowledgeBaseToWorkspace.mutate({
      id,
      targetWorkspaceId,
    });
  };

  /**
   * Attach files to a knowledge base.
   * Tier 1 insertBatch into the `knowledge_base_files` junction. Each row
   * is auto-scoped by user_id via [[auth.user_id_filters]].
   */
  addFilesToKnowledgeBase = async (knowledgeBaseId: string, ids: string[]) => {
    if (ids.length === 0) return;
    const client = await getPrestClient();
    await client.insertBatch(
      'lobehub',
      'public',
      'knowledge_base_files',
      ids.map((fileId) => ({
        id: crypto.randomUUID(),
        knowledge_base_id: knowledgeBaseId,
        file_id: fileId,
      })),
    );
  };

  /**
   * Detach files from a knowledge base.
   * Tier 1 delete on `knowledge_base_files` scoped by KB id + file ids.
   */
  removeFilesFromKnowledgeBase = async (knowledgeBaseId: string, ids: string[]) => {
    if (ids.length === 0) return;
    const client = await getPrestClient();
    await client.delete('lobehub', 'public', 'knowledge_base_files', {
      knowledge_base_id: knowledgeBaseId,
      file_id: { in: ids },
    });
  };
}

export const knowledgeBaseService = new KnowledgeBaseService();
