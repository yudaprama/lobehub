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
  // ─── Phase 5 (Jun 18 2026 — bulk expansion) ──────────────────────────────
  agent_bot_providers: {
    select: {
      id: string;
      agent_id: string;
      platform: string;
      application_id: string;
      enabled: boolean;
      accessed_at: string;
      created_at: string;
      updated_at: string;
    };
    input: { id: string; agent_id: string; platform: string; application_id: string };
  };
  agent_cron_jobs: {
    select: {
      id: string;
      agent_id: string;
      name: string | null;
      description: string | null;
      enabled: boolean | null;
      cron_pattern: string;
      timezone: string | null;
      content: string;
      last_executed_at: string | null;
      created_at: string;
      updated_at: string;
    };
    input: { id: string; agent_id: string; cron_pattern: string; content: string };
  };
  agent_documents: {
    select: {
      id: string;
      agent_id: string;
      document_id: string;
      deleted_at: string | null;
      created_at: string;
      updated_at: string;
    };
    input: { id: string; agent_id: string; document_id: string };
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
      id: string;
      experiment_id: string;
      status: string;
      metrics: unknown;
      created_at: string;
      updated_at: string;
    };
    input: { id: string; experiment_id: string; status: string };
  };
  agent_operations: {
    select: {
      id: string;
      type: string;
      status: string;
      metadata: unknown;
      created_at: string;
      updated_at: string;
    };
    input: { id: string; type: string; status: string };
  };
  agent_skills: {
    select: {
      id: string;
      name: string;
      description: string | null;
      enabled: boolean;
      created_at: string;
      updated_at: string;
    };
    input: { id: string; name: string; enabled?: boolean };
  };
  // ─── Phase 1 (shipped Jun 2026) ──────────────────────────────────────────
  agents: {
    select: {
      id: string;
      slug: string | null;
      title: string | null;
      description: string | null;
      tags: string[] | null;
      avatar: string | null;
      pinned: boolean | null;
      virtual: boolean | null;
      client_id: string | null;
      model: string | null;
      session_group_id: string | null;
      workspace_id: string | null;
      created_at: string;
      updated_at: string;
    };
    input: {
      id: string;
      title?: string | null;
      avatar?: string | null;
      slug?: string | null;
      description?: string | null;
      tags?: string[] | null;
      pinned?: boolean | null;
      virtual?: boolean | null;
      session_group_id?: string | null;
      model?: string | null;
    };
  };
  ai_models: {
    select: {
      id: string;
      name: string;
      provider_id: string;
      display_name: string | null;
      description: string | null;
      organization: string | null;
      enabled: boolean | null;
      type: string;
      sort: number | null;
      pricing: unknown;
      parameters: unknown;
      config: unknown;
      abilities: unknown;
      context_window_tokens: number | null;
      source: string | null;
      released_at: string | null;
      settings: unknown;
      workspace_id: string | null;
      created_at: string;
      updated_at: string;
    };
    input: {
      id: string;
      name: string;
      provider_id: string;
      display_name?: string | null;
      description?: string | null;
      organization?: string | null;
      enabled?: boolean | null;
      type?: string;
      sort?: number | null;
      pricing?: unknown;
      parameters?: unknown;
      config?: unknown;
      abilities?: unknown;
      context_window_tokens?: number | null;
      source?: string | null;
      released_at?: string | null;
      settings?: unknown;
    };
  };
  ai_providers: {
    select: {
      id: string;
      name: string | null;
      sort: number | null;
      enabled: boolean | null;
      fetch_on_client: boolean | null;
      check_model: string | null;
      logo: string | null;
      description: string | null;
      key_vaults: string | null;
      source: string | null;
      settings: unknown;
      config: unknown;
      workspace_id: string | null;
      created_at: string;
      updated_at: string;
    };
    input: {
      id: string;
      name?: string | null;
      sort?: number | null;
      enabled?: boolean | null;
      fetch_on_client?: boolean | null;
      check_model?: string | null;
      logo?: string | null;
      description?: string | null;
      key_vaults?: string | null;
      source?: string | null;
      settings?: unknown;
      config?: unknown;
    };
  };
  api_keys: {
    select: {
      id: string;
      name: string;
      key: string;
      key_hash: string | null;
      description: string | null;
      enabled: boolean | null;
      expires_at: string | null;
      last_used_at: string | null;
      user_id: string;
      workspace_id: string | null;
      created_at: string;
      updated_at: string;
    };
    input: {
      id: string;
      name: string;
      key: string;
      key_hash?: string | null;
      description?: string | null;
      enabled?: boolean | null;
      expires_at?: string | null;
    };
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
  briefs: {
    select: {
      id: string;
      user_id: string;
      workspace_id: string | null;
      task_id: string | null;
      cron_job_id: string | null;
      topic_id: string | null;
      agent_id: string | null;
      type: string;
      priority: string | null;
      title: string;
      summary: string;
      artifacts: unknown;
      actions: unknown;
      resolved_action: string | null;
      resolved_comment: string | null;
      read_at: string | null;
      resolved_at: string | null;
      trigger: string | null;
      metadata: unknown;
      created_at: string;
    };
    input: {
      id: string;
      type: string;
      title: string;
      summary: string;
      task_id?: string | null;
      cron_job_id?: string | null;
      topic_id?: string | null;
      agent_id?: string | null;
      priority?: string | null;
      artifacts?: unknown;
      actions?: unknown;
      trigger?: string | null;
      metadata?: unknown;
      read_at?: string | null;
      resolved_at?: string | null;
      resolved_action?: string | null;
      resolved_comment?: string | null;
    };
  };
  chunks: {
    select: {
      id: string;
      text: string;
      metadata: unknown;
      created_at: string;
      updated_at: string;
    };
    input: { id: string; text: string };
  };
  devices: {
    select: {
      id: string;
      device_id: string;
      identity_source: string;
      hostname: string | null;
      platform: string | null;
      friendly_name: string | null;
      default_cwd: string | null;
      last_seen_at: string;
      created_at: string;
      updated_at: string;
    };
    input: { id: string; device_id: string; identity_source: string };
  };
  document_chunks: {
    select: {
      id: string;
      document_id: string;
      chunk_id: string;
      index: number;
      created_at: string;
    };
    input: { id: string; document_id: string; chunk_id: string; index: number };
  };
  document_histories: {
    select: {
      id: string;
      document_id: string;
      editor_data: unknown;
      save_source: string;
      saved_at: string;
      created_at: string;
      updated_at: string;
    };
    input: { id: string; document_id: string; editor_data: unknown; save_source: string };
  };
  document_shares: {
    select: {
      id: string;
      document_id: string;
      visibility: string;
      created_at: string;
      updated_at: string;
    };
    input: { id: string; document_id: string; visibility: string };
  };
  documents: {
    select: {
      id: string;
      title: string | null;
      description: string | null;
      content: string | null;
      file_type: string;
      filename: string | null;
      total_char_count: number;
      total_line_count: number;
      metadata: Record<string, unknown> | null;
      pages: unknown;
      source_type: string;
      source: string;
      file_id: string | null;
      knowledge_base_id: string | null;
      parent_id: string | null;
      user_id: string;
      client_id: string | null;
      editor_data: Record<string, unknown> | null;
      slug: string | null;
      workspace_id: string | null;
      created_at: string;
      updated_at: string;
    };
    input: {
      id?: string;
      title?: string | null;
      description?: string | null;
      content?: string | null;
      file_type: string;
      filename?: string | null;
      source_type?: string;
      source?: string;
      type?: string;
      file_id?: string | null;
      knowledge_base_id?: string | null;
      parent_id?: string | null;
      editor_data?: Record<string, unknown> | null;
      slug?: string | null;
      metadata?: Record<string, unknown> | null;
    };
  };

  embeddings: {
    select: { id: string; chunk_id: string; model: string; dimensions: number; created_at: string };
    input: { id: string; chunk_id: string; model: string; dimensions: number };
  };
  file_chunks: {
    select: { id: string; file_id: string; chunk_index: number; created_at: string };
    input: { id: string; file_id: string; chunk_index: number };
  };
  files: {
    select: {
      id: string;
      user_id: string;
      file_type: string;
      file_hash: string | null;
      name: string;
      size: number;
      url: string;
      source: string | null;
      parent_id: string | null;
      client_id: string | null;
      metadata: Record<string, unknown> | null;
      chunk_task_id: string | null;
      embedding_task_id: string | null;
      workspace_id: string | null;
      created_at: string;
      updated_at: string;
    };
    input: {
      id?: string;
      name: string;
      url: string;
      file_type: string;
      size: number;
      source?: string | null;
      parent_id?: string | null;
      metadata?: Record<string, unknown> | null;
      file_hash?: string | null;
    };
  };
  files_to_sessions: {
    select: { file_id: string; session_id: string; created_at: string };
    input: { file_id: string; session_id: string };
  };
  generation_batches: {
    select: {
      id: string;
      generation_topic_id: string;
      user_id: string;
      workspace_id: string | null;
      provider: string;
      model: string;
      prompt: string;
      width: number | null;
      height: number | null;
      ratio: string | null;
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
      width?: number | null;
      height?: number | null;
      ratio?: string | null;
    };
  };
  generation_topics: {
    select: {
      id: string;
      title: string | null;
      type: string;
      cover_url: string | null;
      user_id: string;
      workspace_id: string | null;
      created_at: string;
      updated_at: string;
      accessed_at: string;
    };
    input: {
      type?: string;
      title?: string | null;
      cover_url?: string | null;
    };
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
    input: { id: string; generation_batch_id: string };
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
    select: {
      id: string;
      name: string;
      description: string | null;
      avatar: string | null;
      workspace_id: string | null;
      created_at: string;
      updated_at: string;
    };
    input: { id: string; name: string; description?: string | null; avatar?: string | null };
  };
  messages: {
    select: LobehubMessageRow;
    input: Record<string, unknown>;
  };
  messenger_account_links: {
    select: {
      id: string;
      platform: string;
      platform_user_id: string;
      created_at: string;
      updated_at: string;
    };
    input: { id: string; platform: string; platform_user_id: string };
  };
  messenger_installations: {
    select: {
      id: string;
      platform: string;
      tenant_id: string;
      application_id: string;
      account_id: string | null;
      metadata: unknown;
      token_expires_at: string | null;
      revoked_at: string | null;
      created_at: string;
      updated_at: string;
    };
    input: { id: string; platform: string; tenant_id: string; application_id: string };
  };
  notifications: {
    select: {
      id: string;
      user_id: string;
      category: string;
      type: string;
      title: string;
      content: string;
      dedupe_key: string | null;
      action_url: string | null;
      is_read: boolean;
      is_archived: boolean;
      created_at: string;
      updated_at: string;
    };
    input: {
      id: string;
      category: string;
      type: string;
      title: string;
      content: string;
      dedupe_key?: string | null;
      action_url?: string | null;
    };
  };
  push_tokens: {
    select: { id: string; token: string; platform: string; created_at: string };
    input: { id: string; token: string; platform: string };
  };
  rag_eval_dataset_records: {
    select: { id: string; dataset_id: string; content: unknown; created_at: string };
    input: { id: string; dataset_id: string; content: unknown };
  };
  rag_eval_datasets: {
    select: { id: string; name: string; description: string | null; created_at: string };
    input: { id: string; name: string; description?: string | null };
  };
  rag_eval_evaluation: {
    select: {
      id: string;
      dataset_id: string;
      status: string;
      created_at: string;
      updated_at: string;
    };
    input: { id: string; dataset_id: string; status: string };
  };
  rag_eval_evaluation_records: {
    select: {
      id: string;
      evaluation_id: string;
      record_id: string;
      score: number | null;
      created_at: string;
    };
    input: { id: string; evaluation_id: string; record_id: string };
  };
  session_groups: {
    select: {
      id: string;
      name: string;
      sort: number | null;
      accessed_at: string;
      created_at: string;
      updated_at: string;
    };
    input: { id: string; name: string; sort?: number | null };
  };
  sessions: {
    select: {
      id: string;
      title: string | null;
      slug: string | null;
      group_id: string | null;
      type: string | null;
      pinned: boolean | null;
      metadata: unknown;
      workspace_id: string | null;
      accessed_at: string;
      updated_at: string;
      created_at: string;
    };
    input: {
      id: string;
      title?: string | null;
      group_id?: string | null;
      type?: string | null;
      pinned?: boolean | null;
    };
  };
  task_comments: {
    select: {
      id: string;
      task_id: string;
      content: string;
      created_at: string;
      updated_at: string;
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
  tasks: {
    select: { id: string; name: string; status: string; created_at: string; updated_at: string };
    input: { id: string; name: string; status: string };
  };
  threads: {
    select: {
      id: string;
      title: string | null;
      content: string | null;
      editor_data: Record<string, unknown> | null;
      type: string;
      status: string | null;
      topic_id: string;
      source_message_id: string | null;
      parent_thread_id: string | null;
      client_id: string | null;
      agent_id: string | null;
      group_id: string | null;
      metadata: unknown;
      user_id: string;
      last_active_at: string | null;
      workspace_id: string | null;
      accessed_at: string;
      created_at: string;
      updated_at: string;
    };
    input: {
      id: string;
      title?: string | null;
      content?: string | null;
      editor_data?: Record<string, unknown> | null;
      type: string;
      topic_id: string;
      source_message_id?: string | null;
      parent_thread_id?: string | null;
      client_id?: string | null;
      agent_id?: string | null;
      group_id?: string | null;
      metadata?: unknown;
      last_active_at?: string | null;
    };
  };
  topic_documents: {
    select: { document_id: string; topic_id: string; created_at: string };
    input: { document_id: string; topic_id: string };
  };
  topics: {
    select: LobehubTopicRow;
    input: {
      title?: string | null;
      favorite?: boolean;
      session_id?: string | null;
      content?: string | null;
      editor_data?: unknown;
      agent_id?: string | null;
      group_id?: string | null;
      client_id?: string | null;
      description?: string | null;
      metadata?: unknown;
      trigger?: string | null;
      mode?: string | null;
      status?: string | null;
    };
  };
  unstructured_chunks: {
    select: { id: string; text: string; metadata: unknown; created_at: string };
    input: { id: string; text: string };
  };
  user_connector_tools: {
    select: { id: string; connector_id: string; identifier: string; enabled: boolean };
    input: { id: string; connector_id: string; identifier: string };
  };
  user_connectors: {
    select: { id: string; identifier: string; type: string; enabled: boolean; created_at: string };
    input: { id: string; identifier: string; type: string };
  };
  user_installed_plugins: {
    select: {
      identifier: string;
      type: string;
      manifest: unknown;
      settings: unknown;
      custom_params: unknown;
      source: string | null;
      created_at: string;
      updated_at: string;
    };
    input: {
      identifier: string;
      type: string;
      manifest?: unknown;
      settings?: unknown;
      custom_params?: unknown;
      source?: string | null;
    };
  };
  user_memories: {
    select: {
      id: string;
      memory_category: string | null;
      memory_layer: string | null;
      memory_type: string | null;
      title: string | null;
      summary: string | null;
      details: string | null;
      status: string | null;
      accessed_count: number | null;
      last_accessed_at: string;
      captured_at: string;
      created_at: string;
      updated_at: string;
    };
    input: { id: string; captured_at?: string };
  };
  user_memories_activities: {
    select: {
      id: string;
      user_memory_id: string | null;
      type: string;
      status: string;
      timezone: string | null;
      starts_at: string | null;
      ends_at: string | null;
      captured_at: string;
      created_at: string;
      updated_at: string;
    };
    input: { id: string; type: string; status: string };
  };
  user_memories_contexts: {
    select: {
      id: string;
      type: string | null;
      title: string | null;
      description: string | null;
      captured_at: string;
      created_at: string;
      updated_at: string;
    };
    input: { id: string };
  };
  user_memories_experiences: {
    select: { id: string; type: string | null; summary: string | null; captured_at: string };
    input: { id: string };
  };
  user_memories_identities: {
    select: { id: string; type: string | null; summary: string | null; captured_at: string };
    input: { id: string };
  };
  user_memories_preferences: {
    select: {
      id: string;
      user_memory_id: string | null;
      type: string | null;
      suggestions: string | null;
      score_priority: number | null;
      captured_at: string;
      created_at: string;
      updated_at: string;
    };
    input: { id: string };
  };
  user_persona_document_histories: {
    select: { id: string; document_id: string; content: string; saved_at: string };
    input: { id: string; document_id: string; content: string };
  };
  user_persona_documents: {
    select: { id: string; name: string; content: string; created_at: string; updated_at: string };
    input: { id: string; name: string; content: string };
  };
  users: {
    select: { id: string; email: string; name: string; created_at: string; updated_at: string };
    input: { id: string; email: string; name?: string };
  };
  verify_check_results: {
    select: {
      id: string;
      rubric_id: string;
      status: string;
      score: number | null;
      details: unknown;
      created_at: string;
      updated_at: string;
    };
    input: { id: string; rubric_id: string; status: string };
  };
  verify_criteria: {
    select: { id: string; name: string; description: string | null; created_at: string };
    input: { id: string; name: string };
  };
  verify_rubric_criteria: {
    select: { id: string; rubric_id: string; criterion_id: string; weight: number | null };
    input: { id: string; rubric_id: string; criterion_id: string };
  };
  verify_rubrics: {
    select: { id: string; name: string; description: string | null; created_at: string };
    input: { id: string; name: string };
  };

  workspace_audit_logs: {
    select: {
      id: string;
      workspace_id: string;
      user_id: string | null;
      action: string;
      resource_type: string | null;
      resource_id: string | null;
      metadata: Record<string, unknown> | null;
      ip_address: string | null;
      created_at: string;
    };
    input: { id: string; workspace_id: string; action: string };
  };
  workspace_invitations: {
    select: {
      id: string;
      workspace_id: string;
      inviter_id: string;
      email: string | null;
      role: string;
      token: string;
      status: string;
      expires_at: string;
      created_at: string;
      updated_at: string;
    };
    input: {
      id: string;
      workspace_id: string;
      inviter_id: string;
      token: string;
      expires_at: string;
    };
  };
  workspace_members: {
    select: {
      workspace_id: string;
      user_id: string;
      role: string;
      joined_at: string;
      updated_at: string;
      deleted_at: string | null;
    };
    input: { workspace_id: string; user_id: string; role?: string };
  };
  // ─── Workspace tables (Phase 2 — Tier 1 via [[auth.workspace_id_filters]]) ─
  workspaces: {
    select: {
      id: string;
      slug: string;
      name: string;
      description: string | null;
      avatar: string | null;
      primary_owner_id: string;
      settings: Record<string, unknown> | null;
      created_at: string;
      updated_at: string;
    };
    input: { id: string; slug: string; name: string; primary_owner_id: string };
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
