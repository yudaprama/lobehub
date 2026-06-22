import { type ConnectorToolPermission } from '@/database/schemas';
import { getLobehubQueryClient } from '@/libs/prest/client';
import { lambdaClient } from '@/libs/trpc/client';

class ConnectorService {
  /**
   * List all connectors with their tools (credentials stripped server-side).
   */
  list = (): Promise<any[]> => {
    return lambdaClient.connector.list.query();
  };

  /**
   * Return the connector with decrypted user-set credentials for the edit form.
   * Does NOT update the store — caller uses the result directly.
   */
  getForEdit = (id: string) => {
    return lambdaClient.connector.getForEdit.query({ id });
  };

  create = (
    params: Parameters<typeof lambdaClient.connector.create.mutate>[0],
  ): Promise<{ id: string }> => {
    return lambdaClient.connector.create.mutate(params);
  };

  /**
   * Begin the OAuth authorization-code flow and return the authorize URL.
   */
  startOAuth = async (id: string): Promise<string> => {
    const { authorizationUrl } = await lambdaClient.connector.startOAuth.mutate({ id });
    return authorizationUrl;
  };

  delete = async (id: string): Promise<void> => {
    const db = await getLobehubQueryClient();
    await db.delete('user_connectors', { id });
  };

  update = (
    id: string,
    patch: Parameters<typeof lambdaClient.connector.update.mutate>[0]['patch'],
  ): Promise<void> => {
    return lambdaClient.connector.update.mutate({ id, patch: patch as any });
  };

  syncTools = (id: string) => {
    return lambdaClient.connector.syncTools.mutate({ id });
  };

  resetPermissions = (id: string) => {
    return lambdaClient.connector.resetPermissions.mutate({ id });
  };

  /**
   * Sync tools from a client-provided list (Lobehub OAuth skills / Composio).
   */
  syncToolsFromClient = (params: {
    identifier: string;
    name: string;
    sourceType: 'builtin' | 'custom' | 'marketplace';
    tools: Array<{ description?: string; inputSchema?: Record<string, unknown>; toolName: string }>;
  }): Promise<{ connectorId: string }> => {
    return lambdaClient.connector.syncToolsFromClient.mutate(params);
  };

  syncBuiltinTool = (identifier: string): Promise<{ connectorId: string }> => {
    return lambdaClient.connector.syncBuiltinTool.mutate({ identifier });
  };

  syncPluginTools = (identifier: string): Promise<{ connectorId: string }> => {
    return lambdaClient.connector.syncPluginTools.mutate({ identifier });
  };

  updateToolPermission = (toolId: string, permission: ConnectorToolPermission): Promise<void> => {
    return lambdaClient.connector.updateToolPermission.mutate({ permission, toolId });
  };
}

export const connectorService = new ConnectorService();
