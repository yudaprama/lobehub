import type { TableMap } from 'prest-js-sdk';

/**
 * Row types for LobeHub pREST tables (Tier 1 [[auth.user_id_filters]]).
 *
 * Auto-increment column (`id`) is omitted from these types because pREST
 * generates it on INSERT and returns it via the row result. The only
 * column scoped by user_id_filters is `user_id`, which is auto-injected
 * by the middleware and not inserted manually.
 */
export interface LobehubTables extends TableMap {
  agents: {
    select: {
      id: string;
      title: string;
      avatar: string | null;
      created_at: string;
      updated_at: string;
    };
    input: { id: string; title: string; avatar?: string | null };
  };
  ai_models: {
    select: { id: string; name: string; provider_id: string; created_at: string };
    input: { id: string; name: string; provider_id: string };
  };
  ai_providers: {
    select: { id: string; name: string; created_at: string };
    input: { id: string; name: string };
  };
  api_keys: {
    select: { id: string; name: string; api_key: string; created_at: string };
    input: { id: string; name: string; api_key: string };
  };
  async_tasks: {
    select: {
      id: string;
      type: string;
      status: string;
      error: unknown;
      duration: number | null;
      created_at: string;
      updated_at: string;
    };
    input: { id: string; type: string; status: string };
  };
  documents: {
    select: {
      id: string;
      name: string;
      url: string;
      file_type: string;
      size: number;
      created_at: string;
    };
    input: { id: string; name: string; url: string; file_type: string; size: number };
  };
  files: {
    select: {
      id: string;
      name: string;
      url: string;
      file_type: string;
      size: number;
      created_at: string;
    };
    input: { id: string; name: string; url: string; file_type: string; size: number };
  };
  generation_batches: {
    select: { id: string; topic_id: string; model: string; status: string; created_at: string };
    input: { id: string; topic_id: string; model: string; status: string };
  };
  generation_batches: {
    select: {
      id: string;
      generation_topic_id: string;
      provider: string;
      model: string;
      prompt: string;
      width: number;
      height: number;
      ratio: string;
      config: unknown;
      created_at: string;
      updated_at: string;
    };
    input: {
      id: string;
      generation_topic_id: string;
      provider: string;
      model: string;
      prompt: string;
    };
  };
  generation_topics: {
    select: { id: string; name: string; batch_id: string; created_at: string };
    input: { id: string; name: string; batch_id: string };
  };
  generations: {
    select: {
      id: string;
      generation_batch_id: string;
      async_task_id: string | null;
      file_id: string | null;
      seed: number | null;
      asset: unknown;
      created_at: string;
      updated_at: string;
    };
    input: {
      id: string;
      generation_batch_id: string;
      async_task_id?: string | null;
      file_id?: string | null;
    };
  };
  knowledge_base_files: {
    select: {
      id: string;
      knowledge_base_id: string;
      file_id: string;
      chunk_count: number | null;
      created_at: string;
    };
    input: { id: string; knowledge_base_id: string; file_id: string };
  };
  knowledge_bases: {
    select: { id: string; name: string; description: string | null; created_at: string };
    input: { id: string; name: string; description?: string | null };
  };
  messages: {
    select: LobehubMessageRow;
    input: Record<string, unknown>;
  };
  notifications: {
    select: {
      id: string;
      title: string;
      category: string;
      is_read: boolean;
      is_archived: boolean;
      created_at: string;
    };
    input: { id: string; title: string; category: string };
  };
  push_tokens: {
    select: { id: string; token: string; platform: string; created_at: string };
    input: { id: string; token: string; platform: string };
  };
  session_groups: {
    select: { id: string; name: string; sort: number; created_at: string; updated_at: string };
    input: { id: string; name: string; sort: number };
  };
  sessions: {
    select: {
      id: string;
      title: string;
      group_id: string | null;
      pinned: boolean;
      updated_at: string;
      created_at: string;
    };
    input: { id: string; title: string; group_id?: string | null };
  };
  tasks: {
    select: { id: string; name: string; status: string; created_at: string; updated_at: string };
    input: { id: string; name: string; status: string };
  };
  threads: {
    select: {
      id: string;
      title: string | null;
      topic_id: string;
      type: string;
      created_at: string;
      updated_at: string;
    };
    input: { id: string; title?: string | null; topic_id: string; type: string };
  };
  topics: {
    select: LobehubTopicRow;
    input: Record<string, unknown>;
  };
  users: {
    select: { id: string; email: string; name: string; created_at: string; updated_at: string };
    input: { id: string; email: string; name?: string };
  };
}

/** Row shape for `topics` table columns as returned by pREST. */
export interface LobehubTopicRow {
  agent_id: string | null;
  client_id: string | null;
  completed_at: string | null;
  content: string | null;
  created_at: string;
  description: string | null;
  favorite: boolean;
  group_id: string | null;
  id: string;
  metadata: unknown;
  mode: string | null;
  model: string | null;
  provider: string | null;
  session_id: string | null;
  status: string | null;
  title: string;
  total_cost: number | null;
  total_input_tokens: number | null;
  total_output_tokens: number | null;
  total_tokens: number | null;
  trigger: string | null;
  updated_at: string;
}

/** Row shape for `messages` table columns as returned by pREST. */
export interface LobehubMessageRow {
  agent_id: string | null;
  client_id: string | null;
  content: string;
  created_at: string;
  editor_data: unknown;
  error: unknown;
  favorite: boolean;
  id: string;
  message_group_id: string | null;
  metadata: unknown;
  model: string | null;
  parent_id: string | null;
  provider: string | null;
  quota_id: string | null;
  reasoning: unknown;
  role: string;
  search: unknown;
  session_id: string | null;
  summary: string | null;
  target_id: string | null;
  thread_id: string | null;
  tools: unknown;
  topic_id: string | null;
  updated_at: string;
  usage: unknown;
}
