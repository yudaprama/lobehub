import { CUSTOM_DOCUMENT_FILE_TYPE, DERIVED_DOCUMENT_SOURCE_TYPE } from '@lobechat/const';

import { getAlistClient } from '@/libs/alist/client';
import { egentFetch } from '@/libs/egent/client';
import { getLobehubQueryClient, getPrestClient, getWorkspaceParams } from '@/libs/prest/client';
import {
  type CheckFileHashResult,
  type FileItem,
  type FileListItem,
  type KnowledgeItemStatus,
  type PaginatedFileList,
  type QueryFileListParams,
  type UploadFileParams,
} from '@/types/files';

interface KnowledgeItemRow {
  chunk_count: number | null;
  chunk_task_id: string | null;
  chunking_error: any | null;
  chunking_status: string | null;
  content: string | null;
  created_at: string;
  document_id: string | null;
  editor_data: any | null;
  embedding_error: any | null;
  embedding_status: string | null;
  embedding_task_id: string | null;
  file_id: string | null;
  file_type: string;
  finish_embedding: boolean;
  id: string;
  metadata: any | null;
  name: string;
  size: number;
  slug: string | null;
  source_type: string;
  updated_at: string;
  url: string;
}

const isDev = process.env.NODE_ENV === 'development';

const resolveFileAccessUrl = (fileId: string | null, rawUrl: string): string => {
  if (!isDev && fileId) {
    return `${window.location.origin}/f/${fileId}`;
  }
  return rawUrl;
};

const mapRowToFileListItem = (row: KnowledgeItemRow): FileListItem => ({
  chunkCount: row.chunk_count,
  chunkingError: row.chunking_error,
  chunkingStatus: row.chunking_status as any,
  content: row.content,
  createdAt: new Date(row.created_at),
  editorData: row.editor_data,
  embeddingError: row.embedding_error,
  embeddingStatus: row.embedding_status as any,
  fileType: row.file_type,
  finishEmbedding: row.finish_embedding,
  id: row.id,
  metadata: row.metadata,
  name: row.name,
  parentId: null,
  size: Number(row.size),
  slug: row.slug,
  sourceType: row.source_type,
  updatedAt: new Date(row.updated_at),
  url: resolveFileAccessUrl(row.file_id, row.url),
});

export class FileService {
  createFile = async (
    params: UploadFileParams & { parentId?: string },
    knowledgeBaseId?: string,
  ): Promise<{ id: string; url: string }> => {
    const res = await egentFetch('/v1/files/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...params, knowledgeBaseId }),
    });
    if (!res.ok) throw new Error(`createFile failed: ${res.status}`);
    return res.json();
  };

  getFile = async (id: string): Promise<FileItem> => {
    const client = await getAlistClient();

    if (client) {
      try {
        const alistPath = id.startsWith('/') ? id.slice(1) : id;
        const res = await client.get(alistPath);
        const alistFile = res.data;
        const now = new Date(alistFile.modified);
        const downloadUrl = await client.downloadUrl(alistPath);
        return {
          createdAt: now,
          id,
          name: alistFile.name,
          size: alistFile.size,
          type: 'application/octet-stream',
          updatedAt: now,
          url: downloadUrl,
        };
      } catch (e) {
        console.warn('[file] AList getFile failed, falling back to TRPC:', e);
      }
    }

    const db = await getLobehubQueryClient();
    const [row] = await db.select('files', { where: { id }, size: 1, camelCase: false });

    if (!row) {
      throw new Error('file not found');
    }

    const r = row as {
      created_at: string;
      file_type: string;
      id: string;
      name: string;
      size: number;
      source: unknown;
      updated_at: string;
      url: string;
    };
    return {
      createdAt: new Date(r.created_at),
      id: r.id,
      name: r.name,
      size: r.size,
      source: (r.source as any) ?? undefined,
      type: r.file_type,
      updatedAt: new Date(r.updated_at),
      url: r.url,
    };
  };

  removeFile = async (id: string): Promise<void> => {
    const client = await getAlistClient();
    if (client) {
      const alistPath = id.startsWith('/') ? id.slice(1) : id;
      try {
        await client.remove([alistPath]);
      } catch (e) {
        console.warn('[file] AList removeFile failed:', e);
      }
    }

    try {
      await egentFetch('/v1/files/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
    } catch (e) {
      console.warn('[file] Go removeFile failed:', e);
    }
  };

  removeFiles = async (ids: string[]): Promise<void> => {
    const client = await getAlistClient();
    if (client) {
      const alistPaths = ids.map((id) => (id.startsWith('/') ? id.slice(1) : id));
      try {
        await client.remove(alistPaths);
      } catch (e) {
        console.warn('[file] AList removeFiles failed:', e);
      }
    }

    try {
      await egentFetch('/v1/files/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
    } catch (e) {
      console.warn('[file] Go removeFiles failed:', e);
    }
  };

  removeAllFiles = async () => {
    const client = await getAlistClient();
    if (client) {
      try {
        const listed = await client.list('/');
        const paths = listed.data.content.filter((f: any) => !f.is_dir).map((f: any) => f.name);
        if (paths.length > 0) {
          await client.remove(paths);
        }
      } catch (e) {
        console.warn('[file] AList removeAllFiles failed:', e);
      }
    }

    try {
      const db = await getLobehubQueryClient();
      const rows = await db.select('files', { size: 10000, camelCase: false });
      if (rows.length > 0) {
        const ids = rows.map((r: any) => r.id);
        await egentFetch('/v1/files/remove', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        });
      }
    } catch (e) {
      console.warn('[file] Go removeAllFiles failed:', e);
    }
  };

  getKnowledgeItems = async (params: QueryFileListParams): Promise<PaginatedFileList> => {
    const db = await getLobehubQueryClient();
    const limit = params.limit ?? 50;

    const queryParams: Record<string, string | number | boolean> = {
      size: limit + 1,
      ...getWorkspaceParams(),
    };
    if (params.knowledgeBaseId) queryParams.knowledgeBaseId = params.knowledgeBaseId;
    if (params.category) queryParams.category = params.category;
    if (params.q) queryParams.qPattern = `%${params.q}%`;
    if (params.parentId !== undefined) queryParams.parentId = params.parentId ?? 'null';
    if (params.showFilesInKnowledgeBase) queryParams.showFilesInKnowledgeBase = true;
    if (params.sorter) queryParams.sorter = params.sorter;
    if (params.sortType) queryParams.sortType = params.sortType;
    if (params.offset) queryParams.page = Math.floor(params.offset / limit) + 1;

    const rawRows = await db.query<KnowledgeItemRow>('lobehub', 'knowledgeItemsList', queryParams, {
      camelCase: false,
    });

    const hasMore = rawRows.length > limit;
    const rowsToProcess = hasMore ? rawRows.slice(0, limit) : rawRows;
    const items = rowsToProcess.map(mapRowToFileListItem);

    return { hasMore, items };
  };

  getKnowledgeItemStatusesByIds = async (ids: string[]): Promise<KnowledgeItemStatus[]> => {
    if (ids.length === 0) return [];

    const db = await getLobehubQueryClient();
    const rows = await db.query<KnowledgeItemStatus>(
      'lobehub',
      'knowledgeItemStatuses',
      {
        ids: [...new Set(ids)].join(','),
        ...getWorkspaceParams(),
      },
      { camelCase: false },
    );
    return rows;
  };

  resolveKnowledgeItemIds = async (params: QueryFileListParams) => {
    const db = await getLobehubQueryClient();
    const rows = (await db.query<{ id: string }>(
      'lobehub',
      'resolveKnowledgeItemIds',
      {
        fileIds: (params as any).fileIds?.join(',') ?? '',
      },
      { camelCase: false },
    )) as Array<{ id: string }>;
    const ids = rows.map((r) => r.id);
    return { ids, total: ids.length };
  };

  /**
   * Delete knowledge items by file id list.
   *
   * Stays on raw PrestClient — `knowledge_items` isn't in the SDK's
   * TableTypes (it's a view, not a base table).
   */
  deleteKnowledgeItemsByQuery = async (params: QueryFileListParams) => {
    const client = await getPrestClient();
    const fileIds = (params as any).fileIds;
    if (!fileIds?.length) return { count: 0 };
    const deleted = await client.delete('lobehub', 'public', 'knowledge_items', {
      file_id: { in: fileIds },
    });
    return { count: Array.isArray(deleted) ? deleted.length : 0 };
  };

  // V2.0 Migrate from getFileItem to getKnowledgeItem
  // This method handles both files (file_ prefix) and documents (docs_ prefix)
  getKnowledgeItem = async (id: string) => {
    // Detect type based on ID prefix
    if (id.startsWith('docs_')) {
      // Document (including folders) - use pREST direct select
      const db = await getLobehubQueryClient();
      const [doc] = await db.select('documents', { where: { id }, size: 1, camelCase: false });
      if (!doc) return null;

      const d = doc as {
        content: unknown;
        created_at: string;
        editor_data: unknown;
        file_type: string;
        filename: string | null;
        id: string;
        metadata: unknown;
        parent_id: string | null;
        slug: string | null;
        source: string | null;
        title: string | null;
        total_char_count: number;
        updated_at: string;
      };
      // Convert document to FileListItem format
      return {
        chunkCount: null,
        chunkingError: null,
        chunkingStatus: null,
        content: d.content,
        createdAt: d.created_at ? new Date(d.created_at) : new Date(),
        editorData: d.editor_data,
        embeddingError: null,
        embeddingStatus: null,
        fileType: d.file_type || CUSTOM_DOCUMENT_FILE_TYPE,
        finishEmbedding: false,
        id: d.id,
        metadata: d.metadata,
        name: d.title || d.filename || 'Untitled',
        parentId: d.parent_id,
        size: d.total_char_count || 0,
        slug: d.slug,
        sourceType: DERIVED_DOCUMENT_SOURCE_TYPE,
        updatedAt: d.updated_at ? new Date(d.updated_at) : new Date(),
        url: d.source || '',
      } as FileListItem;
    } else {
      // File - use pREST direct select
      const db = await getLobehubQueryClient();
      const [row] = await db.select('files', { where: { id }, size: 1, camelCase: false });
      if (!row) return null;

      const r = row as {
        created_at: string;
        embedding_task_id: string | null;
        file_type: string;
        id: string;
        name: string;
        size: number;
        updated_at: string;
        url: string;
      };
      return {
        chunkCount: 0,
        chunkingError: null,
        chunkingStatus: null,
        createdAt: new Date(r.created_at),
        embeddingError: null,
        embeddingStatus: null,
        fileType: r.file_type,
        finishEmbedding: r.embedding_task_id === null,
        id: r.id,
        name: r.name,
        size: r.size,
        sourceType: 'file' as const,
        updatedAt: new Date(r.updated_at),
        url: r.url,
      } as FileListItem;
    }
  };

  /**
   * Folder breadcrumb lookup.
   *
   * Stays on raw PrestClient — the template returns `{ breadcrumb: any[] }`
   * whose nested shape we don't want the SDK to transform.
   */
  getFolderBreadcrumb = async (slug: string) => {
    const client = await getPrestClient();
    const rows = await client.query<{ breadcrumb: any[] }>('lobehub', 'documentFolderBreadcrumb', {
      slug,
    });
    return rows[0]?.breadcrumb ?? [];
  };

  checkFileHash = async (hash: string): Promise<CheckFileHashResult> => {
    try {
      const db = await getLobehubQueryClient();
      const [row] = (await db.select('global_files', {
        where: { hash_id: hash },
        size: 1,
        camelCase: false,
      })) as Array<{ file_type?: string; metadata?: any; size?: number; url: string }>;
      if (!row) return { isExist: false, metadata: null, url: '' };
      return {
        isExist: true,
        url: row.url,
        fileType: row.file_type,
        size: row.size,
        metadata: row.metadata,
      } as CheckFileHashResult;
    } catch (e) {
      console.warn('[file] pREST checkFileHash failed:', e);
      return { isExist: false, metadata: null, url: '' };
    }
  };

  removeFileAsyncTask = async (id: string, type: 'embedding' | 'chunk') => {
    const db = await getLobehubQueryClient();
    const [file] = await db.select('files', { where: { id }, size: 1, camelCase: false });
    if (!file) return;

    const f = file as { chunk_task_id: string | null; embedding_task_id: string | null };
    const taskId = type === 'embedding' ? f.embedding_task_id : f.chunk_task_id;
    if (!taskId) return;

    const nullField = type === 'embedding' ? 'embedding_task_id' : 'chunk_task_id';
    await db.update('files', { id }, { [nullField]: null });
    await db.delete('async_tasks', { id: taskId });
  };

  updateFile = async (
    id: string,
    data: {
      metadata?: Record<string, any>;
      name?: string;
      parentId?: string | null;
    },
  ) => {
    const client = await getAlistClient();
    if (client && data.name) {
      try {
        const alistPath = id.startsWith('/') ? id.slice(1) : id;
        await client.rename(data.name, alistPath);
      } catch (e) {
        console.warn('[file] AList rename failed:', e);
      }
    }

    const db = await getLobehubQueryClient();
    const updateData: Record<string, any> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.parentId !== undefined) updateData.parent_id = data.parentId;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;
    await db.update('files', { id }, updateData);
  };

  getDownloadUrl = async (path: string): Promise<string> => {
    const client = await getAlistClient();
    if (!client) throw new Error('AList client not available');
    const relPath = path.startsWith('/') ? path.slice(1) : path;
    return client.downloadUrl(relPath);
  };
}

export const fileService = new FileService();
