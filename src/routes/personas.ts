import { Elysia, t } from 'elysia';
import {
  listPersonas,
  getPersona,
  createPersona,
  updatePersona,
  deletePersona,
} from '../core/personas.ts';
import { normalizeAvatar } from '../files/avatar.ts';
import { blobUrl, thumbUrl } from '../files/blobs.ts';
import { NotFound } from '../types.ts';
import type { PersonaRow } from '../types.ts';

// DB stores created_at via unixepoch() — seconds. Frontend feeds timestamps
// to dayjs, which wants milliseconds. Multiply at the wire boundary so
// callers see a consistent unit without a migration.
const present = (p: PersonaRow) => ({
  ...p,
  is_default: !!p.is_default,
  avatar_url: blobUrl('avatars', p.avatar_blob),
  thumbnail_url: thumbUrl('avatars', p.avatar_blob),
  created_at: p.created_at * 1000,
});

export const personaRoutes = new Elysia({ prefix: '/api/personas', tags: ['personas'] })
  .get('/', () => ({ items: listPersonas().map(present) }))

  .get('/:id', ({ params: { id } }) => {
    const p = getPersona(id);
    if (!p) throw NotFound('Persona');
    return present(p);
  })

  .post(
    '/',
    async ({ body }) => {
      let avatarBlob: string | null = null;
      if (body.avatar) {
        const bytes = new Uint8Array(await body.avatar.arrayBuffer());
        avatarBlob = await normalizeAvatar(bytes);
      }
      const p = createPersona({
        name: body.name,
        description: body.description,
        avatar_blob: avatarBlob,
      });
      return present(p);
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        description: t.Optional(t.String()),
        avatar: t.Optional(t.File()),
      }),
    },
  )

  .patch(
    '/:id',
    async ({ params: { id }, body }) => {
      let avatarBlob: string | null | undefined;
      if (body.avatar) {
        const bytes = new Uint8Array(await body.avatar.arrayBuffer());
        avatarBlob = await normalizeAvatar(bytes);
      }
      const p = updatePersona(id, {
        name: body.name,
        description: body.description,
        is_default: body.is_default,
        ...(avatarBlob !== undefined && { avatar_blob: avatarBlob }),
      });
      return present(p);
    },
    {
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        description: t.Optional(t.String()),
        is_default: t.Optional(t.Boolean()),
        avatar: t.Optional(t.File()),
      }),
    },
  )

  .delete('/:id', ({ params: { id } }) => {
    deletePersona(id);
    return {};
  });
