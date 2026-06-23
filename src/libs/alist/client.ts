import { AlistClient } from 'alist-kratos-sdk';

import { fileEnv } from '@/envs/file';

let cachedClient: AlistClient | null = null;
let clientPromise: Promise<AlistClient | null> | null = null;

export function getAlistClient(): Promise<AlistClient | null> {
  if (cachedClient) return Promise.resolve(cachedClient);

  if (clientPromise) return clientPromise;

  const alistUrl = fileEnv.NEXT_PUBLIC_ALIST_URL;

  if (!alistUrl) {
    console.warn('[alist] NEXT_PUBLIC_ALIST_URL must be set for AList integration');
    return Promise.resolve(null);
  }

  clientPromise = AlistClient.fromKratosSession(alistUrl).then((client) => {
    cachedClient = client;
    clientPromise = null;
    return client;
  });

  return clientPromise;
}
