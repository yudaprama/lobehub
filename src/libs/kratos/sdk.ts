import { Configuration, FrontendApi } from '@ory/client';
import { edgeConfig } from '@ory/integrations/next';

const localConfig = {
  basePath:
    process.env.NEXT_PUBLIC_KRATOS_PUBLIC_URL ||
    process.env.KRATOS_PUBLIC_URL ||
    'http://localhost:4433',
  baseOptions: { withCredentials: true },
};

export const kratos = new FrontendApi(
  new Configuration(
    process.env.NEXT_PUBLIC_KRATOS_PUBLIC_URL || process.env.KRATOS_PUBLIC_URL
      ? localConfig
      : edgeConfig,
  ),
);
