import { CUSTOM_DOCUMENT_FILE_TYPE, DERIVED_DOCUMENT_SOURCE_TYPE } from '@lobechat/const';

import { getAlistClient } from '@/libs/alist/client';
import { lambdaClient } from '@/libs/trpc/client';
import {
  type CheckFileHashResult,
  type FileItem,
  type FileListItem,
  type KnowledgeItemStatus,
  type QueryFileListParams,
  type QueryFileListSchemaType,
  type UploadFileParams,
} from '@/types/files';

interface CreateFileParams extends Omit<UploadFileParams, 'url'> {
  knowledgeBaseId?: string;
  parentId?: string;
  url: string;
}

export class FileService {
  createFile = async (
    params: UploadFileParams & { parentId?: string },
    knowledgeBaseId?: string,
  ): Promise<{ id: string; url: string }> => {
    return lambdaClient.file.createFile.mutate({ ...params, knowledgeBaseId } as CreateFileParams);
  };

  getFile = async (id: string): Promise<FileItem> => {
    const client = await getAlistClient();

    if (client) {
      try {
        const alistPath = id.startsWith('/') ? id : `/${id}`;
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

    const item = await lambdaClient.file.findById.query({ id });

    if (!item) {
      throw new Error('file not found');
    }

    return {
      createdAt: item.createdAt,
      id: item.id,
      name: item.name,
      size: item.size,
      source: item.source,
      type: item.fileType,
      updatedAt: item.updatedAt,
      url: item.url,
    };
  };

  removeFile = async (id: string): Promise<void> => {
    const client = await getAlistClient();
    if (client) {
      const alistPath = id.startsWith('/') ? id : `/${id}`;
      try {
        await client.remove([alistPath]);
      } catch (e) {
        console.warn('[file] AList removeFile failed:', e);
      }
    }

    try {
      await lambdaClient.file.removeFile.mutate({ id });
    } catch (e) {
      console.warn('[file] TRPC removeFile failed:', e);
    }
  };

  removeFiles = async (ids: string[]): Promise<void> => {
    const client = await getAlistClient();
    if (client) {
      const alistPaths = ids.map((id) => (id.startsWith('/') ? id : `/${id}`));
      try {
        await client.remove(alistPaths);
      } catch (e) {
        console.warn('[file] AList removeFiles failed:', e);
      }
    }

    try {
      await lambdaClient.file.removeFiles.mutate({ ids });
    } catch (e) {
      console.warn('[file] TRPC removeFiles failed:', e);
    }
  };

  removeAllFiles = async () => {
    const client = await getAlistClient();
    if (client) {
      try {
        const listed = await client.list('/');
        const paths = listed.data.content.filter((f) => !f.is_dir).map((f) => `/${f.name}`);
        if (paths.length > 0) {
          await client.remove(paths);
        }
      } catch (e) {
        console.warn('[file] AList removeAllFiles failed:', e);
      }
    }

    try {
      await lambdaClient.file.removeAllFiles.mutate();
    } catch (e) {
      console.warn('[file] TRPC removeAllFiles failed:', e);
    }
  };

  // V2.0 Migrate from getFiles to getKnowledgeItems
  getKnowledgeItems = async (params: QueryFileListParams) => {
    return lambdaClient.file.getKnowledgeItems.query(params as QueryFileListSchemaType);
  };

  getKnowledgeItemStatusesByIds = async (ids: string[]): Promise<KnowledgeItemStatus[]> => {
    return lambdaClient.file.getKnowledgeItemStatusesByIds.query({ ids });
  };

  resolveKnowledgeItemIds = async (params: QueryFileListParams) => {
    return lambdaClient.file.resolveKnowledgeItemIds.query(params as QueryFileListSchemaType);
  };

  deleteKnowledgeItemsByQuery = async (params: QueryFileListParams) => {
    return lambdaClient.file.deleteKnowledgeItemsByQuery.mutate(params as QueryFileListSchemaType);
  };

  // V2.0 Migrate from getFileItem to getKnowledgeItem
  // This method handles both files (file_ prefix) and documents (docs_ prefix)
  getKnowledgeItem = async (id: string) => {
    // Detect type based on ID prefix
    if (id.startsWith('docs_')) {
      // Document (including folders) - use document endpoint
      const doc = await lambdaClient.document.getDocumentById.query({ id });
      if (!doc) return null;

      // Convert document to FileListItem format
      return {
        chunkCount: null,
        chunkingError: null,
        chunkingStatus: null,
        content: doc.content,
        createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
        editorData: doc.editorData,
        embeddingError: null,
        embeddingStatus: null,
        fileType: doc.fileType || CUSTOM_DOCUMENT_FILE_TYPE,
        finishEmbedding: false,
        id: doc.id,
        metadata: doc.metadata,
        name: doc.title || doc.filename || 'Untitled',
        parentId: doc.parentId,
        size: doc.totalCharCount || 0,
        slug: doc.slug,
        sourceType: DERIVED_DOCUMENT_SOURCE_TYPE,
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt) : new Date(),
        url: doc.source || '',
      } as FileListItem;
    } else {
      // File - use dedicated file endpoint
      return lambdaClient.file.getFileItemById.query({ id });
    }
  };

  getFolderBreadcrumb = async (slug: string) => {
    return lambdaClient.document.getFolderBreadcrumb.query({ slug });
  };

  checkFileHash = async (hash: string): Promise<CheckFileHashResult> => {
    try {
      return await lambdaClient.file.checkFileHash.mutate({ hash });
    } catch (e) {
      console.warn('[file] TRPC checkFileHash failed:', e);
      return { isExist: false, metadata: null, url: '' };
    }
  };

  removeFileAsyncTask = async (id: string, type: 'embedding' | 'chunk') => {
    return lambdaClient.file.removeFileAsyncTask.mutate({ id, type });
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
        const alistPath = id.startsWith('/') ? id : `/${id}`;
        await client.rename(data.name, alistPath);
      } catch (e) {
        console.warn('[file] AList rename failed:', e);
      }
    }

    return lambdaClient.file.updateFile.mutate({ id, ...data });
  };

  getRecentFiles = async (limit?: number) => {
    return lambdaClient.file.recentFiles.query({ limit });
  };

  getRecentPages = async (limit?: number) => {
    return lambdaClient.file.recentPages.query({ limit });
  };

  transferEntity = async (
    id: string,
    entityType: 'document' | 'file' | 'folder',
    targetWorkspaceId: string | null,
  ) => {
    return lambdaClient.file.transferEntity.mutate({ entityType, id, targetWorkspaceId });
  };

  copyEntityToWorkspace = async (
    id: string,
    entityType: 'document' | 'file' | 'folder',
    targetWorkspaceId: string | null,
  ) => {
    return lambdaClient.file.copyEntityToWorkspace.mutate({ entityType, id, targetWorkspaceId });
  };

  getDownloadUrl = async (path: string): Promise<string> => {
    const client = await getAlistClient();
    if (!client) throw new Error('AList client not available');
    return client.downloadUrl(path);
  };
}

export const fileService = new FileService();
