import type { AgentStreamEvent } from '@lobechat/agent-gateway-client';
import type { ExecAgentAppContext, ExecAgentResult } from '@lobechat/types';

import { lambdaClient } from '@/libs/trpc/client';

export type { ExecAgentResult };
export type { AgentStreamEvent };

/**
 * Resume instruction for an operation that hit `human_approve_required`. When
 * present, the new op acts as the "continue" step: server reads the target tool
 * message, writes the user's decision, and either re-dispatches the tool
 * (approved) or feeds the rejection back to the LLM as user feedback
 * (rejected / rejected_continue).
 *
 * Kept as a top-level field (not folded into `appContext`) so the server schema
 * can validate it independently.
 */
export interface ResumeApprovalParam {
  decision: 'approved' | 'rejected' | 'rejected_continue';
  /** ID of the pending `role='tool'` message this decision targets. */
  parentMessageId: string;
  /** Optional user-supplied rejection reason (only meaningful for rejected variants). */
  rejectionReason?: string;
  /** tool_call_id of the pending tool call being approved/rejected. */
  toolCallId: string;
}

export interface ExecAgentTaskParams {
  agentId?: string;
  appContext?: ExecAgentAppContext;
  autoStart?: boolean;
  deviceId?: string;
  existingMessageIds?: string[];
  /** File IDs of already-uploaded attachments to attach to the new user message */
  fileIds?: string[];
  /** Parent message ID for regeneration/continue (skip user message creation, branch from this message) */
  parentMessageId?: string;
  prompt: string;
  /** Resume a previous op paused on `human_approve_required` instead of starting from a fresh user prompt. */
  resumeApproval?: ResumeApprovalParam;
  slug?: string;
  /**
   * Override what initiated this operation. Server defaults to `'chat'` when
   * omitted. Pass a more specific value (`'cli'`, `'openapi'`, …) so the
   * `agent_operations.trigger` column reflects the real source.
   */
  trigger?: string;
}

/**
 * Parameters for execSubAgentTask
 * Supports both Group mode (with groupId) and Single Agent mode (without groupId)
 */
export interface ExecSubAgentTaskParams {
  agentId: string;
  /** Optional for Single Agent mode, required for Group mode */
  groupId?: string;
  instruction: string;
  parentMessageId: string;
  /** Parent operation ID for dispatching callAgent hooks */
  parentOperationId?: string;
  timeout?: number;
  /** Task title (shown in UI, used as thread title) */
  title?: string;
  topicId: string;
}

export interface GetSubAgentTaskStatusParams {
  threadId: string;
}

export interface InterruptTaskParams {
  operationId?: string;
  threadId?: string;
  topicId?: string;
}

/**
 * Parameters for createClientTaskThread
 * Creates a Thread for client-side task execution (desktop only, single agent mode)
 */
export interface CreateClientTaskThreadParams {
  agentId: string;
  groupId?: string;
  /** Initial user message content (task instruction) */
  instruction: string;
  parentMessageId: string;
  title?: string;
  topicId: string;
}

/**
 * Parameters for createClientGroupAgentTaskThread
 * Creates a Thread for client-side task execution in Group mode
 */
export interface CreateClientGroupAgentTaskThreadParams {
  /** The Group ID (required for Group mode) */
  groupId: string;
  /** Initial user message content (task instruction) */
  instruction: string;
  parentMessageId: string;
  /** The Sub-Agent ID that will execute the task (worker agent in group) */
  subAgentId: string;
  title?: string;
  topicId: string;
}

/**
 * Parameters for updateClientTaskThreadStatus
 * Updates Thread status after client-side execution completes
 */
export interface UpdateClientTaskThreadStatusParams {
  completionReason: 'done' | 'error' | 'interrupted';
  error?: string;
  metadata?: {
    totalCost?: number;
    totalMessages?: number;
    totalSteps?: number;
    totalTokens?: number;
    totalToolCalls?: number;
  };
  resultContent?: string;
  threadId: string;
}

class AiAgentService {
  /**
   * Execute a single Agent task.
   * Returns the operationId needed to connect to the Agent Gateway.
   *
   * When NEXT_PUBLIC_AGENT_URL is set, calls the Go backend (egent-lobehub)
   * directly. Falls back to Node.js tRPC when Go is unavailable or fails.
   */
  async execAgentTask(
    params: ExecAgentTaskParams,
    options?: { signal?: AbortSignal },
  ): Promise<ExecAgentResult> {
    // Try Go backend first when configured.
    const agentUrl =
      (typeof window !== 'undefined' && (window as any).__NEXT_PUBLIC_AGENT_URL__) ||
      (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_AGENT_URL);

    if (agentUrl) {
      try {
        return await this.execAgentViaGoSync(params, options);
      } catch (goErr) {
        console.warn('[AiAgentService] Go backend failed, falling back to tRPC:', goErr);
      }
    }

    return await lambdaClient.aiAgent.execAgent.mutate(params, options);
  }

  /**
   * Non-streaming call to the Go backend. Returns ExecAgentResult so the
   * FE can connect to the Agent Gateway WebSocket for streaming as usual.
   */
  private async execAgentViaGoSync(
    params: ExecAgentTaskParams,
    options?: { signal?: AbortSignal },
  ): Promise<ExecAgentResult> {
    const agentUrl =
      (typeof window !== 'undefined' && (window as any).__NEXT_PUBLIC_AGENT_URL__) ||
      (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_AGENT_URL) ||
      'http://localhost:10531';

    const res = await fetch(`${agentUrl}/v1/agent/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: params.agentId,
        prompt: params.prompt,
        stream: false,
        ...(params.appContext?.topicId && { topicId: params.appContext.topicId }),
        ...(params.appContext?.sessionId && { sessionId: params.appContext.sessionId }),
      }),
      signal: options?.signal,
    });

    if (!res.ok) {
      throw new Error(`Go agent exec failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return {
      agentId: data.agentId,
      assistantMessageId: data.assistantMessageId,
      autoStarted: data.autoStarted ?? true,
      createdAt: data.createdAt,
      message: data.message ?? 'operation started',
      operationId: data.operationId,
      status: data.status ?? 'running',
      success: data.success ?? true,
      timestamp: data.timestamp,
      topicId: data.topicId,
      userMessageId: data.userMessageId,
    } as ExecAgentResult;
  }

  /**
   * Execute an agent via the Go backend (egent-lobehub) directly.
   * Bypasses the Node.js tRPC router — calls POST /v1/agent/exec with
   * SSE streaming. Returns an AsyncIterable of AgentStreamEvent for
   * the caller to consume.
   *
   * Requires NEXT_PUBLIC_AGENT_URL env var (e.g. https://agent.getkawai.com).
   */
  async *execAgentViaGo(
    params: {
      agentId: string;
      model?: string;
      prompt: string;
      provider?: string;
      workspaceId?: string;
    },
    options?: { signal?: AbortSignal },
  ): AsyncGenerator<AgentStreamEvent> {
    const agentUrl =
      (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_AGENT_URL) ||
      'http://localhost:10531';

    const res = await fetch(`${agentUrl}/v1/agent/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: params.agentId,
        model: params.model,
        prompt: params.prompt,
        provider: params.provider,
        stream: true,
        workspaceId: params.workspaceId,
      }),
      signal: options?.signal,
    });

    if (!res.ok) {
      throw new Error(`agent exec failed: ${res.status} ${res.statusText}`);
    }
    if (!res.body) {
      throw new Error('agent exec: no response body');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event = JSON.parse(line.slice(6)) as AgentStreamEvent;
            yield event;
            if (event.type === 'agent_runtime_end' || event.type === 'error') {
              return;
            }
          } catch {
            // Skip malformed SSE data lines
          }
        }
      }
    }
  }

  /**
   * Execute a sub-agent task (supports both Group and Single Agent mode)
   *
   * - Group mode: pass groupId, Thread will be associated with the Group
   * - Single Agent mode: omit groupId, Thread will only be associated with the Agent
   */
  /**
   * Get a fresh JWT token for Gateway WebSocket reconnection.
   */
  async refreshGatewayToken(topicId: string): Promise<{ token: string }> {
    return await lambdaClient.aiAgent.refreshGatewayToken.query({ topicId });
  }

  async execSubAgentTask(params: ExecSubAgentTaskParams) {
    return await lambdaClient.aiAgent.execSubAgentTask.mutate(params);
  }

  /**
   * Get SubAgent task status by threadId
   * Works for both Group and Single Agent mode tasks
   */
  async getSubAgentTaskStatus(params: GetSubAgentTaskStatusParams) {
    return await lambdaClient.aiAgent.getSubAgentTaskStatus.query(params);
  }

  /**
   * Interrupt a running task
   */
  async interruptTask(params: InterruptTaskParams) {
    return await lambdaClient.aiAgent.interruptTask.mutate(params);
  }

  /**
   * Create Thread for client-side task execution (desktop only, single agent mode)
   *
   * This method is called when runInClient=true on desktop client.
   * It creates the Thread but does NOT execute the task - execution happens locally.
   */
  async createClientTaskThread(params: CreateClientTaskThreadParams) {
    return await lambdaClient.aiAgent.createClientTaskThread.mutate(params);
  }

  /**
   * Create Thread for client-side task execution in Group mode
   *
   * This method is specifically for Group Chat scenarios where:
   * - Messages may have different agentIds (supervisor, workers)
   * - Thread messages query should not filter by agentId
   */
  async createClientGroupAgentTaskThread(params: CreateClientGroupAgentTaskThreadParams) {
    return await lambdaClient.aiAgent.createClientGroupAgentTaskThread.mutate(params);
  }

  /**
   * Update Thread status after client-side task execution completes
   *
   * This method is called by desktop client after task execution finishes.
   */
  async updateClientTaskThreadStatus(params: UpdateClientTaskThreadStatusParams) {
    return await lambdaClient.aiAgent.updateClientTaskThreadStatus.mutate(params);
  }
}

export const aiAgentService = new AiAgentService();
