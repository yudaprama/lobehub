import { beforeEach, describe, expect, it, vi } from 'vitest';

import { messageService } from './index';

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
    message: {
      getMessages: { query: vi.fn() },
      createMessage: { mutate: vi.fn() },
      removeMessagesByAssistant: { mutate: vi.fn() },
      updateToolMessage: { mutate: vi.fn() },
      updatePluginState: { mutate: vi.fn() },
      updatePluginError: { mutate: vi.fn() },
      updateMessagePlugin: { mutate: vi.fn() },
      updateMessageRAG: { mutate: vi.fn() },
      updateToolArguments: { mutate: vi.fn() },
      addFilesToMessage: { mutate: vi.fn() },
    },
  },
}));

beforeEach(() => {
  prestMock.select.mockReset();
  prestMock.update.mockReset();
  prestMock.delete.mockReset();
  prestMock.query.mockReset();
});

describe('MessageService (prest-js-sdk)', () => {
  it('lists messages by topic via Tier 2 template', async () => {
    prestMock.query.mockResolvedValue([{ id: 'm1', role: 'user', content: 'hi' }]);

    const rows = await messageService.getMessages({ topicId: 't1' });

    expect(prestMock.query).toHaveBeenCalledWith('lobehub', 'messagesListByTopic', {
      topicId: 't1',
    });
    expect(rows).toEqual([{ id: 'm1', role: 'user', content: 'hi' }]);
  });

  it('forwards groupId to the Tier 2 template when present', async () => {
    prestMock.query.mockResolvedValue([]);

    await messageService.getMessages({ topicId: 't1', groupId: 'g1' });

    expect(prestMock.query).toHaveBeenCalledWith('lobehub', 'messagesListByTopic', {
      topicId: 't1',
      groupId: 'g1',
    });
  });

  it('falls back to lambdaClient when topicId is missing', async () => {
    const { lambdaClient } = await import('@/libs/trpc/client');
    vi.mocked(lambdaClient.message.getMessages.query).mockResolvedValue([] as any);

    await messageService.getMessages({});

    expect(lambdaClient.message.getMessages.query).toHaveBeenCalled();
    expect(prestMock.query).not.toHaveBeenCalled();
  });

  it('falls back to lambdaClient when threadId is set', async () => {
    const { lambdaClient } = await import('@/libs/trpc/client');
    vi.mocked(lambdaClient.message.getMessages.query).mockResolvedValue([] as any);

    await messageService.getMessages({ topicId: 't1', threadId: 'th1' });

    expect(lambdaClient.message.getMessages.query).toHaveBeenCalled();
    expect(prestMock.query).not.toHaveBeenCalled();
  });

  it('counts messages via Tier 1 select with count:true', async () => {
    prestMock.select.mockResolvedValue([{ count: 5 }]);

    const n = await messageService.countMessages({ startDate: '2026-01-01' });

    expect(prestMock.select).toHaveBeenCalledWith(
      'lobehub',
      'public',
      'messages',
      expect.objectContaining({
        count: true,
        where: { created_at: { gte: '2026-01-01' } },
      }),
    );
    expect(n).toBe(5);
  });

  it('updates a message via Tier 1 update', async () => {
    prestMock.update.mockResolvedValue([]);

    await messageService.updateMessage('m1', { content: 'edited', model: 'gpt-4' });

    expect(prestMock.update).toHaveBeenCalledWith(
      'lobehub',
      'public',
      'messages',
      { id: 'm1' },
      expect.objectContaining({ content: 'edited', model: 'gpt-4' }),
    );
  });

  it('updates message error via Tier 1 update', async () => {
    prestMock.update.mockResolvedValue([]);

    await messageService.updateMessageError('m1', {
      message: 'oops',
      type: 'ApplicationRuntimeError',
    } as any);

    expect(prestMock.update).toHaveBeenCalledWith(
      'lobehub',
      'public',
      'messages',
      { id: 'm1' },
      expect.objectContaining({
        error: expect.objectContaining({ type: 'ApplicationRuntimeError' }),
      }),
    );
  });

  it('removes a single message via Tier 1 delete', async () => {
    prestMock.delete.mockResolvedValue([]);

    await messageService.removeMessage('m1');

    expect(prestMock.delete).toHaveBeenCalledWith('lobehub', 'public', 'messages', { id: 'm1' });
  });

  it('removes multiple messages via Tier 1 delete with id in filter', async () => {
    prestMock.delete.mockResolvedValue([]);

    await messageService.removeMessages(['m1', 'm2']);

    expect(prestMock.delete).toHaveBeenCalledWith('lobehub', 'public', 'messages', {
      id: { in: ['m1', 'm2'] },
    });
  });

  it('skips the network when removeMessages ids are empty', async () => {
    await messageService.removeMessages([]);
    expect(prestMock.delete).not.toHaveBeenCalled();
  });

  it('removes all messages via Tier 1 delete with empty filter (user-scoped)', async () => {
    prestMock.delete.mockResolvedValue([]);

    await messageService.removeAllMessages();

    expect(prestMock.delete).toHaveBeenCalledWith('lobehub', 'public', 'messages', {});
  });
});
