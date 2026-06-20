import { protectedProcedure, publicProcedure, router } from './context.js';

export const appRouter = router({
  healthcheck: publicProcedure.query(() => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    mode: 'standalone',
  })),

  systemInfo: protectedProcedure.query(({ ctx }) => ({
    user: ctx.user,
    hasRedis: !!ctx.redis,
    timestamp: new Date().toISOString(),
  })),

  echo: publicProcedure
    .input((input: unknown) => input as { message: string })
    .query(({ input }) => ({
      echoed: input.message,
      timestamp: new Date().toISOString(),
    })),
});

export type AppRouter = typeof appRouter;
