import { type LobeChatDatabase } from '@lobechat/database';
import debug from 'debug';

import { FileModel } from '@/database/models/file';
import { fileEnv } from '@/envs/file';

import type { FileServiceImpl, PreSignedUpload } from './type';

const log = debug('lobe-file:alist');

/**
 * Server-side AList client that injects Kratos session token via headers.
 * The v2.0.0 SDK uses browser cookies (credentials: "include"), which
 * doesn't work for server-to-server calls. This standalone client
 * implements the same API surface with explicit token-based auth.
 */
class ServerAlistClient {
  private readonly alistUrl: string;
  private readonly authHeader: string;
  private basePath: string | null = null;
  private basePathPromise: Promise<string> | null = null;

  constructor(alistUrl: string, kratosSessionToken: string) {
    this.alistUrl = alistUrl.replace(/\/+$/, '');
    this.authHeader = `kratos:${kratosSessionToken}`;
  }

  private async request<T = unknown>(
    method: string,
    path: string,
    init?: { body?: BodyInit | null; headers?: Record<string, string> },
  ): Promise<T> {
    const url = `${this.alistUrl}${path.startsWith('/') ? path : '/' + path}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: this.authHeader,
        ...(init?.body && !(init.body instanceof FormData)
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...init?.headers,
      },
      body: init?.body ?? null,
      redirect: 'manual',
    });

    if (res.status === 302) {
      const location = res.headers.get('Location');
      if (!location) throw new Error('redirect with no Location');
      const followed = await fetch(location, { redirect: 'follow' });
      if (!followed.ok) {
        throw new Error('redirect target failed');
      }
      return (await followed.blob()) as unknown as T;
    }

    const text = await res.text();
    let body: any = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }

    if (!res.ok) {
      const code = body?.code ?? res.status;
      const message = body?.message ?? res.statusText;
      throw new Error(`[${res.status}] ${code}: ${message}`);
    }
    return body as T;
  }

  private async ensureBasePath(): Promise<string> {
    if (this.basePath !== null) return this.basePath;
    if (this.basePathPromise) return this.basePathPromise;
    this.basePathPromise = (async () => {
      const me = await this.me();
      const bp = me?.data?.base_path;
      if (!bp) {
        throw new Error('could not discover BasePath from /api/me');
      }
      this.basePath = bp;
      return bp;
    })();
    return this.basePathPromise;
  }

  private async resolvePath(p: string): Promise<string> {
    if (p === '/' || p === '') {
      const basePath = await this.ensureBasePath();
      return basePath;
    }
    return p;
  }

  async me(): Promise<{ code: number; data: { base_path: string } }> {
    const res = await this.request<{ code: number; data: { base_path: string } }>('GET', '/api/me');
    if (res?.data?.base_path) this.basePath = res.data.base_path;
    return res;
  }

  async get(path: string): Promise<{ code: number; data: { size: number } }> {
    const resolved = await this.resolvePath(path);
    return this.request('POST', '/api/fs/get', {
      body: JSON.stringify({ path: resolved }),
    });
  }

  async download(path: string): Promise<Blob> {
    const resolved = await this.resolvePath(path);
    const url = `${this.alistUrl}/d${resolved.startsWith('/') ? '' : '/'}${resolved}`;
    const res = await fetch(url, {
      headers: { Authorization: this.authHeader },
      redirect: 'follow',
    });
    if (!res.ok) {
      throw new Error(`download failed for ${path}`);
    }
    return res.blob();
  }

  async downloadUrl(path: string): Promise<string> {
    const resolved = await this.resolvePath(path);
    const url = `${this.alistUrl}/d${resolved.startsWith('/') ? '' : '/'}${resolved}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: this.authHeader },
      redirect: 'manual',
    });
    if (res.status !== 302) {
      throw new Error(`expected 302 for ${path}, got ${res.status}`);
    }
    const location = res.headers.get('Location');
    if (!location) throw new Error('no Location header');
    return location;
  }

  async upload(path: string, file: Blob): Promise<{ code: number }> {
    const resolved = await this.resolvePath(path);
    const form = new FormData();
    form.append('file', file);
    return this.request('PUT', '/api/fs/form', {
      body: form,
      headers: { 'File-Path': encodeURIComponent(resolved) },
    });
  }

  async remove(paths: string[]): Promise<{ code: number }> {
    const resolved = await Promise.all(paths.map((p) => this.resolvePath(p)));
    return this.request('POST', '/api/fs/remove', {
      body: JSON.stringify({ names: resolved }),
    });
  }
}

/**
 * AList-backed file service implementation.
 *
 * Paths stored in DB are relative to the user's AList BasePath,
 * e.g. "/files/1718234/uuid.ext". AList auto-scopes to
 * /<kratos_identity_id> so the SDK handles the full path.
 */
export class AlistStaticFileImpl implements FileServiceImpl {
  private readonly alist: ServerAlistClient;
  private readonly db: LobeChatDatabase;

  constructor(db: LobeChatDatabase, kratosSessionToken: string) {
    this.db = db;

    const alistUrl = fileEnv.ALIST_URL;
    if (!alistUrl) {
      throw new Error('ALIST_URL is not configured — set it in the server environment');
    }

    this.alist = new ServerAlistClient(alistUrl, kratosSessionToken);
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
