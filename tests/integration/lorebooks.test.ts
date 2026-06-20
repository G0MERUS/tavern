import { describe, test, expect, beforeEach, afterEach } from 'vitest';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { setupDb, teardownDb, FIXTURES } from '../setup.ts';
import {
  importLorebook,
  getLorebookWithEntries,
  createLorebook,
  updateLorebook,
  deleteLorebook,
  createEntry,
  updateEntry,
  deleteEntry,
  setCharacterBindings,
  getBindingsForCharacter,
} from '../../src/core/lorebooks.ts';
import { createCharacter } from '../../src/core/characters.ts';
import { getDb } from '../../src/db/index.ts';

// ST world-info JSON uses different field names than the V2 character_book
// spec: `key`/`keysecondary`/`disable`, numeric position values, entries
// keyed by stringified int instead of an array. Eldoria.json is a real
// 4-entry world from ST's default content — if this imports cleanly the
// field-mapper works.

const eldoria = JSON.parse(readFileSync(join(FIXTURES, 'eldoria.json'), 'utf8'));

beforeEach(setupDb);
afterEach(teardownDb);

describe('importLorebook — Eldoria (real ST world-info JSON)', () => {
  test('keyed-object entries shape is unwrapped to a list', () => {
    // Sanity: the fixture really is the legacy shape.
    expect(Array.isArray(eldoria.entries)).toBe(false);
    expect(Object.keys(eldoria.entries)).toEqual(['0', '1', '2', '3']);

    const book = importLorebook('Eldoria', eldoria);
    const full = getLorebookWithEntries(book.id)!;
    expect(full.entries).toHaveLength(4);
  });

  test('field-name remapping: key → keys, disable → enabled, order → insertion_order', () => {
    const book = importLorebook('Eldoria', eldoria);
    const full = getLorebookWithEntries(book.id)!;

    // Pull entries by comment for stable ordering (insertion_order is all 100).
    const byComment = Object.fromEntries(full.entries.map((e) => [e.comment, e]));

    const e0 = byComment['eldoria']!;
    expect(JSON.parse(e0.keys)).toEqual(['eldoria', 'wood', 'forest', 'magical forest']);
    expect(JSON.parse(e0.secondary_keys)).toEqual([]);
    expect(e0.enabled).toBe(1);
    expect(e0.constant).toBe(0);
    expect(e0.selective).toBe(1);
    expect(e0.insertion_order).toBe(100);
    expect(e0.content).toContain('Eldoria');

    const e1 = byComment['shadowfang']!;
    expect(JSON.parse(e1.keys)).toEqual(['shadowfang', 'beast', 'monster', 'monsters', 'beasts']);

    expect(JSON.parse(byComment['glade']!.keys)).toEqual(['glade', 'safe haven', 'refuge']);
    expect(JSON.parse(byComment['power']!.keys)).toEqual(['power', 'magic', 'ability']);
  });

  test('numeric position 0 → before_char (regression)', () => {
    // Eldoria has position=0 on every entry. Before the fix, the importer
    // only checked for the string 'after_char' — numeric 0 fell through to
    // before_char by accident.
    const book = importLorebook('Eldoria', eldoria);
    const full = getLorebookWithEntries(book.id)!;
    expect(full.entries.every((e) => e.position === 'before_char')).toBe(true);
  });

  test('numeric position 1 → after_char', () => {
    const tweaked = {
      entries: { '0': { ...eldoria.entries['0'], position: 1 } },
    };
    const book = importLorebook('Tweaked', tweaked);
    const full = getLorebookWithEntries(book.id)!;
    expect(full.entries[0]!.position).toBe('after_char');
  });

  test('caseSensitive: null is falsy (does not throw, does not enable)', () => {
    // Eldoria has caseSensitive: null on entry 0 — the === true check handles it.
    const book = importLorebook('Eldoria', eldoria);
    const full = getLorebookWithEntries(book.id)!;
    expect(full.entries[0]!.case_sensitive).toBe(0);
  });

  test('disable: true → enabled: 0', () => {
    const tweaked = {
      entries: { '0': { ...eldoria.entries['0'], disable: true } },
    };
    const book = importLorebook('Disabled', tweaked);
    expect(getLorebookWithEntries(book.id)!.entries[0]!.enabled).toBe(0);
  });

  test('content survives byte-for-byte', () => {
    const book = importLorebook('Eldoria', eldoria);
    const full = getLorebookWithEntries(book.id)!;

    const sourceContents = Object.values(eldoria.entries)
      .map((e: any) => e.content)
      .sort();
    const importedContents = full.entries.map((e) => e.content).sort();
    expect(importedContents).toEqual(sourceContents);
  });
});

describe('importLorebook — V2 array-shape entries', () => {
  test('handles spec-compliant CharacterBook shape (entries as array)', () => {
    const v2book = {
      name: 'V2 Book',
      description: 'desc',
      scan_depth: 8,
      token_budget: 1000,
      recursive_scanning: true,
      entries: [
        {
          keys: ['alpha', 'beta'],
          secondary_keys: ['gamma'],
          content: 'entry one content',
          comment: 'first',
          enabled: true,
          constant: true,
          selective: false,
          case_sensitive: true,
          position: 'after_char',
          insertion_order: 50,
          priority: 200,
        },
      ],
    };

    const book = importLorebook('V2', v2book);
    const full = getLorebookWithEntries(book.id)!;

    expect(full.name).toBe('V2 Book');
    expect(full.scan_depth).toBe(8);
    expect(full.token_budget).toBe(1000);
    expect(full.recursive).toBe(1);
    expect(full.entries).toHaveLength(1);

    const e = full.entries[0]!;
    expect(JSON.parse(e.keys)).toEqual(['alpha', 'beta']);
    expect(JSON.parse(e.secondary_keys)).toEqual(['gamma']);
    expect(e.constant).toBe(1);
    expect(e.case_sensitive).toBe(1);
    expect(e.position).toBe('after_char');
    expect(e.insertion_order).toBe(50);
    expect(e.priority).toBe(200);
  });

  test('rejects garbage', () => {
    expect(() => importLorebook('x', null)).toThrow(/object/);
    expect(() => importLorebook('x', 'string')).toThrow(/object/);
    expect(() => importLorebook('x', {})).toThrow(/entries/);
    expect(() => importLorebook('x', { entries: 'wat' })).toThrow(/entries/);
  });
});

describe('lorebook CRUD', () => {
  test('updateLorebook patches fields', () => {
    const book = createLorebook({ name: 'Before', scan_depth: 4 });
    updateLorebook(book.id, { name: 'After', scan_depth: 10, recursive: true });

    const updated = getLorebookWithEntries(book.id)!;
    expect(updated.name).toBe('After');
    expect(updated.scan_depth).toBe(10);
    expect(updated.recursive).toBe(1);
    expect(updated.token_budget).toBe(500); // untouched
  });

  test('deleteLorebook cascades entries', () => {
    const book = importLorebook('Eldoria', eldoria);
    expect(getLorebookWithEntries(book.id)!.entries).toHaveLength(4);

    deleteLorebook(book.id);

    const orphans = getDb()
      .query<{ n: number }, [string]>('SELECT COUNT(*) AS n FROM lorebook_entries WHERE lorebook_id = ?')
      .get(book.id)!.n;
    expect(orphans).toBe(0);
  });

  test('entry CRUD: create, update, delete', () => {
    const book = createLorebook({ name: 'Editable' });

    const entry = createEntry(book.id, {
      keys: ['initial'],
      content: 'before',
      comment: 'test entry',
    });
    expect(JSON.parse(entry.keys)).toEqual(['initial']);

    updateEntry(entry.id, { keys: ['changed', 'added'], content: 'after' });
    const updated = getLorebookWithEntries(book.id)!.entries[0]!;
    expect(JSON.parse(updated.keys)).toEqual(['changed', 'added']);
    expect(updated.content).toBe('after');
    expect(updated.comment).toBe('test entry'); // untouched

    deleteEntry(entry.id);
    expect(getLorebookWithEntries(book.id)!.entries).toHaveLength(0);
  });
});

describe('lorebook bindings', () => {
  test('setCharacterBindings is full-replace', async () => {
    const char = await createCharacter({ data: { name: 'Bound' } });
    const a = createLorebook({ name: 'A' });
    const b = createLorebook({ name: 'B' });
    const c = createLorebook({ name: 'C' });

    setCharacterBindings(char.id, [a.id, b.id]);
    expect(getBindingsForCharacter(char.id).sort()).toEqual([a.id, b.id].sort());

    setCharacterBindings(char.id, [c.id]);
    expect(getBindingsForCharacter(char.id)).toEqual([c.id]);

    setCharacterBindings(char.id, []);
    expect(getBindingsForCharacter(char.id)).toEqual([]);
  });

  test('setCharacterBindings idempotent on identical input', async () => {
    // Delete-then-insert pattern means no UNIQUE collision possible.
    const char = await createCharacter({ data: { name: 'X' } });
    const book = createLorebook({ name: 'Y' });

    setCharacterBindings(char.id, [book.id]);
    setCharacterBindings(char.id, [book.id]);
    expect(getBindingsForCharacter(char.id)).toEqual([book.id]);
  });

  test('deleteLorebook cascades bindings', async () => {
    const char = await createCharacter({ data: { name: 'X' } });
    const book = createLorebook({ name: 'Y' });
    setCharacterBindings(char.id, [book.id]);

    deleteLorebook(book.id);
    expect(getBindingsForCharacter(char.id)).toEqual([]);
  });
});
