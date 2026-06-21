import { type LobeTool, type ToolManifest } from '@lobechat/types';

import { getLobehubQueryClient } from '@/libs/prest/client';
import { type LobeToolCustomPlugin } from '@/types/tool/plugin';

export interface InstallPluginParams {
  customParams?: Record<string, any>;
  identifier: string;
  manifest: ToolManifest;
  settings?: Record<string, any>;
  type: 'plugin' | 'customPlugin';
}

interface InstalledPluginRow {
  createdAt: string;
  customParams: Record<string, any> | null;
  identifier: string;
  manifest: ToolManifest | null;
  settings: Record<string, any> | null;
  source: string | null;
  type: 'plugin' | 'customPlugin';
  updatedAt: string;
  userId: string;
}

const toLobeTool = (row: InstalledPluginRow): LobeTool => ({
  identifier: row.identifier,
  manifest: row.manifest ?? undefined,
  settings: row.settings ?? undefined,
  type: row.type,
});

export class PluginService {
  installPlugin = async (plugin: InstallPluginParams): Promise<void> => {
    const db = await getLobehubQueryClient();
    const existing = await db.select('user_installed_plugins', {
      where: { identifier: (plugin as any).identifier },
      size: 1,
    });
    if (existing.length > 0) {
      await db.update('user_installed_plugins', { identifier: (plugin as any).identifier }, {
        custom_params: plugin.customParams,
        manifest: plugin.manifest,
        settings: plugin.settings,
      } as any);
    } else {
      await db.insert('user_installed_plugins', {
        custom_params: plugin.customParams,
        identifier: (plugin as any).identifier,
        manifest: plugin.manifest,
        settings: plugin.settings,
        type: plugin.type,
      } as any);
    }
  };

  getInstalledPlugins = async (): Promise<LobeTool[]> => {
    const db = await getLobehubQueryClient();
    const rows = await db.select('user_installed_plugins', {
      order: ['updated_at:desc'],
      size: 100,
    });

    return (Array.isArray(rows) ? (rows as unknown as InstalledPluginRow[]) : []).map(toLobeTool);
  };

  uninstallPlugin = async (identifier: string): Promise<void> => {
    const db = await getLobehubQueryClient();
    await db.delete('user_installed_plugins', { identifier });
  };

  createCustomPlugin = async (customPlugin: LobeToolCustomPlugin): Promise<void> => {
    const db = await getLobehubQueryClient();
    await db.insert('user_installed_plugins', {
      custom_params: customPlugin.customParams,
      identifier: (customPlugin as any).id,
      manifest: customPlugin.manifest,
      settings: customPlugin.settings,
      type: 'customPlugin',
    });
  };

  updatePlugin = async (id: string, value: Partial<LobeToolCustomPlugin>): Promise<void> => {
    const db = await getLobehubQueryClient();
    await db.update('user_installed_plugins', { identifier: id }, {
      custom_params: value.customParams,
      manifest: value.manifest,
      settings: value.settings,
    } as any);
  };

  updatePluginManifest = async (id: string, manifest: ToolManifest): Promise<void> => {
    const db = await getLobehubQueryClient();
    await db.update('user_installed_plugins', { identifier: id }, { manifest } as any);
  };

  removeAllPlugins = async (): Promise<void> => {
    const db = await getLobehubQueryClient();
    await db.delete('user_installed_plugins', {});
  };

  updatePluginSettings = async (
    id: string,
    settings: any,
    _signal?: AbortSignal,
  ): Promise<void> => {
    const db = await getLobehubQueryClient();
    await db.update('user_installed_plugins', { identifier: id }, { settings } as any);
  };
}

export const pluginService = new PluginService();
