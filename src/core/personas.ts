import { nanoid } from 'nanoid';
import { getDb, transaction } from '../db/index.ts';
import { deleteBlob } from '../files/blobs.ts';
import type { PersonaRow } from '../types.ts';
import { NotFound } from '../types.ts';

// User identities. One of is_default is true at any given time.

export function listPersonas(): PersonaRow[] {
  return getDb()
    .query<PersonaRow, []>('SELECT * FROM personas ORDER BY is_default DESC, name COLLATE NOCASE')
    .all();
}

export function getPersona(id: string): PersonaRow | null {
  return (
    getDb()
      .query<PersonaRow, [string]>('SELECT * FROM personas WHERE id = ?')
      .get(id) ?? null
  );
}

export function createPersona(input: {
  name: string;
  description?: string;
  avatar_blob?: string | null;
}): PersonaRow {
  const id = nanoid(12);
  getDb()
    .query(
      'INSERT INTO personas (id, name, description, avatar_blob) VALUES (?, ?, ?, ?)',
    )
    .run(id, input.name, input.description ?? '', input.avatar_blob ?? null);
  return getPersona(id)!;
}

export function updatePersona(
  id: string,
  patch: {
    name?: string;
    description?: string;
    avatar_blob?: string | null;
    is_default?: boolean;
  },
): PersonaRow {
  const existing = getPersona(id);
  if (!existing) throw NotFound('Persona');

  return transaction(() => {
    // is_default is exclusive.
    if (patch.is_default === true) {
      getDb().query('UPDATE personas SET is_default = 0 WHERE is_default = 1').run();
    }

    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    if (patch.name !== undefined) {
      fields.push('name = ?');
      values.push(patch.name);
    }
    if (patch.description !== undefined) {
      fields.push('description = ?');
      values.push(patch.description);
    }
    if (patch.avatar_blob !== undefined) {
      fields.push('avatar_blob = ?');
      values.push(patch.avatar_blob);
      if (existing.avatar_blob && existing.avatar_blob !== patch.avatar_blob) {
        deleteBlob('avatars', existing.avatar_blob);
      }
    }
    if (patch.is_default !== undefined) {
      fields.push('is_default = ?');
      values.push(patch.is_default ? 1 : 0);
    }

    if (fields.length > 0) {
      getDb()
        .query(`UPDATE personas SET ${fields.join(', ')} WHERE id = ?`)
        .run(...values, id);
    }

    return getPersona(id)!;
  });
}

export function deletePersona(id: string): void {
  const existing = getPersona(id);
  if (!existing) throw NotFound('Persona');
  getDb().query('DELETE FROM personas WHERE id = ?').run(id);
  deleteBlob('avatars', existing.avatar_blob);
}
