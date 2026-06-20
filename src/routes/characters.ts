import { Elysia, t } from 'elysia';
import sanitize from 'sanitize-filename';
import {
  listCharacters,
  getCharacterFull,
  createCharacter,
  updateCharacter,
  updateAvatar,
  deleteCharacter,
  duplicateCharacter,
  importCharacter,
  importNormalized,
  exportCharacterPng,
  exportCharacterJson,
} from '../core/characters.ts';
import { setCharacterBindings } from '../core/lorebooks.ts';
import { parseChubUrl, fetchChubCharacter } from '../chub/index.ts';
import { toV2 } from '../card/normalize.ts';
import { V2DataPartialSchema, CropSchema } from '../card/schema.ts';
import { AppError, NotFound } from '../types.ts';

export const characterRoutes = new Elysia({ prefix: '/api/characters', tags: ['characters'] })
  .get(
    '/',
    ({ query }) =>
      listCharacters({
        fav: query.fav === '1' || query.fav === 'true',
        tagId: query.tag,
        q: query.q,
        sort: query.sort,
        limit: query.limit,
        offset: query.offset,
      }),
    {
      query: t.Object({
        fav: t.Optional(t.String()),
        tag: t.Optional(t.String()),
        q: t.Optional(t.String()),
        sort: t.Optional(t.Union([t.Literal('name'), t.Literal('recent'), t.Literal('created')])),
        limit: t.Optional(t.Numeric()),
        offset: t.Optional(t.Numeric()),
      }),
    },
  )

  .get('/:id', ({ params: { id } }) => {
    const c = getCharacterFull(id);
    if (!c) throw NotFound('Character');
    return c;
  })

  .post(
    '/',
    async ({ body }) => {
      const data = typeof body.data === 'string' ? JSON.parse(body.data) : body.data;
      const crop = body.crop ? (typeof body.crop === 'string' ? JSON.parse(body.crop) : body.crop) : undefined;

      let avatar: { bytes: Uint8Array; crop?: typeof crop } | undefined;
      if (body.avatar) {
        avatar = {
          bytes: new Uint8Array(await body.avatar.arrayBuffer()),
          crop,
        };
      }

      const row = await createCharacter({ data, avatar });
      return getCharacterFull(row.id)!;
    },
    {
      // Multipart: data comes through as a string field, avatar as a file
      // part. Parse data manually to keep the schema flexible.
      body: t.Object({
        data: t.Union([t.String(), V2DataPartialSchema]),
        avatar: t.Optional(t.File()),
        crop: t.Optional(t.Union([t.String(), CropSchema])),
      }),
    },
  )

  .patch(
    '/:id',
    ({ params: { id }, body }) => {
      const row = updateCharacter(id, body);
      return getCharacterFull(row.id)!;
    },
    {
      body: t.Object({
        data: t.Optional(t.Partial(V2DataPartialSchema)),
        fav: t.Optional(t.Boolean()),
      }),
    },
  )

  .delete('/:id', ({ params: { id } }) => {
    deleteCharacter(id);
    return {};
  })

  .post('/:id/duplicate', ({ params: { id } }) => {
    const row = duplicateCharacter(id);
    return getCharacterFull(row.id)!;
  })

  .put(
    '/:id/avatar',
    async ({ params: { id }, body }) => {
      const bytes = new Uint8Array(await body.avatar.arrayBuffer());
      const crop = body.crop ? (typeof body.crop === 'string' ? JSON.parse(body.crop) : body.crop) : undefined;
      const row = await updateAvatar(id, bytes, crop);
      return getCharacterFull(row.id)!;
    },
    {
      body: t.Object({
        avatar: t.File(),
        crop: t.Optional(t.Union([t.String(), CropSchema])),
      }),
    },
  )

  // Full replace of a character's lorebook bindings.
  .put(
    '/:id/lorebooks',
    ({ params: { id }, body }) => {
      if (!getCharacterFull(id)) throw NotFound('Character');
      setCharacterBindings(id, body.lorebook_ids);
      return { lorebook_ids: body.lorebook_ids };
    },
    { body: t.Object({ lorebook_ids: t.Array(t.String()) }) },
  )

  .post(
    '/import',
    async ({ body }) => {
      if (body.url) {
        const ref = parseChubUrl(body.url);
        if (!ref || ref.kind !== 'character') {
          throw new AppError('INVALID_URL', 'Not a recognized Chub character URL', 400);
        }
        const { card, avatar } = await fetchChubCharacter(ref);
        // Chub data should already be V2-shaped; belt and suspenders.
        const normalized = toV2(card);
        return await importNormalized(normalized, avatar);
      }

      if (body.file) {
        const bytes = new Uint8Array(await body.file.arrayBuffer());
        return await importCharacter(bytes, body.file.type);
      }

      throw new AppError('INVALID_INPUT', 'Provide either url or file', 400);
    },
    {
      body: t.Object({
        file: t.Optional(t.File()),
        url: t.Optional(t.String()),
      }),
    },
  )

  .get(
    '/:id/export',
    async ({ params: { id }, query, set }) => {
      const format = query.format ?? 'png';

      if (format === 'json') {
        const { card, name } = exportCharacterJson(id);
        set.headers['content-disposition'] =
          `attachment; filename="${sanitize(name) || 'character'}.json"`;
        return card;
      }

      const { buffer, name } = await exportCharacterPng(id);
      set.headers['content-type'] = 'image/png';
      set.headers['content-disposition'] =
        `attachment; filename="${sanitize(name) || 'character'}.png"`;
      return new Response(buffer);
    },
    {
      query: t.Object({
        format: t.Optional(t.Union([t.Literal('png'), t.Literal('json')])),
      }),
    },
  );
