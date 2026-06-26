import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({
  delete: vi.fn(),
  insert: vi.fn(),
  query: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
}));

const egentFetchMock = vi.hoisted(() => vi.fn());

vi.mock('@/libs/prest/client', () => ({
  getLobehubQueryClient: vi.fn(() => Promise.resolve(dbMock)),
}));

vi.mock('@/business/client/hooks/useActiveWorkspaceId', () => ({
  getActiveWorkspaceId: vi.fn((): string | null => null),
}));

vi.mock('@/libs/egent/client', () => ({
  egentFetch: egentFetchMock,
}));

import { connectorService } from './connector';

const okJson = (body: unknown) => ({ json: () => Promise.resolve(body), ok: true, status: 200 });

beforeEach(() => {
  dbMock.query.mockReset().mockResolvedValue([]);
  dbMock.update.mockReset().mockResolvedValue(undefined);
  dbMock.delete.mockReset().mockResolvedValue(undefined);
  dbMock.select.mockReset().mockResolvedValue([]);
  dbMock.insert.mockReset().mockResolvedValue([]);
  egentFetchMock.mockReset();
});

describe('connectorService (Phase 0–2)', () => {
  it('list calls the connectorsListWithTools Tier 2 template', async () => {
    dbMock.query.mockResolvedValue([{ id: 'c1', identifier: 'gmail', tools: [] }]);
    await connectorService.list();
    expect(dbMock.query).toHaveBeenCalledWith('lobehub', 'connectorsListWithTools', {});
  });

  it('resetPermissions bulk-updates permission to auto on the correct column (not delete)', async () => {
    await connectorService.resetPermissions('c1');
    expect(dbMock.delete).not.toHaveBeenCalled();
    expect(dbMock.update).toHaveBeenCalledWith(
      'user_connector_tools',
      { user_connector_id: 'c1' },
      { permission: 'auto' },
    );
  });

  it('update maps camelCase → snake_case and encrypts credentials via egent', async () => {
    egentFetchMock.mockResolvedValue(okJson({ ciphertext: 'ENC' }));

    await connectorService.update('c1', {
      credentials: { token: 'secret', type: 'bearer' },
      isEnabled: false,
      mcpServerUrl: 'https://mcp.example',
      name: 'My Connector',
      oidcConfig: { clientId: 'cl' },
    } as any);

    expect(egentFetchMock).toHaveBeenCalledWith(
      '/v1/connector/credentials/encrypt',
      expect.objectContaining({ method: 'POST' }),
    );
    const [, , patch] = dbMock.update.mock.calls[0];
    expect(patch).toEqual({
      name: 'My Connector',
      is_enabled: false,
      mcp_server_url: 'https://mcp.example',
      credentials: 'ENC',
    });
    // oidcConfig never reaches pREST (machine-managed — Phase 4).
    expect(patch.oidcConfig).toBeUndefined();
    expect(patch.oidc_config).toBeUndefined();
  });

  it('update with credentials:null clears credentials + token_expires_at', async () => {
    await connectorService.update('c1', { credentials: null } as any);
    const [, , patch] = dbMock.update.mock.calls[0];
    expect(patch.credentials).toBeNull();
    expect(patch.token_expires_at).toBeNull();
    expect(egentFetchMock).not.toHaveBeenCalled();
  });

  it('update with only isEnabled (disconnect) maps to is_enabled', async () => {
    await connectorService.update('c1', { isEnabled: false } as any);
    const [, , patch] = dbMock.update.mock.calls[0];
    expect(patch).toEqual({ is_enabled: false });
  });

  it('create encrypts credentials then inserts a new connector (disconnected)', async () => {
    egentFetchMock.mockResolvedValue(okJson({ ciphertext: 'ENC' }));
    dbMock.select.mockResolvedValue([]); // no existing
    dbMock.insert.mockResolvedValue([{ id: 'new-id' }]);

    const res = await connectorService.create({
      credentials: { apiKey: 'k', type: 'apikey' },
      identifier: 'linear',
      name: 'Linear',
      sourceType: 'custom',
    } as any);

    expect(res.id).toBe('new-id');
    const [table, payload] = dbMock.insert.mock.calls[0];
    expect(table).toBe('user_connectors');
    expect(payload.identifier).toBe('linear');
    expect(payload.source_type).toBe('custom');
    expect(payload.status).toBe('disconnected');
    expect(payload.credentials).toBe('ENC');
  });

  it('create upserts when the identifier already exists', async () => {
    egentFetchMock.mockResolvedValue(okJson({ ciphertext: 'ENC' }));
    dbMock.select.mockResolvedValue([{ id: 'existing-id', identifier: 'linear' }]);

    const res = await connectorService.create({
      identifier: 'linear',
      name: 'Linear',
      sourceType: 'custom',
    } as any);

    expect(res.id).toBe('existing-id');
    expect(dbMock.insert).not.toHaveBeenCalled();
    expect(dbMock.update).toHaveBeenCalledWith(
      'user_connectors',
      { id: 'existing-id' },
      expect.objectContaining({ status: 'disconnected', credentials: null }),
    );
  });

  it('getForEdit decrypts user-set credentials and strips oauth2 + clientSecret', async () => {
    dbMock.select.mockResolvedValue([
      {
        id: 'c1',
        identifier: 'linear',
        credentials: 'CIPHERTEXT',
        name: 'Linear',
        oidcConfig: { clientId: 'cl', clientSecret: 'shh' },
      },
    ]);
    egentFetchMock.mockResolvedValue(okJson({ credentials: { token: 'tok', type: 'bearer' } }));

    const row = await connectorService.getForEdit('c1');

    expect(egentFetchMock).toHaveBeenCalledWith(
      '/v1/connector/credentials/decrypt',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(row.credentials).toEqual({ token: 'tok', type: 'bearer' });
    expect(row.oidcConfig.clientSecret).toBeUndefined();
    expect(row.oidcConfig.clientId).toBe('cl');
    // Ciphertext must never reach the browser.
    expect(row.credentials).not.toBe('CIPHERTEXT');
  });

  it('getForEdit returns null credentials for oauth2 (machine-managed)', async () => {
    dbMock.select.mockResolvedValue([{ id: 'c1', credentials: 'CIPHERTEXT' }]);
    egentFetchMock.mockResolvedValue(okJson({ credentials: { accessToken: 'x', type: 'oauth2' } }));

    const row = await connectorService.getForEdit('c1');
    expect(row.credentials).toBeNull();
  });

  it('getForEdit throws when the connector is not found', async () => {
    dbMock.select.mockResolvedValue([]);
    await expect(connectorService.getForEdit('missing')).rejects.toThrow(/not found/i);
  });
});
