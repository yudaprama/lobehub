import debug from 'debug';

import { FileModel } from '@/database/models/file';
import { getServerDB } from '@/database/server';
import { fileEnv } from '@/envs/file';
import { FileService } from '@/server/services/file';

const log = debug('lobe-file:proxy');

type Params = Promise<{ id: string }>;

/**
 * File proxy service
 * GET /f/:id
 *
 * Features:
 * - Query database to get file record (without userId filter for public access)
 * - Generate a temporary AList signed URL or S3 presigned preview URL
 * - Return 302 redirect
 */
export const GET = async (req: Request, segmentData: { params: Params }) => {
  try {
    const params = await segmentData.params;
    const { id } = params;

    log('File proxy request: %s', id);

    // Get database connection
    const db = await getServerDB();

    // Query file record without userId filter (public access)
    const file = await FileModel.getFileById(db, id);

    if (!file) {
      log('File not found: %s', id);
      return new Response('File not found', {
        status: 404,
      });
    }

    // Extract Kratos session token from cookies or header for AList authentication
    const cookieHeader = req.headers.get('cookie') || '';
    const kratosSessionToken =
      req.headers.get('x-session-token') ||
      cookieHeader
        .split(';')
        .find((c) => c.trim().startsWith('ory_kratos_session='))
        ?.split('=')[1]?.trim() ||
      undefined;

    // Create file service with file owner's userId
    const fileService = new FileService(db, file.userId, undefined, kratosSessionToken);

    // Generate the appropriate signed URL (AList or S3)
    const redirectUrl = await fileService.createCachedPreSignedUrlForPreview(file.url);
    log('File proxy redirect URL generated');

    // Return 302 redirect
    return Response.redirect(redirectUrl, 302);
  } catch (error) {
    console.error('File proxy error:', error);
    return new Response('Internal server error', {
      status: 500,
    });
  }
};
