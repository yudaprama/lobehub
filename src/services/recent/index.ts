import type { TaskStatus } from '@lobechat/types';

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

/**
 * Row shape returned by `LobehubClient.recentByUser` (camelCased by the SDK
 * at the pREST boundary since prest-js-sdk 0.7.0). Declared locally instead
 * of derived from the SDK's `RecentItem` to keep tsgo module-resolution
 * independent of the symlinked SDK dist.
 */
interface RecentQueryRow {
  id: string;
  metadata: ChatTopicMetadata | null;
  routeGroupId: string | null;
  routeId: string | null;
  status: TaskStatus | null;
  title: string;
  type: 'topic' | 'document' | 'task';
  updatedAt: string;
}

/**
 * Map an SDK row (already camelCased at the pREST boundary) to the UI shape.
 *
 * The SDK renames top-level keys (`route_group_id` → `routeGroupId`,
 * `route_id` → `routeId`, `updated_at` → `updatedAt`), so this mapper only
 * handles URL building and Date parsing — no manual snake→camel mapping.
 */
const toRecentItem = (item: RecentQueryRow): RecentItem => {
  let routePath: string;

  switch (item.type) {
    case 'topic': {
      if (item.routeGroupId) {
        routePath = `/group/${item.routeGroupId}?topic=${item.id}`;
      } else if (item.routeId) {
        routePath = SESSION_CHAT_TOPIC_URL(item.routeId, item.id);
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
      routePath = item.routeId ? `/agent/${item.routeId}/task/${item.id}` : `/task/${item.id}`;
      break;
    }
  }

  return {
    agentId: item.routeId,
    icon: item.type,
    id: item.id,
    metadata: item.metadata ?? undefined,
    routePath,
    status: item.status ?? null,
    title: item.title,
    type: item.type,
    updatedAt: new Date(item.updatedAt),
  };
};

class RecentService {
  getAll = async (limit?: number): Promise<RecentItem[]> => {
    const db = await getLobehubQueryClient();
    // LobehubClient.recentByUser camelCases by default (SDK 0.7.0+).
    const rows = (await db.recentByUser({
      limit: limit ?? 10,
      ...getWorkspaceParams(),
    })) as unknown as RecentQueryRow[];

    return rows.map(toRecentItem);
  };
}

export const recentService = new RecentService();
