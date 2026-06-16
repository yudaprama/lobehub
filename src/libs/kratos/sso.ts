/**
 * Parse SSO providers from environment variable.
 * Supports comma-separated list (both English and Chinese commas).
 */
export const parseSSOProviders = (providersEnv?: string): string[] => {
  const providers = providersEnv?.trim();

  if (!providers) {
    return [];
  }

  return providers
    .split(/[,，]/)
    .map((p) => p.trim())
    .filter(Boolean);
};
