import { nanoid } from 'nanoid';
import { getDb, transaction } from '../db/index.ts';
import { setSetting } from './settings.ts';
import { getProvider } from '../llm/catalog.ts';
import type { ConnectionRow, ConnectionKind } from '../types.ts';
import { NotFound, AppError } from '../types.ts';

// LLM endpoint profiles. base_url + api_key + model — that's a connection.
// extra_headers and extra_body are per-connection escape hatches.

export interface ConnectionInput {
  label: string;
  kind?: ConnectionKind;
  base_url: string;
  api_key?: string;
  model: string;
  extra_headers?: Record<string, string>;
  extra_body?: Record<string, unknown>;
}

export function listConnections(): ConnectionRow[] {
  return getDb()
    .query<ConnectionRow, []>('SELECT * FROM connections ORDER BY created_at DESC')
    .all();
}

export function getConnection(id: string): ConnectionRow | null {
  return (
    getDb()
      .query<ConnectionRow, [string]>('SELECT * FROM connections WHERE id = ?')
      .get(id) ?? null
  );
}

export function getActive(): ConnectionRow | null {
  return (
    getDb()
      .query<ConnectionRow, []>('SELECT * FROM connections WHERE is_active = 1 LIMIT 1')
      .get() ?? null
  );
}

export function createConnection(input: ConnectionInput): ConnectionRow {
  const id = nanoid(12);
  getDb()
    .query(
      `INSERT INTO connections (id, label, kind, base_url, api_key, model, extra_headers, extra_body)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.label,
      input.kind ?? 'openai',
      input.base_url,
      input.api_key ?? '',
      input.model,
      JSON.stringify(input.extra_headers ?? {}),
      JSON.stringify(input.extra_body ?? {}),
    );
  return getConnection(id)!;
}

/**
 * Create a connection pre-filled from a catalog provider. Not idempotent —
 * two calls produce two rows, which is what we want since users routinely
 * keep multiple connections to the same provider with different keys.
 */
export function createFromCatalog(
  providerId: string,
  opts: { label?: string; api_key?: string } = {},
): ConnectionRow {
  const p = getProvider(providerId);
  if (!p) {
    throw new AppError('UNKNOWN_PROVIDER', `Provider '${providerId}' is not in the catalog`, 400);
  }
  return createConnection({
    label: opts.label ?? p.name,
    kind: p.kind,
    base_url: p.base_url,
    api_key: opts.api_key,
    model: p.models[0]?.id ?? '',
  });
}

export function updateConnection(id: string, patch: Partial<ConnectionInput>): ConnectionRow {
  const existing = getConnection(id);
  if (!existing) throw NotFound('Connection');

  const fields: string[] = [];
  const values: (string | number)[] = [];
  if (patch.label !== undefined) {
    fields.push('label = ?');
    values.push(patch.label);
  }
  if (patch.kind !== undefined) {
    fields.push('kind = ?');
    values.push(patch.kind);
  }
  if (patch.base_url !== undefined) {
    fields.push('base_url = ?');
    values.push(patch.base_url);
  }
  if (patch.api_key !== undefined) {
    fields.push('api_key = ?');
    values.push(patch.api_key);
  }
  if (patch.model !== undefined) {
    fields.push('model = ?');
    values.push(patch.model);
  }
  if (patch.extra_headers !== undefined) {
    fields.push('extra_headers = ?');
    values.push(JSON.stringify(patch.extra_headers));
  }
  if (patch.extra_body !== undefined) {
    fields.push('extra_body = ?');
    values.push(JSON.stringify(patch.extra_body));
  }

  if (fields.length > 0) {
    getDb()
      .query(`UPDATE connections SET ${fields.join(', ')} WHERE id = ?`)
      .run(...values, id);
  }

  return getConnection(id)!;
}

export function deleteConnection(id: string): void {
  const existing = getConnection(id);
  if (!existing) throw NotFound('Connection');
  getDb().query('DELETE FROM connections WHERE id = ?').run(id);
  // Clear the setting if we just deleted the active connection.
  if (existing.is_active) {
    setSetting('active_connection_id', null);
  }
}

/** Make this the one active connection. Clears the flag on all others. */
export function activateConnection(id: string): ConnectionRow {
  const existing = getConnection(id);
  if (!existing) throw NotFound('Connection');

  transaction(() => {
    getDb().query('UPDATE connections SET is_active = 0 WHERE is_active = 1').run();
    getDb().query('UPDATE connections SET is_active = 1 WHERE id = ?').run(id);
    setSetting('active_connection_id', id);
  });

  return getConnection(id)!;
}
