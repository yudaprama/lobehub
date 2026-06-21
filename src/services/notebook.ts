import { type DocumentType } from '@lobechat/builtin-tool-notebook';
import type { AGENT_PLAN_FILE_TYPE } from '@lobechat/const';

import { getLobehubQueryClient } from '@/libs/prest/client';
import { lambdaClient } from '@/libs/trpc/client';

type ExtendedDocumentType = DocumentType | typeof AGENT_PLAN_FILE_TYPE;

interface CreateDocumentParams {
  content: string;
  description: string;
  metadata?: Record<string, any>;
  source?: string;
  sourceType?: 'file' | 'web' | 'api' | 'topic';
  title: string;
  topicId: string;
  type?: ExtendedDocumentType;
}

interface UpdateDocumentParams {
  append?: boolean;
  content?: string;
  description?: string;
  id: string;
  metadata?: Record<string, any>;
  title?: string;
}

interface ListDocumentsParams {
  topicId: string;
  type?: ExtendedDocumentType;
}

class NotebookService {
  createDocument = async (params: CreateDocumentParams) => {
    const db = await getLobehubQueryClient();
    const [doc] = await db.insert('documents', {
      content: params.content,
      description: params.description,
      file_type: 'markdown',
      metadata: params.metadata,
      source: params.source,
      source_type: params.sourceType,
      title: params.title,
      type: params.type,
    } as any);
    if (doc && params.topicId) {
      await db.insert('topic_documents', {
        document_id: doc.id,
        topic_id: params.topicId,
      });
    }
    return doc;
  };

  updateDocument = async (params: UpdateDocumentParams) => {
    const db = await getLobehubQueryClient();
    if (params.append) {
      const [existing] = await db.select('documents', {
        where: { id: params.id },
        size: 1,
        camelCase: false,
      });
      const e = existing as { content: string | null } | undefined;
      const newContent = (e?.content || '') + (params.content || '');
      const [row] = await db.update(
        'documents',
        { id: params.id },
        {
          ...params,
          content: newContent,
        },
      );
      return row;
    }
    const [row] = await db.update('documents', { id: params.id }, params);
    return row;
  };

  getDocument = async (id: string) => {
    const db = await getLobehubQueryClient();
    const rows = await db.select('documents', {
      where: { id },
      size: 1,
      camelCase: false,
    });
    return Array.isArray(rows) ? rows[0] : undefined;
  };

  listDocuments = async (params: ListDocumentsParams) => {
    const db = await getLobehubQueryClient();
    const links = await db.select('topic_documents', {
      where: { topic_id: params.topicId },
      camelCase: false,
    });
    if (!links.length) return [];
    const docIds = links.map((l: any) => l.document_id);
    return db.select('documents', {
      where: { id: { in: docIds }, ...(params.type ? { type: params.type } : {}) },
    });
  };

  // Stays on BFF — may have side effects via NotebookRuntimeService
  deleteDocument = async (id: string) => {
    return lambdaClient.notebook.deleteDocument.mutate({ id });
  };
}

export const notebookService = new NotebookService();
