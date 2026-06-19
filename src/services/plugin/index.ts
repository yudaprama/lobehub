import { type LobeTool, type ToolManifest } from '@lobechat/types';

import { getLobehubClient, getPrestClient } from '@/libs/prest/client';
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
    const db = await getLobehubClient();
    const existing = await db.select('user_installed_plugins', {
      where: { identifier: plugin.identifier },
      size: 1,
    });
    if (existing.length > 0) {
      await db.update(
        'user_installed_plugins',
        { identifier: plugin.identifier },
        {
          custom_params: plugin.customParams,
          manifest: plugin.manifest,
          settings: plugin.settings,
        },
      );
    } else {
      await db.insert('user_installed_plugins', {
        custom_params: plugin.customParams,
        identifier: plugin.identifier,
        manifest: plugin.manifest,
        settings: plugin.settings,
        type: plugin.type,
      });
    }
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
    const db = await getLobehubClient();
    await db.delete('user_installed_plugins', { identifier });
  };

  createCustomPlugin = async (customPlugin: LobeToolCustomPlugin): Promise<void> => {
    const db = await getLobehubClient();
    await db.insert('user_installed_plugins', {
      custom_params: customPlugin.customParams,
      identifier: customPlugin.id,
      manifest: customPlugin.manifest,
      settings: customPlugin.settings,
      type: 'customPlugin',
    });
  };

  updatePlugin = async (id: string, value: Partial<LobeToolCustomPlugin>): Promise<void> => {
    const db = await getLobehubClient();
    await db.update(
      'user_installed_plugins',
      { identifier: id },
      {
        custom_params: value.customParams,
        manifest: value.manifest,
        settings: value.settings,
      },
    );
  };

  updatePluginManifest = async (id: string, manifest: ToolManifest): Promise<void> => {
    const db = await getLobehubClient();
    await db.update('user_installed_plugins', { identifier: id }, { manifest });
  };

  removeAllPlugins = async (): Promise<void> => {
    const db = await getLobehubClient();
    await db.delete('user_installed_plugins', {});
  };

  updatePluginSettings = async (id: string, settings: any, _signal?: AbortSignal): Promise<void> => {
    const db = await getLobehubClient();
    await db.update('user_installed_plugins', { identifier: id }, { settings });
  };
}

export const pluginService = new PluginService();
