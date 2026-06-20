import { AgentRuntimeError } from '@lobechat/model-runtime';
import { ChatErrorType } from '@lobechat/types';

interface CheckAuthParams {
  kratosAuthorized?: boolean;
}

/**
 * Check if authentication is valid.
 * Only accepts a verified server-side session (Kratos).
 */
export const checkAuthMethod = (params: CheckAuthParams) => {
  const { kratosAuthorized } = params;

  if (kratosAuthorized) return;

  throw AgentRuntimeError.createError(ChatErrorType.Unauthorized);
};
