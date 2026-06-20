import { getDb } from '../db/index.ts';

// K/V settings. Backend-relevant prefs only — UI state lives in localStorage.

export function getSetting<T = unknown>(key: string): T | null {
  const row = getDb()
    .query<{ value: string }, [string]>('SELECT value FROM settings WHERE key = ?')
    .get(key);
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return row.value as T;
  }
}

export function getAllSettings(): Record<string, unknown> {
  const rows = getDb()
    .query<{ key: string; value: string }, []>('SELECT key, value FROM settings')
    .all();
  const out: Record<string, unknown> = {};
  for (const r of rows) {
    try {
      out[r.key] = JSON.parse(r.value);
    } catch {
      out[r.key] = r.value;
    }
  }
  return out;
}

export function setSetting(key: string, value: unknown): void {
  getDb()
    .query(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, unixepoch())
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()`,
    )
    .run(key, JSON.stringify(value));
}

export function patchSettings(patch: Record<string, unknown>): void {
  const db = getDb();
  const stmt = db.query(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, unixepoch())
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()`,
  );
  db.transaction(() => {
    for (const [k, v] of Object.entries(patch)) stmt.run(k, JSON.stringify(v));
  })();
}
