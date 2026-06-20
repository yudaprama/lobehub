import { beforeEach, describe, expect, it, vi } from 'vitest';

import { knowledgeBaseService } from '../knowledgeBase';

// The typed client (getLobehubClient) calls `this.client.select(db, schema, table, opts)`
// on the underlying PrestClient. So prestMock.select receives the 4-arg form
// even when the service calls `db.select('table', opts)`.
const prestMock = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  insertBatch: vi.fn(),
  query: vi.fn(),
}));

vi.mock('@/libs/prest/client', () => ({
  getPrestClient: vi.fn(() => Promise.resolve(prestMock)),
  getLobehubClient: vi.fn(() =>
    // TypedPrestClient delegates to prestMock under the hood.
    Promise.resolve({
      client: prestMock,
      select: (table: string, opts: unknown) => prestMock.select('lobehub', 'public', table, opts),
      insert: (table: string, data: unknown) => prestMock.insert('lobehub', 'public', table, data),
      update: (table: string, where: unknown, data: unknown) =>
        prestMock.update('lobehub', 'public', table, where, data),
      delete: (table: string, where: unknown) =>
        prestMock.delete('lobehub', 'public', table, where),
    }),
  ),
}));

vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: {
    knowledgeBase: {
      transferKnowledgeBase: { mutate: vi.fn() },
      copyKnowledgeBaseToWorkspace: { mutate: vi.fn() },
    },
  },
}));

beforeEach(() => {
  prestMock.select.mockReset();
  prestMock.insert.mockReset();
  prestMock.update.mockReset();
  prestMock.delete.mockReset();
  prestMock.insertBatch.mockReset();
  prestMock.query.mockReset();
});

describe('KnowledgeBaseService (prest-js-sdk)', () => {
  it('getKnowledgeBaseList returns all KBs via Tier 1 select', async () => {
    prestMock.select.mockResolvedValue([{ id: 'kb-1', name: 'Docs' }]);

    const rows = await knowledgeBaseService.getKnowledgeBaseList();

    expect(prestMock.select).toHaveBeenCalledWith(
      'lobehub',
      'public',
      'knowledge_bases',
      expect.objectContaining({ order: ['updated_at:desc'] }),
    );
    expect(rows).toEqual([{ id: 'kb-1', name: 'Docs' }]);
  });

  it('getKnowledgeBaseById returns one KB', async () => {
    prestMock.select.mockResolvedValue([{ id: 'kb-1', name: 'Docs' }]);

    const row = await knowledgeBaseService.getKnowledgeBaseById('kb-1');

    expect(prestMock.select).toHaveBeenCalledWith(
      'lobehub',
      'public',
      'knowledge_bases',
      expect.objectContaining({ where: { id: 'kb-1' }, size: 1 }),
    );
    expect(row).toEqual({ id: 'kb-1', name: 'Docs' });
  });

  it('getKnowledgeBaseById returns null when not found', async () => {
    prestMock.select.mockResolvedValue([]);

    const row = await knowledgeBaseService.getKnowledgeBaseById('missing');
    expect(row).toBeNull();
  });

  it('createKnowledgeBase inserts via Tier 1', async () => {
    prestMock.insert.mockResolvedValue([{ id: 'new-id', name: 'Test' }]);

    const result = await knowledgeBaseService.createKnowledgeBase({
      name: 'Test',
    });

    expect(prestMock.insert).toHaveBeenCalledWith(
      'lobehub',
      'public',
      'knowledge_bases',
      expect.objectContaining({ name: 'Test' }),
    );
    expect(result).toEqual({ id: 'new-id', name: 'Test' });
  });

  it('updateKnowledgeBaseList updates via Tier 1', async () => {
    prestMock.update.mockResolvedValue([]);

    await knowledgeBaseService.updateKnowledgeBaseList('kb-1', { name: 'Updated' });

    expect(prestMock.update).toHaveBeenCalledWith(
      'lobehub',
      'public',
      'knowledge_bases',
      { id: 'kb-1' },
      expect.objectContaining({ name: 'Updated' }),
    );
  });

  it('deleteKnowledgeBase deletes via Tier 1', async () => {
    prestMock.delete.mockResolvedValue([]);

    await knowledgeBaseService.deleteKnowledgeBase('kb-1');

    expect(prestMock.delete).toHaveBeenCalledWith('lobehub', 'public', 'knowledge_bases', {
      id: 'kb-1',
    });
  });

  it('addFilesToKnowledgeBase inserts into junction table', async () => {
    prestMock.insertBatch.mockResolvedValue([]);

    await knowledgeBaseService.addFilesToKnowledgeBase('kb-1', ['f1', 'f2']);

    expect(prestMock.insertBatch).toHaveBeenCalledWith(
      'lobehub',
      'public',
      'knowledge_base_files',
      expect.arrayContaining([
        expect.objectContaining({ knowledge_base_id: 'kb-1', file_id: 'f1' }),
        expect.objectContaining({ knowledge_base_id: 'kb-1', file_id: 'f2' }),
      ]),
    );
  });

  it('skips network when addFilesToKnowledgeBase ids are empty', async () => {
    await knowledgeBaseService.addFilesToKnowledgeBase('kb-1', []);
    expect(prestMock.insertBatch).not.toHaveBeenCalled();
  });

  it('removeFilesFromKnowledgeBase deletes from junction table', async () => {
    prestMock.delete.mockResolvedValue([]);

    await knowledgeBaseService.removeFilesFromKnowledgeBase('kb-1', ['f1', 'f2']);

    expect(prestMock.delete).toHaveBeenCalledWith('lobehub', 'public', 'knowledge_base_files', {
      knowledge_base_id: 'kb-1',
      file_id: { in: ['f1', 'f2'] },
    });
  });

  it('skips network when removeFilesFromKnowledgeBase ids are empty', async () => {
    await knowledgeBaseService.removeFilesFromKnowledgeBase('kb-1', []);
    expect(prestMock.delete).not.toHaveBeenCalled();
  });
});
