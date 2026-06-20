import { Elysia, t } from 'elysia';
import {
  listPresets,
  getPreset,
  createPreset,
  updatePreset,
  deletePreset,
} from '../core/presets.ts';
import { NotFound } from '../types.ts';
import type { PresetRow } from '../types.ts';

// Seconds in the DB (unixepoch()); ms on the wire for dayjs.
const present = (p: PresetRow) => ({
  ...p,
  created_at: p.created_at * 1000,
  updated_at: p.updated_at * 1000,
});

export const presetRoutes = new Elysia({ prefix: '/api/presets', tags: ['presets'] })
  .get('/', () => ({ items: listPresets().map(present) }))

  .get('/:id', ({ params: { id } }) => {
    const p = getPreset(id);
    if (!p) throw NotFound('Preset');
    return present(p);
  })

  .post('/', ({ body }) => present(createPreset(body.name, body.params)), {
    body: t.Object({
      name: t.String({ minLength: 1 }),
      params: t.Record(t.String(), t.Unknown(), { default: {} }),
    }),
  })

  .patch('/:id', ({ params: { id }, body }) => present(updatePreset(id, body)), {
    body: t.Object({
      name: t.Optional(t.String({ minLength: 1 })),
      params: t.Optional(t.Record(t.String(), t.Unknown())),
    }),
  })

  .delete('/:id', ({ params: { id } }) => {
    deletePreset(id);
    return {};
  });
