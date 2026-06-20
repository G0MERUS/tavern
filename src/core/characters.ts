import { existsSync, readFileSync } from 'node:fs';
import { nanoid } from 'nanoid';
import { getDb, transaction } from '../db/index.ts';

import { deleteBlob, blobUrl, thumbUrl, blobPath } from '../files/blobs.ts';
import { normalizeAvatar } from '../files/avatar.ts';
import { readCard, NoCardDataError } from '../card/parse.ts';
import { writeCard } from '../card/write.ts';
import { toV2, emptyV2 } from '../card/normalize.ts';
import {
  extractCharacterBook,
  reconstructCharacterBook,
  getBindingsForCharacter,
} from './lorebooks.ts';
import type {
  CharacterRow,
  CharacterSummary,
  TavernCardV2,
  TavernCardV2Data,
} from '../types.ts';
import { NotFound, AppError } from '../types.ts';

// Characters. Opaque nanoid PK, full V2 card JSON stored in `data`,
// character_book extracted into its own lorebook on import.

export interface ListOptions {
  fav?: boolean;
  tagId?: string;
  q?: string;
  sort?: 'name' | 'recent' | 'created';
  limit?: number;
  offset?: number;
}

export function listCharacters(opts: ListOptions = {}): {
  items: CharacterSummary[];
  total: number;
} {
  const db = getDb();

  const where: string[] = [];
  const params: (string | number)[] = [];

  if (opts.fav) where.push('c.fav = 1');
  if (opts.q) {
    where.push('c.name_search LIKE ?');
    params.push(`%${opts.q.toLowerCase()}%`);
  }
  if (opts.tagId) {
    where.push('c.id IN (SELECT character_id FROM character_tags WHERE tag_id = ?)');
    params.push(opts.tagId);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const orderBy =
    opts.sort === 'name'
      ? 'c.name COLLATE NOCASE ASC'
      : opts.sort === 'created'
        ? 'c.created_at DESC'
        : 'c.fav DESC, c.last_chat_at DESC NULLS LAST, c.created_at DESC'; // 'recent' (default)

  const limit = Math.min(opts.limit ?? 200, 1000);
  const offset = opts.offset ?? 0;

  const total = db
    .query<{ n: number }, typeof params>(`SELECT COUNT(*) AS n FROM characters c ${whereClause}`)
    .get(...params)!.n;

  // The chat_count subquery is correlated but idx_messages_chat_pos covers it.
  const rows = db
    .query<CharacterRow & { creator: string; chat_count: number }, (string | number)[]>(
      `SELECT c.*, c.creator,
              (SELECT COUNT(*) FROM chats WHERE character_id = c.id) AS chat_count
       FROM characters c
       ${whereClause}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset);

  return { items: rows.map(toSummary), total };
}

export function getCharacterFull(
  id: string,
): (CharacterSummary & { data: TavernCardV2Data; lorebook_ids: string[] }) | null {
  const row = getDb()
    .query<CharacterRow & { creator: string; chat_count: number }, [string]>(
      `SELECT c.*, c.creator,
              (SELECT COUNT(*) FROM chats WHERE character_id = c.id) AS chat_count
       FROM characters c WHERE c.id = ?`,
    )
    .get(id);
  if (!row) return null;

  const data: TavernCardV2 = JSON.parse(row.data);
  return {
    ...toSummary(row),
    data: data.data,
    lorebook_ids: getBindingsForCharacter(id),
  };
}

function toSummary(row: CharacterRow & { creator: string; chat_count: number }): CharacterSummary {
  let tags: string[] = [];
  try {
    tags = JSON.parse(row.data)?.data?.tags ?? [];
  } catch {
    // Malformed JSON in the DB shouldn't crash the list endpoint.
  }
  return {
    id: row.id,
    name: row.name,
    avatar_url: blobUrl('avatars', row.avatar_blob),
    thumbnail_url: thumbUrl('avatars', row.avatar_blob),
    fav: !!row.fav,
    tags,
    creator: row.creator ?? '',
    // Seconds in the DB (unixepoch()); ms on the wire for dayjs.
    // last_chat_at is nullable — preserve null, don't coerce to 0.
    last_chat_at: row.last_chat_at == null ? row.last_chat_at : row.last_chat_at * 1000,
    chat_count: row.chat_count,
    created_at: row.created_at * 1000,
    updated_at: row.updated_at * 1000,
  };
}

export interface CreateInput {
  data: Partial<TavernCardV2Data> & { name: string };
  avatar?: { bytes: Uint8Array; crop?: { x: number; y: number; width: number; height: number } };
}

export async function createCharacter(input: CreateInput): Promise<CharacterRow> {
  const card = emptyV2(input.data);
  const id = nanoid(12);

  let avatarBlob: string | null = null;
  if (input.avatar) {
    avatarBlob = await normalizeAvatar(input.avatar.bytes, input.avatar.crop);
  }

  return transaction(() => {
    insertCharacter(id, card, avatarBlob);
    syncTags(id, card.data.tags);
    return getRow(id)!;
  });
}

/** Shallow-merge patch into the stored V2 card data. */
export function updateCharacter(
  id: string,
  patch: { data?: Partial<TavernCardV2Data>; fav?: boolean },
): CharacterRow {
  const existing = getRow(id);
  if (!existing) throw NotFound('Character');

  return transaction(() => {
    const card: TavernCardV2 = JSON.parse(existing.data);

    if (patch.data) {
      // `extensions` sub-merges so partial updates don't clobber unrelated keys.
      const merged = { ...card.data, ...patch.data };
      if (patch.data.extensions) {
        merged.extensions = { ...card.data.extensions, ...patch.data.extensions };
      }
      card.data = merged;
    }

    const name = card.data.name;
    const fav = patch.fav !== undefined ? (patch.fav ? 1 : 0) : existing.fav;

    getDb()
      .query(
        `UPDATE characters
         SET name = ?, data = ?, fav = ?, updated_at = unixepoch()
         WHERE id = ?`,
      )
      .run(name, JSON.stringify(card), fav, id);

    if (patch.data?.tags) syncTags(id, card.data.tags);

    return getRow(id)!;
  });
}

/** Replace the avatar. Old blob is deleted; new one normalized to 512×768 PNG. */
export async function updateAvatar(
  id: string,
  bytes: Uint8Array,
  crop?: { x: number; y: number; width: number; height: number },
): Promise<CharacterRow> {
  const existing = getRow(id);
  if (!existing) throw NotFound('Character');

  const newBlob = await normalizeAvatar(bytes, crop);

  getDb()
    .query('UPDATE characters SET avatar_blob = ?, updated_at = unixepoch() WHERE id = ?')
    .run(newBlob, id);

  deleteBlob('avatars', existing.avatar_blob);
  return getRow(id)!;
}

export function deleteCharacter(id: string): void {
  const existing = getRow(id);
  if (!existing) throw NotFound('Character');
  // chats, character_tags, lorebook_bindings, group_members all cascade.
  getDb().query('DELETE FROM characters WHERE id = ?').run(id);
  deleteBlob('avatars', existing.avatar_blob);
}

export function duplicateCharacter(id: string): CharacterRow {
  const existing = getRow(id);
  if (!existing) throw NotFound('Character');

  const card: TavernCardV2 = JSON.parse(existing.data);
  card.data.name = `${card.data.name} (copy)`;

  const newId = nanoid(12);
  return transaction(() => {
    // Share the avatar blob rather than copying it on disk. The blob is
    // immutable (replacing it generates a new filename), so the first delete
    // unlinks the file; the other copy then has a dangling avatar_blob
    // reference. Acceptable for a duplicate workflow where the user typically
    // replaces the avatar anyway. Copy the file here if it bites in practice.
    insertCharacter(newId, card, existing.avatar_blob);
    syncTags(newId, card.data.tags);
    return getRow(newId)!;
  });
}

export interface ImportResult {
  id: string;
  name: string;
  lorebook_id: string | null;
}

/**
 * Import a character from a PNG (with tEXt) or JSON file.
 * Detects format → parses → upgrades to V2 → extracts character_book →
 * inserts → binds book.
 */
export async function importCharacter(
  bytes: Uint8Array,
  contentType?: string,
): Promise<ImportResult> {
  let raw: unknown;
  let avatarBytes: Uint8Array | null = null;

  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;

  if (isPng) {
    try {
      raw = readCard(bytes);
    } catch (err) {
      if (err instanceof NoCardDataError) {
        throw new AppError('NO_CARD_DATA', 'PNG has no embedded character data', 400);
      }
      throw new AppError('INVALID_CARD', `Failed to parse PNG: ${(err as Error).message}`, 400);
    }
    avatarBytes = bytes;
  } else if (contentType?.includes('json') || bytes[0] === 0x7b /* '{' */) {
    try {
      raw = JSON.parse(new TextDecoder().decode(bytes));
    } catch (err) {
      throw new AppError('INVALID_CARD', `Failed to parse JSON: ${(err as Error).message}`, 400);
    }
  } else {
    throw new AppError('INVALID_CARD', 'File is neither a PNG nor JSON', 400);
  }

  const card = toV2(raw);
  return importNormalized(card, avatarBytes);
}

/**
 * Lower-level import for when you already have a normalized V2 card
 * (used by the Chub fetcher).
 */
export async function importNormalized(
  card: TavernCardV2,
  avatarBytes: Uint8Array | null,
): Promise<ImportResult> {
  // Pull character_book aside; it goes to its own table.
  const book = card.data.character_book;
  const cardSansBook: TavernCardV2 = {
    ...card,
    data: { ...card.data, character_book: undefined },
  };
  delete cardSansBook.data.character_book;

  let avatarBlob: string | null = null;
  if (avatarBytes) {
    try {
      avatarBlob = await normalizeAvatar(avatarBytes);
    } catch (err) {
      // A bad avatar shouldn't tank the import — just go without one.
      console.warn(`avatar normalize failed for ${card.data.name}:`, (err as Error).message);
    }
  }

  const id = nanoid(12);
  let lorebookId: string | null = null;

  transaction(() => {
    insertCharacter(id, cardSansBook, avatarBlob);
    syncTags(id, card.data.tags);
    if (book && Array.isArray(book.entries) && book.entries.length > 0) {
      lorebookId = extractCharacterBook(id, card.data.name, book);
    }
  });

  return { id, name: card.data.name, lorebook_id: lorebookId };
}

/**
 * Reconstruct a PNG character card. Reads avatar bytes from blobs, splices
 * the character_book back in (only books with source='character:<id>'),
 * embeds tEXt.
 */
export async function exportCharacterPng(id: string): Promise<{ buffer: Uint8Array; name: string }> {
  const row = getRow(id);
  if (!row) throw NotFound('Character');

  const card: TavernCardV2 = JSON.parse(row.data);

  const book = reconstructCharacterBook(id);
  if (book) card.data.character_book = book;

  if (!row.avatar_blob) {
    throw new AppError('NO_AVATAR', 'Character has no avatar — cannot export as PNG', 400);
  }

  const path = blobPath('avatars', row.avatar_blob);
  if (!existsSync(path)) {
    throw new AppError('AVATAR_MISSING', 'Avatar file is missing from disk', 500);
  }
  const imageBytes = new Uint8Array(readFileSync(path));


  const out = writeCard(imageBytes, card);
  return { buffer: out, name: card.data.name };
}

export function exportCharacterJson(id: string): { card: TavernCardV2; name: string } {
  const row = getRow(id);
  if (!row) throw NotFound('Character');

  const card: TavernCardV2 = JSON.parse(row.data);
  const book = reconstructCharacterBook(id);
  if (book) card.data.character_book = book;

  return { card, name: card.data.name };
}

/** Bump last_chat_at. Called from messages.ts on insert. */
export function touchLastChat(characterId: string): void {
  getDb()
    .query('UPDATE characters SET last_chat_at = unixepoch() WHERE id = ?')
    .run(characterId);
}

function getRow(id: string): CharacterRow | null {
  return (
    getDb()
      .query<CharacterRow, [string]>('SELECT * FROM characters WHERE id = ?')
      .get(id) ?? null
  );
}

function insertCharacter(id: string, card: TavernCardV2, avatarBlob: string | null): void {
  getDb()
    .query(
      `INSERT INTO characters (id, name, data, avatar_blob, fav)
       VALUES (?, ?, ?, ?, 0)`,
    )
    .run(id, card.data.name, JSON.stringify(card), avatarBlob);
}

/**
 * Sync the denormalized tag index from data.tags. The JSON stays the source
 * of truth for export; this table is just a fast WHERE/JOIN.
 */
function syncTags(characterId: string, tags: string[]): void {
  const db = getDb();
  db.query('DELETE FROM character_tags WHERE character_id = ?').run(characterId);

  if (!tags.length) return;

  const upsertTag = db.query<{ id: string }, [string, string]>(
    `INSERT INTO tags (id, name) VALUES (?, ?)
     ON CONFLICT(name) DO UPDATE SET name = name RETURNING id`,
  );
  const linkTag = db.query(
    'INSERT OR IGNORE INTO character_tags (character_id, tag_id) VALUES (?, ?)',
  );

  for (const name of tags) {
    if (!name) continue;
    const tag = upsertTag.get(nanoid(10), name)!;
    linkTag.run(characterId, tag.id);
  }
}
