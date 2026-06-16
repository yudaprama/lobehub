import { parseDataUri } from '@lobechat/model-runtime';
import { uuid } from '@lobechat/utils';
import dayjs from 'dayjs';
import { sha256 } from 'js-sha256';

import { fileEnv } from '@/envs/file';
import { type FileMetadata, type UploadBase64ToS3Result } from '@/types/files';
import { type FileUploadState, type FileUploadStatus } from '@/types/files/upload';

export const UPLOAD_NETWORK_ERROR = 'NetWorkError';

const ALIST_UPLOAD_DIR = 'files';

const generateFilePathMetadata = (
  originalFilename: string,
  options: { directory?: string; pathname?: string } = {},
): {
  date: string;
  dirname: string;
  filename: string;
  pathname: string;
} => {
  const extension = originalFilename.split('.').at(-1);
  const filename = `${uuid()}.${extension}`;

  const date = (Date.now() / 1000 / 60 / 60).toFixed(0);
  const dirname = `${options.directory || ALIST_UPLOAD_DIR}/${date}`;
  const pathname = options.pathname ?? `${dirname}/${filename}`;

  return {
    date,
    dirname,
    filename,
    pathname,
  };
};

interface UploadFileToS3Options {
  abortController?: AbortController;
  directory?: string;
  filename?: string;
  onNotSupported?: () => void;
  onProgress?: (status: FileUploadStatus, state: FileUploadState) => void;
  pathname?: string;
  skipCheckFileType?: boolean;
}

function getKratosSessionToken(): string {
  const match = document.cookie.match(/(?:^|; )ory_kratos_session=([^;]*)/);
  if (!match?.[1]) throw new Error('No Kratos session cookie found');
  return decodeURIComponent(match[1]);
}

class UploadService {
  uploadFileToS3 = async (
    file: File,
    { onProgress, directory, pathname, abortController }: UploadFileToS3Options,
  ): Promise<{ data: FileMetadata; success: boolean }> => {
    const data = await this.uploadToAList(file, {
      abortController,
      directory,
      onProgress,
      pathname,
    });
    return { data, success: true };
  };

  uploadBase64ToS3 = async (
    base64Data: string,
    options: UploadFileToS3Options = {},
  ): Promise<UploadBase64ToS3Result> => {
    const { base64, mimeType, type } = parseDataUri(base64Data);

    if (!base64 || !mimeType || type !== 'base64') {
      throw new Error('Invalid base64 data for image');
    }

    const byteCharacters = atob(base64);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
      const slice = byteCharacters.slice(offset, offset + 1024);

      const byteNumbers: number[] = Array.from({ length: slice.length });
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    const blob = new Blob(byteArrays, { type: mimeType });

    const fileExtension = mimeType.split('/')[1] || 'png';
    const fileName = `${options.filename || `image_${dayjs().format('YYYY-MM-DD-hh-mm-ss')}`}.${fileExtension}`;

    const file = new File([blob], fileName, { type: mimeType });

    const { data: metadata } = await this.uploadFileToS3(file, options);
    const hash = sha256(await file.arrayBuffer());

    return {
      fileType: mimeType,
      hash,
      metadata,
      size: file.size,
    };
  };

  uploadDataToS3 = async (data: object, options: UploadFileToS3Options = {}) => {
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const file = new File([blob], options.filename || 'data.json', { type: 'application/json' });
    return await this.uploadFileToS3(file, options);
  };

  private uploadToAList = async (
    file: File,
    {
      onProgress,
      directory,
      pathname,
      abortController,
    }: {
      abortController?: AbortController;
      directory?: string;
      onProgress?: (status: FileUploadStatus, state: FileUploadState) => void;
      pathname?: string;
    },
  ): Promise<FileMetadata> => {
    const alistUrl = fileEnv.NEXT_PUBLIC_ALIST_URL;
    if (!alistUrl) throw new Error('NEXT_PUBLIC_ALIST_URL is not configured');

    const {
      date,
      dirname,
      filename,
      pathname: destPath,
    } = generateFilePathMetadata(file.name, {
      directory,
      pathname,
    });

    const token = getKratosSessionToken();
    const baseUrl = alistUrl.replace(/\/+$/, '');

    const xhr = new XMLHttpRequest();
    const startTime = Date.now();

    if (abortController) {
      abortController.signal.addEventListener('abort', () => {
        xhr.abort();
      });
    }

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const progress = Number(((event.loaded / event.total) * 100).toFixed(1));
        const speedInByte = event.loaded / ((Date.now() - startTime) / 1000);

        onProgress?.('uploading', {
          progress: progress === 100 ? 99.9 : progress,
          restTime: (event.total - event.loaded) / speedInByte,
          speed: speedInByte,
        });
      }
    });

    await new Promise<void>((resolve, reject) => {
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.('success', {
            progress: 100,
            restTime: 0,
            speed: file.size / ((Date.now() - startTime) / 1000),
          });
          resolve();
        } else {
          reject(xhr.statusText);
        }
      });
      xhr.addEventListener('error', () => {
        if (xhr.status === 0) reject(UPLOAD_NETWORK_ERROR);
        else reject(xhr.statusText);
      });
      xhr.addEventListener('abort', () => {
        onProgress?.('cancelled', { progress: 0, restTime: 0, speed: 0 });
        reject(new Error('Upload cancelled by user'));
      });

      const form = new FormData();
      form.append('file', file);

      xhr.open('PUT', `${baseUrl}/api/fs/form`);
      xhr.setRequestHeader('Authorization', `kratos:${token}`);
      xhr.setRequestHeader('File-Path', encodeURIComponent(destPath));

      xhr.send(form);
    });

    return {
      date,
      dirname,
      filename,
      path: destPath,
    };
  };
}

export const uploadService = new UploadService();
