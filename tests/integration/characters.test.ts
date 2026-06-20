import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { setupDb, teardownDb, FIXTURES } from '../setup.ts';
import {
  importCharacter,
  exportCharacterPng,
  exportCharacterJson,
  getCharacterFull,
  listCharacters,
  updateCharacter,
  deleteCharacter,
  createCharacter,
} from '../../src/core/characters.ts';
import {
  getLorebookWithEntries,
  getBindingsForCharacter,
} from '../../src/core/lorebooks.ts';
import { createChat, listChats } from '../../src/core/chats.ts';
import { searchChats } from '../../src/core/chats.ts';
import { createMessage } from '../../src/core/messages.ts';
import { readCard } from '../../src/card/parse.ts';
import { toV2 } from '../../src/card/normalize.ts';
import { getDb } from '../../src/db/index.ts';

// Full import → DB → export roundtrip on a real card. If this passes, the
// PNG-with-tEXt format is correctly handled and we can interop.

const seraphinaPng = readFileSync(join(FIXTURES, 'seraphina.png'));

beforeEach(setupDb);
afterEach(teardownDb);

describe('character import — Seraphina (real card)', () => {
  test('import extracts character_book to a lorebook + binding', async () => {
    const result = await importCharacter(seraphinaPng, 'image/png');

    expect(result.name).toBe('Seraphina');
    expect(result.id).toBeString();
    expect(result.lorebook_id).toBeString();

    // Character row exists, data column does NOT contain character_book.
    const full = getCharacterFull(result.id)!;
    expect(full.name).toBe('Seraphina');
    expect((full.data as any).character_book).toBeUndefined();

    // Lorebook was created with the right provenance.
    const book = getLorebookWithEntries(result.lorebook_id!)!;
    expect(book.source).toBe(`character:${result.id}`);
    expect(book.entries).toHaveLength(4);

    // Entries have keys and content (spot-check first one survived parsing).
    const entry = book.entries[0]!;
    expect(JSON.parse(entry.keys).length).toBeGreaterThan(0);
    expect(entry.content.length).toBeGreaterThan(0);

    expect(getBindingsForCharacter(result.id)).toContain(result.lorebook_id);
  });

  test('avatar normalized to 512×768 PNG, no tEXt in stored blob', async () => {
    const result = await importCharacter(seraphinaPng, 'image/png');
    const full = getCharacterFull(result.id)!;

    expect(full.avatar_url).toBeString();
    expect(full.avatar_url).toMatch(/^\/blobs\/avatars\/.+\.png$/);

    // Original was 400×600. Stored blob should be 512×768 with no embedded
    // card data — the DB is the source of truth.
    const sharp = (await import('sharp')).default;
    const blobPath = full.avatar_url!.replace('/blobs/avatars/', '');
    const { blobPath: resolvePath } = await import('../../src/files/blobs.ts');
    const meta = await sharp(resolvePath('avatars', blobPath)).metadata();

    expect(meta.width).toBe(512);
    expect(meta.height).toBe(768);

    // No tEXt in the stored blob.
    const blobBytes = readFileSync(resolvePath('avatars', blobPath));
    expect(() => readCard(blobBytes)).toThrow();
  });

  test('export PNG re-embeds character_book — full roundtrip', async () => {
    const imported = await importCharacter(seraphinaPng, 'image/png');

    const { buffer, name } = await exportCharacterPng(imported.id);
    expect(name).toBe('Seraphina');

    const recovered = toV2(readCard(buffer));

    expect(recovered.data.name).toBe('Seraphina');
    expect(recovered.data.character_book).toBeDefined();
    expect(recovered.data.character_book!.entries).toHaveLength(4);

    const original = toV2(readCard(seraphinaPng));
    expect(recovered.data.description).toBe(original.data.description);
    expect(recovered.data.first_mes).toBe(original.data.first_mes);
    expect(recovered.data.system_prompt).toBe(original.data.system_prompt);

    // Book entry content should be byte-identical (key arrays may reorder).
    const origContents = original.data.character_book!.entries
      .map((e) => e.content).sort();
    const recoContents = recovered.data.character_book!.entries
      .map((e) => e.content).sort();
    expect(recoContents).toEqual(origContents);
  });

  test('export JSON includes re-attached book', async () => {
    const imported = await importCharacter(seraphinaPng, 'image/png');
    const { card } = exportCharacterJson(imported.id);

    expect(card.spec).toBe('chara_card_v2');
    expect(card.data.character_book?.entries).toHaveLength(4);
  });

  test('JSON file import (no avatar)', async () => {
    const original = toV2(readCard(seraphinaPng));
    const json = JSON.stringify(original);
    const result = await importCharacter(
      new TextEncoder().encode(json),
      'application/json',
    );

    expect(result.name).toBe('Seraphina');
    const full = getCharacterFull(result.id)!;
    expect(full.avatar_url).toBeNull();
  });
});

describe('character CRUD', () => {
  test('listCharacters with filters and sort', async () => {
    await createCharacter({ data: { name: 'Zelda' } });
    await createCharacter({ data: { name: 'Alice' } });
    const bob = await createCharacter({ data: { name: 'Bob' } });
    updateCharacter(bob.id, { fav: true });

    const byName = listCharacters({ sort: 'name' });
    expect(byName.items.map((c) => c.name)).toEqual(['Alice', 'Bob', 'Zelda']);
    expect(byName.total).toBe(3);

    const favOnly = listCharacters({ fav: true });
    expect(favOnly.items.map((c) => c.name)).toEqual(['Bob']);

    const search = listCharacters({ q: 'ali' });
    expect(search.items.map((c) => c.name)).toEqual(['Alice']);
  });

  test('updateCharacter shallow-merges data, sub-merges extensions', async () => {
    const c = await createCharacter({
      data: {
        name: 'Patch',
        description: 'old desc',
        extensions: { foo: 1, bar: 2 } as any,
      },
    });

    updateCharacter(c.id, {
      data: { description: 'new desc', extensions: { bar: 99, baz: 3 } as any },
    });

    const full = getCharacterFull(c.id)!;
    expect(full.data.name).toBe('Patch'); // untouched
    expect(full.data.description).toBe('new desc'); // replaced
    // extensions sub-merged: foo kept, bar replaced, baz added.
    expect(full.data.extensions).toEqual({ foo: 1, bar: 99, baz: 3 });
  });

  test('deleteCharacter cascades chats and lorebook bindings', async () => {
    const imported = await importCharacter(seraphinaPng, 'image/png');
    const chat = createChat({ character_id: imported.id });
    createMessage(chat.id, { role: 'user', content: 'hello' });

    expect(listChats({ characterId: imported.id })).toHaveLength(1);
    expect(getBindingsForCharacter(imported.id)).toHaveLength(1);

    deleteCharacter(imported.id);

    expect(listChats({ characterId: imported.id })).toHaveLength(0);
    expect(getBindingsForCharacter(imported.id)).toHaveLength(0);
    // Messages cascaded via the chat cascade.
    const msgCount = getDb()
      .query<{ n: number }, []>('SELECT COUNT(*) AS n FROM messages')
      .get()!.n;
    expect(msgCount).toBe(0);
  });
});

describe('FTS5 search', () => {
  test('finds messages by content', async () => {
    const c = await createCharacter({ data: { name: 'Searchable' } });
    const chat = createChat({ character_id: c.id });

    createMessage(chat.id, { role: 'user', content: 'The quick brown fox' });
    createMessage(chat.id, { role: 'assistant', content: 'jumped over the lazy dog' });
    createMessage(chat.id, { role: 'user', content: 'unrelated text here' });

    const hits = searchChats('quick');
    expect(hits).toHaveLength(1);
    expect(hits[0]!.snippet).toContain('<mark>quick</mark>');
    expect(hits[0]!.chat_id).toBe(chat.id);
  });

  test('user input with FTS5 operators does not blow up', () => {
    // Quoting in searchChats() escapes these so MATCH parsing succeeds.
    expect(() => searchChats('AND OR NOT')).not.toThrow();
    expect(() => searchChats('foo "bar')).not.toThrow();
    expect(() => searchChats('-prefix*')).not.toThrow();
  });
});
