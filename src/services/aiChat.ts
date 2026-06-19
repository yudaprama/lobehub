import { type SendMessageServerParams, type StructureOutputParams } from '@lobechat/types';
import { cleanObject } from '@lobechat/utils';

import { getPrestClient } from '@/libs/prest/client';
import { lambdaClient } from '@/libs/trpc/client';

export interface RecordTracingFeedbackParams {
  data?: Record<string, unknown>;
  score?: number;
  signal: 'positive' | 'negative' | 'neutral';
  source: string;
  tracingId: string;
}

class AiChatService {
  sendMessageInServer = async (
    params: SendMessageServerParams,
    abortController: AbortController,
  ) => {
    return lambdaClient.aiChat.sendMessageInServer.mutate(cleanObject(params), {
      context: { showNotification: false },
      signal: abortController?.signal,
    });
  };

  generateJSON = async (params: StructureOutputParams, abortController: AbortController) => {
    return lambdaClient.aiChat.outputJSON.mutate(params, {
      context: { showNotification: false },
      signal: abortController?.signal,
    });
  };

  recordTracingFeedback = async (params: RecordTracingFeedbackParams) => {
    const client = await getPrestClient();
    await client
      .from('llm_generation_tracing')
      .eq('id', params.tracingId)
      .patch({
        feedback_data: params.data,
        feedback_score: params.score?.toString(),
        feedback_signal: params.signal,
        feedback_source: params.source,
        feedback_updated_at: new Date().toISOString(),
      });
  };
}

export const aiChatService = new AiChatService();
