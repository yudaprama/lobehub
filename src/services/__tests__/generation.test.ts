import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generationService } from '../generation';

const prestMock = vi.hoisted(() => ({
  select: vi.fn<() => Promise<unknown[]>>(() => Promise.resolve([])),
  delete: vi.fn<() => Promise<unknown[]>>(() => Promise.resolve([])),
}));

vi.mock('@/libs/prest/client', () => ({
  getPrestClient: vi.fn(() => Promise.resolve(prestMock)),
  getLobehubClient: vi.fn(() =>
    Promise.resolve({
      client: prestMock,
      select: prestMock.select,
      delete: prestMock.delete,
    }),
  ),
}));

describe('GenerationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getGenerationStatus should fetch generation and async task via prest', async () => {
    const generationId = 'test-generation-id';
    const asyncTaskId = 'test-async-task-id';

    prestMock.select
      .mockResolvedValueOnce([{ id: generationId, generation_batch_id: 'b1' }]) // generation row
      .mockResolvedValueOnce([{ id: asyncTaskId, status: 'completed' }]); // async task row

    const result = await generationService.getGenerationStatus(generationId, asyncTaskId);

    expect(result).toEqual({
      id: generationId,
      generation_batch_id: 'b1',
      async_task: { id: asyncTaskId, status: 'completed' },
    });
    expect(prestMock.select).toHaveBeenCalledTimes(2);
  });

  it('deleteGeneration should call prest delete', async () => {
    const generationId = 'test-generation-id';

    await generationService.deleteGeneration(generationId);

    expect(prestMock.delete).toHaveBeenCalled();
  });
});
