import { beforeEach, describe, expect, it, vi } from 'vitest';

import { agentService } from '../agent';

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
    agent: {
      countAgents: { query: vi.fn() },
      removeAgent: { mutate: vi.fn() },
    },
  },
}));

beforeEach(() => {
  prestMock.select.mockReset();
  prestMock.update.mockReset();
  prestMock.delete.mockReset();
  prestMock.query.mockReset();
});

describe('AgentService (prest-js-sdk)', () => {
  it('queryAgents calls Tier 2 agentsListWithStats template', async () => {
    prestMock.query.mockResolvedValue([{ id: 'a1', title: 'My Agent' }]);

    const rows = await agentService.queryAgents({ keyword: 'test', limit: 5, offset: 10 });

    expect(prestMock.query).toHaveBeenCalledWith(
      'lobehub',
      'agentsListWithStats',
      expect.objectContaining({ keyword: 'test', size: 5 }),
    );
    expect(rows).toEqual([{ id: 'a1', title: 'My Agent' }]);
  });

  it('queryAgents computes page from offset/limit', async () => {
    prestMock.query.mockResolvedValue([]);

    await agentService.queryAgents({ limit: 10, offset: 20 });

    expect(prestMock.query).toHaveBeenCalledWith(
      'lobehub',
      'agentsListWithStats',
      expect.objectContaining({ size: 10, page: 3 }),
    );
  });

  it('countAgents without keyword uses Tier 1 count', async () => {
    prestMock.select.mockResolvedValue([{ count: 7 }]);

    const n = await agentService.countAgents();

    expect(prestMock.select).toHaveBeenCalledWith(
      'lobehub',
      'public',
      'agents',
      expect.objectContaining({ count: true, where: { virtual: false } }),
    );
    expect(n).toBe(7);
  });

  it('countAgents returns 0 when no rows', async () => {
    prestMock.select.mockResolvedValue([]);

    const n = await agentService.countAgents();
    expect(n).toBe(0);
  });

  it('countAgents with keyword falls back to lambdaClient', async () => {
    const { lambdaClient } = await import('@/libs/trpc/client');
    vi.mocked(lambdaClient.agent.countAgents.query).mockResolvedValue(3);

    const n = await agentService.countAgents({ keyword: 'foo' });

    expect(lambdaClient.agent.countAgents.query).toHaveBeenCalledWith({ keyword: 'foo' });
    expect(n).toBe(3);
    expect(prestMock.select).not.toHaveBeenCalled();
  });

  it('updateAgentPinned updates via Tier 1', async () => {
    prestMock.update.mockResolvedValue([]);

    await agentService.updateAgentPinned('a1', true);

    expect(prestMock.update).toHaveBeenCalledWith(
      'lobehub',
      'public',
      'agents',
      { id: 'a1' },
      { pinned: true },
    );
  });
});
