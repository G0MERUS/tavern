import { nanoid } from 'nanoid';
import { getDb, transaction } from '../db/index.ts';
import { touchLastChat } from './characters.ts';
import type { ChatRow, ChatSummary } from '../types.ts';
import { NotFound, AppError } from '../types.ts';

// Chats are solo-XOR-group, enforced by a CHECK constraint.

export interface ChatListOptions {
  characterId?: string;
  groupId?: string;
  limit?: number;
}

export function listChats(opts: ChatListOptions = {}): ChatSummary[] {
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (opts.characterId) {
    where.push('c.character_id = ?');
    params.push(opts.characterId);
  }
  if (opts.groupId) {
    where.push('c.group_id = ?');
    params.push(opts.groupId);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(opts.limit ?? 100, 500);

  // last_message_preview: substr of the highest-position message. The
  // subquery is correlated but idx_messages_chat_pos covers it.
  return getDb()
    .query<
      ChatRow & { message_count: number; last_message_preview: string | null },
      (string | number)[]
    >(
      `SELECT c.*,
              (SELECT COUNT(*) FROM messages WHERE chat_id = c.id) AS message_count,
              (SELECT substr(content, 1, 200) FROM messages WHERE chat_id = c.id
               ORDER BY position DESC LIMIT 1) AS last_message_preview
       FROM chats c
       ${whereClause}
       ORDER BY c.updated_at DESC
       LIMIT ?`,
    )
    .all(...params, limit)
    .map((r) => ({
      id: r.id,
      title: r.title,
      character_id: r.character_id,
      group_id: r.group_id,
      message_count: r.message_count,
      last_message_preview: r.last_message_preview ?? '',
      // Seconds in the DB (unixepoch()); ms on the wire for dayjs.
      created_at: r.created_at * 1000,
      updated_at: r.updated_at * 1000,
    }));
}

export function getChat(id: string): ChatRow | null {
  return (
    getDb()
      .query<ChatRow, [string]>('SELECT * FROM chats WHERE id = ?')
      .get(id) ?? null
  );
}

export interface ChatCreateInput {
  character_id?: string;
  group_id?: string;
  title?: string;
  persona_id?: string;
}

export function createChat(input: ChatCreateInput): ChatRow {
  // XOR validated by app + DB CHECK constraint. App-level check first for a
  // friendlier error than "CHECK constraint failed".
  const hasChar = !!input.character_id;
  const hasGroup = !!input.group_id;
  if (hasChar === hasGroup) {
    throw new AppError(
      'INVALID_INPUT',
      'Provide exactly one of character_id or group_id',
      400,
    );
  }

  const id = nanoid(12);
  const title = input.title ?? defaultTitle(input);

  getDb()
    .query(
      `INSERT INTO chats (id, title, character_id, group_id, persona_id)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(id, title, input.character_id ?? null, input.group_id ?? null, input.persona_id ?? null);

  return getChat(id)!;
}

export function updateChat(
  id: string,
  patch: { title?: string; metadata?: Record<string, unknown>; persona_id?: string | null },
): ChatRow {
  if (!getChat(id)) throw NotFound('Chat');

  const fields: string[] = ['updated_at = unixepoch()'];
  const values: (string | null)[] = [];
  if (patch.title !== undefined) {
    fields.push('title = ?');
    values.push(patch.title);
  }
  if (patch.metadata !== undefined) {
    fields.push('metadata = ?');
    values.push(JSON.stringify(patch.metadata));
  }
  if (patch.persona_id !== undefined) {
    fields.push('persona_id = ?');
    values.push(patch.persona_id);
  }

  getDb()
    .query(`UPDATE chats SET ${fields.join(', ')} WHERE id = ?`)
    .run(...values, id);

  return getChat(id)!;
}

export function deleteChat(id: string): void {
  if (!getChat(id)) throw NotFound('Chat');
  getDb().query('DELETE FROM chats WHERE id = ?').run(id);
}

export interface BranchInput {
  /** Inclusive cutoff. Messages with position <= this are copied. */
  up_to_position: number;
  title?: string;
}

/**
 * Fork a chat at a position. Two INSERTs in a transaction: one for the chat
 * row (inheriting parent metadata + stamping `parent_chat`), one
 * INSERT…SELECT for all messages with position <= cutoff.
 *
 * Message IDs are SQLite-generated hex (one round-trip for N rows). Positions
 * and created_at are preserved — the branch continues from an existing
 * timeline.
 */
export function branchChat(sourceId: string, input: BranchInput): ChatRow {
  const source = getChat(sourceId);
  if (!source) throw NotFound('Chat');

  return transaction(() => {
    const db = getDb();
    const newId = nanoid(12);

    // Inherit parent metadata and stamp parent_chat. Existing parent_chat
    // (from branching a branch) is overwritten — chains, doesn't fan out.
    const sourceMeta = JSON.parse(source.metadata) as Record<string, unknown>;
    const newMeta = JSON.stringify({ ...sourceMeta, parent_chat: sourceId });

    db.query(
      `INSERT INTO chats (id, title, character_id, group_id, persona_id, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      newId,
      input.title ?? `${source.title} — branch`,
      source.character_id,
      source.group_id,
      source.persona_id,
      newMeta,
    );

    // New IDs, same positions (sparse so no rebalance needed), same
    // created_at — these ARE the original messages, in a new timeline.
    db.query(
      `INSERT INTO messages
         (id, chat_id, position, role, character_id, content, swipes, swipe_idx, extra, is_hidden, created_at)
       SELECT
         lower(hex(randomblob(6))), ?, position, role, character_id, content, swipes, swipe_idx, extra, is_hidden, created_at
       FROM messages
       WHERE chat_id = ? AND position <= ?
       ORDER BY position ASC`,
    ).run(newId, sourceId, input.up_to_position);

    if (source.character_id) touchLastChat(source.character_id);
    return getChat(newId)!;
  });
}

/** Bump updated_at. Called from messages.ts on any message mutation. */
export function touchChat(id: string): void {
  getDb().query('UPDATE chats SET updated_at = unixepoch() WHERE id = ?').run(id);
}

export interface SearchHit {
  chat_id: string;
  chat_title: string;
  message_id: string;
  position: number;
  snippet: string;
  rank: number;
}

/** FTS5 search across all messages. */
export function searchChats(
  query: string,
  filters: { characterId?: string; groupId?: string } = {},
): SearchHit[] {
  if (!query.trim()) return [];

  // FTS5 quoting: wrap in double quotes and escape inner double quotes so
  // user queries containing operators (- * NEAR) don't blow up parsing.
  const ftsQuery = `"${query.replace(/"/g, '""')}"`;

  const where: string[] = ['messages_fts MATCH ?'];
  const params: (string | number)[] = [ftsQuery];

  if (filters.characterId) {
    where.push('c.character_id = ?');
    params.push(filters.characterId);
  }
  if (filters.groupId) {
    where.push('c.group_id = ?');
    params.push(filters.groupId);
  }

  return getDb()
    .query<SearchHit, (string | number)[]>(
      `SELECT m.chat_id, c.title AS chat_title, m.id AS message_id, m.position,
              snippet(messages_fts, 0, '<mark>', '</mark>', '…', 32) AS snippet,
              bm25(messages_fts) AS rank
       FROM messages_fts
       JOIN messages m ON m.rowid = messages_fts.rowid
       JOIN chats c ON c.id = m.chat_id
       WHERE ${where.join(' AND ')}
       ORDER BY rank
       LIMIT 50`,
    )
    .all(...params);
}

function defaultTitle(input: ChatCreateInput): string {
  const db = getDb();
  let name = 'Chat';
  if (input.character_id) {
    name =
      db
        .query<{ name: string }, [string]>('SELECT name FROM characters WHERE id = ?')
        .get(input.character_id)?.name ?? 'Chat';
  } else if (input.group_id) {
    name =
      db
        .query<{ name: string }, [string]>('SELECT name FROM groups WHERE id = ?')
        .get(input.group_id)?.name ?? 'Group';
  }
  const date = new Date().toISOString().slice(0, 10);
  return `${name} — ${date}`;
}
