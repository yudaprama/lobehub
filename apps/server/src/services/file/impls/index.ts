import { type LobeChatDatabase } from '@lobechat/database';

import { fileEnv } from '@/envs/file';

import { AlistStaticFileImpl } from './alist';
import { S3StaticFileImpl } from './s3';
import { type FileServiceImpl } from './type';

/**
 * Create file service module.
 *
 * Returns the AList implementation when `ALIST_URL` is configured and a
 * Kratos session token is available; otherwise falls back to S3 so that
 * internal-only consumers (agent tracing, LLM tracing) keep working.
 */
export const createFileServiceModule = (
  db: LobeChatDatabase,
  kratosSessionToken?: string,
): FileServiceImpl => {
  if (fileEnv.ALIST_URL && kratosSessionToken) {
    return new AlistStaticFileImpl(db, kratosSessionToken);
  }

  // S3 fallback — used by tracing stores and when AList is not configured
  return new S3StaticFileImpl(db);
};
