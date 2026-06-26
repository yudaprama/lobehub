import { beforeEach, describe, expect, it, vi } from 'vitest';

import { composioService } from './composio';

const dbMock = vi.hoisted(() => ({
  delete: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
}));

const egentFetchMock = vi.hoisted(() => vi.fn());

vi.mock('@/libs/prest/client', () => ({
  getLobehubQueryClient: vi.fn(() => Promise.resolve(dbMock)),
}));

vi.mock('@/libs/egent/client', () => ({
  egentFetch: egentFetchMock,
}));

const okJson = (body: unknown) => ({ json: () => Promise.resolve(body), ok: true, status: 200 });

beforeEach(() => {
  dbMock.delete.mockReset().mockResolvedValue(undefined);
  dbMock.insert.mockReset().mockResolvedValue(undefined);
  dbMock.select.mockReset().mockResolvedValue([]);
  dbMock.update.mockReset().mockResolvedValue(undefined);
  egentFetchMock.mockReset();
});

describe('composioService', () => {
  it('createConnection calls egent then persists a PENDING plugin to pREST', async () => {
    egentFetchMock.mockResolvedValue(
      okJson({
        authConfigId: 'ac1',
        connectedAccountId: 'ca1',
        identifier: 'github',
        redirectUrl: 'https://oauth',
      }),
    );

    const res = await composioService.createConnection({
      appSlug: 'github',
      identifier: 'github',
      label: 'GitHub',
    });

    expect(egentFetchMock).toHaveBeenCalledWith(
      '/v1/composio/connections',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(res.connectedAccountId).toBe('ca1');

    expect(dbMock.insert).toHaveBeenCalledTimes(1);
    const [table, payload] = dbMock.insert.mock.calls[0];
    expect(table).toBe('user_installed_plugins');
    expect(payload.source).toBe('composio');
    expect(payload.identifier).toBe('github');
    expect(payload.custom_params.composio.status).toBe('PENDING');
    expect(payload.custom_params.composio.connectedAccountId).toBe('ca1');
  });

  it('getConnection polls egent and returns status', async () => {
    egentFetchMock.mockResolvedValue(okJson({ connectedAccountId: 'ca1', status: 'ACTIVE' }));

    const res = await composioService.getConnection({ connectedAccountId: 'ca1' });

    expect(egentFetchMock).toHaveBeenCalledWith(
      '/v1/composio/connections/poll',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(res.status).toBe('ACTIVE');
  });

  it('updateComposioPlugin inserts when the row does not exist', async () => {
    dbMock.select.mockResolvedValue([]);

    const out = await composioService.updateComposioPlugin({
      appSlug: 'github',
      authConfigId: 'ac1',
      connectedAccountId: 'ca1',
      identifier: 'github',
      label: 'GitHub',
      status: 'ACTIVE',
      tools: [{ description: 'list repos', inputSchema: { type: 'object' }, name: 'list_repos' }],
    });

    expect(dbMock.update).not.toHaveBeenCalled();
    expect(dbMock.insert).toHaveBeenCalledTimes(1);
    const [, payload] = dbMock.insert.mock.calls[0];
    expect(payload.manifest.api).toHaveLength(1);
    expect(payload.manifest.api[0].name).toBe('list_repos');
    expect(out.savedCount).toBe(1);
  });

  it('updateComposioPlugin updates when the row exists (preserving meta)', async () => {
    dbMock.select.mockResolvedValue([
      { identifier: 'github', manifest: { meta: { title: 'Existing GitHub' } } },
    ]);

    await composioService.updateComposioPlugin({
      appSlug: 'github',
      authConfigId: 'ac1',
      connectedAccountId: 'ca1',
      identifier: 'github',
      label: 'GitHub',
      status: 'ACTIVE',
      tools: [],
    });

    expect(dbMock.insert).not.toHaveBeenCalled();
    expect(dbMock.update).toHaveBeenCalledTimes(1);
    const [, where, payload] = dbMock.update.mock.calls[0];
    expect(where).toEqual({ identifier: 'github' });
    expect(payload.manifest.meta.title).toBe('Existing GitHub');
    expect(payload.custom_params.composio.status).toBe('ACTIVE');
  });

  it('deleteConnection revokes at egent then deletes the pREST row', async () => {
    egentFetchMock.mockResolvedValue(okJson({}));

    await composioService.deleteConnection({ connectedAccountId: 'ca1', identifier: 'github' });

    expect(egentFetchMock).toHaveBeenCalledWith(
      '/v1/composio/connections/delete',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(dbMock.delete).toHaveBeenCalledWith('user_installed_plugins', { identifier: 'github' });
  });

  it('getComposioPlugins selects composio-sourced rows from pREST', async () => {
    dbMock.select.mockResolvedValue([{ customParams: { composio: {} }, identifier: 'github' }]);

    const rows = await composioService.getComposioPlugins();

    expect(dbMock.select).toHaveBeenCalledWith('user_installed_plugins', {
      where: { source: 'composio' },
    });
    expect(rows).toHaveLength(1);
  });
});
