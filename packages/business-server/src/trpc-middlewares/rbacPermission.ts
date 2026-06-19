import { TRPCError } from '@trpc/server';

import { trpc } from '@/libs/trpc/lambda/init';

import { checkWorkspacePermission } from './ketoClient';

/**
 * Workspace-scoped permission gate backed by Ory Keto.
 *
 * When `KETO_READ_URL` is configured, checks the user's relationship tuple
 * against the workspace. The action code (e.g. 'agent:update') is mapped to
 * a Keto relation tier (view/write/manage) by `ketoClient.ts`.
 *
 * When `KETO_READ_URL` is not configured (personal-scope deployment) or
 * `ctx.workspaceId` is absent (personal request), the gate passes through.
 *
 * On Keto errors the gate fails open (logs a warning, passes through) to
 * avoid blocking all requests during a Keto outage. Monitor `[keto]` log
 * lines for degraded authorization.
 */
const createPermissionMiddleware = (actionCode: string) =>
  trpc.middleware(async (opts) => {
    const { ctx } = opts;
    const userId = (ctx as any).userId as string | null | undefined;
    const workspaceId = (ctx as any).workspaceId as string | null | undefined;

    if (userId && workspaceId) {
      try {
        const allowed = await checkWorkspacePermission(userId, workspaceId, actionCode);
        if (!allowed) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: `Insufficient workspace permission: ${actionCode}`,
          });
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.warn(
          `[keto] Permission check failed for ${userId} on workspace ${workspaceId} ` +
            `(${actionCode}), failing open:`,
          error,
        );
      }
    }

    return opts.next();
  });

export const withRbacPermission = (code: string) => createPermissionMiddleware(code);

export const withAnyRbacPermission = (codes: string[]) =>
  trpc.middleware(async (opts) => {
    const { ctx } = opts;
    const userId = (ctx as any).userId as string | null | undefined;
    const workspaceId = (ctx as any).workspaceId as string | null | undefined;

    if (userId && workspaceId) {
      for (const code of codes) {
        try {
          const allowed = await checkWorkspacePermission(userId, workspaceId, code);
          if (allowed) return opts.next();
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.warn(`[keto] Permission check failed for ${code}, trying next:`, error);
        }
      }
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Insufficient workspace permission: none of [${codes.join(', ')}]`,
      });
    }

    return opts.next();
  });

export const withAllRbacPermissions = (codes: string[]) =>
  trpc.middleware(async (opts) => {
    const { ctx } = opts;
    const userId = (ctx as any).userId as string | null | undefined;
    const workspaceId = (ctx as any).workspaceId as string | null | undefined;

    if (userId && workspaceId) {
      for (const code of codes) {
        try {
          const allowed = await checkWorkspacePermission(userId, workspaceId, code);
          if (!allowed) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: `Insufficient workspace permission: ${code}`,
            });
          }
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.warn(`[keto] Permission check failed for ${code}, failing open:`, error);
        }
      }
    }

    return opts.next();
  });

/**
 * Sugar for the "member-or-owner" gate. Maps the action code to a Keto
 * relation tier and checks workspace membership. The `:all` vs `:owner`
 * scope distinction is handled by the application layer (resource query
 * filtering), not by Keto.
 */
export const withScopedPermission = (action: string) => createPermissionMiddleware(action);
