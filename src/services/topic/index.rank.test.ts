import { beforeEach, describe, expect, it, vi } from 'vitest';

import { topicService } from './index';

const { mockPrestQuery } = vi.hoisted(() => ({
  mockPrestQuery: vi.fn(),
}));

vi.mock('@/libs/prest/client', () => ({
  getLobehubQueryClient: vi.fn().mockResolvedValue({ query: mockPrestQuery }),
  getWorkspaceParams: () => ({}),
}));

vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: { topic: {} },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TopicService.rankTopics', () => {
  it('queries the topicsRank template with the default limit', async () => {
    mockPrestQuery.mockResolvedValueOnce([
      { agentId: 'a1', count: 5, id: 't1', title: 'First' },
    ]);

    const rows = await topicService.rankTopics();

    expect(mockPrestQuery).toHaveBeenCalledWith('lobehub', 'topicsRank', { limit: '10' });
    expect(rows).toEqual([{ agentId: 'a1', count: 5, id: 't1', title: 'First' }]);
  });

  it('caps the limit at 50', async () => {
    mockPrestQuery.mockResolvedValueOnce([]);

    await topicService.rankTopics(999);

    expect(mockPrestQuery).toHaveBeenCalledWith('lobehub', 'topicsRank', { limit: '50' });
  });
});

describe('TopicService.getMaxTaskDuration', () => {
  it('returns the seconds value from the aggregate template', async () => {
    mockPrestQuery.mockResolvedValueOnce([{ seconds: 123.5 }]);

    const seconds = await topicService.getMaxTaskDuration();

    expect(mockPrestQuery).toHaveBeenCalledWith('lobehub', 'agentOperationsMaxDuration', {});
    expect(seconds).toBe(123.5);
  });

  it('returns 0 when there are no completed operations', async () => {
    mockPrestQuery.mockResolvedValueOnce([]);

    const seconds = await topicService.getMaxTaskDuration();

    expect(seconds).toBe(0);
  });
});
