import { describe, test, expect, beforeEach, afterEach } from 'vitest';

import { setupDb, teardownDb } from '../setup.ts';
import { createCharacter } from '../../src/core/characters.ts';
import { createChat, getChat, branchChat } from '../../src/core/chats.ts';
import {
  createMessage,
  listMessages,
  updateMessage,
  deleteMessage,
  moveMessage,
  addSwipe,
  deleteSwipe,
} from '../../src/core/messages.ts';

// Position math is the part most likely to be subtly wrong. Sparse-integer
// gaps, mid-chat insert, rebalancing when gaps run out — exercise it all.

let chatId: string;
let charId: string;

beforeEach(async () => {
  setupDb();
  const char = await createCharacter({ data: { name: 'Test' } });
  charId = char.id;
  chatId = createChat({ character_id: char.id }).id;
});
afterEach(teardownDb);

describe('messages — position', () => {
  test('append assigns increasing positions', () => {
    const a = createMessage(chatId, { role: 'user', content: 'a' });
    const b = createMessage(chatId, { role: 'assistant', content: 'b' });
    const c = createMessage(chatId, { role: 'user', content: 'c' });

    expect(a.position).toBeLessThan(b.position);
    expect(b.position).toBeLessThan(c.position);

    const list = listMessages(chatId);
    expect(list.map((m) => m.content)).toEqual(['a', 'b', 'c']);
  });

  test('mid-chat insert lands between neighbours', () => {
    const a = createMessage(chatId, { role: 'user', content: 'a' });
    const c = createMessage(chatId, { role: 'user', content: 'c' });
    const b = createMessage(chatId, { role: 'user', content: 'b', after_position: a.position });

    expect(b.position).toBeGreaterThan(a.position);
    expect(b.position).toBeLessThan(c.position);
    expect(listMessages(chatId).map((m) => m.content)).toEqual(['a', 'b', 'c']);
  });

  test('insert after last message acts like append', () => {
    const a = createMessage(chatId, { role: 'user', content: 'a' });
    const b = createMessage(chatId, { role: 'user', content: 'b', after_position: a.position });

    expect(b.position).toBeGreaterThan(a.position);
    expect(listMessages(chatId).map((m) => m.content)).toEqual(['a', 'b']);
  });

  test('rebalances when gap exhausts (10+ same-spot inserts)', () => {
    // GAP=1024, halving each insert → after 10 inserts gap = 1, rebalance fires.
    const anchor = createMessage(chatId, { role: 'user', content: 'anchor' });
    createMessage(chatId, { role: 'user', content: 'tail' });

    for (let i = 0; i < 12; i++) {
      createMessage(chatId, { role: 'user', content: `m${i}`, after_position: anchor.position });
    }

    // Order: anchor, then m11..m0 (each inserted right after anchor), then tail.
    const list = listMessages(chatId);
    expect(list).toHaveLength(14);
    expect(list[0]!.content).toBe('anchor');
    expect(list[list.length - 1]!.content).toBe('tail');

    const positions = list.map((m) => m.position);
    const sorted = [...positions].sort((a, b) => a - b);
    expect(positions).toEqual(sorted);
    expect(new Set(positions).size).toBe(14);

    // Each mid-insert landed right after anchor, so latest first.
    expect(list.slice(1, -1).map((m) => m.content)).toEqual([
      'm11', 'm10', 'm9', 'm8', 'm7', 'm6', 'm5', 'm4', 'm3', 'm2', 'm1', 'm0',
    ]);
  });

  test('UNIQUE constraint holds under stress', () => {
    // 50 appends + 50 random mid-inserts. Any breakage in position math
    // trips the UNIQUE(chat_id, position) index.
    const created: number[] = [];
    for (let i = 0; i < 50; i++) {
      created.push(createMessage(chatId, { role: 'user', content: `seq${i}` }).position);
    }
    for (let i = 0; i < 50; i++) {
      const after = created[Math.floor(Math.random() * created.length)]!;
      createMessage(chatId, { role: 'user', content: `mid${i}`, after_position: after });
    }

    const list = listMessages(chatId);
    expect(list).toHaveLength(100);
    expect(new Set(list.map((m) => m.position)).size).toBe(100);
  });
});

describe('messages — swipes', () => {
  test('first swipe captures original content as swipe[0]', () => {
    const m = createMessage(chatId, { role: 'assistant', content: 'original' });
    const swiped = addSwipe(m.id, { content: 'regen', model: 'gpt-4' });

    expect(swiped.swipes).toHaveLength(2);
    expect(swiped.swipes[0]!.content).toBe('original');
    expect(swiped.swipes[1]!.content).toBe('regen');
    expect(swiped.swipes[1]!.model).toBe('gpt-4');
    // activate defaults to true → content updated to new swipe.
    expect(swiped.content).toBe('regen');
    expect(swiped.swipe_idx).toBe(1);
  });

  test('subsequent swipes append, do not re-capture original', () => {
    const m = createMessage(chatId, { role: 'assistant', content: 'original' });
    addSwipe(m.id, { content: 'r1' });
    addSwipe(m.id, { content: 'r2' });
    const final = addSwipe(m.id, { content: 'r3' });

    expect(final.swipes.map((s) => s.content)).toEqual(['original', 'r1', 'r2', 'r3']);
    expect(final.swipe_idx).toBe(3);
  });

  test('activate=false adds swipe without switching content', () => {
    const m = createMessage(chatId, { role: 'assistant', content: 'keep' });
    const swiped = addSwipe(m.id, { content: 'shelved', activate: false });

    expect(swiped.swipes).toHaveLength(2);
    expect(swiped.content).toBe('keep');
    expect(swiped.swipe_idx).toBe(0);
  });

  test('swipe_idx patch switches active content from swipes array', () => {
    const m = createMessage(chatId, { role: 'assistant', content: 'a' });
    addSwipe(m.id, { content: 'b' });
    addSwipe(m.id, { content: 'c' });

    const switched = updateMessage(m.id, { swipe_idx: 0 });
    expect(switched.content).toBe('a');
    expect(switched.swipe_idx).toBe(0);

    expect(updateMessage(m.id, { swipe_idx: 1 }).content).toBe('b');
  });

  test('swipe_idx out of range throws', () => {
    const m = createMessage(chatId, { role: 'assistant', content: 'a' });
    addSwipe(m.id, { content: 'b' });

    expect(() => updateMessage(m.id, { swipe_idx: 5 })).toThrow();
    expect(() => updateMessage(m.id, { swipe_idx: -1 })).toThrow();
  });
});

describe('messages — basics', () => {
  test('update content', () => {
    const m = createMessage(chatId, { role: 'user', content: 'before' });
    const updated = updateMessage(m.id, { content: 'after' });
    expect(updated.content).toBe('after');
  });

  test('is_hidden toggle', () => {
    const m = createMessage(chatId, { role: 'system', content: 'note' });
    expect(m.is_hidden).toBe(false);

    const hidden = updateMessage(m.id, { is_hidden: true });
    expect(hidden.is_hidden).toBe(true);
  });

  test('delete', () => {
    const m = createMessage(chatId, { role: 'user', content: 'doomed' });
    deleteMessage(m.id);
    expect(listMessages(chatId)).toHaveLength(0);
  });

  test('extra JSON roundtrip', () => {
    const m = createMessage(chatId, {
      role: 'assistant',
      content: 'hi',
      extra: { model: 'gpt-4', token_count: 42, attachments: ['/blobs/x.png'] },
    });
    expect(m.extra.model).toBe('gpt-4');
    expect(m.extra.token_count).toBe(42);
    expect(m.extra.attachments).toEqual(['/blobs/x.png']);
  });
});

describe('moveMessage', () => {
  test('swaps positions', () => {
    const a = createMessage(chatId, { role: 'user', content: 'first' });
    const b = createMessage(chatId, { role: 'assistant', content: 'second' });
    moveMessage(b.id, a.id);
    const list = listMessages(chatId);
    expect(list[0]!.content).toBe('second');
    expect(list[1]!.content).toBe('first');
  });

  test('rejects cross-chat swap', () => {
    const chat2 = createChat({ character_id: charId }).id;
    const a = createMessage(chatId, { role: 'user', content: 'x' });
    const b = createMessage(chat2, { role: 'user', content: 'y' });
    expect(() => moveMessage(a.id, b.id)).toThrow(/across chats/);
  });

  test('rejects nonexistent target', () => {
    const a = createMessage(chatId, { role: 'user', content: 'x' });
    expect(() => moveMessage(a.id, 'nope')).toThrow(/not found/);
    expect(() => moveMessage('nope', a.id)).toThrow(/not found/);
  });
});

describe('deleteSwipe', () => {
  test('splices and snaps active index', () => {
    const m = createMessage(chatId, { role: 'assistant', content: 'v0' });
    addSwipe(m.id, { content: 'v1', activate: true });
    addSwipe(m.id, { content: 'v2', activate: true });
    // Now: swipes = [v0, v1, v2], swipe_idx = 2, content = 'v2'
    const after = deleteSwipe(m.id, 2);
    expect(after.swipes.length).toBe(2);
    expect(after.swipe_idx).toBe(1);
    expect(after.content).toBe('v1');
  });

  test('decrements index when deleting before it', () => {
    const m = createMessage(chatId, { role: 'assistant', content: 'v0' });
    addSwipe(m.id, { content: 'v1' });
    addSwipe(m.id, { content: 'v2', activate: true }); // idx=2
    const after = deleteSwipe(m.id, 0);
    expect(after.swipe_idx).toBe(1);
    expect(after.content).toBe('v2');
  });

  test('leaves index unchanged when deleting after it', () => {
    const m = createMessage(chatId, { role: 'assistant', content: 'v0' });
    addSwipe(m.id, { content: 'v1', activate: true }); // idx=1
    addSwipe(m.id, { content: 'v2', activate: false });
    const after = deleteSwipe(m.id, 2);
    expect(after.swipe_idx).toBe(1);
    expect(after.content).toBe('v1');
  });

  test('refuses to delete the last swipe', () => {
    const m = createMessage(chatId, { role: 'assistant', content: 'only' });
    addSwipe(m.id, { content: 'temp' });
    deleteSwipe(m.id, 1);
    // Back to one swipe (the captured 'only').
    expect(() => deleteSwipe(m.id, 0)).toThrow(/last swipe/);
  });

  test('rejects out-of-range index', () => {
    const m = createMessage(chatId, { role: 'assistant', content: 'v0' });
    addSwipe(m.id, { content: 'v1' });
    expect(() => deleteSwipe(m.id, 5)).toThrow(/out of range/);
    expect(() => deleteSwipe(m.id, -1)).toThrow(/out of range/);
  });

  test('preserves message-level extra on snap', () => {
    // Snapped swipe.extra spreads over message.extra so bookmark_link
    // survives even when snapping to a partial swipe.
    const m = createMessage(chatId, {
      role: 'assistant',
      content: 'v0',
      extra: { bookmark_link: 'some-chat' },
    });
    addSwipe(m.id, { content: 'v1', extra: { reasoning: 'A' }, activate: true });
    addSwipe(m.id, { content: 'v2', extra: { reasoning: 'B' }, activate: true });
    // Snap to v1: its extra is partial ({reasoning:'A'}), merge keeps bookmark_link.
    const after = deleteSwipe(m.id, 2);
    expect(after.swipe_idx).toBe(1);
    expect(after.extra['bookmark_link']).toBe('some-chat');
    expect(after.extra.reasoning).toBe('A');
  });

  test('addSwipe captures extra in swipe[0] and merges on activate', () => {
    const m = createMessage(chatId, {
      role: 'assistant',
      content: 'orig',
      extra: { bookmark_link: 'chat-x', token_count: 10 },
    });
    const swiped = addSwipe(m.id, {
      content: 'regen',
      extra: { reasoning: 'hmm', token_count: 99 },
      activate: true,
    });
    // swipe[0] snapshot includes original extra.
    expect(swiped.swipes[0]!.extra?.['bookmark_link']).toBe('chat-x');
    expect(swiped.swipes[0]!.extra?.token_count).toBe(10);
    // Message extra: bookmark_link survives, gen fields overwritten.
    expect(swiped.extra['bookmark_link']).toBe('chat-x');
    expect(swiped.extra.reasoning).toBe('hmm');
    expect(swiped.extra.token_count).toBe(99);
  });
});

describe('branchChat', () => {
  test('copies messages up to position', () => {
    for (let i = 0; i < 5; i++) {
      createMessage(chatId, { role: 'user', content: `msg${i}` });
    }
    const list = listMessages(chatId);
    const cutoff = list[2]!.position;

    const branch = branchChat(chatId, { up_to_position: cutoff });

    const branchMsgs = listMessages(branch.id);
    expect(branchMsgs.length).toBe(3);
    expect(branchMsgs.map((m) => m.content)).toEqual(['msg0', 'msg1', 'msg2']);
    // New IDs — no overlap with the source chat's message IDs.
    const sourceIds = new Set(list.map((m) => m.id));
    expect(branchMsgs.some((m) => sourceIds.has(m.id))).toBe(false);

    // Same positions (sparse, preserved).
    expect(branchMsgs.map((m) => m.position)).toEqual(list.slice(0, 3).map((m) => m.position));
  });

  test('writes parent_chat to metadata', () => {
    createMessage(chatId, { role: 'user', content: 'x' });
    const branch = branchChat(chatId, { up_to_position: 999999 });
    const meta = JSON.parse(branch.metadata);
    expect(meta.parent_chat).toBe(chatId);
  });

  test('preserves created_at', () => {
    const m = createMessage(chatId, { role: 'user', content: 'old' });
    const branch = branchChat(chatId, { up_to_position: m.position });
    expect(listMessages(branch.id)[0]!.created_at).toBe(m.created_at);
  });

  test('inherits source metadata, overwrites parent_chat on branch-of-branch', () => {
    createMessage(chatId, { role: 'user', content: 'x' });
    const b1 = branchChat(chatId, { up_to_position: 999999 });
    const b2 = branchChat(b1.id, { up_to_position: 999999 });
    const meta = JSON.parse(b2.metadata);
    expect(meta.parent_chat).toBe(b1.id); // chains, doesn't fan out.
  });

  test('default title appends " — branch"', () => {
    createMessage(chatId, { role: 'user', content: 'x' });
    const source = getChat(chatId)!;
    const branch = branchChat(chatId, { up_to_position: 999999 });
    expect(branch.title).toBe(`${source.title} — branch`);
  });

  test('custom title', () => {
    createMessage(chatId, { role: 'user', content: 'x' });
    const branch = branchChat(chatId, { up_to_position: 999999, title: 'my fork' });
    expect(branch.title).toBe('my fork');
  });

  test('rejects nonexistent source', () => {
    expect(() => branchChat('nope', { up_to_position: 0 })).toThrow(/not found/);
  });
});
