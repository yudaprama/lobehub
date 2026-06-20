import type { ModelUsage } from '@lobechat/types';

import type { ChatCompletionTool, ChatStreamPayload } from './chat';

interface GenerateObjectMessage {
  content: string;
  name?: string;
  role: 'user' | 'system' | 'assistant';
}

export interface GenerateObjectSchema {
  description?: string;
  name: string;
  schema: {
    additionalProperties?: boolean;
    properties: Record<string, any>;
    required?: string[];
    type: 'object';
  };
  strict?: boolean;
}

export interface GenerateObjectPayload {
  messages: GenerateObjectMessage[];
  model: string;
  reasoning_effort?: ChatStreamPayload['reasoning_effort'];
  responseApi?: boolean;
  schema?: GenerateObjectSchema;
  thinking?: ChatStreamPayload['thinking'];
  tools?: ChatCompletionTool[];
}

/**
 * Caller-facing tracing config for a single `generateObject` call. Passed
 * through `GenerateObjectOptions.tracing` and consumed by runtime hooks
 * to populate OTLP span attributes for agent loop, task execution, and
 * knowledge search tracing.
 *
 * Every field is optional — callers supply the fields they care about.
 */
export interface TracingOptions {
  /** Owning agent ID. */
  agentId?: string;
  /**
   * Short snippet for span descriptions. Pass the user's actual typed text
   * when the prompt wraps it in a template.
   */
  inputHint?: string;
  /**
   * Free-form context written as span attributes. Use this
   * for ad-hoc fields that don't deserve a typed slot (e.g. correlation IDs).
   */
  metadata?: Record<string, unknown>;
  /** Parent trace ID for chained generations. */
  parentTracingId?: string;
  /** Semantic prompt version (e.g. `v1.0`). */
  promptVersion?: string;
  /** Scenario name; falls back to registry lookup by `trigger`. */
  scenario?: string;
  /** Structured-output schema identifier. */
  schemaName?: string;
  /**
   * Override for the prompt-hash system text. Defaults to `messages[0]`
   * when it's a system message.
   */
  systemPrompt?: string;
  /** Topic / conversation ID. */
  topicId?: string;
  /**
   * Caller-supplied UUID for the tracing row. Pass this
   * when the id needs to be known **before** the generation completes —
   * e.g. so the calling route can return it in the response and the client
   * can later post feedback against it. Omit to let the service generate one.
   */
  tracingId?: string;
  /** RequestTrigger string. */
  trigger?: string;
}

export interface GenerateObjectOptions {
  /**
   * response headers
   */
  headers?: Record<string, any>;

  /** Free-form context passed to hooks (e.g. billing, routing). */
  metadata?: Record<string, unknown>;

  onUsage?: (usage: ModelUsage) => void | Promise<void>;

  signal?: AbortSignal;
  /**
   * Structured tracing config consumed by runtime hooks for OTLP span
   * attributes. Strongly typed as `TracingOptions` for call-site safety.
   */
  tracing?: TracingOptions;

  /**
   * userId for the GenerateObject
   */
  user?: string;
}
