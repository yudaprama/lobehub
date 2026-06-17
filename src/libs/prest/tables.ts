import type { TableMap } from 'prest-js-sdk';

/**
 * Row types for all LobeHub pREST tables in [[auth.user_id_filters]].
 *
 * Covers all Phase 1 + Phase 5 tables (60+). Each entry has:
 * - `select`: the row shape returned by pREST (snake_case, timestamp strings)
 * - `input`: the minimal shape needed for INSERT (omits auto-generated fields)
 *
 * Both exclude `user_id` (auto-injected by pREST middleware) and auto-generated
 * `id` columns (returned on INSERT). Timestamps are `string` (ISO 8601 from
 * Postgres → raw JSON).
 */
export interface LobehubTables extends TableMap {
  // ─── Phase 1 (shipped Jun 2026) ──────────────────────────────────────────
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
      id: string; type: string; status: string; error: unknown;
      duration: number | null; created_at: string; updated_at: string;
    };
    input: { id: string; type: string; status: string };
  };
  documents: {
    select: {
      id: string; name: string; url: string; file_type: string;
      size: number; created_at: string;
    };
    input: { id: string; name: string; url: string; file_type: string; size: number };
  };
  files: {
    select: {
      id: string; name: string; url: string; file_type: string;
      size: number; created_at: string;
    };
    input: { id: string; name: string; url: string; file_type: string; size: number };
  };
  generation_batches: {
    select: {
      id: string; generation_topic_id: string; provider: string; model: string;
      prompt: string; width: number; height: number; ratio: string;
      config: unknown; created_at: string; updated_at: string;
    };
    input: { id: string; generation_topic_id: string; provider: string; model: string; prompt: string };
  };
  generation_topics: {
    select: { id: string; name: string; batch_id: string; created_at: string };
    input: { id: string; name: string; batch_id: string };
  };
  generations: {
    select: {
      id: string; generation_batch_id: string; async_task_id: string | null;
      file_id: string | null; seed: number | null; asset: unknown;
      created_at: string; updated_at: string;
    };
    input: { id: string; generation_batch_id: string };
  };
  knowledge_base_files: {
    select: {
      id: string; knowledge_base_id: string; file_id: string;
      chunk_count: number | null; created_at: string;
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
      id: string; title: string; category: string;
      is_read: boolean; is_archived: boolean; created_at: string;
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
      id: string; title: string; group_id: string | null;
      pinned: boolean; updated_at: string; created_at: string;
    };
    input: { id: string; title: string; group_id?: string | null };
  };
  tasks: {
    select: { id: string; name: string; status: string; created_at: string; updated_at: string };
    input: { id: string; name: string; status: string };
  };
  threads: {
    select: {
      id: string; title: string | null; topic_id: string; type: string;
      created_at: string; updated_at: string;
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

  // ─── Phase 5 (Jun 18 2026 — bulk expansion) ──────────────────────────────
  agent_bot_providers: {
    select: {
      id: string; agent_id: string; platform: string; application_id: string;
      enabled: boolean; accessed_at: string; created_at: string; updated_at: string;
    };
    input: { id: string; agent_id: string; platform: string; application_id: string };
  };
  agent_cron_jobs: {
    select: {
      id: string; agent_id: string; name: string | null; description: string | null;
      enabled: boolean | null; cron_pattern: string; timezone: string | null;
      content: string; last_executed_at: string | null; created_at: string; updated_at: string;
    };
    input: { id: string; agent_id: string; cron_pattern: string; content: string };
  };
  agent_documents: {
    select: {
      id: string; agent_id: string; document_id: string;
      deleted_at: string | null; created_at: string; updated_at: string;
    };
    input: { id: string; agent_id: string; document_id: string };
  };
  agent_operations: {
    select: {
      id: string; type: string; status: string; metadata: unknown;
      created_at: string; updated_at: string;
    };
    input: { id: string; type: string; status: string };
  };
  agent_skills: {
    select: {
      id: string; name: string; description: string | null; enabled: boolean;
      created_at: string; updated_at: string;
    };
    input: { id: string; name: string; enabled?: boolean };
  };
  agent_eval_benchmarks: {
    select: { id: string; name: string; identifier: string; created_at: string };
    input: { id: string; name: string; identifier: string };
  };
  agent_eval_datasets: {
    select: { id: string; name: string; identifier: string; created_at: string };
    input: { id: string; name: string; identifier: string };
  };
  agent_eval_experiments: {
    select: { id: string; name: string; benchmark_id: string; created_at: string };
    input: { id: string; name: string; benchmark_id: string };
  };
  agent_eval_runs: {
    select: {
      id: string; experiment_id: string; status: string;
      metrics: unknown; created_at: string; updated_at: string;
    };
    input: { id: string; experiment_id: string; status: string };
  };
  briefs: {
    select: {
      id: string; task_id: string; content: string; resolved_at: string | null;
      created_at: string; updated_at: string;
    };
    input: { id: string; task_id: string; content: string };
  };
  chunks: {
    select: {
      id: string; text: string; metadata: unknown;
      created_at: string; updated_at: string;
    };
    input: { id: string; text: string };
  };
  document_chunks: {
    select: {
      id: string; document_id: string; chunk_id: string;
      index: number; created_at: string;
    };
    input: { id: string; document_id: string; chunk_id: string; index: number };
  };
  document_histories: {
    select: {
      id: string; document_id: string; editor_data: unknown;
      save_source: string; saved_at: string; created_at: string; updated_at: string;
    };
    input: { id: string; document_id: string; editor_data: unknown; save_source: string };
  };
  document_shares: {
    select: {
      id: string; document_id: string; visibility: string;
      created_at: string; updated_at: string;
    };
    input: { id: string; document_id: string; visibility: string };
  };
  embeddings: {
    select: { id: string; chunk_id: string; model: string; dimensions: number; created_at: string };
    input: { id: string; chunk_id: string; model: string; dimensions: number };
  };
  llm_generation_tracing: {
    select: {
      id: string; provider: string; model: string; request_type: string;
      input_tokens: number | null; output_tokens: number | null;
      duration_ms: number | null; created_at: string;
    };
    input: { id: string; provider: string; model: string; request_type: string };
  };
  messenger_account_links: {
    select: {
      id: string; platform: string; platform_user_id: string;
      created_at: string; updated_at: string;
    };
    input: { id: string; platform: string; platform_user_id: string };
  };
  messenger_installations: {
    select: {
      id: string; platform: string; tenant_id: string; application_id: string;
      account_id: string | null; metadata: unknown; token_expires_at: string | null;
      revoked_at: string | null; created_at: string; updated_at: string;
    };
    input: { id: string; platform: string; tenant_id: string; application_id: string };
  };
  rag_eval_datasets: {
    select: { id: string; name: string; description: string | null; created_at: string };
    input: { id: string; name: string; description?: string | null };
  };
  rag_eval_dataset_records: {
    select: { id: string; dataset_id: string; content: unknown; created_at: string };
    input: { id: string; dataset_id: string; content: unknown };
  };
  rag_eval_evaluation: {
    select: { id: string; dataset_id: string; status: string; created_at: string; updated_at: string };
    input: { id: string; dataset_id: string; status: string };
  };
  rag_eval_evaluation_records: {
    select: { id: string; evaluation_id: string; record_id: string; score: number | null; created_at: string };
    input: { id: string; evaluation_id: string; record_id: string };
  };
  task_comments: {
    select: {
      id: string; task_id: string; content: string;
      created_at: string; updated_at: string;
    };
    input: { id: string; task_id: string; content: string };
  };
  task_dependencies: {
    select: { id: string; task_id: string; depends_on_task_id: string; created_at: string };
    input: { id: string; task_id: string; depends_on_task_id: string };
  };
  task_documents: {
    select: { id: string; task_id: string; document_id: string; created_at: string };
    input: { id: string; task_id: string; document_id: string };
  };
  task_topics: {
    select: { id: string; task_id: string; topic_id: string; created_at: string };
    input: { id: string; task_id: string; topic_id: string };
  };
  topic_documents: {
    select: { document_id: string; topic_id: string; created_at: string };
    input: { document_id: string; topic_id: string };
  };
  unstructured_chunks: {
    select: { id: string; text: string; metadata: unknown; created_at: string };
    input: { id: string; text: string };
  };
  user_connectors: {
    select: { id: string; identifier: string; type: string; enabled: boolean; created_at: string };
    input: { id: string; identifier: string; type: string };
  };
  user_connector_tools: {
    select: { id: string; connector_id: string; identifier: string; enabled: boolean };
    input: { id: string; connector_id: string; identifier: string };
  };
  user_installed_plugins: {
    select: {
      identifier: string; type: string; manifest: unknown;
      settings: unknown; custom_params: unknown; source: string | null;
      created_at: string; updated_at: string;
    };
    input: { identifier: string; type: string; manifest?: unknown; settings?: unknown };
  };
  user_memories: {
    select: {
      id: string; memory_category: string | null; memory_layer: string | null;
      memory_type: string | null; title: string | null; summary: string | null;
      details: string | null; status: string | null;
      accessed_count: number | null; last_accessed_at: string; captured_at: string;
      created_at: string; updated_at: string;
    };
    input: { id: string; captured_at?: string };
  };
  user_memories_contexts: {
    select: {
      id: string; type: string | null; title: string | null; description: string | null;
      captured_at: string; created_at: string; updated_at: string;
    };
    input: { id: string };
  };
  user_memories_preferences: {
    select: {
      id: string; user_memory_id: string | null; type: string | null;
      suggestions: string | null; score_priority: number | null;
      captured_at: string; created_at: string; updated_at: string;
    };
    input: { id: string };
  };
  user_memories_activities: {
    select: {
      id: string; user_memory_id: string | null; type: string;
      status: string; timezone: string | null;
      starts_at: string | null; ends_at: string | null;
      captured_at: string; created_at: string; updated_at: string;
    };
    input: { id: string; type: string; status: string };
  };
  user_memories_identities: {
    select: { id: string; type: string | null; summary: string | null; captured_at: string };
    input: { id: string };
  };
  user_memories_experiences: {
    select: { id: string; type: string | null; summary: string | null; captured_at: string };
    input: { id: string };
  };
  user_persona_documents: {
    select: { id: string; name: string; content: string; created_at: string; updated_at: string };
    input: { id: string; name: string; content: string };
  };
  user_persona_document_histories: {
    select: { id: string; document_id: string; content: string; saved_at: string };
    input: { id: string; document_id: string; content: string };
  };
  verify_criteria: {
    select: { id: string; name: string; description: string | null; created_at: string };
    input: { id: string; name: string };
  };
  verify_rubrics: {
    select: { id: string; name: string; description: string | null; created_at: string };
    input: { id: string; name: string };
  };
  verify_rubric_criteria: {
    select: { id: string; rubric_id: string; criterion_id: string; weight: number | null };
    input: { id: string; rubric_id: string; criterion_id: string };
  };
  verify_check_results: {
    select: {
      id: string; rubric_id: string; status: string; score: number | null;
      details: unknown; created_at: string; updated_at: string;
    };
    input: { id: string; rubric_id: string; status: string };
  };
  files_to_sessions: {
    select: { file_id: string; session_id: string; created_at: string };
    input: { file_id: string; session_id: string };
  };
  file_chunks: {
    select: { id: string; file_id: string; chunk_index: number; created_at: string };
    input: { id: string; file_id: string; chunk_index: number };
  };
  devices: {
    select: {
      id: string; device_id: string; identity_source: string;
      hostname: string | null; platform: string | null; friendly_name: string | null;
      default_cwd: string | null; last_seen_at: string;
      created_at: string; updated_at: string;
    };
    input: { id: string; device_id: string; identity_source: string };
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
