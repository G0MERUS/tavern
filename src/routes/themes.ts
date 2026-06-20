import { Elysia, t } from 'elysia';
import {
  listThemes,
  getTheme,
  createTheme,
  updateTheme,
  deleteTheme,
} from '../core/themes.ts';
import { NotFound } from '../types.ts';
import type { ThemeRow } from '../types.ts';

// Seconds in the DB (unixepoch()); ms on the wire for dayjs.
const present = (row: ThemeRow) => ({
  ...row,
  created_at: row.created_at * 1000,
  updated_at: row.updated_at * 1000,
});

export const themeRoutes = new Elysia({ prefix: '/api/themes', tags: ['themes'] })
  .get('/', () => ({ items: listThemes().map(present) }))

  .get('/:id', ({ params: { id } }) => {
    const row = getTheme(id);
    if (!row) throw NotFound('Theme');
    return present(row);
  })

  .post('/', ({ body }) => present(createTheme(body.name, body.data)), {
    body: t.Object({
      name: t.String({ minLength: 1 }),
      data: t.Record(t.String(), t.Unknown(), { default: {} }),
    }),
  })

  .patch('/:id', ({ params: { id }, body }) => present(updateTheme(id, body)), {
    body: t.Object({
      name: t.Optional(t.String({ minLength: 1 })),
      data: t.Optional(t.Record(t.String(), t.Unknown())),
    }),
  })

  .delete('/:id', ({ params: { id } }) => {
    deleteTheme(id);
    return {};
  });
