import { type ConnectorToolPermission } from '@/database/schemas';
import { getActiveWorkspaceId } from '@/business/client/hooks/useActiveWorkspaceId';
import { egentFetch } from '@/libs/egent/client';
import { getLobehubQueryClient } from '@/libs/prest/client';
import { lambdaClient } from '@/libs/trpc/client';

interface ConnectorCredentialsInput {
  apiKey?: string;
  headers?: Record<string, string>;
  token?: string;
  type: 'apikey' | 'bearer' | 'header';
}

interface CreateConnectorParams {
  credentials?: ConnectorCredentialsInput;
  identifier: string;
  isEnabled?: boolean;
  mcpConnectionType?: 'http' | 'stdio' | 'cloud';
  mcpServerUrl?: string;
  mcpStdioConfig?: { args?: string[]; command: string; env?: Record<string, string> };
  metadata?: Record<string, unknown>;
  name: string;
  oidcConfig?: Record<string, unknown>;
  sourceType: 'builtin' | 'custom' | 'marketplace';
}

class ConnectorService {
  /**
   * Tier 3: AES-GCM encrypt connector credentials via the egent keyvault (the
   * only part of connector CRUD pREST cannot do). Mirrors TS ConnectorModel
   * which stored encrypt(JSON.stringify(credentials)). Returns the ciphertext
   * string for the `user_connectors.credentials` column.
   */
  private encryptCredentials = async (credentials: ConnectorCredentialsInput): Promise<string> => {
    const res = await egentFetch('/v1/connector/credentials/encrypt', {
      body: JSON.stringify({ credentials }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    if (!res.ok) throw new Error(`connector encrypt failed: ${res.status}`);
    const data = await res.json();
    return data.ciphertext as string;
  };

  private decryptCredentials = async (ciphertext: string | null): Promise<ConnectorCredentialsInput | null> => {
    if (!ciphertext) return null;
    const res = await egentFetch('/v1/connector/credentials/decrypt', {
      body: JSON.stringify({ ciphertext }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    if (!res.ok) throw new Error(`connector decrypt failed: ${res.status}`);
    const data = await res.json();
    return (data.credentials as ConnectorCredentialsInput | null) ?? null;
  };
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
   * pREST select + egent keyvault decrypt. OAuth2 tokens (machine-managed) and
   * oidcConfig.clientSecret are stripped — same posture as the TS router.
   * Throws when the connector is not found (TS parity: NOT_FOUND).
   */
  getForEdit = async (id: string): Promise<any> => {
    const db = await getLobehubQueryClient();
    const rows = await db.select('user_connectors', { where: { id } });
    const row = (rows as any[])?.[0];
    if (!row) throw new Error(`Connector not found: ${id}`);

    const { credentials: _ciphertext, oidcConfig: rawOidc, ...rest } = row;
    const decrypted = await this.decryptCredentials(_ciphertext ?? null);
    // OAuth2 tokens are machine-managed — never returned; the UI only needs to
    // know an OAuth flow is configured (via oidcConfig presence).
    const safeCredentials = decrypted && (decrypted as any).type === 'oauth2' ? null : decrypted;
    const safeOidc = rawOidc ? { ...rawOidc, clientSecret: undefined } : rawOidc;

    return { ...rest, credentials: safeCredentials, oidcConfig: safeOidc };
  };

  /**
   * Create (or re-authorize) a connector. Idempotent on (user_id, identifier):
   * egent-encrypts credentials, then pREST upserts. Mirrors the TS router
   * (status resets to 'disconnected'; OAuth/sync promotes it back to 'connected').
   */
  create = async (params: CreateConnectorParams): Promise<{ id: string }> => {
    const db = await getLobehubQueryClient();

    const credentialsCiphertext = params.credentials
      ? await this.encryptCredentials(params.credentials)
      : null;

    const fields = {
      credentials: credentialsCiphertext,
      mcp_connection_type: params.mcpConnectionType ?? null,
      mcp_server_url: params.mcpServerUrl ?? null,
      mcp_stdio_config: params.mcpStdioConfig ?? null,
      metadata: params.metadata ?? null,
      name: params.name,
      oidc_config: params.oidcConfig ?? null,
    };

    // Idempotent: select-by-identifier (user_id auto-scoped) → update or insert.
    const existing = (await db.select('user_connectors', {
      where: { identifier: params.identifier },
    })) as any[];
    if (existing.length > 0) {
      await db.update(
        'user_connectors',
        { id: existing[0].id },
        { ...fields, is_enabled: params.isEnabled ?? true, status: 'disconnected' } as any,
      );
      return { id: existing[0].id };
    }

    const created = (await db.insert('user_connectors', {
      ...fields,
      identifier: params.identifier,
      is_enabled: params.isEnabled ?? true,
      source_type: params.sourceType,
      status: 'disconnected',
    } as any)) as any[];
    return { id: created?.[0]?.id };
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
    patch: {
      credentials?: ConnectorCredentialsInput | null;
      mcpConnectionType?: 'http' | 'stdio' | 'cloud';
      mcpServerUrl?: string;
      mcpStdioConfig?: { args?: string[]; command: string; env?: Record<string, string> };
      name?: string;
      isEnabled?: boolean;
      oidcConfig?: Record<string, unknown>;
    },
  ): Promise<void> => {
    const db = await getLobehubQueryClient();
    // Map the FE camelCase patch to snake_case columns. `oidcConfig` is still
    // dropped — it's machine-managed by the OAuth flow (Phase 4 egent endpoint).
    const {
      oidcConfig: _oidcConfig,
      credentials,
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
    // credentials: undefined → leave untouched; null → clear; object → egent-encrypt.
    if (credentials !== undefined) {
      safePatch.credentials = credentials ? await this.encryptCredentials(credentials) : null;
      if (credentials === null) safePatch.token_expires_at = null;
    }
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
