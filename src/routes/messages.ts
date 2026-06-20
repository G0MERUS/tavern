import { Elysia, t } from '../_compat/elysia.ts';

import {
  createMessage,
  getMessage,
  updateMessage,
  deleteMessage,
  moveMessage,
  addSwipe,
  deleteSwipe,
} from '../core/messages.ts';
import { NotFound } from '../types.ts';

const Role = t.Union([t.Literal('user'), t.Literal('assistant'), t.Literal('system')]);

export const messageRoutes = new Elysia({ tags: ['messages'] })
  // Create lives under /chats/:id/. The param is `:id` (not `:chat_id`) to
  // match chatRoutes' POST /:id/branch — memoirist needs one param name per
  // radix node.
  .post(
    '/api/chats/:id/messages',
    ({ params: { id }, body }) => createMessage(id, body),
    {
      body: t.Object({
        role: Role,
        content: t.String(),
        character_id: t.Optional(t.Nullable(t.String())),
        extra: t.Optional(t.Record(t.String(), t.Unknown())),
        after_position: t.Optional(t.Number()),
        is_hidden: t.Optional(t.Boolean()),
      }),
    },
  )

  .get('/api/messages/:id', ({ params: { id } }) => {
    const m = getMessage(id);
    if (!m) throw NotFound('Message');
    return m;
  })

  .patch(
    '/api/messages/:id',
    ({ params: { id }, body }) => updateMessage(id, body),
    {
      body: t.Object({
        content: t.Optional(t.String()),
        extra: t.Optional(t.Record(t.String(), t.Unknown())),
        is_hidden: t.Optional(t.Boolean()),
        swipe_idx: t.Optional(t.Number({ minimum: 0 })),
      }),
    },
  )

  .delete('/api/messages/:id', ({ params: { id } }) => {
    deleteMessage(id);
    return {};
  })

  .post(
    '/api/messages/:id/move',
    ({ params: { id }, body }) => moveMessage(id, body.swap_with),
    {
      body: t.Object({ swap_with: t.String() }),
    },
  )

  .post(
    '/api/messages/:id/swipe',
    ({ params: { id }, body }) => addSwipe(id, body),
    {
      body: t.Object({
        content: t.String(),
        model: t.Optional(t.String()),
        extra: t.Optional(t.Record(t.String(), t.Unknown())),
        activate: t.Optional(t.Boolean()),
      }),
    },
  )

  .delete(
    '/api/messages/:id/swipes/:idx',
    ({ params: { id, idx } }) => deleteSwipe(id, parseInt(idx, 10)),
    {
      params: t.Object({ id: t.String(), idx: t.String({ pattern: '^\\d+$' }) }),
    },
  );
