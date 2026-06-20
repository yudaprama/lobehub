import { beforeEach, describe, expect, it, vi } from 'vitest';

import { briefService } from '../brief';

const { mockPrestDelete, mockPrestUpdate, mockQuery, mockBriefMutate } = vi.hoisted(() => ({
  mockBriefMutate: vi.fn(),
  mockPrestDelete: vi.fn().mockResolvedValue([]),
  mockPrestUpdate: vi.fn().mockResolvedValue([{ id: 'brief-1' }]),
  mockQuery: vi.fn(),
}));

vi.mock('@/libs/prest/client', () => ({
  getLobehubClient: vi.fn().mockResolvedValue({
    delete: mockPrestDelete,
    update: mockPrestUpdate,
  }),
}));

vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: {
    brief: {
      listUnresolved: { query: (...args: any[]) => mockQuery(...args) },
      resolve: { mutate: (...args: any[]) => mockBriefMutate(...args) },
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('BriefService', () => {
  describe('delete', () => {
    it('should call pREST delete with id', async () => {
      await briefService.delete('brief-1');

      expect(mockPrestDelete).toHaveBeenCalledWith('briefs', { id: 'brief-1' });
    });
  });

  describe('listUnresolved', () => {
    it('should call listUnresolved query', async () => {
      const mockData = { data: [{ id: 'brief-1', title: 'Test' }], success: true };
      mockQuery.mockResolvedValueOnce(mockData);

      const result = await briefService.listUnresolved();

      expect(mockQuery).toHaveBeenCalled();
      expect(result).toEqual(mockData);
    });
  });

  describe('resolve', () => {
    it('should call resolve with id and params', async () => {
      mockBriefMutate.mockResolvedValueOnce({ data: {}, success: true });

      await briefService.resolve('brief-1', { action: 'approve', comment: 'looks good' });

      expect(mockBriefMutate).toHaveBeenCalledWith({
        action: 'approve',
        comment: 'looks good',
        id: 'brief-1',
      });
    });

    it('should call resolve with only id when no params', async () => {
      mockBriefMutate.mockResolvedValueOnce({ data: {}, success: true });

      await briefService.resolve('brief-1');

      expect(mockBriefMutate).toHaveBeenCalledWith({ id: 'brief-1' });
    });
  });

  describe('markRead', () => {
    it('should call pREST update with read_at timestamp', async () => {
      const result = await briefService.markRead('brief-1');

      expect(mockPrestUpdate).toHaveBeenCalledWith(
        'briefs',
        { id: 'brief-1' },
        { read_at: expect.any(String) },
      );
      expect(result).toEqual({ id: 'brief-1' });
    });
  });
});
