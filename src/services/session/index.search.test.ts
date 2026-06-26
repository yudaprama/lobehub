import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionService } from './index';

const { mockPrestQuery, mockWorkspaceParams } = vi.hoisted(() => ({
  mockPrestQuery: vi.fn(),
  mockWorkspaceParams: vi.fn(() => ({})),
}));

vi.mock('@/libs/prest/client', () => ({
  getLobehubQueryClient: vi.fn().mockResolvedValue({ query: mockPrestQuery }),
  getWorkspaceParams: () => mockWorkspaceParams(),
}));

vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: { session: { searchSessions: { query: vi.fn() } } },
}));

const service = new SessionService();

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SessionService.searchSessions', () => {
  it('returns [] without hitting the DB when keyword is empty', async () => {
    const result = await service.searchSessions('');

    expect(result).toEqual([]);
    expect(mockPrestQuery).not.toHaveBeenCalled();
  });

  it('queries the Tier 2 template and assembles an agent session shape', async () => {
    mockPrestQuery.mockResolvedValueOnce([
      {
        agentAvatar: 'agent-avatar.png',
        agentBackgroundColor: '#000',
        agentDescription: 'agent desc',
        agentMarketIdentifier: 'market-1',
        agentModel: 'gpt-4',
        agentTags: ['x'],
        agentTitle: 'Agent Title',
        agentVirtual: false,
        avatar: 'session-avatar.png',
        backgroundColor: '#fff',
        createdAt: '2026-01-01',
        description: 'session desc',
        groupId: 'group-1',
        id: 'session-1',
        pinned: true,
        slug: 'sess-slug',
        title: 'Session Title',
        updatedAt: '2026-01-02',
      },
    ]);

    const result = await service.searchSessions('agent');

    expect(mockPrestQuery).toHaveBeenCalledWith('lobehub', 'sessionsSearchByKeyword', {
      keyword: 'agent',
    });
    expect(result).toEqual([
      {
        config: { model: 'gpt-4', plugins: [], virtual: false },
        createdAt: '2026-01-01',
        group: 'group-1',
        id: 'session-1',
        meta: {
          avatar: 'agent-avatar.png',
          backgroundColor: '#000',
          description: 'agent desc',
          marketIdentifier: 'market-1',
          tags: ['x'],
          title: 'Agent Title',
        },
        model: 'gpt-4',
        pinned: true,
        slug: 'sess-slug',
        type: 'agent',
        updatedAt: '2026-01-02',
      },
    ]);
  });

  it('falls back to session columns when agent fields are null', async () => {
    mockPrestQuery.mockResolvedValueOnce([
      {
        agentAvatar: null,
        agentBackgroundColor: null,
        agentDescription: null,
        agentMarketIdentifier: null,
        agentModel: null,
        agentTags: null,
        agentTitle: null,
        agentVirtual: null,
        avatar: 'session-avatar.png',
        backgroundColor: '#fff',
        createdAt: '2026-01-01',
        description: 'session desc',
        groupId: null,
        id: 'session-2',
        pinned: null,
        slug: 'sess-2',
        title: 'Session Title',
        updatedAt: '2026-01-02',
      },
    ]);

    const [session] = await service.searchSessions('foo');

    expect(session.meta).toEqual({
      avatar: 'session-avatar.png',
      backgroundColor: '#fff',
      description: 'session desc',
      marketIdentifier: undefined,
      tags: undefined,
      title: 'Session Title',
    });
    expect((session as any).config).toEqual({ model: '', plugins: [], virtual: false });
    expect((session as any).group).toBeUndefined();
    expect(session.pinned).toBe(false);
  });
});
