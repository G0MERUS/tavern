import { Elysia, t } from '../_compat/elysia.ts';

import {
  listConnections,
  getConnection,
  createConnection,
  createFromCatalog,
  updateConnection,
  deleteConnection,
  activateConnection,
} from '../core/connections.ts';
import { testConnection } from '../llm/generate.ts';
import { getCatalog } from '../llm/catalog.ts';
import { NotFound } from '../types.ts';
import type { ConnectionRow } from '../types.ts';

// Seconds in the DB (unixepoch()); ms on the wire for dayjs.
const present = (c: ConnectionRow) => ({
  ...c,
  created_at: c.created_at * 1000,
});

const Kind = t.Union([t.Literal('openai'), t.Literal('anthropic'), t.Literal('google')]);

const ConnectionInput = t.Object({
  label: t.String({ minLength: 1 }),
  kind: t.Optional(Kind),
  base_url: t.String({ minLength: 1 }),
  api_key: t.Optional(t.String()),
  model: t.String({ minLength: 1 }),
  extra_headers: t.Optional(t.Record(t.String(), t.String())),
  extra_body: t.Optional(t.Record(t.String(), t.Unknown())),
});

/**
 * /api/catalog — lives outside the /connections prefix per the spec.
 * Static, cacheable forever (changes only when the binary does).
 */
export const catalogRoute = new Elysia({ tags: ['connections'] })
  .get('/api/catalog', ({ set }) => {
    set.headers['cache-control'] = 'public, max-age=86400, immutable';
    return { providers: getCatalog() };
  });

export const connectionRoutes = new Elysia({ prefix: '/api/connections', tags: ['connections'] })
  .get('/', () => ({ items: listConnections().map(present) }))

  .get('/:id', ({ params: { id } }) => {
    const conn = getConnection(id);
    if (!conn) throw NotFound('Connection');
    return present(conn);
  })

  .post('/', ({ body }) => present(createConnection(body)), { body: ConnectionInput })

  .post(
    '/from-catalog',
    ({ body }) => present(createFromCatalog(body.provider_id, { label: body.label, api_key: body.api_key })),
    {
      body: t.Object({
        provider_id: t.String({ minLength: 1 }),
        label: t.Optional(t.String()),
        api_key: t.Optional(t.String()),
      }),
    },
  )

  .patch('/:id', ({ params: { id }, body }) => present(updateConnection(id, body)), {
    body: t.Partial(ConnectionInput),
  })

  .delete('/:id', ({ params: { id } }) => {
    deleteConnection(id);
    return {};
  })

  .post('/:id/activate', ({ params: { id } }) => present(activateConnection(id)))

  .post('/:id/test', ({ params: { id } }) => testConnection(id));
