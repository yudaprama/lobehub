import { initTRPC, TRPCError } from '@trpc/server';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import superjson from 'superjson';

import { type AuthUser, extractUserFromRequest } from './auth.js';
import { getRedis } from './redis.js';

export const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export interface Context {
  redis: ReturnType<typeof getRedis>;
  req: CreateExpressContextOptions['req'];
  res: CreateExpressContextOptions['res'];
  user: AuthUser | null;
}

export const createContext = async ({
  req,
  res,
}: CreateExpressContextOptions): Promise<Context> => {
  const user = await extractUserFromRequest(req);

  let redis: ReturnType<typeof getRedis>;
  try {
    redis = getRedis();
  } catch (error) {
    console.warn('⚠️ Redis unavailable:', error);
    redis = null;
  }

  return {
    req,
    res,
    user,
    redis,
  };
};
