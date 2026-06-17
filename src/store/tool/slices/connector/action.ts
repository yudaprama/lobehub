import type { ConnectorToolPermission } from '@/database/schemas';
import { connectorService } from '@/services/connector';
import type { StoreSetter } from '@/store/types';

import type { ToolStore } from '../../store';

type Setter = StoreSetter<ToolStore>;

export const createConnectorSlice = (set: Setter, get: () => ToolStore, _api?: unknown) =>
  new ConnectorActionImpl(set, get, _api);

export class ConnectorActionImpl {
  readonly #set: Setter;

  constructor(set: Setter, _get: () => ToolStore, _api?: unknown) {
    void _api;
    this.#set = set;
  }

  fetchConnectors = async (): Promise<void> => {
    const data = await connectorService.list();
    this.#set({ connectors: data as any, isConnectorsInit: true }, false, 'fetchConnectors');
  };

  getConnectorForEdit = async (id: string) => {
    return connectorService.getForEdit(id);
  };

  createConnector = async (
    params: Parameters<typeof connectorService.create>[0],
  ): Promise<string> => {
    this.#set({ connectorCreating: true }, false, 'createConnector/start');
    try {
      const created = await connectorService.create(params);
      await this.fetchConnectors();
      return created.id;
    } finally {
      this.#set({ connectorCreating: false }, false, 'createConnector/end');
    }
  };

  startConnectorOAuth = async (id: string): Promise<string> => {
    return connectorService.startOAuth(id);
  };

  deleteConnector = async (id: string): Promise<void> => {
    await connectorService.delete(id);
    await this.fetchConnectors();
  };

  updateConnector = async (
    id: string,
    patch: {
      credentials?:
        | { token: string; type: 'bearer' }
        | { headers: Record<string, string>; type: 'header' }
        | null;
      isEnabled?: boolean;
      mcpServerUrl?: string;
      name?: string;
      oidcConfig?: {
        clientId?: string;
        clientSecret?: string;
        scheme?: 'pre_registration' | 'dcr' | 'client_id_metadata_document';
      };
    },
  ): Promise<void> => {
    await connectorService.update(id, patch as any);
    await this.fetchConnectors();
  };

  syncConnectorTools = async (id: string): Promise<void> => {
    this.#set(
      (s) => ({ connectorSyncing: { ...s.connectorSyncing, [id]: true } }),
      false,
      'syncConnectorTools/start',
    );
    try {
      await connectorService.syncTools(id);
      await this.fetchConnectors();
    } finally {
      this.#set(
        (s) => ({ connectorSyncing: { ...s.connectorSyncing, [id]: false } }),
        false,
        'syncConnectorTools/end',
      );
    }
  };

  disconnectConnector = async (id: string): Promise<void> => {
    await connectorService.update(id, { isEnabled: false });
    await this.fetchConnectors();
  };

  resetConnectorPermissions = async (id: string): Promise<void> => {
    await connectorService.resetPermissions(id);
    await this.fetchConnectors();
  };

  syncToolsFromClient = async (params: {
    identifier: string;
    name: string;
    sourceType: 'builtin' | 'custom' | 'marketplace';
    tools: Array<{ description?: string; inputSchema?: Record<string, unknown>; toolName: string }>;
  }): Promise<string> => {
    const result = await connectorService.syncToolsFromClient(params);
    await this.fetchConnectors();
    return result.connectorId;
  };

  syncBuiltinTool = async (identifier: string): Promise<string> => {
    const result = await connectorService.syncBuiltinTool(identifier);
    await this.fetchConnectors();
    return result.connectorId;
  };

  syncPluginTools = async (identifier: string): Promise<string> => {
    const result = await connectorService.syncPluginTools(identifier);
    await this.fetchConnectors();
    return result.connectorId;
  };

  updateToolPermission = async (
    toolId: string,
    permission: ConnectorToolPermission,
  ): Promise<void> => {
    // Optimistic update
    this.#set(
      (s) => ({
        connectors: s.connectors.map((c) => ({
          ...c,
          tools: c.tools.map((t) => (t.id === toolId ? { ...t, permission } : t)),
        })),
      }),
      false,
      'updateToolPermission/optimistic',
    );

    try {
      await connectorService.updateToolPermission(toolId, permission);
    } catch {
      // Roll back on error
      await this.fetchConnectors();
    }
  };
}

export type ConnectorAction = Pick<ConnectorActionImpl, keyof ConnectorActionImpl>;
