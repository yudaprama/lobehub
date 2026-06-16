import type { Request } from 'express';

export interface AuthUser {
  email?: string;
  id: string;
  role?: string;
}

/**
 * Extract user from Authorization header
 * Supports:
 * - Bearer token (API key from KEY_VAULTS_SECRET)
 * - JWT tokens (if JWT_SECRET is set)
 */
export const extractUserFromRequest = async (req: Request): Promise<AuthUser | null> => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  // Check if token matches KEY_VAULTS_SECRET (internal API key)
  const keyVaultsSecret = process.env.KEY_VAULTS_SECRET;
  if (keyVaultsSecret && token === keyVaultsSecret) {
    return {
      id: 'system',
      role: 'admin',
    };
  }

  // TODO: Add JWT verification if JWT_SECRET is set
  // For now, treat any other token as invalid

  return null;
};

/**
 * Middleware to require authentication
 */
export const requireAuth = async (req: Request): Promise<AuthUser> => {
  const user = await extractUserFromRequest(req);

  if (!user) {
    throw new Error('Unauthorized: Invalid or missing authentication token');
  }

  return user;
};
