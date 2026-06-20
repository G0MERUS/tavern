import { Elysia, t } from 'elysia';
import sanitize from 'sanitize-filename';
import {
  listLorebooks,
  getLorebookWithEntries,
  createLorebook,
  updateLorebook,
  deleteLorebook,
  createEntry,
  updateEntry,
  deleteEntry,
  importLorebook,
} from '../core/lorebooks.ts';
import { parseChubUrl, fetchChubLorebook } from '../chub/index.ts';
import { AppError, NotFound } from '../types.ts';
import type { LorebookEntryRow, LorebookRow } from '../types.ts';

/** Parse JSON columns + cast bools + seconds→ms for the API response. */
const presentEntry = (e: LorebookEntryRow) => ({
  ...e,
  keys: JSON.parse(e.keys),
  secondary_keys: JSON.parse(e.secondary_keys),
  extensions: JSON.parse(e.extensions),
  enabled: !!e.enabled,
  constant: !!e.constant,
  selective: !!e.selective,
  case_sensitive: !!e.case_sensitive,
});

// Seconds in the DB (unixepoch()); ms on the wire for dayjs.
const presentBook = (b: LorebookRow) => ({
  ...b,
  recursive: !!b.recursive,
  created_at: b.created_at * 1000,
  updated_at: b.updated_at * 1000,
});

const Position = t.Union([
  t.Literal('before_char'),
  t.Literal('after_char'),
  t.Literal('at_depth'),
]);

const EntryInputSchema = t.Object({
  keys: t.Optional(t.Array(t.String())),
  secondary_keys: t.Optional(t.Array(t.String())),
  content: t.String(),
  comment: t.Optional(t.String()),
  enabled: t.Optional(t.Boolean()),
  constant: t.Optional(t.Boolean()),
  selective: t.Optional(t.Boolean()),
  case_sensitive: t.Optional(t.Boolean()),
  position: t.Optional(Position),
  depth: t.Optional(t.Nullable(t.Number())),
  insertion_order: t.Optional(t.Number()),
  priority: t.Optional(t.Number()),
  extensions: t.Optional(t.Record(t.String(), t.Unknown())),
});

export const lorebookRoutes = new Elysia({ tags: ['lorebooks'] })
  .get('/api/lorebooks', () => ({ items: listLorebooks().map(presentBook) }))

  .get('/api/lorebooks/:id', ({ params: { id } }) => {
    const book = getLorebookWithEntries(id);
    if (!book) throw NotFound('Lorebook');
    return { ...presentBook(book), entries: book.entries.map(presentEntry) };
  })

  .post(
    '/api/lorebooks',
    ({ body }) => presentBook(createLorebook({ ...body, source: 'standalone' })),
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        description: t.Optional(t.String()),
        scan_depth: t.Optional(t.Number()),
        token_budget: t.Optional(t.Number()),
        recursive: t.Optional(t.Boolean()),
      }),
    },
  )

  .patch(
    '/api/lorebooks/:id',
    ({ params: { id }, body }) => presentBook(updateLorebook(id, body)),
    {
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        description: t.Optional(t.String()),
        scan_depth: t.Optional(t.Number()),
        token_budget: t.Optional(t.Number()),
        recursive: t.Optional(t.Boolean()),
      }),
    },
  )

  .delete('/api/lorebooks/:id', ({ params: { id } }) => {
    deleteLorebook(id);
    return {};
  })

  .post(
    '/api/lorebooks/import',
    async ({ body }) => {
      let name: string;
      let data: unknown;

      if (body.url) {
        const ref = parseChubUrl(body.url);
        if (!ref || ref.kind !== 'lorebook') {
          throw new AppError('INVALID_URL', 'Not a recognized Chub lorebook URL', 400);
        }
        const fetched = await fetchChubLorebook(ref);
        name = fetched.name;
        data = fetched.data;
      } else if (body.file) {
        const text = await body.file.text();
        data = JSON.parse(text);
        name = body.file.name.replace(/\.json$/i, '') || 'Imported';
      } else {
        throw new AppError('INVALID_INPUT', 'Provide either url or file', 400);
      }

      return presentBook(importLorebook(name, data));
    },
    {
      body: t.Object({
        file: t.Optional(t.File()),
        url: t.Optional(t.String()),
      }),
    },
  )

  .get('/api/lorebooks/:id/export', ({ params: { id }, set }) => {
    const book = getLorebookWithEntries(id);
    if (!book) throw NotFound('Lorebook');

    // Export as a CharacterBook-shaped JSON (V2 spec) for portability.
    const out = {
      name: book.name,
      description: book.description,
      scan_depth: book.scan_depth,
      token_budget: book.token_budget,
      recursive_scanning: !!book.recursive,
      extensions: {},
      entries: book.entries.map((e, i) => ({
        id: i,
        keys: JSON.parse(e.keys),
        secondary_keys: JSON.parse(e.secondary_keys),
        content: e.content,
        comment: e.comment,
        enabled: !!e.enabled,
        constant: !!e.constant,
        selective: !!e.selective,
        case_sensitive: !!e.case_sensitive,
        position: e.position === 'after_char' ? 'after_char' : 'before_char',
        insertion_order: e.insertion_order,
        priority: e.priority,
        extensions: JSON.parse(e.extensions),
      })),
    };

    set.headers['content-disposition'] =
      `attachment; filename="${sanitize(book.name) || 'lorebook'}.json"`;
    return out;
  })

  // Per-entry CRUD.
  .post(
    '/api/lorebooks/:id/entries',
    ({ params: { id }, body }) => presentEntry(createEntry(id, body)),
    { body: EntryInputSchema },
  )

  .patch(
    '/api/lorebook-entries/:id',
    ({ params: { id }, body }) => presentEntry(updateEntry(id, body)),
    { body: t.Partial(EntryInputSchema) },
  )

  .delete('/api/lorebook-entries/:id', ({ params: { id } }) => {
    deleteEntry(id);
    return {};
  });
