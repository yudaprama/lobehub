import { asyncRouter as router, publicProcedure } from '@/libs/trpc/async';

export const asyncRouter = router({
  healthcheck: publicProcedure.query(() => "i'm live!"),
});

export type AsyncRouter = typeof asyncRouter;

export type { UnifiedAsyncCaller } from './caller';
export { createAsyncCaller, createAsyncServerClient } from './caller';
