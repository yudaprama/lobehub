import type { FollowUpExtractInput, FollowUpExtractResult } from '@lobechat/types';

import { deferredEmpty } from '@/libs/deferred';

class FollowUpActionService {
  /**
   * Extract chips for a message. Returns null on abort or any failure (silent).
   *
   * @deferred(M3) followUpAction.extract → egent runtime. The backend tRPC router
   * was removed for the MVP TS-backend cut; this silently degrades to "no chips"
   * until the feature is re-wired to the Go runtime at milestone M3. The method
   * signature is preserved so callers (store/followUpAction) compile unchanged.
   * See MVP_ROADMAP.md (Track B).
   */
  async extract(
    _input: FollowUpExtractInput,
    _signal?: AbortSignal,
  ): Promise<FollowUpExtractResult | null> {
    return deferredEmpty('M3', 'followUpAction.extract → egent runtime', null);
  }
}

export const followUpActionService = new FollowUpActionService();
