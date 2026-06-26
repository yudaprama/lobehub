import { egentFetch } from '@/libs/egent/client';
import { getLobehubQueryClient } from '@/libs/prest/client';

/**
 * Single chokepoint for Composio connector operations.
 *
 * Replaces the `lambdaClient.composio.*` tRPC router. The work is split
 * across two backends per the migration tiers (see AGENTS.md rule #1/#5):
 *
 *   - **OAuth / connection lifecycle** (Tier 3, external Composio API) →
 *     egent-lobehub `/v1/composio/*` via `egentFetch`. These genuinely need
 *     Go: they call Composio's REST API and mint OAuth links.
 *   - **Plugin persistence** (Tier 1 CRUD) → pREST `user_installed_plugins`
 *     via `getLobehubQueryClient()`. The egent `/v1/composio/plugins*`
 *     handlers are stubs (return `[]`, no DB write), and per rule #1 simple
 *     CRUD must NOT go through a Go handler. So the frontend persists here.
 *
 * Mirrors `apps/server/src/routers/lambda/composio.ts` (the `PluginModel`
 * path) for `user_installed_plugins` rows: `source: 'composio'`,
 * `type: 'plugin'`, `custom_params.composio`, and a `manifest` carrying the
 * tool list as `api[]`.
 */

interface CreateConnectionParams {
  appSlug: string;
  identifier: string;
  label: string;
}

interface CreateConnectionResult {
  authConfigId: string;
  connectedAccountId: string;
  identifier: string;
  redirectUrl: string;
}

interface GetConnectionResult {
  appSlug?: string;
  connectedAccountId: string;
  error?: 'AUTH_ERROR';
  status: string;
}

interface UpdatePluginParams {
  appSlug: string;
  authConfigId: string;
  connectedAccountId: string;
  identifier: string;
  label: string;
  redirectUrl?: string;
  status: string;
  tools: { description?: string; inputSchema?: unknown; name: string }[];
}

interface InstalledComposioPlugin {
  customParams?: { composio?: Record<string, any> } | null;
  identifier: string;
  manifest?: { api?: { description?: string; name: string; parameters?: unknown }[] } | null;
}

interface ComposioAction {
  description?: string;
  inputSchema?: unknown;
  name: string;
}

interface ExecuteActionParams {
  identifier: string;
  toolArgs?: Record<string, unknown>;
  toolSlug: string;
}

// Matches MCPService.processToolCallResult, consumed by the chat-plugin
// executor (store/chat/slices/plugin/actions/exector.ts).
interface ExecuteActionResult {
  content: string;
  state: { content: { text: string; type: string }[]; isError: boolean };
  success: boolean;
}

const buildManifest = (
  identifier: string,
  label: string,
  tools: UpdatePluginParams['tools'],
  existingMeta?: Record<string, unknown>,
) => ({
  api: tools.map((tool) => ({
    description: tool.description || '',
    name: tool.name,
    parameters: tool.inputSchema || { properties: {}, type: 'object' },
  })),
  identifier,
  meta: existingMeta || {
    avatar: '🔌',
    description: `Composio: ${label}`,
    title: label,
  },
  type: 'default',
});

class ComposioService {
  /**
   * Start a Composio OAuth connection. Calls egent (Tier 3) to mint the
   * auth-config + OAuth link, then persists a PENDING plugin row to pREST so
   * the connection survives a reload (mirrors the TS `pluginModel.create`).
   */
  async createConnection(params: CreateConnectionParams): Promise<CreateConnectionResult> {
    const res = await egentFetch('/v1/composio/connections', {
      body: JSON.stringify(params),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    if (!res.ok) throw new Error(`composio createConnection failed: ${res.status}`);
    const data = (await res.json()) as CreateConnectionResult;

    const db = await getLobehubQueryClient();
    await db.insert('user_installed_plugins', {
      custom_params: {
        composio: {
          appSlug: params.appSlug,
          authConfigId: data.authConfigId,
          connectedAccountId: data.connectedAccountId,
          redirectUrl: data.redirectUrl,
          status: 'PENDING',
        },
      },
      identifier: params.identifier,
      manifest: buildManifest(params.identifier, params.label, []),
      source: 'composio',
      type: 'plugin',
    } as any);

    return data;
  }

  /** Poll the live Composio connection status (Tier 3, egent). */
  async getConnection(params: { connectedAccountId: string }): Promise<GetConnectionResult> {
    const res = await egentFetch('/v1/composio/connections/poll', {
      body: JSON.stringify(params),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    if (!res.ok) throw new Error(`composio getConnection failed: ${res.status}`);
    return (await res.json()) as GetConnectionResult;
  }

  /**
   * Upsert the persisted plugin row once a connection becomes ACTIVE and its
   * tools are known (Tier 1 pREST — mirrors TS `updateComposioPlugin`).
   */
  async updateComposioPlugin(params: UpdatePluginParams): Promise<{ savedCount: number }> {
    const {
      appSlug,
      authConfigId,
      connectedAccountId,
      identifier,
      label,
      redirectUrl,
      status,
      tools,
    } = params;
    const db = await getLobehubQueryClient();

    const existing = await db.select('user_installed_plugins', {
      where: { identifier },
    });

    const customParams = {
      composio: { appSlug, authConfigId, connectedAccountId, redirectUrl, status },
    };
    const existingMeta = (existing[0] as InstalledComposioPlugin | undefined)?.manifest as any;
    const manifest = buildManifest(identifier, label, tools, existingMeta?.meta);

    if (existing.length > 0) {
      await db.update('user_installed_plugins', { identifier }, {
        custom_params: customParams,
        manifest,
      } as any);
    } else {
      await db.insert('user_installed_plugins', {
        custom_params: customParams,
        identifier,
        manifest,
        source: 'composio',
        type: 'plugin',
      } as any);
    }

    return { savedCount: tools.length };
  }

  /**
   * Revoke the remote Composio connection (Tier 3, egent) then delete the
   * local plugin row (Tier 1 pREST). Both are best-effort in the caller.
   */
  async deleteConnection(params: {
    connectedAccountId: string;
    identifier: string;
  }): Promise<void> {
    await egentFetch('/v1/composio/connections/delete', {
      body: JSON.stringify({ connectedAccountId: params.connectedAccountId }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });

    const db = await getLobehubQueryClient();
    await db.delete('user_installed_plugins', { identifier: params.identifier });
  }

  /** Read installed Composio plugins from pREST (Tier 1). */
  async getComposioPlugins(): Promise<InstalledComposioPlugin[]> {
    const db = await getLobehubQueryClient();
    const rows = await db.select('user_installed_plugins', {
      where: { source: 'composio' },
    });
    return rows as unknown as InstalledComposioPlugin[];
  }

  /**
   * List a Composio app's actions (Tier 3, egent → Composio API). One endpoint
   * serves both the pre-connect browse (`useFetchAppTools`) and the post-ACTIVE
   * tool fetch (`refreshComposioConnectionStatus`) — they were the identical
   * `getActions` / `listActions` tRPC procedures.
   */
  async getActions(appSlug: string): Promise<{ tools: ComposioAction[] }> {
    const res = await egentFetch(`/v1/composio/tools?appSlug=${encodeURIComponent(appSlug)}`, {
      headers: { 'Content-Type': 'application/json' },
      method: 'GET',
    });
    if (!res.ok) throw new Error(`composio getActions failed: ${res.status}`);
    return (await res.json()) as { tools: ComposioAction[] };
  }

  /**
   * Execute a Composio action on behalf of the caller's own connection
   * (Tier 3, egent). The server resolves `connectedAccountId` from the
   * caller's `user_installed_plugins` row — a client-supplied id is never
   * trusted, so one user cannot drive another user's connection.
   */
  async executeAction(params: ExecuteActionParams): Promise<ExecuteActionResult> {
    const res = await egentFetch('/v1/composio/tools/execute', {
      body: JSON.stringify(params),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    if (!res.ok) throw new Error(`composio executeAction failed: ${res.status}`);
    return (await res.json()) as ExecuteActionResult;
  }
}

export const composioService = new ComposioService();
