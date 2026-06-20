import { Elysia, t, file } from '../_compat/elysia.ts';
import { extname } from 'node:path';

import { existsSync } from 'node:fs';
import {
  saveBlob,
  deleteBlob,
  listBackgrounds,
  blobPath,
  blobUrl,
  thumbUrl,
} from '../files/blobs.ts';
import { getOrGenerate } from '../files/thumbnail.ts';
import { AppError } from '../types.ts';

// Backgrounds: no table, no metadata — just images to pick from a grid.
// Attachments: multipart upload, streamed to disk.
// Thumbnails: lazy generate-or-serve; source filenames are immutable so
// thumbnails are too (Cache-Control: immutable).

const MAX_BACKGROUND_SIZE = 20 * 1024 * 1024;
const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024;

export const fileRoutes = new Elysia({ tags: ['files'] })
  .get('/api/backgrounds', () => ({
    items: listBackgrounds().map((f) => ({
      filename: f,
      url: blobUrl('backgrounds', f),
      thumbnail_url: thumbUrl('backgrounds', f),
    })),
  }))

  .post(
    '/api/backgrounds',
    async ({ body }) => {
      if (body.file.size > MAX_BACKGROUND_SIZE) {
        throw new AppError('FILE_TOO_LARGE', `Max ${MAX_BACKGROUND_SIZE / 1024 / 1024}MB`, 400);
      }
      const ext = extname(body.file.name) || '.png';
      const bytes = new Uint8Array(await body.file.arrayBuffer());
      const filename = await saveBlob('backgrounds', bytes, ext);
      return {
        filename,
        url: blobUrl('backgrounds', filename),
        thumbnail_url: thumbUrl('backgrounds', filename),
      };
    },
    { body: t.Object({ file: t.File() }) },
  )

  .delete('/api/backgrounds/:filename', ({ params: { filename } }) => {
    const path = blobPath('backgrounds', filename);
    if (!existsSync(path)) throw new AppError('NOT_FOUND', 'Background not found', 404);
    deleteBlob('backgrounds', filename);
    return {};
  })

  .post(
    '/api/attachments',
    async ({ body }) => {
      if (body.file.size > MAX_ATTACHMENT_SIZE) {
        throw new AppError('FILE_TOO_LARGE', `Max ${MAX_ATTACHMENT_SIZE / 1024 / 1024}MB`, 400);
      }
      const ext = extname(body.file.name) || '.bin';
      const bytes = new Uint8Array(await body.file.arrayBuffer());
      const filename = await saveBlob('attachments', bytes, ext);
      return { filename, url: blobUrl('attachments', filename) };
    },
    { body: t.Object({ file: t.File() }) },
  )

  .delete('/api/attachments/:filename', ({ params: { filename } }) => {
    deleteBlob('attachments', filename);
    return {};
  })

  .get(
    '/thumbnails/:type/:filename',
    async ({ params: { type, filename }, set, status }) => {
      const path = await getOrGenerate(type, filename);
      if (!path) return status(404, 'Not found');

      // Source filenames never change — replacing an avatar yields a new
      // nanoid — so thumbnails are immutable.
      set.headers['cache-control'] = 'public, max-age=31536000, immutable';
      return file(path);

    },
    {
      params: t.Object({
        type: t.Union([t.Literal('avatars'), t.Literal('backgrounds')]),
        filename: t.String(),
      }),
    },
  );
