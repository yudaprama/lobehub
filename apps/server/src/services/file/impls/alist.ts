import { type LobeChatDatabase } from '@lobechat/database';
import { AlistClient } from 'alist-kratos-sdk';
import debug from 'debug';

import { FileModel } from '@/database/models/file';
import { fileEnv } from '@/envs/file';

import type { FileServiceImpl, PreSignedUpload } from './type';

const log = debug('lobe-file:alist');

/**
 * AList-backed file service implementation.
 *
 * Paths stored in DB are relative to the user's AList BasePath,
 * e.g. "/files/1718234/uuid.ext". AList auto-scopes to
 * /<kratos_identity_id> so the SDK handles the full path.
 */
export class AlistStaticFileImpl implements FileServiceImpl {
  private readonly alist: AlistClient;
  private readonly db: LobeChatDatabase;

  constructor(db: LobeChatDatabase, kratosSessionToken: string) {
    this.db = db;

    const alistUrl = fileEnv.ALIST_URL;
    if (!alistUrl) {
      throw new Error('ALIST_URL is not configured — set it in the server environment');
    }

    this.alist = new AlistClient({
      alistUrl,
      kratosSessionToken,
    });
  }

  async deleteFile(key: string) {
    return this.alist.remove([key]);
  }

  async deleteFiles(keys: string[]) {
    return this.alist.remove(keys);
  }

  async getFileContent(key: string): Promise<string> {
    const res = await this.alist.download(key);
    return res.text();
  }

  async getFileByteArray(key: string): Promise<Uint8Array> {
    const res = await this.alist.download(key);
    return new Uint8Array(await res.arrayBuffer());
  }

  async getFileMetadata(key: string): Promise<{ contentLength: number; contentType?: string }> {
    try {
      const { data } = await this.alist.get(key);
      return { contentLength: data.size, contentType: undefined };
    } catch (error) {
      log('getFileMetadata failed for key %s: %O', key, error);
      throw error;
    }
  }

  /**
   * AList uploads go directly to /api/fs/form — no per-object pre-signing
   * is needed. The returned URL is the upload endpoint; the actual file
   * path is sent via the `File-Path` header by the client.
   */
  async createPreSignedUrl(_key: string): Promise<string> {
    return `${fileEnv.ALIST_URL}/api/fs/form`;
  }

  async createPreSignedUpload(_key: string): Promise<PreSignedUpload> {
    return { url: `${fileEnv.ALIST_URL}/api/fs/form` };
  }

  async createPreSignedUrlForPreview(key: string, _expiresIn?: number): Promise<string> {
    return this.alist.downloadUrl(key);
  }

  async createCachedPreSignedUrlForPreview(
    url?: string | null,
    _expiresIn?: number,
  ): Promise<string> {
    if (!url) return '';
    const key = await this.resolveKey(url);
    return this.alist.downloadUrl(key);
  }

  async uploadContent(path: string, content: string) {
    return this.alist.upload(path, new Blob([content], { type: 'text/plain' }));
  }

  async uploadBuffer(key: string, buffer: Buffer, contentType: string): Promise<{ key: string }> {
    await this.alist.upload(key, new Blob([buffer as any], { type: contentType }));
    return { key };
  }

  async uploadMedia(key: string, buffer: Buffer): Promise<{ key: string }> {
    await this.alist.upload(key, new Blob([buffer as any]));
    return { key };
  }

  async getFullFileUrl(url?: string | null, _expiresIn?: number): Promise<string> {
    if (!url) return '';
    const key = await this.resolveKey(url);
    return this.alist.downloadUrl(key);
  }

  async getKeyFromFullUrl(url: string): Promise<string | null> {
    try {
      const urlObject = new URL(url);
      const { pathname } = urlObject;

      // Case 1: File proxy URL pattern /f/{fileId} - query database for storage key
      if (pathname.startsWith('/f/')) {
        const fileId = pathname.slice(3); // Remove '/f/' prefix
        const file = await FileModel.getFileById(this.db, fileId);
        return file?.url ?? null;
      }

      // Case 2: AList download URL pattern /d/<path>
      if (pathname.startsWith('/d/')) return pathname.slice(3);

      // Case 3: Raw path — strip leading slash
      return pathname.startsWith('/') ? pathname.slice(1) : pathname;
    } catch {
      // If url is not a valid URL, return null
      return null;
    }
  }

  private async resolveKey(url: string): Promise<string> {
    if (!url.startsWith('http://') && !url.startsWith('https://')) return url;

    const key = await this.getKeyFromFullUrl(url);
    if (!key) throw new Error('Key not found from url: ' + url);

    return key;
  }
}
