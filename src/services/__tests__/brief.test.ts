import { beforeEach, describe, expect, it, vi } from 'vitest';

import { briefService } from '../brief';

const { mockPrestDelete, mockPrestUpdate, mockPrestQuery, mockBriefMutate } = vi.hoisted(() => ({
  mockBriefMutate: vi.fn(),
  mockPrestDelete: vi.fn().mockResolvedValue([]),
  mockPrestQuery: vi.fn(),
  mockPrestUpdate: vi.fn().mockResolvedValue([{ id: 'brief-1' }]),
}));

vi.mock('@/libs/prest/client', () => ({
  getLobehubQueryClient: vi.fn().mockResolvedValue({
    delete: mockPrestDelete,
    query: mockPrestQuery,
    update: mockPrestUpdate,
  }),
}));

vi.mock('@/database/utils/inboxAgent', () => ({
  normalizeInboxAgentAvatar: (avatar: string | null) => avatar,
  normalizeInboxAgentTitle: (title: string | null) => title,
}));

vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: {
    brief: {
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
    it('should query the Tier 2 template and assemble the agent object', async () => {
      mockPrestQuery.mockResolvedValueOnce([
        {
          agentAvatar: 'avatar.png',
          agentBackgroundColor: '#fff',
          agentRowId: 'agent-1',
          agentSlug: 'my-agent',
          agentTitle: 'My Agent',
          id: 'brief-1',
          taskStatus: 'running',
          title: 'Test',
        },
      ]);

      const result = await briefService.listUnresolved();

      expect(mockPrestQuery).toHaveBeenCalledWith('lobehub', 'briefsListUnresolved', {});
      expect(result).toEqual({
        data: [
          {
            agent: {
              avatar: 'avatar.png',
              backgroundColor: '#fff',
              id: 'agent-1',
              title: 'My Agent',
            },
            agents: [],
            id: 'brief-1',
            taskStatus: 'running',
            title: 'Test',
          },
        ],
        success: true,
      });
    });

    it('should null the agent and taskStatus when the brief has no agent/task', async () => {
      mockPrestQuery.mockResolvedValueOnce([
        {
          agentAvatar: null,
          agentBackgroundColor: null,
          agentRowId: null,
          agentSlug: null,
          agentTitle: null,
          id: 'brief-2',
          taskStatus: null,
          title: 'Orphan',
        },
      ]);

      const result = await briefService.listUnresolved();

      expect(result.data[0].agent).toBeNull();
      expect(result.data[0].taskStatus).toBeNull();
      expect(result.data[0].agents).toEqual([]);
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
