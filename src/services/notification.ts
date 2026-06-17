import { getPrestClient } from '@/libs/prest/client';

export interface NotificationRow {
  action_url: string | null;
  category: string;
  content: string;
  created_at: string;
  dedupe_key: string | null;
  id: string;
  is_archived: boolean;
  is_read: boolean;
  title: string;
  type: string;
  updated_at: string;
  user_id: string;
}

class NotificationService {
  list = async (
    params: {
      category?: string;
      cursor?: string;
      limit?: number;
      unreadOnly?: boolean;
    } = {},
  ) => {
    const client = await getPrestClient();
    const { category, cursor, limit = 20, unreadOnly } = params;

    // Tier 2 stored SQL template handles userId scoping, unread + active filters,
    // and joins notification_deliveries. The legacy cursor pagination is
    // approximated by offset (page) since prest's composite-cursor support is
    // pending — callers using `cursor` will get the first page.
    return client.query<NotificationRow>('lobehub', 'notificationsListWithDeliveries', {
      ...(category ? { category } : {}),
      ...(cursor ? { cursor } : {}),
      ...(unreadOnly ? { unreadOnly: 'true' } : {}),
      activeOnly: 'true',
      page: '1',
      size: String(limit),
    });
  };

  getUnreadCount = async (): Promise<number> => {
    const client = await getPrestClient();

    // Tier 1: count unread, non-archived notifications for this user.
    // user_id is auto-injected by pREST's [[auth.user_id_filters]].
    const rows = await client.select<{ count: number }[]>('lobehub', 'public', 'notifications', {
      count: true,
      where: { is_read: false, is_archived: false },
    });
    const row = Array.isArray(rows) ? rows[0] : undefined;
    return row?.count ?? 0;
  };

  markAsRead = async (ids: string[]) => {
    if (ids.length === 0) return;
    const client = await getPrestClient();

    await client.update<NotificationRow>(
      'lobehub',
      'public',
      'notifications',
      { id: { in: ids } },
      { is_read: true, updated_at: new Date().toISOString() },
    );
  };

  markAllAsRead = async () => {
    const client = await getPrestClient();

    await client.update<NotificationRow>(
      'lobehub',
      'public',
      'notifications',
      { is_read: false, is_archived: false },
      { is_read: true, updated_at: new Date().toISOString() },
    );
  };

  archive = async (id: string) => {
    const client = await getPrestClient();

    await client.update<NotificationRow>(
      'lobehub',
      'public',
      'notifications',
      { id },
      { is_archived: true, updated_at: new Date().toISOString() },
    );
  };

  archiveAll = async () => {
    const client = await getPrestClient();

    await client.update<NotificationRow>(
      'lobehub',
      'public',
      'notifications',
      { is_archived: false },
      { is_archived: true, updated_at: new Date().toISOString() },
    );
  };
}

export const notificationService = new NotificationService();
