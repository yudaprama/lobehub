import { beforeEach, describe, expect, it, vi } from 'vitest';

import { topicService } from './index';

const prestMock = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  query: vi.fn(),
}));

vi.mock('@/libs/prest/client', () => ({
  getPrestClient: vi.fn(() => Promise.resolve(prestMock)),
}));

vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: {
    topic: {
      createTopic: { mutate: vi.fn() },
      getTopics: { query: vi.fn() },
      searchTopics: { query: vi.fn() },
      updateTopicMetadata: { mutate: vi.fn() },
      getShareInfo: { query: vi.fn() },
    },
  },
}));

beforeEach(() => {
  prestMock.select.mockReset();
  prestMock.update.mockReset();
  prestMock.delete.mockReset();
  prestMock.query.mockReset();
});

describe('TopicService (prest-js-sdk)', () => {
  it('queries topics via Tier 1 select with status filter', async () => {
    prestMock.select.mockResolvedValue([{ id: 't1', title: 'First', status: 'active' }]);

    const rows = await topicService.queryTopics({ pageSize: 10, statuses: ['active'] });

    expect(prestMock.select).toHaveBeenCalledWith(
      'lobehub',
      'public',
      'topics',
      expect.objectContaining({
        order: ['updated_at:desc'],
        size: 10,
        where: { status: { in: ['active'] } },
      }),
    );
    expect(rows).toEqual([{ id: 't1', title: 'First', status: 'active' }]);
  });

  it('counts topics via Tier 1 select with count:true', async () => {
    prestMock.select.mockResolvedValue([{ count: 42 }]);

    const n = await topicService.countTopics({ agentId: 'a1', startDate: '2026-01-01' });

    expect(prestMock.select).toHaveBeenCalledWith(
      'lobehub',
      'public',
      'topics',
      expect.objectContaining({
        count: true,
        where: { agent_id: 'a1', created_at: { gte: '2026-01-01' } },
      }),
    );
    expect(n).toBe(42);
  });

  it('returns 0 when prest returns no count row', async () => {
    prestMock.select.mockResolvedValue([]);
    const n = await topicService.countTopics();
    expect(n).toBe(0);
  });

  it('searches topics via Tier 2 topicsSearchFts template', async () => {
    prestMock.query.mockResolvedValue([{ id: 't1', title: 'deploy fail', rank: 0.5 }]);

    const rows = await topicService.searchTopics('deploy', 'agent-1');

    expect(prestMock.query).toHaveBeenCalledWith('lobehub', 'topicsSearchFts', {
      q: 'deploy',
      agentId: 'agent-1',
    });
    expect(rows).toHaveLength(1);
  });

  it('returns empty array for empty search keywords', async () => {
    const rows = await topicService.searchTopics('   ');
    expect(rows).toEqual([]);
    expect(prestMock.query).not.toHaveBeenCalled();
  });

  it('falls back to lambdaClient for searchTopics when groupId is set', async () => {
    const { lambdaClient } = await import('@/libs/trpc/client');
    vi.mocked(lambdaClient.topic.searchTopics.query).mockResolvedValue([] as any);

    await topicService.searchTopics('deploy', undefined, 'group-1');

    expect(lambdaClient.topic.searchTopics.query).toHaveBeenCalledWith({
      agentId: undefined,
      groupId: 'group-1',
      keywords: 'deploy',
    });
    expect(prestMock.query).not.toHaveBeenCalled();
  });

  it('updates a topic via Tier 1 update', async () => {
    prestMock.update.mockResolvedValue([]);

    await topicService.updateTopic('t1', { title: 'New Title', favorite: true });

    expect(prestMock.update).toHaveBeenCalledWith(
      'lobehub',
      'public',
      'topics',
      { id: 't1' },
      expect.objectContaining({ title: 'New Title', favorite: true }),
    );
  });

  it('removes a single topic via Tier 1 delete', async () => {
    prestMock.delete.mockResolvedValue([]);

    await topicService.removeTopic('t1');

    expect(prestMock.delete).toHaveBeenCalledWith('lobehub', 'public', 'topics', { id: 't1' });
  });

  it('removes topics by session via Tier 1 delete with session_id filter', async () => {
    prestMock.delete.mockResolvedValue([]);

    await topicService.removeTopics('session-1');

    expect(prestMock.delete).toHaveBeenCalledWith('lobehub', 'public', 'topics', {
      session_id: 'session-1',
    });
  });

  it('skips the delete when removing INBOX topics (sessionId null)', async () => {
    await topicService.removeTopics('inbox');

    expect(prestMock.delete).not.toHaveBeenCalled();
  });

  it('removes topics by agentId via Tier 1 delete', async () => {
    prestMock.delete.mockResolvedValue([]);

    await topicService.removeTopicsByAgentId('agent-1');

    expect(prestMock.delete).toHaveBeenCalledWith('lobehub', 'public', 'topics', {
      agent_id: 'agent-1',
    });
  });

  it('batch-removes topics via Tier 1 delete with id in filter', async () => {
    prestMock.delete.mockResolvedValue([]);

    await topicService.batchRemoveTopics(['t1', 't2']);

    expect(prestMock.delete).toHaveBeenCalledWith('lobehub', 'public', 'topics', {
      id: { in: ['t1', 't2'] },
    });
  });

  it('skips the network when batchRemoveTopics ids are empty', async () => {
    await topicService.batchRemoveTopics([]);
    expect(prestMock.delete).not.toHaveBeenCalled();
  });

  it('removes all topics via Tier 1 delete with empty filter (user-scoped)', async () => {
    prestMock.delete.mockResolvedValue([]);

    await topicService.removeAllTopic();

    expect(prestMock.delete).toHaveBeenCalledWith('lobehub', 'public', 'topics', {});
  });
});
