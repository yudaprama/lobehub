import { getLobehubQueryClient } from '@/libs/prest/client';
import { lambdaClient } from '@/libs/trpc/client';
import { type SemanticSearchSchemaType } from '@/types/rag';

class RAGService {
  parseFileContent = async (id: string, skipExist?: boolean) => {
    return lambdaClient.document.parseFileContent.mutate({ id, skipExist });
  };

  createParseFileTask = async (id: string, skipExist?: boolean) => {
    return lambdaClient.chunk.createParseFileTask.mutate({ id, skipExist });
  };

  retryParseFile = async (id: string) => {
    return lambdaClient.chunk.retryParseFileTask.mutate({ id });
  };

  createEmbeddingChunksTask = async (id: string) => {
    return lambdaClient.chunk.createEmbeddingChunksTask.mutate({ id });
  };

  semanticSearch = async (query: string, fileIds?: string[]) => {
    return lambdaClient.chunk.semanticSearch.mutate({ fileIds, query });
  };

  semanticSearchForChat = async (params: SemanticSearchSchemaType, signal?: AbortSignal) => {
    return lambdaClient.chunk.semanticSearchForChat.mutate(params, { signal });
  };

  getFileContents = async (fileIds: string[], signal?: AbortSignal) => {
    return lambdaClient.chunk.getFileContents.mutate({ fileIds }, { signal });
  };

  deleteMessageRagQuery = async (id: string) => {
    // Tier 1 delete: pREST auto-scopes by user_id; FK cascade removes the
    // child message_query_chunks rows (query_id → message_queries.id ON DELETE
    // CASCADE), so no BFF reshape is needed.
    const db = await getLobehubQueryClient();
    await db.delete('message_queries', { id });
    return { success: true };
  };
}

export const ragService = new RAGService();
