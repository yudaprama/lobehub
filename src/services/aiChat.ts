import {
  type SendMessageServerParams,
  type SendMessageServerResponse,
  type StructureOutputParams,
} from '@lobechat/types';
import { cleanObject } from '@lobechat/utils';

import { egentFetch } from '@/libs/egent/client';

class AiChatService {
  sendMessageInServer = async (
    params: SendMessageServerParams,
    abortController: AbortController,
  ): Promise<SendMessageServerResponse> => {
    const res = await egentFetch('/v1/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanObject(params)),
      signal: abortController?.signal,
    });
    if (!res.ok) throw new Error(`sendMessageInServer failed: ${res.status}`);
    return res.json();
  };

  generateJSON = async (
    params: StructureOutputParams,
    abortController: AbortController,
  ): Promise<any> => {
    const res = await egentFetch('/v1/chat/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: abortController?.signal,
    });
    if (!res.ok) throw new Error(`generateJSON failed: ${res.status}`);
    return res.json();
  };
}

export const aiChatService = new AiChatService();
