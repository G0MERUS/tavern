import { nanoid } from 'nanoid';
import { getDb, transaction } from '../db/index.ts';
import { getChat, touchChat } from './chats.ts';
import { touchLastChat } from './characters.ts';
import type { MessageRow, Message, Swipe, MessageExtra } from '../types.ts';
import { NotFound, AppError } from '../types.ts';

// Messages. Position is a sparse integer (gap of POSITION_GAP) so mid-chat
// inserts don't reorder anything until gaps run out, at which point we
// rebalance.

const POSITION_GAP = 1024;

export function listMessages(
  chatId: string,
  opts: { afterPosition?: number; limit?: number } = {},
): Message[] {
  const limit = Math.min(opts.limit ?? 1000, 5000);
  const after = opts.afterPosition ?? -1;

  return getDb()
    .query<MessageRow, [string, number, number]>(
      `SELECT * FROM messages
       WHERE chat_id = ? AND position > ?
       ORDER BY position ASC
       LIMIT ?`,
    )
    .all(chatId, after, limit)
    .map(rowToMessage);
}

export function getMessage(id: string): Message | null {
  const row = getDb()
    .query<MessageRow, [string]>('SELECT * FROM messages WHERE id = ?')
    .get(id);
  return row ? rowToMessage(row) : null;
}

export interface MessageInput {
  role: 'user' | 'assistant' | 'system';
  content: string;
  character_id?: string | null;
  extra?: MessageExtra;
  /** Insert after this position (mid-chat). Omitted = append. */
  after_position?: number;
  is_hidden?: boolean;
}

export function createMessage(chatId: string, input: MessageInput): Message {
  const chat = getChat(chatId);
  if (!chat) throw NotFound('Chat');

  return transaction(() => {
    const position = computePosition(chatId, input.after_position);

    const id = nanoid(12);
    getDb()
      .query(
        `INSERT INTO messages
         (id, chat_id, position, role, character_id, content, swipes, swipe_idx, extra, is_hidden)
         VALUES (?, ?, ?, ?, ?, ?, '[]', 0, ?, ?)`,
      )
      .run(
        id,
        chatId,
        position,
        input.role,
        input.character_id ?? null,
        input.content,
        JSON.stringify(input.extra ?? {}),
        input.is_hidden ? 1 : 0,
      );

    touchChat(chatId);
    if (chat.character_id) touchLastChat(chat.character_id);

    return getMessage(id)!;
  });
}

/**
 * Compute position for a new message.
 *
 * Append (afterPosition undefined): max + GAP.
 * Mid-chat: midpoint between afterPosition and next. If the gap is exhausted
 * (≤1 — takes ~10 consecutive same-spot inserts with GAP=1024), rebalance
 * the whole chat first. Rare enough that an O(n) rebalance is fine.
 *
 * After rebalancing, `afterPosition` no longer maps to a row — we snapshot
 * the *rank* of the insertion point before rebalancing, then derive the
 * post-rebalance position from that rank.
 */
function computePosition(chatId: string, afterPosition?: number): number {
  const db = getDb();

  // Append.
  if (afterPosition === undefined) {
    const max = db
      .query<{ p: number | null }, [string]>(
        'SELECT MAX(position) AS p FROM messages WHERE chat_id = ?',
      )
      .get(chatId)!.p;
    return (max ?? 0) + POSITION_GAP;
  }

  // Mid-chat.
  const next = db
    .query<{ p: number | null }, [string, number]>(
      'SELECT MIN(position) AS p FROM messages WHERE chat_id = ? AND position > ?',
    )
    .get(chatId, afterPosition)!.p;

  if (next == null) {
    // Nothing after this one — effectively an append.
    return afterPosition + POSITION_GAP;
  }

  if (next - afterPosition > 1) {
    return afterPosition + Math.floor((next - afterPosition) / 2);
  }

  // Gap exhausted. Snapshot rank BEFORE rebalancing — afterPosition will be
  // invalid after.
  const rank = db
    .query<{ r: number }, [string, number]>(
      'SELECT COUNT(*) AS r FROM messages WHERE chat_id = ? AND position <= ?',
    )
    .get(chatId, afterPosition)!.r;

  rebalance(chatId);

  // After rebalance, row at rank N has position N*GAP. Insert at midpoint.
  return rank * POSITION_GAP + Math.floor(POSITION_GAP / 2);
}

/**
 * Reassign positions to be evenly spaced. Two-pass through negative range to
 * dodge the UNIQUE(chat_id, position) constraint mid-flight.
 */
function rebalance(chatId: string): void {
  const db = getDb();
  const ids = db
    .query<{ id: string }, [string]>(
      'SELECT id FROM messages WHERE chat_id = ? ORDER BY position ASC',
    )
    .all(chatId);

  const stmt = db.query('UPDATE messages SET position = ? WHERE id = ?');
  // Pass 1: park in negative space.
  for (let i = 0; i < ids.length; i++) stmt.run(-(i + 1), ids[i]!.id);
  // Pass 2: final positions.
  for (let i = 0; i < ids.length; i++) stmt.run((i + 1) * POSITION_GAP, ids[i]!.id);
}

export function updateMessage(
  id: string,
  patch: {
    content?: string;
    extra?: MessageExtra;
    is_hidden?: boolean;
    swipe_idx?: number;
  },
): Message {
  const existing = getMessageRow(id);
  if (!existing) throw NotFound('Message');

  return transaction(() => {
    const fields: string[] = [];
    const values: (string | number)[] = [];

    // swipe_idx switches the active swipe — copies swipes[idx].content into
    // content. Done BEFORE the content patch so an explicit edit still wins.
    if (patch.swipe_idx !== undefined) {
      const swipes: Swipe[] = JSON.parse(existing.swipes);
      if (patch.swipe_idx < 0 || patch.swipe_idx >= swipes.length) {
        throw new AppError('INVALID_SWIPE', `swipe_idx ${patch.swipe_idx} out of range`, 400);
      }
      fields.push('swipe_idx = ?', 'content = ?');
      values.push(patch.swipe_idx, swipes[patch.swipe_idx]!.content);
    }

    if (patch.content !== undefined) {
      fields.push('content = ?');
      values.push(patch.content);
    }
    if (patch.extra !== undefined) {
      fields.push('extra = ?');
      values.push(JSON.stringify(patch.extra));
    }
    if (patch.is_hidden !== undefined) {
      fields.push('is_hidden = ?');
      values.push(patch.is_hidden ? 1 : 0);
    }

    if (fields.length > 0) {
      getDb()
        .query(`UPDATE messages SET ${fields.join(', ')} WHERE id = ?`)
        .run(...values, id);
    }

    touchChat(existing.chat_id);
    return getMessage(id)!;
  });
}

export function deleteMessage(id: string): void {
  const existing = getMessageRow(id);
  if (!existing) throw NotFound('Message');
  getDb().query('DELETE FROM messages WHERE id = ?').run(id);
  touchChat(existing.chat_id);
}

/**
 * Swap positions with a neighbor. The frontend computes which neighbor
 * (`messages[i ± 1]`) and sends both IDs. Two-pass through a parking spot
 * just like rebalance() to dodge the UNIQUE(chat_id, position) constraint.
 */
export function moveMessage(id: string, swapWithId: string): Message {
  const a = getMessageRow(id);
  const b = getMessageRow(swapWithId);
  if (!a) throw NotFound('Message');
  if (!b) throw NotFound('Message (swap target)');
  if (a.chat_id !== b.chat_id) {
    throw new AppError('INVALID_INPUT', 'Cannot swap across chats', 400);
  }

  return transaction(() => {
    const db = getDb();
    // Park `a` at a position guaranteed free. computePosition never produces
    // negatives; rebalance() only uses them transiently inside its own
    // transaction, so -1 is safe here.
    db.query('UPDATE messages SET position = -1 WHERE id = ?').run(a.id);
    db.query('UPDATE messages SET position = ?  WHERE id = ?').run(a.position, b.id);
    db.query('UPDATE messages SET position = ?  WHERE id = ?').run(b.position, a.id);

    touchChat(a.chat_id);
    return getMessage(id)!;
  });
}

/**
 * Append a swipe (alternate generation). If `activate`, also set it as the
 * current content.
 *
 * Swipes are a JSON array, not a child table — they're alternates of *one*
 * message, never queried independently, always loaded/swapped/deleted
 * together.
 */
export function addSwipe(
  messageId: string,
  swipe: { content: string; model?: string; extra?: MessageExtra; activate?: boolean },
): Message {
  const existing = getMessageRow(messageId);
  if (!existing) throw NotFound('Message');

  return transaction(() => {
    const swipes: Swipe[] = JSON.parse(existing.swipes);

    // First swipe: capture current content + extra as swipe 0 so it's not lost.
    if (swipes.length === 0) {
      swipes.push({
        content: existing.content,
        extra: JSON.parse(existing.extra),
      });
    }

    swipes.push({
      content: swipe.content,
      model: swipe.model,
      extra: swipe.extra,
      gen_at: Math.floor(Date.now() / 1000),
    });

    const newIdx = swipes.length - 1;
    const activate = swipe.activate !== false;

    if (activate) {
      // Merge swipe.extra over the message's standing extra so message-level
      // fields (bookmark_link, attachments) survive while gen-result fields
      // (reasoning, token_count, finish_reason) are updated.
      const baseExtra: MessageExtra = JSON.parse(existing.extra);
      const merged = JSON.stringify({ ...baseExtra, ...(swipe.extra ?? {}) });
      getDb()
        .query('UPDATE messages SET swipes = ?, swipe_idx = ?, content = ?, extra = ? WHERE id = ?')
        .run(JSON.stringify(swipes), newIdx, swipe.content, merged, messageId);
    } else {
      getDb()
        .query('UPDATE messages SET swipes = ? WHERE id = ?')
        .run(JSON.stringify(swipes), messageId);
    }

    touchChat(existing.chat_id);
    return getMessage(messageId)!;
  });
}

/**
 * Splice a swipe from the JSON array. If the active swipe is deleted, snap
 * to the nearest surviving one and copy its content/extra back to the message.
 */
export function deleteSwipe(messageId: string, idx: number): Message {
  const existing = getMessageRow(messageId);
  if (!existing) throw NotFound('Message');

  const swipes: Swipe[] = JSON.parse(existing.swipes);
  if (idx < 0 || idx >= swipes.length) {
    throw new AppError('INVALID_SWIPE', `swipe index ${idx} out of range`, 400);
  }
  if (swipes.length <= 1) {
    // Deleting the only swipe = deleting the message. Callers should use
    // deleteMessage. Refusing here makes the contract explicit.
    throw new AppError('INVALID_SWIPE', 'Cannot delete the last swipe', 400);
  }

  return transaction(() => {
    swipes.splice(idx, 1);

    // If we deleted the active swipe, snap to the nearest surviving one. If
    // we deleted a swipe before the active one, the active index slides down
    // by one. If after, no change.
    let newIdx = existing.swipe_idx;
    if (idx < existing.swipe_idx) {
      newIdx = existing.swipe_idx - 1;
    } else if (idx === existing.swipe_idx) {
      newIdx = Math.min(idx, swipes.length - 1);
    }

    const newContent = swipes[newIdx]!.content;
    // Restore per-swipe extra if present. Merge over existing so
    // message-level fields (bookmark_link, attachments) survive.
    const baseExtra: MessageExtra = JSON.parse(existing.extra);
    const swipeExtra = swipes[newIdx]!.extra ?? {};
    const newExtra = JSON.stringify({ ...baseExtra, ...swipeExtra });

    getDb()
      .query('UPDATE messages SET swipes = ?, swipe_idx = ?, content = ?, extra = ? WHERE id = ?')
      .run(JSON.stringify(swipes), newIdx, newContent, newExtra, messageId);

    touchChat(existing.chat_id);
    return getMessage(messageId)!;
  });
}

function getMessageRow(id: string): MessageRow | null {
  return (
    getDb()
      .query<MessageRow, [string]>('SELECT * FROM messages WHERE id = ?')
      .get(id) ?? null
  );
}

function rowToMessage(row: MessageRow): Message {
  // DB stamps `created_at` via SQLite's unixepoch() — that's SECONDS since
  // epoch. The frontend feeds this straight into dayjs(), which expects
  // MILLISECONDS; without the *1000, every server-loaded message dates to
  // Jan 21, 1970. Swipe.gen_at is stored seconds too (addSwipe uses
  // Math.floor(Date.now()/1000)); normalize per-swipe so they don't diverge
  // from message.created_at if we ever surface them.
  const swipes: Swipe[] = JSON.parse(row.swipes);
  for (const s of swipes) {
    if (typeof s.gen_at === 'number') s.gen_at = s.gen_at * 1000;
  }
  return {
    id: row.id,
    chat_id: row.chat_id,
    position: row.position,
    role: row.role,
    character_id: row.character_id,
    content: row.content,
    swipes,
    swipe_idx: row.swipe_idx,
    extra: JSON.parse(row.extra),
    is_hidden: !!row.is_hidden,
    created_at: row.created_at * 1000,
  };
}
