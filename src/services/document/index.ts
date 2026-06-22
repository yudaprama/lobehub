import { CUSTOM_DOCUMENT_FILE_TYPE } from '@lobechat/const';
import { type DocumentItem } from '@lobechat/database/schemas';
import type { Filter } from 'prest-js-sdk';

import { egentFetch, getEgentUrl } from '@/libs/egent/client';
import { idGenerator } from '@/libs/idGenerator';
import { getLobehubQueryClient, getPrestClient } from '@/libs/prest/client';
import { lambdaClient } from '@/libs/trpc/client';
import type {
  CompareHistoryItemsInput,
  CompareHistoryItemsOutput,
  GetHistoryItemInput,
  GetHistoryItemOutput,
  ListHistoryInput,
  ListHistoryOutput,
  SaveDocumentHistoryInput,
  SaveDocumentHistoryOutput,
  UpdateDocumentInput,
  UpdateDocumentOutput,
} from '@/server/routers/lambda/_schema/documentHistory';

import { abortableRequest } from '../utils/abortableRequest';

const serializeSavedAt = (savedAt: Date | string) =>
  savedAt instanceof Date ? savedAt.toISOString() : savedAt;

type SerializedSavedAt<T extends { savedAt: Date | string }> = Omit<T, 'savedAt'> & {
  savedAt: string;
};

const serializeHistoryTimestamp = <T extends { savedAt: Date | string }>(
  result: T,
): SerializedSavedAt<T> => ({
  ...result,
  savedAt: serializeSavedAt(result.savedAt),
});

const serializeHistoryList = <
  T extends {
    items: Array<{
      id: string;
      isCurrent: boolean;
      saveSource: ListHistoryOutput['items'][number]['saveSource'];
      savedAt: Date | string;
      userId: string;
    }>;
    nextBeforeSavedAt?: Date | string;
  },
>(
  result: T,
): ListHistoryOutput => ({
  ...result,
  items: result.items.map((item) => ({
    ...item,
    savedAt: serializeSavedAt(item.savedAt),
  })),
  nextBeforeSavedAt: result.nextBeforeSavedAt
    ? serializeSavedAt(result.nextBeforeSavedAt)
    : undefined,
});

const serializeHistoryItem = <
  T extends {
    editorData: GetHistoryItemOutput['editorData'];
    id: string;
    isCurrent: boolean;
    saveSource: GetHistoryItemOutput['saveSource'];
    savedAt: Date | string;
  },
>(
  result: T,
): GetHistoryItemOutput => serializeHistoryTimestamp(result);

const serializeHistoryComparison = <
  T extends {
    from: {
      editorData: CompareHistoryItemsOutput['from']['editorData'];
      id: string;
      isCurrent: boolean;
      saveSource: CompareHistoryItemsOutput['from']['saveSource'];
      savedAt: Date | string;
    };
    to: {
      editorData: CompareHistoryItemsOutput['to']['editorData'];
      id: string;
      isCurrent: boolean;
      saveSource: CompareHistoryItemsOutput['to']['saveSource'];
      savedAt: Date | string;
    };
  },
>(
  result: T,
): CompareHistoryItemsOutput => ({
  from: serializeHistoryTimestamp(result.from),
  to: serializeHistoryTimestamp(result.to),
});

export interface CreateDocumentParams {
  content?: string;
  editorData: string;
  fileType?: string;
  knowledgeBaseId?: string;
  metadata?: Record<string, any>;
  parentId?: string;
  slug?: string;
  title: string;
}

export interface ListDocumentHistoryParams extends ListHistoryInput {}

export interface GetDocumentHistoryItemParams extends GetHistoryItemInput {}

export interface CompareDocumentHistoryItemsParams extends CompareHistoryItemsInput {}

export interface UpdateDocumentParams extends UpdateDocumentInput {}

export interface DocumentHistoryClientSurface {
  compareDocumentHistoryItems: (
    params: CompareDocumentHistoryItemsParams,
  ) => Promise<CompareHistoryItemsOutput>;
  getDocumentHistoryItem: (
    params: GetDocumentHistoryItemParams,
    uniqueKey?: string,
  ) => Promise<GetHistoryItemOutput>;
  listDocumentHistory: (params: ListDocumentHistoryParams) => Promise<ListHistoryOutput>;
  saveDocumentHistory: (params: SaveDocumentHistoryInput) => Promise<SaveDocumentHistoryOutput>;
  updateDocument: (params: UpdateDocumentParams) => Promise<UpdateDocumentOutput>;
}

const autosavedOnceIds = new Set<string>();

export class DocumentService {
  async createDocument(params: CreateDocumentParams): Promise<DocumentItem> {
    const db = await getLobehubQueryClient();
    const id = idGenerator('documents');
    await db.insert('documents', {
      id,
      title: params.title,
      content: params.content ?? null,
      editor_data: params.editorData ?? null,
      file_type: params.fileType ?? 'markdown',
      metadata: params.metadata ?? null,
      parent_id: params.parentId ?? null,
      slug: params.slug ?? null,
      knowledge_base_id: params.knowledgeBaseId ?? null,
    } as any);
    return { id } as DocumentItem;
  }

  async createDocuments(documents: CreateDocumentParams[]): Promise<DocumentItem[]> {
    const db = await getLobehubQueryClient();
    const results = await Promise.all(
      documents.map(async (params) => {
        const id = idGenerator('documents');
        await db.insert('documents', {
          id,
          title: params.title,
          content: params.content ?? null,
          editor_data: params.editorData ?? null,
          file_type: params.fileType ?? 'markdown',
          metadata: params.metadata ?? null,
          parent_id: params.parentId ?? null,
          slug: params.slug ?? null,
          knowledge_base_id: params.knowledgeBaseId ?? null,
        } as any);
        return { id } as DocumentItem;
      }),
    );
    return results;
  }

  async queryDocuments(params?: {
    current?: number;
    fileTypes?: string[];
    pageSize?: number;
    sourceTypes?: string[];
  }): Promise<{ items: DocumentItem[]; total: number }> {
    const client = await getPrestClient();

    const where: Filter = {};
    if (params?.fileTypes?.length) where.file_type = { in: params.fileTypes };
    if (params?.sourceTypes?.length) where.source_type = { in: params.sourceTypes };

    const page = (params?.current ?? 0) + 1;
    const size = params?.pageSize ?? 20;

    const [items, countRows] = await Promise.all([
      client.select<DocumentItem>('lobehub', 'public', 'documents', {
        camelCase: true,
        order: ['updated_at:desc'],
        page,
        size,
        where: Object.keys(where).length ? where : undefined,
      }),
      client.select<{ count: number }>('lobehub', 'public', 'documents', {
        count: true,
        where: Object.keys(where).length ? where : undefined,
      }),
    ]);

    const total = (Array.isArray(countRows) ? countRows[0]?.count : 0) ?? 0;

    return { items, total };
  }

  async listDocumentHistory(params: ListDocumentHistoryParams): Promise<ListHistoryOutput> {
    const db = await getLobehubQueryClient();

    const queryParams: Record<string, string | number | boolean> = {
      documentId: params.documentId,
      limit: String(params.limit ?? 20),
    };
    if (params.beforeSavedAt) queryParams.beforeSavedAt = params.beforeSavedAt;
    if (params.beforeId) queryParams.beforeId = params.beforeId;

    const rows = await db.query<{
      id: string;
      documentId: string;
      editorData: any;
      saveSource: string;
      savedAt: string;
    }>('lobehub', 'documentsWithHistory', queryParams);

    const items = rows as unknown as ListHistoryOutput['items'];
    const lastItem = items.at(-1);
    const nextBeforeSavedAt = lastItem?.savedAt ?? undefined;

    return { items, nextBeforeSavedAt };
  }

  async getDocumentHistoryItem(
    params: GetDocumentHistoryItemParams,
    uniqueKey?: string,
  ): Promise<GetHistoryItemOutput> {
    const fetchHistoryItem = async (signal?: AbortSignal) => {
      const url = new URL(`${getEgentUrl()}/v1/documents/history/item`);
      url.searchParams.set('documentId', params.documentId);
      url.searchParams.set('historyId', params.historyId);
      const res = await egentFetch(url.pathname + url.search, { signal });
      if (!res.ok) throw new Error(`getDocumentHistoryItem failed: ${res.status}`);
      const result = await res.json();
      return serializeHistoryItem(result);
    };

    if (uniqueKey) {
      return abortableRequest.execute(uniqueKey, (signal) => fetchHistoryItem(signal));
    }

    return fetchHistoryItem();
  }

  async compareDocumentHistoryItems(
    params: CompareDocumentHistoryItemsParams,
  ): Promise<CompareHistoryItemsOutput> {
    const url = new URL(`${getEgentUrl()}/v1/documents/history/compare`);
    url.searchParams.set('documentId', params.documentId);
    url.searchParams.set('fromHistoryId', params.fromHistoryId);
    url.searchParams.set('toHistoryId', params.toHistoryId);
    const res = await egentFetch(url.pathname + url.search);
    if (!res.ok) throw new Error(`compareDocumentHistoryItems failed: ${res.status}`);
    const result = await res.json();

    return serializeHistoryComparison(result);
  }

  async getPageDocuments(pageSize: number = 20): Promise<DocumentItem[]> {
    const result = await this.queryDocuments({
      current: 0,
      fileTypes: [CUSTOM_DOCUMENT_FILE_TYPE, 'application/pdf'],
      pageSize,
      sourceTypes: ['editor', 'file', 'api'],
    });

    return result.items
      .filter(
        (doc) =>
          ['editor', 'file', 'api'].includes(doc.sourceType) &&
          [CUSTOM_DOCUMENT_FILE_TYPE, 'application/pdf'].includes(doc.fileType),
      )
      .map((doc) => ({ ...doc, filename: doc.filename ?? doc.title ?? 'Untitled' }));
  }

  async getDocumentById(id: string, uniqueKey?: string): Promise<DocumentItem | undefined> {
    if (uniqueKey) {
      // Use fixed key so switching documents cancels the previous request
      // This prevents race conditions where old document's data overwrites new document's editor
      return abortableRequest.execute(uniqueKey, async (signal) => {
        return new Promise<DocumentItem | undefined>((resolve, reject) => {
          const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
          if (signal?.aborted) {
            reject(new DOMException('Aborted', 'AbortError'));
            return;
          }
          signal?.addEventListener('abort', onAbort);

          getPrestClient()
            .then((client) =>
              client.select<DocumentItem>('lobehub', 'public', 'documents', {
                camelCase: true,
                where: { id },
                size: 1,
              }),
            )
            .then((rows) => {
              signal?.removeEventListener('abort', onAbort);
              resolve(Array.isArray(rows) ? rows[0] : undefined);
            }, reject);
        });
      });
    }

    const client = await getPrestClient();
    const rows = await client.select<DocumentItem>('lobehub', 'public', 'documents', {
      camelCase: true,
      where: { id },
      size: 1,
    });
    return Array.isArray(rows) ? rows[0] : undefined;
  }

  async deleteDocument(id: string): Promise<void> {
    await egentFetch('/v1/documents/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  }

  async deleteDocuments(ids: string[]): Promise<void> {
    await egentFetch('/v1/documents/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
  }

  async updateDocument(params: UpdateDocumentParams): Promise<UpdateDocumentOutput> {
    const isFirstAutosave = params.saveSource === 'autosave' && !autosavedOnceIds.has(params.id);
    const mutationParams = isFirstAutosave ? { ...params, breakAutosaveWindow: true } : params;
    const res = await egentFetch('/v1/documents/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mutationParams),
    });
    if (!res.ok) {
      if (res.status === 409) throw new Error('Document locked by another user');
      throw new Error(`updateDocument failed: ${res.status}`);
    }
    if (isFirstAutosave) autosavedOnceIds.add(params.id);
    const result = await res.json();

    return {
      ...result,
      savedAt: result.savedAt
        ? result.savedAt instanceof Date
          ? result.savedAt.toISOString()
          : result.savedAt
        : undefined,
    };
  }

  /**
   * Acquire or refresh the collaborative edit lock for a workspace page.
   * Doubles as the heartbeat. Personal pages always report as unlocked.
   */
  async acquireDocumentLock(id: string, ownerId?: string) {
    return lambdaClient.document.acquireDocumentLock.mutate({ id, ownerId });
  }

  /** Read-only peek of the current edit lock (does not acquire). */
  async getDocumentLock(id: string, ownerId?: string) {
    return lambdaClient.document.getDocumentLock.query({ id, ownerId });
  }

  async releaseDocumentLock(id: string, ownerId?: string): Promise<void> {
    await lambdaClient.document.releaseDocumentLock.mutate({ id, ownerId });
  }

  async saveDocumentHistory(params: SaveDocumentHistoryInput): Promise<SaveDocumentHistoryOutput> {
    const res = await egentFetch('/v1/documents/history/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`saveDocumentHistory failed: ${res.status}`);
    const result = await res.json();

    return {
      savedAt: result.savedAt instanceof Date ? result.savedAt.toISOString() : result.savedAt,
    };
  }

  async transferDocument(documentId: string, targetWorkspaceId: string | null): Promise<void> {
    await lambdaClient.document.transferDocument.mutate({ documentId, targetWorkspaceId });
  }

  async copyDocumentToWorkspace(
    documentId: string,
    targetWorkspaceId: string | null,
  ): Promise<{ rootId: string }> {
    return lambdaClient.document.copyDocumentToWorkspace.mutate({ documentId, targetWorkspaceId });
  }
}

export const documentService = new DocumentService() as DocumentService &
  DocumentHistoryClientSurface;
