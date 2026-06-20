import { nanoid } from 'nanoid';
import { getDb } from '../db/index.ts';
import type { ThemeRow } from '../types.ts';
import { NotFound, AppError } from '../types.ts';

// UI themes. Mirrors presets.ts with one extra field (is_bundled) that
// blocks DELETE. PATCH on a bundled theme is allowed — the migration's
// INSERT OR IGNORE re-seeds on next boot for a fresh copy.

export function listThemes(): ThemeRow[] {
  return getDb()
    .query<ThemeRow, []>('SELECT * FROM themes ORDER BY is_bundled DESC, name COLLATE NOCASE')
    .all();
}

export function getTheme(id: string): ThemeRow | null {
  return (
    getDb()
      .query<ThemeRow, [string]>('SELECT * FROM themes WHERE id = ?')
      .get(id) ?? null
  );
}

export function createTheme(name: string, data: Record<string, unknown>): ThemeRow {
  const id = nanoid(12);
  getDb()
    .query('INSERT INTO themes (id, name, data) VALUES (?, ?, ?)')
    .run(id, name, JSON.stringify(data));
  return getTheme(id)!;
}

export function updateTheme(
  id: string,
  patch: { name?: string; data?: Record<string, unknown> },
): ThemeRow {
  const existing = getTheme(id);
  if (!existing) throw NotFound('Theme');

  const fields: string[] = ['updated_at = unixepoch()'];
  const values: string[] = [];
  if (patch.name !== undefined) {
    fields.push('name = ?');
    values.push(patch.name);
  }
  if (patch.data !== undefined) {
    fields.push('data = ?');
    values.push(JSON.stringify(patch.data));
  }

  getDb()
    .query(`UPDATE themes SET ${fields.join(', ')} WHERE id = ?`)
    .run(...values, id);

  return getTheme(id)!;
}

export function deleteTheme(id: string): void {
  const t = getTheme(id);
  if (!t) throw NotFound('Theme');
  if (t.is_bundled) {
    throw new AppError('THEME_BUNDLED', 'Cannot delete bundled theme', 400);
  }
  getDb().query('DELETE FROM themes WHERE id = ?').run(id);
}
