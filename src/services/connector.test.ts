import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/libs/prest/client', () => ({
  getLobehubQueryClient: vi.fn(() => Promise.resolve(dbMock)),
}));

vi.mock('@/business/client/hooks/useActiveWorkspaceId', () => ({
  getActiveWorkspaceId: vi.fn((): string | null => null),
}));

vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: { connector: {} },
}));

const dbMock = vi.hoisted(() => ({
  delete: vi.fn(),
  insert: vi.fn(),
  query: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
}));

import { connectorService } from './connector';

beforeEach(() => {
  dbMock.query.mockReset().mockResolvedValue([]);
  dbMock.update.mockReset().mockResolvedValue(undefined);
  dbMock.delete.mockReset().mockResolvedValue(undefined);
});

describe('connectorService (Phase 0–1)', () => {
  it('list calls the connectorsListWithTools Tier 2 template', async () => {
    dbMock.query.mockResolvedValue([{ id: 'c1', identifier: 'gmail', tools: [] }]);

    const rows = await connectorService.list();

    expect(dbMock.query).toHaveBeenCalledWith('lobehub', 'connectorsListWithTools', {});
    expect(rows).toHaveLength(1);
  });

  it('resetPermissions bulk-updates permission to auto on the correct column (not delete)', async () => {
    await connectorService.resetPermissions('c1');

    // Was db.delete on the wrong column `connector_id`; now a bulk update.
    expect(dbMock.delete).not.toHaveBeenCalled();
    expect(dbMock.update).toHaveBeenCalledWith(
      'user_connector_tools',
      { user_connector_id: 'c1' },
      { permission: 'auto' },
    );
  });

  it('update strips credentials + oidcConfig and maps camelCase → snake_case', async () => {
    await connectorService.update('c1', {
      credentials: { token: 'secret', type: 'bearer' },
      isEnabled: false,
      mcpServerUrl: 'https://mcp.example',
      name: 'My Connector',
      oidcConfig: { clientId: 'cl', scheme: 'dcr' },
    } as any);

    expect(dbMock.update).toHaveBeenCalledTimes(1);
    const [, , patch] = dbMock.update.mock.calls[0];
    expect(patch).toEqual({
      name: 'My Connector',
      is_enabled: false,
      mcp_server_url: 'https://mcp.example',
    });
    // Secrets must never reach pREST (plaintext into the ciphertext column).
    expect(patch.credentials).toBeUndefined();
    expect(patch.oidcConfig).toBeUndefined();
    expect(patch.oidc_config).toBeUndefined();
  });

  it('update with only isEnabled (disconnect) maps to is_enabled', async () => {
    await connectorService.update('c1', { isEnabled: false } as any);

    const [, , patch] = dbMock.update.mock.calls[0];
    expect(patch).toEqual({ is_enabled: false });
  });
});
