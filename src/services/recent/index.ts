import type { TaskStatus } from '@lobechat/types';
import type { RecentItem as PrestRecentRow } from 'prest-js-sdk/lobehub';

import { SESSION_CHAT_TOPIC_URL } from '@/const/url';
import { getLobehubQueryClient } from '@/libs/prest/client';
import { getWorkspaceParams } from '@/libs/prest/workspaceScope';
import type { ChatTopicMetadata } from '@/types/topic';

export interface RecentItem {
  agentId?: string | null;
  icon: string;
  id: string;
  metadata?: ChatTopicMetadata;
  routePath: string;
  /** Task lifecycle status when `type === 'task'`; null for topic/document. */
  status: TaskStatus | null;
  title: string;
  type: 'topic' | 'document' | 'task';
  updatedAt: Date;
}

type RecentQueryRow = Omit<PrestRecentRow, 'metadata' | 'status'> & {
  metadata: ChatTopicMetadata | null;
  status: TaskStatus | null;
};

const toRecentItem = (item: RecentQueryRow): RecentItem => {
  let routePath: string;

  switch (item.type) {
    case 'topic': {
      if (item.route_group_id) {
        routePath = `/group/${item.route_group_id}?topic=${item.id}`;
      } else if (item.route_id) {
        routePath = SESSION_CHAT_TOPIC_URL(item.route_id, item.id);
      } else {
        routePath = '/';
      }
      break;
    }
    case 'document': {
      routePath = `/page/${item.id}`;
      break;
    }
    case 'task': {
      routePath = item.route_id ? `/agent/${item.route_id}/task/${item.id}` : `/task/${item.id}`;
      break;
    }
  }

  return {
    agentId: item.route_id,
    icon: item.type,
    id: item.id,
    metadata: item.metadata ?? undefined,
    routePath,
    status: item.status ?? null,
    title: item.title,
    type: item.type,
    updatedAt: new Date(item.updated_at),
  };
};

class RecentService {
  getAll = async (limit?: number): Promise<RecentItem[]> => {
    const db = await getLobehubQueryClient();
    const rows = (await db.recentByUser({
      limit: limit ?? 10,
      ...getWorkspaceParams(),
    })) as RecentQueryRow[];

    return rows.map(toRecentItem);
  };
}

export const recentService = new RecentService();
