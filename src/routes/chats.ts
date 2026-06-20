import { Elysia, t } from '../_compat/elysia.ts';

import {
  listChats,
  getChat,
  createChat,
  updateChat,
  deleteChat,
  branchChat,
  searchChats,
} from '../core/chats.ts';
import { listMessages } from '../core/messages.ts';
import { NotFound } from '../types.ts';
import type { ChatRow } from '../types.ts';

// Parse JSON columns + normalize seconds→ms timestamps for the wire. DB stays
// in seconds (SQLite unixepoch()) so existing rows keep working; dayjs on
// the frontend needs ms.
const present = (c: ChatRow) => ({
  ...c,
  metadata: JSON.parse(c.metadata) as Record<string, unknown>,
  created_at: c.created_at * 1000,
  updated_at: c.updated_at * 1000,
});

export const chatRoutes = new Elysia({ prefix: '/api/chats', tags: ['chats'] })
  // Search must be defined before /:id, otherwise /:id captures "search".
  .get(
    '/search',
    ({ query }) =>
      ({
        items: searchChats(query.q, {
          characterId: query.character_id,
          groupId: query.group_id,
        }),
      }),
    {
      query: t.Object({
        q: t.String({ minLength: 1 }),
        character_id: t.Optional(t.String()),
        group_id: t.Optional(t.String()),
      }),
    },
  )

  .get(
    '/',
    ({ query }) =>
      ({
        items: listChats({
          characterId: query.character_id,
          groupId: query.group_id,
          limit: query.limit,
        }),
      }),
    {
      query: t.Object({
        character_id: t.Optional(t.String()),
        group_id: t.Optional(t.String()),
        limit: t.Optional(t.Numeric()),
      }),
    },
  )

  .get(
    '/:id',
    ({ params: { id }, query }) => {
      const chat = getChat(id);
      if (!chat) throw NotFound('Chat');
      return {
        chat: present(chat),
        messages: listMessages(id, {
          afterPosition: query.after_position,
          limit: query.limit,
        }),
      };
    },
    {
      query: t.Object({
        after_position: t.Optional(t.Numeric()),
        limit: t.Optional(t.Numeric()),
      }),
    },
  )

  .post('/', ({ body }) => present(createChat(body)), {
    body: t.Object({
      character_id: t.Optional(t.String()),
      group_id: t.Optional(t.String()),
      title: t.Optional(t.String()),
      persona_id: t.Optional(t.String()),
    }),
  })

  .patch(
    '/:id',
    ({ params: { id }, body }) => present(updateChat(id, body)),
    {
      body: t.Object({
        title: t.Optional(t.String()),
        metadata: t.Optional(t.Record(t.String(), t.Unknown())),
        persona_id: t.Optional(t.Nullable(t.String())),
      }),
    },
  )

  .delete('/:id', ({ params: { id } }) => {
    deleteChat(id);
    return {};
  })

  .post(
    '/:id/branch',
    ({ params: { id }, body }) => present(branchChat(id, body)),
    {
      body: t.Object({
        up_to_position: t.Number({ minimum: 0 }),
        title: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
      }),
    },
  );
