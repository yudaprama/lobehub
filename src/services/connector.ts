import { type ConnectorToolPermission } from '@/database/schemas';
import { getActiveWorkspaceId } from '@/business/client/hooks/useActiveWorkspaceId';
import { getLobehubQueryClient } from '@/libs/prest/client';
import { lambdaClient } from '@/libs/trpc/client';

class ConnectorService {
  /**
   * List all connectors with their tools nested (secrets stripped server-side
   * by the `connectorsListWithTools` Tier 2 template). Was lambdaClient.connector.list.
   */
  list = async (): Promise<any[]> => {
    const db = await getLobehubQueryClient();
    const params: Record<string, string> = {};
    const workspaceId = getActiveWorkspaceId();
    if (workspaceId) params.workspaceId = workspaceId;
    return db.query('lobehub', 'connectorsListWithTools', params);
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

  update = async (
    id: string,
    patch: Parameters<typeof lambdaClient.connector.update.mutate>[0]['patch'],
  ): Promise<void> => {
    const db = await getLobehubQueryClient();
    // Map the FE camelCase patch to snake_case columns. `credentials` and
    // `oidcConfig` are intentionally dropped here: credentials are AES-GCM
    // encrypted at rest (needs the keyvault) and oidcConfig is machine-managed
    // by the OAuth flow — both require egent /v1/connector/update (Phase 2).
    // Dropping them guarantees no plaintext ever lands in the ciphertext column.
    const {
      credentials: _credentials,
      oidcConfig: _oidcConfig,
      mcpConnectionType,
      mcpServerUrl,
      mcpStdioConfig,
      isEnabled,
      ...rest
    } = (patch ?? {}) as any;
    const safePatch: Record<string, unknown> = { ...rest };
    if (isEnabled !== undefined) safePatch.is_enabled = isEnabled;
    if (mcpServerUrl !== undefined) safePatch.mcp_server_url = mcpServerUrl;
    if (mcpConnectionType !== undefined) safePatch.mcp_connection_type = mcpConnectionType;
    if (mcpStdioConfig !== undefined) safePatch.mcp_stdio_config = mcpStdioConfig;
    await db.update('user_connectors', { id }, safePatch as any);
  };

  syncTools = (id: string) => {
    return lambdaClient.connector.syncTools.mutate({ id });
  };

  /**
   * Reset every tool's permission for a connector back to 'auto' (re-enable).
   * Was a db.delete (wrong — deleted the tools) on the wrong column
   * (`connector_id`); the real column is `user_connector_id`. Bulk PUT now
   * mirrors ConnectorToolModel resetting each tool to 'auto'.
   */
  resetPermissions = async (id: string): Promise<void> => {
    const db = await getLobehubQueryClient();
    await db.update(
      'user_connector_tools',
      { user_connector_id: id },
      { permission: 'auto' } as any,
    );
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

  updateToolPermission = async (
    toolId: string,
    permission: ConnectorToolPermission,
  ): Promise<void> => {
    const db = await getLobehubQueryClient();
    await db.update('user_connector_tools', { id: toolId }, { permission } as any);
  };
}

export const connectorService = new ConnectorService();
