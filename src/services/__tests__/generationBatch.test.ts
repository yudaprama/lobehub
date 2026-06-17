import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generationBatchService } from '../generationBatch';

const prestMock = vi.hoisted(() => ({
  query: vi.fn(() => Promise.resolve([])),
  delete: vi.fn(() => Promise.resolve([])),
}));

vi.mock('@/libs/prest/client', () => ({
  getPrestClient: vi.fn(() => Promise.resolve(prestMock)),
  getLobehubClient: vi.fn(() =>
    Promise.resolve({
      client: prestMock,
      delete: prestMock.delete,
    }),
  ),
}));

describe('GenerationBatchService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getGenerationBatches should call Tier 2 template with topicId', async () => {
    const topicId = 'test-topic-id';

    await generationBatchService.getGenerationBatches(topicId);

    expect(prestMock.query).toHaveBeenCalledWith('lobehub', 'generationBatchesWithGenerations', {
      topicId,
    });
  });

  it('deleteGenerationBatch should call prest delete', async () => {
    const batchId = 'test-batch-id';

    await generationBatchService.deleteGenerationBatch(batchId);

    expect(prestMock.delete).toHaveBeenCalled();
  });
});
