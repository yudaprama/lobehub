import { headers } from 'next/headers';

import { getKratosSession } from '@/libs/kratos/server-session';

export const getUserAuth = async () => {
  const currentHeaders = await headers();

  const session = await getKratosSession(currentHeaders);

  const userId = session?.user?.id;

  return { session, userId };
};

/**
 * Extract Bearer Token from authorization header
 * @param authHeader - Authorization header (e.g. "Bearer xxx")
 * @returns Bearer Token or null (if authorization header is invalid or does not exist)
 */
export const extractBearerToken = (authHeader?: string | null): string | null => {
  if (!authHeader) return null;

  const trimmedHeader = authHeader.trim();

  if (!trimmedHeader.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  const token = trimmedHeader.slice(7).trim();

  return token || null;
};

/**
 * Extract JWT token from Oidc-Auth header
 * @param authHeader - Oidc-Auth header value (e.g. "Oidc-Auth xxx")
 * @returns JWT token or null (if authorization header is invalid or does not exist)
 */
export const extractOidcAuthToken = (authHeader?: string | null): string | null => {
  if (!authHeader) return null;

  const trimmedHeader = authHeader.trim();

  if (!trimmedHeader.toLowerCase().startsWith('oidc-auth ')) {
    return null;
  }

  const token = trimmedHeader.slice(10).trim();

  return token || null;
};
