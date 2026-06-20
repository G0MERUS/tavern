import { nanoid } from 'nanoid';
import { getDb } from '../db/index.ts';
import type { PresetRow } from '../types.ts';
import { NotFound } from '../types.ts';

// Sampling parameters. No connection_id FK: temperature: 0.8 means the same
// thing on every backend, so one preset applies to many connections.

export function listPresets(): PresetRow[] {
  return getDb()
    .query<PresetRow, []>('SELECT * FROM presets ORDER BY name COLLATE NOCASE')
    .all();
}

export function getPreset(id: string): PresetRow | null {
  return (
    getDb()
      .query<PresetRow, [string]>('SELECT * FROM presets WHERE id = ?')
      .get(id) ?? null
  );
}

export function createPreset(name: string, params: Record<string, unknown>): PresetRow {
  const id = nanoid(12);
  getDb()
    .query('INSERT INTO presets (id, name, params) VALUES (?, ?, ?)')
    .run(id, name, JSON.stringify(params));
  return getPreset(id)!;
}

export function updatePreset(
  id: string,
  patch: { name?: string; params?: Record<string, unknown> },
): PresetRow {
  const existing = getPreset(id);
  if (!existing) throw NotFound('Preset');

  const fields: string[] = ['updated_at = unixepoch()'];
  const values: string[] = [];
  if (patch.name !== undefined) {
    fields.push('name = ?');
    values.push(patch.name);
  }
  if (patch.params !== undefined) {
    fields.push('params = ?');
    values.push(JSON.stringify(patch.params));
  }

  getDb()
    .query(`UPDATE presets SET ${fields.join(', ')} WHERE id = ?`)
    .run(...values, id);

  return getPreset(id)!;
}

export function deletePreset(id: string): void {
  if (!getPreset(id)) throw NotFound('Preset');
  getDb().query('DELETE FROM presets WHERE id = ?').run(id);
}
