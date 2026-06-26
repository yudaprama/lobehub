import { beforeEach, describe, expect, it, vi } from 'vitest';

import { chatGroupService } from './index';

const { mockUpdate } = vi.hoisted(() => ({
  mockUpdate: vi.fn(),
}));

vi.mock('@/libs/prest/client', () => ({
  getLobehubQueryClient: vi.fn().mockResolvedValue({ update: mockUpdate }),
}));

vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: {
    group: {
      getGroupByForkedFromIdentifier: { query: vi.fn() },
      createGroup: { mutate: vi.fn() },
      createGroupWithMembers: { mutate: vi.fn() },
      getGroupDetail: { query: vi.fn() },
      addAgentsToGroup: { mutate: vi.fn() },
      batchCreateAgentsInGroup: { mutate: vi.fn() },
      duplicateGroup: { mutate: vi.fn() },
      transferGroup: { mutate: vi.fn() },
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('chatGroupService.updateAgentInGroup', () => {
  it('updates order and role via pREST', async () => {
    mockUpdate.mockResolvedValueOnce([
      {
        agentId: 'agent-1',
        chatGroupId: 'group-1',
        order: 2,
        role: 'leader',
        enabled: true,
        userId: 'user-1',
      },
    ]);

    const result = await chatGroupService.updateAgentInGroup('group-1', 'agent-1', {
      order: 2,
      role: 'leader',
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      'chat_groups_agents',
      { chat_group_id: 'group-1', agent_id: 'agent-1' },
      { order: 2, role: 'leader' },
      { returning: ['*'] },
    );
    expect(result).toEqual({
      agentId: 'agent-1',
      chatGroupId: 'group-1',
      order: 2,
      role: 'leader',
      enabled: true,
      userId: 'user-1',
    });
  });

  it('updates only order when role is omitted', async () => {
    mockUpdate.mockResolvedValueOnce([
      {
        agentId: 'agent-1',
        chatGroupId: 'group-1',
        order: 5,
        role: 'participant',
        enabled: true,
        userId: 'user-1',
      },
    ]);

    await chatGroupService.updateAgentInGroup('group-1', 'agent-1', { order: 5 });

    expect(mockUpdate).toHaveBeenCalledWith(
      'chat_groups_agents',
      { chat_group_id: 'group-1', agent_id: 'agent-1' },
      { order: 5 },
      { returning: ['*'] },
    );
  });

  it('skips null values in the patch', async () => {
    mockUpdate.mockResolvedValueOnce([
      {
        agentId: 'agent-1',
        chatGroupId: 'group-1',
        order: 0,
        role: 'participant',
        enabled: true,
        userId: 'user-1',
      },
    ]);

    await chatGroupService.updateAgentInGroup('group-1', 'agent-1', {
      order: null as any,
      role: 'moderator',
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      'chat_groups_agents',
      { chat_group_id: 'group-1', agent_id: 'agent-1' },
      { role: 'moderator' },
      { returning: ['*'] },
    );
  });
});
