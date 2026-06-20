import { type LobeTool, type ToolManifest } from '@lobechat/types';

import { getPrestClient } from '@/libs/prest/client';
import { lambdaClient } from '@/libs/trpc/client';
import { type LobeToolCustomPlugin } from '@/types/tool/plugin';

export interface InstallPluginParams {
  customParams?: Record<string, any>;
  identifier: string;
  manifest: ToolManifest;
  settings?: Record<string, any>;
  type: 'plugin' | 'customPlugin';
}

interface InstalledPluginRow {
  created_at: string;
  custom_params: Record<string, any> | null;
  identifier: string;
  manifest: ToolManifest | null;
  settings: Record<string, any> | null;
  source: string | null;
  type: 'plugin' | 'customPlugin';
  updated_at: string;
  user_id: string;
}

const toLobeTool = (row: InstalledPluginRow): LobeTool => ({
  identifier: row.identifier,
  manifest: row.manifest ?? undefined,
  settings: row.settings ?? undefined,
  type: row.type,
});

export class PluginService {
  installPlugin = async (plugin: InstallPluginParams): Promise<void> => {
    await lambdaClient.plugin.createOrInstallPlugin.mutate(plugin);
  };

  getInstalledPlugins = async (): Promise<LobeTool[]> => {
    const client = await getPrestClient();
    const rows = await client.select<InstalledPluginRow>(
      'lobehub',
      'public',
      'user_installed_plugins',
      {
        order: ['updated_at:desc'],
        size: 100,
      },
    );

    return (Array.isArray(rows) ? rows : []).map(toLobeTool);
  };

  uninstallPlugin = async (identifier: string): Promise<void> => {
    await lambdaClient.plugin.removePlugin.mutate({ id: identifier });
  };

  createCustomPlugin = async (customPlugin: LobeToolCustomPlugin): Promise<void> => {
    await lambdaClient.plugin.createPlugin.mutate({ ...customPlugin, type: 'customPlugin' });
  };

  updatePlugin = async (id: string, value: Partial<LobeToolCustomPlugin>): Promise<void> => {
    await lambdaClient.plugin.updatePlugin.mutate({
      customParams: value.customParams,
      id,
      manifest: value.manifest,
      settings: value.settings,
    });
  };

  updatePluginManifest = async (id: string, manifest: ToolManifest): Promise<void> => {
    await lambdaClient.plugin.updatePlugin.mutate({ id, manifest });
  };

  removeAllPlugins = async (): Promise<void> => {
    await lambdaClient.plugin.removeAllPlugins.mutate();
  };

  updatePluginSettings = async (id: string, settings: any, signal?: AbortSignal): Promise<void> => {
    await lambdaClient.plugin.updatePlugin.mutate({ id, settings }, { signal });
  };
}

export const pluginService = new PluginService();
