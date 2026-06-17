import { beforeEach, describe, expect, it, vi } from 'vitest';

import { notificationService } from './notification';

const prestMock = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  query: vi.fn(),
}));

vi.mock('@/libs/prest/client', () => ({
  getPrestClient: vi.fn(() => Promise.resolve(prestMock)),
}));

beforeEach(() => {
  prestMock.select.mockReset();
  prestMock.update.mockReset();
  prestMock.query.mockReset();
});

describe('NotificationService', () => {
  it('lists notifications via the Tier 2 template', async () => {
    prestMock.query.mockResolvedValue([{ id: 'n1', category: 'system' }]);

    const rows = await notificationService.list({ limit: 10, unreadOnly: true });

    expect(prestMock.query).toHaveBeenCalledWith(
      'lobehub',
      'notificationsListWithDeliveries',
      expect.objectContaining({
        unreadOnly: 'true',
        activeOnly: 'true',
        size: '10',
      }),
    );
    expect(rows).toEqual([{ id: 'n1', category: 'system' }]);
  });

  it('forwards category filter to the template', async () => {
    prestMock.query.mockResolvedValue([]);

    await notificationService.list({ category: 'agent', limit: 5 });

    expect(prestMock.query).toHaveBeenCalledWith(
      'lobehub',
      'notificationsListWithDeliveries',
      expect.objectContaining({ category: 'agent', size: '5' }),
    );
  });

  it('counts unread via Tier 1 select with count:true', async () => {
    prestMock.select.mockResolvedValue([{ count: 3 }]);

    const n = await notificationService.getUnreadCount();

    expect(prestMock.select).toHaveBeenCalledWith(
      'lobehub',
      'public',
      'notifications',
      expect.objectContaining({
        count: true,
        where: { is_read: false, is_archived: false },
      }),
    );
    expect(n).toBe(3);
  });

  it('returns 0 when prest returns no count row', async () => {
    prestMock.select.mockResolvedValue([]);

    const n = await notificationService.getUnreadCount();
    expect(n).toBe(0);
  });

  it('marks a set of ids as read via Tier 1 update', async () => {
    prestMock.update.mockResolvedValue([]);

    await notificationService.markAsRead(['a', 'b']);

    expect(prestMock.update).toHaveBeenCalledWith(
      'lobehub',
      'public',
      'notifications',
      { id: { in: ['a', 'b'] } },
      expect.objectContaining({ is_read: true }),
    );
  });

  it('skips the network entirely when ids is empty', async () => {
    await notificationService.markAsRead([]);
    expect(prestMock.update).not.toHaveBeenCalled();
  });

  it('marks all as read via Tier 1 update with unread filter', async () => {
    prestMock.update.mockResolvedValue([]);

    await notificationService.markAllAsRead();

    expect(prestMock.update).toHaveBeenCalledWith(
      'lobehub',
      'public',
      'notifications',
      { is_read: false, is_archived: false },
      expect.objectContaining({ is_read: true }),
    );
  });

  it('archives a single id via Tier 1 update', async () => {
    prestMock.update.mockResolvedValue([]);

    await notificationService.archive('n1');

    expect(prestMock.update).toHaveBeenCalledWith(
      'lobehub',
      'public',
      'notifications',
      { id: 'n1' },
      expect.objectContaining({ is_archived: true }),
    );
  });

  it('archives all via Tier 1 update with unarchived filter', async () => {
    prestMock.update.mockResolvedValue([]);

    await notificationService.archiveAll();

    expect(prestMock.update).toHaveBeenCalledWith(
      'lobehub',
      'public',
      'notifications',
      { is_archived: false },
      expect.objectContaining({ is_archived: true }),
    );
  });
});
