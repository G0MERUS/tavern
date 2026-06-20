import { nanoid } from 'nanoid';
import { getDb, transaction } from '../db/index.ts';
import type {
  LorebookRow,
  LorebookEntryRow,
  CharacterBook,
  CharacterBookEntry,
} from '../types.ts';
import { NotFound, AppError } from '../types.ts';

// World Info. Embedded character_books are extracted on import with
// source='character:<id>' and re-embedded into the PNG on export, so they
// become editable in the lorebook UI like any standalone book.

export function listLorebooks(): LorebookRow[] {
  return getDb()
    .query<LorebookRow, []>('SELECT * FROM lorebooks ORDER BY name COLLATE NOCASE')
    .all();
}

export function getLorebook(id: string): LorebookRow | null {
  return (
    getDb()
      .query<LorebookRow, [string]>('SELECT * FROM lorebooks WHERE id = ?')
      .get(id) ?? null
  );
}

export function getLorebookWithEntries(
  id: string,
): (LorebookRow & { entries: LorebookEntryRow[] }) | null {
  const book = getLorebook(id);
  if (!book) return null;
  const entries = getDb()
    .query<LorebookEntryRow, [string]>(
      'SELECT * FROM lorebook_entries WHERE lorebook_id = ? ORDER BY insertion_order, rowid',
    )
    .all(id);
  return { ...book, entries };
}

export interface LorebookInput {
  name: string;
  description?: string;
  scan_depth?: number;
  token_budget?: number;
  recursive?: boolean;
  source?: string | null;
}

export function createLorebook(input: LorebookInput): LorebookRow {
  const id = nanoid(12);
  getDb()
    .query(
      `INSERT INTO lorebooks (id, name, description, scan_depth, token_budget, recursive, source)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.name,
      input.description ?? '',
      input.scan_depth ?? 4,
      input.token_budget ?? 500,
      input.recursive ? 1 : 0,
      input.source ?? null,
    );
  return getLorebook(id)!;
}

export function updateLorebook(id: string, patch: Partial<LorebookInput>): LorebookRow {
  if (!getLorebook(id)) throw NotFound('Lorebook');

  const fields: string[] = ['updated_at = unixepoch()'];
  const values: (string | number | null)[] = [];
  const map: Record<string, (v: any) => string | number | null> = {
    name: (v) => v,
    description: (v) => v,
    scan_depth: (v) => v,
    token_budget: (v) => v,
    recursive: (v) => (v ? 1 : 0),
    source: (v) => v,
  };
  for (const [k, conv] of Object.entries(map)) {
    if (k in patch && (patch as any)[k] !== undefined) {
      fields.push(`${k} = ?`);
      values.push(conv((patch as any)[k]));
    }
  }

  getDb()
    .query(`UPDATE lorebooks SET ${fields.join(', ')} WHERE id = ?`)
    .run(...values, id);
  return getLorebook(id)!;
}

export function deleteLorebook(id: string): void {
  if (!getLorebook(id)) throw NotFound('Lorebook');
  // entries + bindings cascade.
  getDb().query('DELETE FROM lorebooks WHERE id = ?').run(id);
}

export interface EntryInput {
  keys?: string[];
  secondary_keys?: string[];
  content: string;
  comment?: string;
  enabled?: boolean;
  constant?: boolean;
  selective?: boolean;
  case_sensitive?: boolean;
  position?: 'before_char' | 'after_char' | 'at_depth';
  depth?: number | null;
  insertion_order?: number;
  priority?: number;
  extensions?: Record<string, unknown>;
}

export function getEntry(id: string): LorebookEntryRow | null {
  return (
    getDb()
      .query<LorebookEntryRow, [string]>('SELECT * FROM lorebook_entries WHERE id = ?')
      .get(id) ?? null
  );
}

export function createEntry(lorebookId: string, input: EntryInput): LorebookEntryRow {
  if (!getLorebook(lorebookId)) throw NotFound('Lorebook');
  const id = nanoid(12);
  getDb()
    .query(
      `INSERT INTO lorebook_entries
       (id, lorebook_id, keys, secondary_keys, content, comment, enabled, constant,
        selective, case_sensitive, position, depth, insertion_order, priority, extensions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      lorebookId,
      JSON.stringify(input.keys ?? []),
      JSON.stringify(input.secondary_keys ?? []),
      input.content,
      input.comment ?? '',
      input.enabled === false ? 0 : 1,
      input.constant ? 1 : 0,
      input.selective ? 1 : 0,
      input.case_sensitive ? 1 : 0,
      input.position ?? 'before_char',
      input.depth ?? null,
      input.insertion_order ?? 100,
      input.priority ?? 100,
      JSON.stringify(input.extensions ?? {}),
    );
  return getEntry(id)!;
}

export function updateEntry(id: string, patch: Partial<EntryInput>): LorebookEntryRow {
  if (!getEntry(id)) throw NotFound('Lorebook entry');

  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  const set = (col: string, val: string | number | null) => {
    fields.push(`${col} = ?`);
    values.push(val);
  };

  if (patch.keys !== undefined) set('keys', JSON.stringify(patch.keys));
  if (patch.secondary_keys !== undefined) set('secondary_keys', JSON.stringify(patch.secondary_keys));
  if (patch.content !== undefined) set('content', patch.content);
  if (patch.comment !== undefined) set('comment', patch.comment);
  if (patch.enabled !== undefined) set('enabled', patch.enabled ? 1 : 0);
  if (patch.constant !== undefined) set('constant', patch.constant ? 1 : 0);
  if (patch.selective !== undefined) set('selective', patch.selective ? 1 : 0);
  if (patch.case_sensitive !== undefined) set('case_sensitive', patch.case_sensitive ? 1 : 0);
  if (patch.position !== undefined) set('position', patch.position);
  if (patch.depth !== undefined) set('depth', patch.depth);
  if (patch.insertion_order !== undefined) set('insertion_order', patch.insertion_order);
  if (patch.priority !== undefined) set('priority', patch.priority);
  if (patch.extensions !== undefined) set('extensions', JSON.stringify(patch.extensions));

  if (fields.length > 0) {
    getDb()
      .query(`UPDATE lorebook_entries SET ${fields.join(', ')} WHERE id = ?`)
      .run(...values, id);
  }
  return getEntry(id)!;
}

export function deleteEntry(id: string): void {
  if (!getEntry(id)) throw NotFound('Lorebook entry');
  getDb().query('DELETE FROM lorebook_entries WHERE id = ?').run(id);
}

export function getBindingsForCharacter(characterId: string): string[] {
  return getDb()
    .query<{ lorebook_id: string }, [string]>(
      'SELECT lorebook_id FROM lorebook_bindings WHERE character_id = ?',
    )
    .all(characterId)
    .map((r) => r.lorebook_id);
}

export function getBindingsForGroup(groupId: string): string[] {
  return getDb()
    .query<{ lorebook_id: string }, [string]>(
      'SELECT lorebook_id FROM lorebook_bindings WHERE group_id = ?',
    )
    .all(groupId)
    .map((r) => r.lorebook_id);
}

/** Full replace of bindings for a character. */
export function setCharacterBindings(characterId: string, lorebookIds: string[]): void {
  transaction(() => {
    const db = getDb();
    db.query('DELETE FROM lorebook_bindings WHERE character_id = ?').run(characterId);
    const ins = db.query(
      'INSERT INTO lorebook_bindings (lorebook_id, character_id) VALUES (?, ?)',
    );
    for (const lid of lorebookIds) ins.run(lid, characterId);
  });
}

export function setGroupBindings(groupId: string, lorebookIds: string[]): void {
  transaction(() => {
    const db = getDb();
    db.query('DELETE FROM lorebook_bindings WHERE group_id = ?').run(groupId);
    const ins = db.query(
      'INSERT INTO lorebook_bindings (lorebook_id, group_id) VALUES (?, ?)',
    );
    for (const lid of lorebookIds) ins.run(lid, groupId);
  });
}

/**
 * Pull a CharacterBook out of imported card data and turn it into a lorebook
 * + entries + binding. Returns the new lorebook id. Caller wraps in a
 * transaction.
 */
export function extractCharacterBook(
  characterId: string,
  characterName: string,
  book: CharacterBook,
): string {
  const lorebook = createLorebook({
    name: book.name || `${characterName}'s Lorebook`,
    description: book.description ?? '',
    scan_depth: book.scan_depth ?? 4,
    token_budget: book.token_budget ?? 500,
    recursive: book.recursive_scanning ?? false,
    source: `character:${characterId}`,
  });

  for (const e of book.entries ?? []) {
    // V2 spec only allows before_char/after_char; some cards in the wild
    // have null/undefined — default to before_char.
    const pos =
      e.position === 'after_char' || e.position === 'before_char' ? e.position : 'before_char';

    createEntry(lorebook.id, {
      keys: Array.isArray(e.keys) ? e.keys : [],
      secondary_keys: Array.isArray(e.secondary_keys) ? e.secondary_keys : [],
      content: e.content ?? '',
      comment: e.comment ?? e.name ?? '',
      enabled: e.enabled !== false,
      constant: !!e.constant,
      selective: !!e.selective,
      case_sensitive: !!e.case_sensitive,
      position: pos,
      insertion_order: e.insertion_order ?? 100,
      priority: e.priority ?? 100,
      extensions: e.extensions ?? {},
    });
  }

  getDb()
    .query('INSERT INTO lorebook_bindings (lorebook_id, character_id) VALUES (?, ?)')
    .run(lorebook.id, characterId);

  return lorebook.id;
}

/**
 * Rebuild a CharacterBook for export. Only books that came from this
 * character (source='character:<id>') get re-embedded; standalone books the
 * user bound separately stay separate.
 */
export function reconstructCharacterBook(characterId: string): CharacterBook | undefined {
  const book = getDb()
    .query<LorebookRow, [string]>('SELECT * FROM lorebooks WHERE source = ? LIMIT 1')
    .get(`character:${characterId}`);
  if (!book) return undefined;

  const entries = getDb()
    .query<LorebookEntryRow, [string]>(
      'SELECT * FROM lorebook_entries WHERE lorebook_id = ? ORDER BY insertion_order, rowid',
    )
    .all(book.id);

  const out: CharacterBook = {
    name: book.name,
    description: book.description,
    scan_depth: book.scan_depth,
    token_budget: book.token_budget,
    recursive_scanning: !!book.recursive,
    extensions: {},
    entries: entries.map(
      (e, i): CharacterBookEntry => ({
        id: i,
        keys: JSON.parse(e.keys),
        secondary_keys: JSON.parse(e.secondary_keys),
        content: e.content,
        comment: e.comment,
        enabled: !!e.enabled,
        constant: !!e.constant,
        selective: !!e.selective,
        case_sensitive: !!e.case_sensitive,
        // V2 spec has no at_depth — collapse to before_char on export.
        position: e.position === 'after_char' ? 'after_char' : 'before_char',
        insertion_order: e.insertion_order,
        priority: e.priority,
        extensions: JSON.parse(e.extensions),
      }),
    ),
  };

  return out;
}

/**
 * Import a lorebook from a SillyTavern-format world info JSON.
 * Handles both spec-V2 CharacterBook shape and the legacy ST `entries` keyed-
 * by-stringified-int shape.
 */
export function importLorebook(name: string, raw: unknown): LorebookRow {
  if (!raw || typeof raw !== 'object') {
    throw new AppError('INVALID_LOREBOOK', 'Lorebook data must be an object', 400);
  }
  const data = raw as Record<string, unknown>;

  let entries: unknown[] = [];
  const e = data['entries'];
  if (Array.isArray(e)) {
    entries = e;
  } else if (e && typeof e === 'object') {
    // ST legacy: { "0": {...}, "1": {...} }
    entries = Object.values(e);
  } else {
    throw new AppError('INVALID_LOREBOOK', 'Lorebook must contain an entries list', 400);
  }

  return transaction(() => {
    const book = createLorebook({
      name: typeof data['name'] === 'string' ? data['name'] : name,
      description: typeof data['description'] === 'string' ? data['description'] : '',
      scan_depth: typeof data['scan_depth'] === 'number' ? data['scan_depth'] : 4,
      token_budget: typeof data['token_budget'] === 'number' ? data['token_budget'] : 500,
      recursive:
        data['recursive_scanning'] === true || data['recursive'] === true,
      source: 'standalone',
    });

    for (const ent of entries) {
      if (!ent || typeof ent !== 'object') continue;
      const x = ent as Record<string, unknown>;

      // ST legacy uses `key`/`keysecondary`/`disable` instead of V2 names.
      const keys = Array.isArray(x['keys']) ? x['keys'] : Array.isArray(x['key']) ? x['key'] : [];
      const skeys = Array.isArray(x['secondary_keys'])
        ? x['secondary_keys']
        : Array.isArray(x['keysecondary'])
          ? x['keysecondary']
          : [];
      const enabled = x['enabled'] !== false && x['disable'] !== true;

      // ST world-info uses numeric position: 0=before_char, 1=after_char,
      // 2-4=author's-note variants we collapse to before. V2 spec uses
      // strings. (Covered by tests/integration/lorebooks.test.ts on the
      // Eldoria fixture.)
      const rawPos = x['position'];
      const position =
        rawPos === 'after_char' || rawPos === 1 ? 'after_char' : 'before_char';

      createEntry(book.id, {
        keys: keys.filter((k): k is string => typeof k === 'string'),
        secondary_keys: skeys.filter((k): k is string => typeof k === 'string'),
        content: typeof x['content'] === 'string' ? x['content'] : '',
        comment: typeof x['comment'] === 'string' ? x['comment'] : '',
        enabled,
        constant: x['constant'] === true,
        selective: x['selective'] === true,
        case_sensitive: x['case_sensitive'] === true || x['caseSensitive'] === true,
        position,
        insertion_order:
          typeof x['insertion_order'] === 'number'
            ? x['insertion_order']
            : typeof x['order'] === 'number'
              ? x['order']
              : 100,
        priority: typeof x['priority'] === 'number' ? x['priority'] : 100,
        extensions: typeof x['extensions'] === 'object' && x['extensions'] ? (x['extensions'] as Record<string, unknown>) : {},
      });
    }

    return book;
  });
}
