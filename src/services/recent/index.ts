import type { TaskStatus } from '@lobechat/types';
import type { RecentItem as PrestRecentItem } from 'prest-js-sdk/lobehub';

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
 * Map an SDK row (already camelCased at the pREST boundary by SDK 0.8.0's
 * LobehubClient + CamelTableTypes) to the UI shape. The mapper only handles
 * URL building and Date parsing — no manual snake→camel mapping.
 *
 * The SDK's `RecentItem` has `metadata: Record<string, unknown> | null` —
 * we narrow it to `ChatTopicMetadata` at the call site since the consumer
 * knows the concrete shape.
 */
const toRecentItem = (item: PrestRecentItem): RecentItem => {
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
    metadata: (item.metadata as ChatTopicMetadata | null) ?? undefined,
    routePath,
    status: (item.status as TaskStatus | null) ?? null,
    title: item.title,
    type: item.type,
    updatedAt: new Date(item.updatedAt),
  };
};

class RecentService {
  getAll = async (limit?: number): Promise<RecentItem[]> => {
    const db = await getLobehubQueryClient();
    // LobehubClient.recentByUser returns RecentItem[] directly (typed via
    // CamelTableTypes in SDK 0.8.0+).
    const rows = await db.recentByUser({
      limit: limit ?? 10,
      ...getWorkspaceParams(),
    });

    return rows.map(toRecentItem);
  };
}

export const recentService = new RecentService();
