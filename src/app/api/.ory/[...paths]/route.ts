// Ory Kratos Next.js App Router proxy
// Proxies Kratos API calls through Next.js to avoid CORS issues

import { createApiHandler } from '@ory/integrations/next-edge-app';

export const { GET, POST } = createApiHandler({
  fallbackToPlayground: false,
  dontUseTldForCookieDomain: true,
  forwardAdditionalHeaders: ['x-forwarded-host'],
});
