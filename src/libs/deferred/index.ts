/**
 * Deferred-feature helpers for the MVP TS-backend deletion (see MVP_ROADMAP.md).
 *
 * Track B of the cut keeps the frontend for milestone-deferred features but
 * deletes their backend tRPC router (the Node-heavy part). The only required FE
 * change is neutralizing the `lambdaClient.<router>` call so the build still
 * type-checks. These helpers make every such stub typed, consistent, and
 * greppable (search the repo for `deferred`).
 *
 * Two patterns:
 *  - `deferredToMilestone(...)` — THROW for user-initiated actions with no
 *    sensible empty result (e.g. "create X"). The UI surfaces the error.
 *  - `deferredEmpty(...)` — RETURN the feature's empty value (null / [] / {}) for
 *    background or nullable contracts that should degrade silently.
 *
 * At the target milestone, replace the stub body with the real Go/pREST wiring.
 */

export class DeferredFeatureError extends Error {
  constructor(
    public readonly milestone: string,
    public readonly ref: string,
  ) {
    super(`[deferred:${milestone}] ${ref} is not available in the MVP build`);
    this.name = 'DeferredFeatureError';
  }
}

/** Throw from a deferred service method that has no graceful empty value. */
export const deferredToMilestone = (milestone: string, ref: string): never => {
  throw new DeferredFeatureError(milestone, ref);
};

/** Return the empty value for a deferred service method that degrades silently. */
export const deferredEmpty = <T>(_milestone: string, _ref: string, value: T): T => value;
